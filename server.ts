import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { testConnection, query } from "./src/lib/db.js";
import { initializeDatabase } from "./src/lib/init-db.js";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Initialize Database
await initializeDatabase();

// Round Robin Helper
async function getNextConsultant(agencyId: number) {
  const consultants = await query("SELECT id FROM users WHERE role = 'consultant' AND agency_id = $1", [agencyId]);
  if (consultants.rows.length === 0) return null;

  // Simple Round Robin: find consultant with fewest active processes
  const counts = await query(`
    SELECT u.id, COUNT(p.id) as proc_count
    FROM users u
    LEFT JOIN processes p ON u.id = p.consultant_id AND p.status != 'completed'
    WHERE u.role = 'consultant' AND u.agency_id = $1
    GROUP BY u.id
    ORDER BY proc_count ASC
    LIMIT 1
  `, [agencyId]);

  return counts.rows[0]?.id || consultants.rows[0].id;
}

async function getAuditUserId(agencyId?: number | string | null) {
  const parsedAgencyId = agencyId ? Number(agencyId) : null;

  if (parsedAgencyId) {
    const supervisor = await query(
      "SELECT id FROM users WHERE agency_id = $1 AND role = 'supervisor' LIMIT 1",
      [parsedAgencyId]
    );

    if (supervisor.rows[0]?.id) {
      return supervisor.rows[0].id;
    }
  }

  const master = await query(
    "SELECT id FROM users WHERE role = 'master' ORDER BY id ASC LIMIT 1",
    []
  );

  return master.rows[0]?.id || 1;
}

async function isFinanceModuleEnabledForAgency(agencyId?: number | string | null) {
  const parsedAgencyId = agencyId ? Number(agencyId) : null;
  if (!parsedAgencyId) return true;

  const agency = await query("SELECT modules FROM agencies WHERE id = $1", [parsedAgencyId]);
  if (!agency.rows[0]) return false;

  try {
    const modules = JSON.parse(agency.rows[0].modules || '{}');
    return Boolean(modules.finance);
  } catch {
    return false;
  }
}

async function startServer() {
  try {
    // Test database connection
    console.log('[BOOT] Iniciando servidor...');
    await testConnection();
    console.log('[BOOT] Ô£ô Banco de dados conectado com sucesso');
  } catch (dbError) {
    console.error('[BOOT] Ô£ù Falha na conex├úo com banco de dados');
    console.error('[BOOT] Configure a vari├ível DATABASE_URL antes de rodar o servidor');
    process.exit(1);
  }

  const app = express();
  const PORT = Number(process.env.PORT);
  if (!PORT) {
    console.error('[BOOT] PORT n├úo definida');
    throw new Error("PORT environment variable is required");
  }

  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  app.use((req, _res, next) => {
    if (req.url.startsWith('/xapi/')) {
      req.url = req.url.replace('/xapi/', '/api/');
    }
    next();
  });

  // API Routes
  app.post("/api/upload-logo", upload.single("logo"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const logoUrl = `/uploads/${req.file.filename}`;
    res.json({ url: logoUrl });
  });

  app.get("/api/test-db", async (req, res) => {
    try {
      const users = await query("SELECT email, role FROM users", []);
      res.json({ status: "ok", users: users.rows });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await query(`
        SELECT u.*, a.modules as agency_modules
        FROM users u
        LEFT JOIN agencies a ON u.agency_id = a.id
        WHERE LOWER(u.email) = LOWER($1) AND u.password = $2
      `, [email, password]);

      if (user.rows[0]) {
        const { password, ...userWithoutPassword } = user.rows[0];
        res.json(userWithoutPassword);
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/visa-types", async (req, res) => {
    const { agency_id } = req.query;
    try {
      const visas = await query("SELECT * FROM visa_types WHERE agency_id = $1", [agency_id]);
      res.json(visas.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/processes/start", async (req, res) => {
    try {
      const { client_id, agency_id, visa_type_id, destination_id, plan_id, is_dependent, parent_process_id, dependents, travel_date, form_responses } = req.body;

      if (!client_id || !agency_id) {
        return res.status(400).json({ error: "client_id and agency_id are required" });
      }

      const consultant_id = await getNextConsultant(agency_id);

      // Get price from plan if provided, otherwise from visa type
      let amount = 0;
      let planName = null;
      let visaTypeName = null;
      let destinationName = null;

      if (plan_id) {
        // Handle numeric ID or string ID (for default plans)
        if (typeof plan_id === 'number') {
          const planResult = await query("SELECT name, price FROM plans WHERE id = $1", [plan_id]);
          const plan = planResult.rows[0];
          if (plan) {
            amount = plan.price;
            planName = plan.name;
          }
        } else {
          // Fallback for default plans if not in DB
          if (plan_id === 'basic') { amount = 497; planName = 'Consultoria B├ísica'; }
          else if (plan_id === 'complete') { amount = 1497; planName = 'Consultoria Completa'; }
          else if (plan_id === 'premium') { amount = 2997; planName = 'Consultoria Premium'; }
        }
      }

      // Handle visa_type_id (can be numeric ID or string name/goal)
      let db_visa_type_id = typeof visa_type_id === 'number' ? visa_type_id : null;
      if (!db_visa_type_id && typeof visa_type_id === 'string') {
        const existingResult = await query("SELECT id, name, base_price FROM visa_types WHERE agency_id = $1 AND LOWER(name) = LOWER($2)", [agency_id, visa_type_id]);
        const existing = existingResult.rows[0];
        if (existing) {
          db_visa_type_id = existing.id;
          visaTypeName = existing.name;
          if (amount === 0) amount = existing.base_price;
        } else {
          // Use the string as name
          visaTypeName = visa_type_id.charAt(0).toUpperCase() + visa_type_id.slice(1);
        }
      } else if (db_visa_type_id) {
        const visaResult = await query("SELECT name, base_price FROM visa_types WHERE id = $1", [db_visa_type_id]);
        const visa = visaResult.rows[0];
        if (visa) {
          visaTypeName = visa.name;
          if (amount === 0) amount = visa.base_price;
        }
      }

      // Handle destination_id
      let db_destination_id = typeof destination_id === 'number' ? destination_id : null;
      if (db_destination_id) {
        const destResult = await query("SELECT name FROM destinations WHERE id = $1", [db_destination_id]);
        const dest = destResult.rows[0];
        if (dest) destinationName = dest.name;
      } else if (typeof destination_id === 'string') {
        destinationName = destination_id;
      }

      const db_plan_id = typeof plan_id === 'number' ? plan_id : null;

      // Fallback for visa_type_id if it's still null (due to NOT NULL constraint in some DB versions)
      if (db_visa_type_id === null) {
        // Try to find ANY visa type for this agency to use as a placeholder
        const anyVisaResult = await query("SELECT id FROM visa_types WHERE agency_id = $1 LIMIT 1", [agency_id]);
        const anyVisa = anyVisaResult.rows[0];
        if (anyVisa) {
          db_visa_type_id = anyVisa.id;
        } else {
          // If no visa types exist at all for this agency, create a default one
          const insertResult = await query(
            "INSERT INTO visa_types (agency_id, name, base_price) VALUES ($1, $2, $3) RETURNING id",
            [agency_id, visaTypeName || 'Visto Geral', 0]
          );
          db_visa_type_id = insertResult.rows[0].id;
        }
      }

      const insertResult = await query(`
        INSERT INTO processes (
          client_id, agency_id, visa_type_id, destination_id, plan_id,
          consultant_id, status, amount, internal_status, is_dependent,
          parent_process_id, travel_date, visa_type_name, plan_name, destination_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'waiting_payment', $7, 'pending', $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        client_id, agency_id, db_visa_type_id, db_destination_id, db_plan_id,
        consultant_id, amount, is_dependent, parent_process_id || null,
        travel_date || null, visaTypeName, planName, destinationName
      ]);

      const processId = insertResult.rows[0].id;

      // Save form responses if any
      if (form_responses) {
        let formId = null;
        if (db_visa_type_id) {
          const formResult = await query("SELECT id FROM forms WHERE visa_type_id = $1", [db_visa_type_id]);
          const form = formResult.rows[0];
          if (form) formId = form.id;
        }

        if (formId) {
          await query("INSERT INTO form_responses (process_id, form_id, data, status) VALUES ($1, $2, $3, $4)", [processId, formId, JSON.stringify(form_responses), 'submitted']);
        }
      }

      // Create mandatory financial record
      await query("INSERT INTO financials (process_id, type, category, amount, status) VALUES ($1, $2, $3, $4, $5)", [processId, 'income', 'Consultoria', amount, "pending"]);

      // Save dependents if any
      if (dependents && Array.isArray(dependents)) {
        for (const dep of dependents) {
          await query("INSERT INTO dependents (process_id, name, relationship, age, passport) VALUES ($1, $2, $3, $4, $5)", [processId, dep.name, dep.relationship, dep.age, dep.passport || null]);
        }
      }

      // Create process tasks from agency tasks
      const agencyTasksResult = await query("SELECT id FROM tasks WHERE agency_id = $1 AND is_active = true", [agency_id]);
      for (const task of agencyTasksResult.rows) {
        await query("INSERT INTO process_tasks (process_id, task_id) VALUES ($1, $2)", [processId, task.id]);
      }

      // Log action
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agency_id, client_id, "process_started", `Process ID: ${processId}`]);

      res.json({ id: processId, success: true });
    } catch (error: any) {
      console.error('Error in /api/processes/start:', error);
      if (error.stack) console.error(error.stack);
      res.status(500).json({ error: error.message || "Internal server error", stack: error.stack });
    }
  });

  app.get("/api/audit-logs", async (req, res) => {
    try {
      const logsResult = await query(`
        SELECT l.*, u.name as user_name, a.name as agency_name
        FROM audit_logs l
        LEFT JOIN users u ON l.user_id = u.id
        LEFT JOIN agencies a ON l.agency_id = a.id
        ORDER BY l.created_at DESC
        LIMIT 100
      `, []);
      res.json(logsResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agencies", async (req, res) => {
    try {
      const agenciesResult = await query(`
        SELECT
          a.*,
          su.id as admin_user_id,
          su.name as admin_name,
          su.email as admin_email,
          su.role as admin_role
        FROM agencies a
        LEFT JOIN users su ON su.id = (
          SELECT u.id
          FROM users u
          WHERE u.agency_id = a.id
          ORDER BY CASE WHEN u.role = 'supervisor' THEN 0 ELSE 1 END, u.id ASC
          LIMIT 1
        )
        ORDER BY a.created_at DESC
      `, []);
      res.json(agenciesResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/agencies/:id", async (req, res) => {
    try {
      const agencyResult = await query(`
        SELECT
          a.*,
          su.id as admin_user_id,
          su.name as admin_name,
          su.email as admin_email,
          su.role as admin_role
        FROM agencies a
        LEFT JOIN users su ON su.id = (
          SELECT u.id
          FROM users u
          WHERE u.agency_id = a.id
          ORDER BY CASE WHEN u.role = 'supervisor' THEN 0 ELSE 1 END, u.id ASC
          LIMIT 1
        )
        WHERE a.id = $1
      `, [req.params.id]);
      if (agencyResult.rows.length === 0) {
        return res.status(404).json({ error: "Ag├¬ncia n├úo encontrada" });
      }
      res.json(agencyResult.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agencies", async (req, res) => {
    console.log('Recebendo requisi├º├úo para criar ag├¬ncia:', req.body);
    const { name, slug, has_finance, admin_name, admin_email, admin_password } = req.body;

    try {
      await query('BEGIN', []);

      const modules = JSON.stringify({ finance: has_finance, chat: true, pipefy: req.body.has_pipefy !== undefined ? req.body.has_pipefy : true });
      const agencyResult = await query("INSERT INTO agencies (name, slug, modules) VALUES ($1, $2, $3) RETURNING id", [name, slug, modules]);
      const agencyId = agencyResult.rows[0].id;

      let auditUserId = await getAuditUserId(null);

      if (admin_email && admin_password) {
        const adminInsertResult = await query("INSERT INTO users (email, password, name, role, agency_id) VALUES ($1, $2, $3, 'supervisor', $4) RETURNING id", [
          admin_email,
          admin_password,
          admin_name || `Admin ${name}`,
          agencyId
        ]);
        auditUserId = adminInsertResult.rows[0].id;
      }

      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agencyId, auditUserId, "agency_created", `Ag├¬ncia criada: ${name}`]);

      await query('COMMIT', []);
      res.json({ id: agencyId });
    } catch (e: any) {
      await query('ROLLBACK', []);
      if (e.message.includes("duplicate key value violates unique constraint") && e.message.includes("users_email_key")) {
        res.status(400).json({ error: "Email do administrador j├í cadastrado" });
      } else if (e.message.includes("duplicate key value violates unique constraint") && e.message.includes("agencies_slug_key")) {
        res.status(400).json({ error: "Slug da ag├¬ncia j├í existe" });
      } else {
        res.status(500).json({ error: "Erro ao criar ag├¬ncia" });
      }
    }
  });

  app.put("/api/agencies/:id", async (req, res) => {
    console.log(`Recebendo requisi├º├úo para atualizar ag├¬ncia ${req.params.id}:`, req.body);
    const { name, slug, has_finance, has_pipefy } = req.body;
    const modules = JSON.stringify({ finance: has_finance, chat: true, pipefy: has_pipefy });
    try {
      await query("UPDATE agencies SET name = $1, slug = $2, modules = $3 WHERE id = $4", [name, slug, modules, req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes("duplicate key value violates unique constraint") && e.message.includes("agencies_slug_key")) {
        res.status(400).json({ error: "Slug da ag├¬ncia j├í existe" });
      } else {
        res.status(500).json({ error: "Erro ao atualizar ag├¬ncia" });
      }
    }
  });

  app.delete("/api/agencies/:id", async (req, res) => {
    const agencyId = Number(req.params.id);

    if (!agencyId) {
      return res.status(400).json({ error: "ID de ag├¬ncia inv├ílido" });
    }

    try {
      const agencyResult = await query("SELECT id, name FROM agencies WHERE id = $1", [agencyId]);
      if (agencyResult.rows.length === 0) {
        return res.status(404).json({ error: "Ag├¬ncia n├úo encontrada" });
      }
      const agency = agencyResult.rows[0];

      await query('BEGIN', []);

      await query("DELETE FROM process_tasks WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM documents WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM messages WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM form_responses WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM financials WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);

      await query("DELETE FROM forms WHERE visa_type_id IN (SELECT id FROM visa_types WHERE agency_id = $1)", [agencyId]);

      await query("DELETE FROM processes WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM visa_types WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM tasks WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM expenses WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM revenues WHERE agency_id = $1", [agencyId]);

      await query("DELETE FROM audit_logs WHERE agency_id = $1 OR user_id IN (SELECT id FROM users WHERE agency_id = $1)", [agencyId, agencyId]);

      await query("DELETE FROM users WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM agencies WHERE id = $1", [agencyId]);

      await query('COMMIT', []);
      return res.json({ success: true, deleted_agency_id: agencyId, deleted_agency_name: agency.name });
    } catch (error) {
      await query('ROLLBACK', []);
      return res.status(500).json({ error: "Erro ao excluir ag├¬ncia e dados vinculados" });
    }
  });

  app.get("/api/agencies/by-slug/:slug", async (req, res) => {
    try {
      const agencyResult = await query("SELECT * FROM agencies WHERE slug = $1", [req.params.slug]);
      if (agencyResult.rows.length > 0) {
        res.json(agencyResult.rows[0]);
      } else {
        res.status(404).json({ error: "Agency not found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/agencies/:id/settings", async (req, res) => {
    const { name, logo_url, pre_form_questions } = req.body;
    console.log(`Updating settings for agency ${req.params.id}:`, { name, logo_url, preFormQuestionsCount: pre_form_questions?.length });
    try {
      await query("UPDATE agencies SET name = $1, logo_url = $2, pre_form_questions = $3 WHERE id = $4", [
        name,
        logo_url,
        pre_form_questions ? JSON.stringify(pre_form_questions) : null,
        req.params.id
      ]);
      const auditUserId = await getAuditUserId(req.params.id);
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [req.params.id, auditUserId, "agency_settings_updated", `Configura├º├Áes da ag├¬ncia atualizadas: ${name}`]);
      res.json({ success: true });
    } catch (e) {
      console.error('Error updating agency settings:', e);
      res.status(500).json({ error: "Failed to update agency settings" });
    }
  });

  // Destinations CRUD
  app.get("/api/destinations", async (req, res) => {
    const { agency_id } = req.query;
    try {
      let sql = "SELECT * FROM destinations";
      let params = [];
      if (agency_id) {
        sql += " WHERE agency_id = $1";
        params.push(agency_id);
      }
      sql += " ORDER BY \"order\" ASC, name ASC";
      const destinations = await query(sql, params);
      const result = destinations.rows.map((d: any) => ({
        ...d,
        highlight_points: JSON.parse(d.highlight_points || '[]')
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/destinations", async (req, res) => {
    const { agency_id, name, code, description, image, highlight_points, order } = req.body;
    try {
      const result = await query(
        "INSERT INTO destinations (agency_id, name, code, description, image, highlight_points, \"order\") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [agency_id, name, code, description, image, JSON.stringify(highlight_points || []), order || 0]
      );
      res.json({ id: result.rows[0].id });
    } catch (e: any) {
      console.error("Error creating destination:", e);
      res.status(500).json({ error: "Erro ao criar destino" });
    }
  });

  app.put("/api/destinations/:id", async (req, res) => {
    const { name, code, description, image, highlight_points, is_active, order } = req.body;
    try {
      await query(
        "UPDATE destinations SET name = $1, code = $2, description = $3, image = $4, highlight_points = $5, is_active = $6, \"order\" = $7 WHERE id = $8",
        [name, code, description, image, JSON.stringify(highlight_points || []), is_active, order || 0, req.params.id]
      );
      res.json({ success: true });
    } catch (e: any) {
      console.error("Error updating destination:", e);
      res.status(500).json({ error: "Erro ao atualizar destino" });
    }
  });

  app.delete("/api/destinations/:id", async (req, res) => {
    try {
      await query("DELETE FROM destinations WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/visa-types", async (req, res) => {
    const { agency_id } = req.query;
    if (!agency_id) return res.status(400).json({ error: "agency_id is required" });
    try {
      const visaTypesResult = await query("SELECT * FROM visa_types WHERE agency_id = $1 ORDER BY created_at DESC", [agency_id]);
      const visaTypes = visaTypesResult.rows.map((v: any) => ({
        ...v,
        required_docs: JSON.parse(v.required_docs || '[]')
      }));
      res.json(visaTypes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/visa-types", async (req, res) => {
    const { agency_id, name, description, base_price, required_docs } = req.body;
    try {
      const result = await query(
        "INSERT INTO visa_types (agency_id, name, description, base_price, required_docs) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [agency_id, name, description, base_price, JSON.stringify(required_docs || [])]
      );
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/visa-types/:id", async (req, res) => {
    const { name, description, base_price, required_docs } = req.body;
    try {
      await query(
        "UPDATE visa_types SET name = $1, description = $2, base_price = $3, required_docs = $4 WHERE id = $5",
        [name, description, base_price, JSON.stringify(required_docs || []), req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/visa-types/:id", async (req, res) => {
    try {
      await query("DELETE FROM forms WHERE visa_type_id = $1", [req.params.id]);
      await query("DELETE FROM visa_types WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/forms/:visa_type_id", async (req, res) => {
    try {
      const forms = await query("SELECT * FROM forms WHERE visa_type_id = $1", [req.params.visa_type_id]);
      const result = forms.rows.map((f: any) => ({
        ...f,
        fields: JSON.parse(f.fields || '[]')
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/forms", async (req, res) => {
    const { visa_type_id, title, fields } = req.body;
    try {
      const result = await query("INSERT INTO forms (visa_type_id, title, fields) VALUES ($1, $2, $3) RETURNING id", [visa_type_id, title, JSON.stringify(fields || [])]);
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/forms/:id", async (req, res) => {
    const { title, fields } = req.body;
    try {
      await query("UPDATE forms SET title = $1, fields = $2 WHERE id = $3", [title, JSON.stringify(fields || []), req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/forms/:id", async (req, res) => {
    try {
      await query("DELETE FROM forms WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/form-responses/:process_id", async (req, res) => {
    try {
      const responsesResult = await query("SELECT * FROM form_responses WHERE process_id = $1", [req.params.process_id]);
      const responses = responsesResult.rows.map((r: any) => ({
        ...r,
        data: JSON.parse(r.data || '{}')
      }));
      res.json(responses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/form-responses", async (req, res) => {
    const { process_id, form_id, data } = req.body;
    try {
      const existingResult = await query("SELECT id FROM form_responses WHERE process_id = $1 AND form_id = $2", [process_id, form_id]);

      if (existingResult.rows.length > 0) {
        await query("UPDATE form_responses SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [JSON.stringify(data), existingResult.rows[0].id]);
        res.json({ id: existingResult.rows[0].id });
      } else {
        const result = await query("INSERT INTO form_responses (process_id, form_id, data) VALUES ($1, $2, $3) RETURNING id", [process_id, form_id, JSON.stringify(data)]);
        res.json({ id: result.rows[0].id });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/financials/confirm-proof", upload.single('file'), async (req, res) => {
    const { process_id } = req.body;
    const file = req.file;
    const proof_url = file ? `/uploads/${file.filename}` : null;

    try {
      await query("UPDATE financials SET status = 'proof_received', proof_url = $1 WHERE process_id = $2", [proof_url, process_id]);
      res.json({ success: true, proof_url });
    } catch (e) {
      console.error('Error confirming proof:', e);
      res.status(500).json({ error: "Failed to confirm proof" });
    }
  });

  app.post("/api/financials/validate", async (req, res) => {
    const { process_id, status } = req.body; // status: 'confirmed'

    try {
      await query('BEGIN', []);
      await query("UPDATE financials SET status = $1, confirmed_at = CURRENT_TIMESTAMP WHERE process_id = $2", [status, process_id]);
      if (status === 'confirmed') {
        await query("UPDATE processes SET status = 'analyzing', internal_status = 'reviewing' WHERE id = $1", [process_id]);
      }
      await query('COMMIT', []);
      res.json({ success: true });
    } catch (e) {
      await query('ROLLBACK', []);
      console.error('Error validating financial:', e);
      res.status(500).json({ error: "Failed to validate financial" });
    }
  });

  app.post("/api/documents/validate", async (req, res) => {
    const { id, status, rejection_reason } = req.body;
    try {
      await query("UPDATE documents SET status = $1, rejection_reason = $2 WHERE id = $3", [status, rejection_reason || null, id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/documents", upload.single('file'), async (req, res) => {
    const { process_id, name } = req.body;
    const file = req.file;
    const url = file ? `/uploads/${file.filename}` : null;

    try {
      const result = await query("INSERT INTO documents (process_id, name, url, status) VALUES ($1, $2, $3, 'uploaded') RETURNING id", [process_id, name, url]);
      res.json({ id: result.rows[0].id, url });
    } catch (e) {
      console.error('Error uploading document:', e);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });
  // Plans CRUD
  app.get("/api/plans", async (req, res) => {
    const { agency_id } = req.query;
    try {
      let sql = "SELECT * FROM plans";
      let params = [];
      if (agency_id) {
        sql += " WHERE agency_id = $1";
        params.push(agency_id);
      }
      sql += " ORDER BY price ASC";
      const plansResult = await query(sql, params);
      const plans = plansResult.rows.map((p: any) => ({
        ...p,
        features: JSON.parse(p.features || '[]')
      }));
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/plans", async (req, res) => {
    const { agency_id, name, description, price, features, is_recommended, icon } = req.body;
    try {
      const result = await query(
        "INSERT INTO plans (agency_id, name, description, price, features, is_recommended, icon) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [agency_id, name, description, price, JSON.stringify(features || []), is_recommended, icon || 'Star']
      );
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/plans/:id", async (req, res) => {
    const { name, description, price, features, is_recommended, icon } = req.body;
    try {
      await query(
        "UPDATE plans SET name = $1, description = $2, price = $3, features = $4, is_recommended = $5, icon = $6 WHERE id = $7",
        [name, description, price, JSON.stringify(features || []), is_recommended, icon || 'Star', req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/plans/:id", async (req, res) => {
    try {
      await query("DELETE FROM plans WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Form Fields CRUD
  app.get("/api/form-fields", async (req, res) => {
    const { agency_id, destination_id } = req.query;
    try {
      let sql = "SELECT * FROM form_fields WHERE agency_id = $1";
      let params = [agency_id];
      if (destination_id) {
        sql += " AND (destination_id = $2 OR destination_id IS NULL)";
        params.push(destination_id);
      }
      sql += " ORDER BY \"order\" ASC";
      const fieldsResult = await query(sql, params);
      const fields = fieldsResult.rows.map((f: any) => ({
        ...f,
        options: JSON.parse(f.options || '[]')
      }));
      res.json(fields);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/form-fields", async (req, res) => {
    const { agency_id, destination_id, label, type, required, options, order } = req.body;
    try {
      const result = await query(
        "INSERT INTO form_fields (agency_id, destination_id, label, type, required, options, \"order\") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [agency_id, destination_id || null, label, type, required, JSON.stringify(options || []), order || 0]
      );
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/form-fields/:id", async (req, res) => {
    const { destination_id, label, type, required, options, order } = req.body;
    try {
      await query(
        "UPDATE form_fields SET destination_id = $1, label = $2, type = $3, required = $4, options = $5, \"order\" = $6 WHERE id = $7",
        [destination_id || null, label, type, required, JSON.stringify(options || []), order || 0, req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/form-fields/:id", async (req, res) => {
    try {
      await query("DELETE FROM form_fields WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/processes", async (req, res) => {
    const { agency_id, role, user_id } = req.query;
    try {
      let sql = `
        SELECT
          p.*,
          u.name as client_name,
          v.name as visa_name,
          d.name as destination_name,
          d.image as destination_image,
          pl.name as plan_name,
          f.status as payment_status,
          f.proof_url as payment_proof_url,
          cu.name as consultant_name
        FROM processes p
        JOIN users u ON p.client_id = u.id
        LEFT JOIN visa_types v ON p.visa_type_id = v.id
        LEFT JOIN destinations d ON p.destination_id = d.id
        LEFT JOIN plans pl ON p.plan_id = pl.id
        LEFT JOIN financials f ON p.id = f.process_id
        LEFT JOIN users cu ON p.consultant_id = cu.id
      `;
      let params = [];

      if (role === 'master') {
        // No filter
      } else if (role === 'client') {
        sql += " WHERE p.client_id = $1";
        params.push(user_id);
      } else if (role === 'consultant') {
        sql += " WHERE p.consultant_id = $1";
        params.push(user_id);
      } else if (role === 'analyst') {
        sql += " WHERE p.analyst_id = $1 OR (p.internal_status = 'reviewing' AND p.agency_id = $2)";
        params.push(user_id, agency_id);
      } else {
        sql += " WHERE p.agency_id = $1";
        params.push(agency_id);
      }

      sql += " ORDER BY p.created_at DESC";

      const processesResult = await query(sql, params);
      res.json(processesResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/processes", async (req, res) => {
    const { client_id, agency_id, visa_type_id, consultant_id, analyst_id, status, internal_status } = req.body;

    try {
      await query('BEGIN', []);

      const visaResult = await query("SELECT base_price FROM visa_types WHERE id = $1", [visa_type_id]);
      if (visaResult.rows.length === 0) {
        await query('ROLLBACK', []);
        return res.status(400).json({ error: "Tipo de visto inv├ílido" });
      }
      const visa = visaResult.rows[0];

      const processResult = await query(`
        INSERT INTO processes (client_id, agency_id, visa_type_id, consultant_id, analyst_id, status, internal_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [client_id, agency_id, visa_type_id, consultant_id || null, analyst_id || null, status || 'started', internal_status || 'pending']);

      const processId = processResult.rows[0].id;

      // Create mandatory financial record
      await query("INSERT INTO financials (process_id, amount, status) VALUES ($1, $2, $3)", [processId, visa.base_price, "pending"]);

      // Create process tasks from agency tasks
      const agencyTasksResult = await query("SELECT id FROM tasks WHERE agency_id = $1 AND is_active = true", [agency_id]);
      for (const task of agencyTasksResult.rows) {
        await query("INSERT INTO process_tasks (process_id, task_id) VALUES ($1, $2)", [processId, task.id]);
      }

      // Log action
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agency_id, client_id, "process_created", `Process ID: ${processId}`]);

      // Return tasks for the UI as requested
      const tasksResult = await query(`
        SELECT pt.*, t.title, t.description
        FROM process_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        WHERE pt.process_id = $1
      `, [processId]);

      await query('COMMIT', []);
      res.json({ id: processId, tasks: tasksResult.rows });
    } catch (err: any) {
      await query('ROLLBACK', []);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/processes/:id", async (req, res) => {
    const { visa_type_id, consultant_id, analyst_id, status, internal_status } = req.body;

    try {
      const existingProcessResult = await query("SELECT id, status, internal_status, visa_type_id FROM processes WHERE id = $1", [req.params.id]);
      if (existingProcessResult.rows.length === 0) {
        return res.status(404).json({ error: "Processo n├úo encontrado" });
      }
      const existingProcess = existingProcessResult.rows[0];

      if (existingProcess.status === 'completed') {
        return res.status(400).json({ error: "Processos conclu├¡dos n├úo podem ser editados" });
      }

      await query(`
        UPDATE processes
        SET visa_type_id = $1, consultant_id = $2, analyst_id = $3, status = $4, internal_status = $5
        WHERE id = $6
      `, [
        visa_type_id !== undefined ? visa_type_id : existingProcess.visa_type_id,
        consultant_id !== undefined ? consultant_id : existingProcess.consultant_id,
        analyst_id !== undefined ? analyst_id : existingProcess.analyst_id,
        status !== undefined ? status : existingProcess.status,
        internal_status !== undefined ? internal_status : existingProcess.internal_status,
        req.params.id,
      ]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/processes/:id", async (req, res) => {
    try {
      await query('BEGIN', []);
      await query("DELETE FROM process_tasks WHERE process_id = $1", [req.params.id]);
      await query("DELETE FROM form_responses WHERE process_id = $1", [req.params.id]);
      await query("DELETE FROM documents WHERE process_id = $1", [req.params.id]);
      await query("DELETE FROM messages WHERE process_id = $1", [req.params.id]);
      await query("DELETE FROM financials WHERE process_id = $1", [req.params.id]);
      await query("DELETE FROM processes WHERE id = $1", [req.params.id]);
      await query('COMMIT', []);
      res.json({ success: true });
    } catch (err: any) {
      await query('ROLLBACK', []);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/processes/:id", async (req, res) => {
    try {
      const processResult = await query(`
        SELECT
          p.*,
          u.name as client_name,
          v.name as visa_name,
          v.required_docs,
          d.name as destination_name,
          d.image as destination_image,
          pl.name as plan_name
        FROM processes p
        JOIN users u ON p.client_id = u.id
        LEFT JOIN visa_types v ON p.visa_type_id = v.id
        LEFT JOIN destinations d ON p.destination_id = d.id
        LEFT JOIN plans pl ON p.plan_id = pl.id
        WHERE p.id = $1
      `, [req.params.id]);

      if (processResult.rows.length === 0) {
        return res.status(404).json({ error: "Processo n├úo encontrado" });
      }

      const process = processResult.rows[0];

      const documentsResult = await query("SELECT * FROM documents WHERE process_id = $1", [req.params.id]);
      const messagesResult = await query("SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.process_id = $1 ORDER BY sent_at ASC", [req.params.id]);
      const financialResult = await query("SELECT * FROM financials WHERE process_id = $1", [req.params.id]);
      const responsesResult = await query(`
        SELECT fr.*, f.title as form_title, f.fields as form_fields
        FROM form_responses fr
        JOIN forms f ON fr.form_id = f.id
        WHERE fr.process_id = $1
      `, [req.params.id]);
      const dependentsResult = await query("SELECT * FROM dependents WHERE process_id = $1", [req.params.id]);
      const tasksResult = await query(`
        SELECT pt.*, t.title, t.description
        FROM process_tasks pt
        JOIN tasks t ON pt.task_id = t.id
        WHERE pt.process_id = $1
      `, [req.params.id]);

      res.json({
        ...process,
        documents: documentsResult.rows,
        messages: messagesResult.rows,
        financial: financialResult.rows[0] || null,
        responses: responsesResult.rows,
        dependents: dependentsResult.rows,
        tasks: tasksResult.rows
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/process-tasks/:id/toggle", async (req, res) => {
    const { status } = req.body;
    const completed_at = status === 'completed' ? new Date().toISOString() : null;
    try {
      await query("UPDATE process_tasks SET status = $1, completed_at = $2 WHERE id = $3", [status, completed_at, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/messages", async (req, res) => {
    const { process_id, sender_id, content, is_proof } = req.body;
    try {
      const result = await query("INSERT INTO messages (process_id, sender_id, content, is_proof) VALUES ($1, $2, $3, $4) RETURNING id", [process_id, sender_id, content, is_proof]);
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agencies/:id/reset-password", async (req, res) => {
    console.log(`Recebendo requisi├º├úo para resetar senha da ag├¬ncia ${req.params.id}`);
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "Nova senha ├® obrigat├│ria" });

    try {
      const supervisorResult = await query("SELECT id FROM users WHERE agency_id = $1 AND role = 'supervisor' LIMIT 1", [req.params.id]);
      const fallbackAgencyUserResult = await query("SELECT id FROM users WHERE agency_id = $1 ORDER BY id ASC LIMIT 1", [req.params.id]);
      const userToReset = supervisorResult.rows[0]?.id || fallbackAgencyUserResult.rows[0]?.id;

      if (!userToReset) {
        return res.status(404).json({ error: "Administrador da ag├¬ncia n├úo encontrado" });
      }

      await query("UPDATE users SET password = $1 WHERE id = $2", [new_password, userToReset]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.post("/api/users/:id/reset-password", async (req, res) => {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "Nova senha ├® obrigat├│ria" });

    try {
      await query("UPDATE users SET password = $1 WHERE id = $2", [new_password, req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.get("/api/leads", async (req, res) => {
    const { agency_id } = req.query;

    try {
      let sql = `
        SELECT
          u.id, u.name, u.email, u.phone, u.created_at,
          p.status as process_status,
          p.internal_status as process_internal_status,
          p.id as process_id
        FROM users u
        LEFT JOIN processes p ON u.id = p.client_id
        WHERE u.role = 'client'
      `;

      const params: any[] = [];
      if (agency_id && agency_id !== '') {
        sql += " AND u.agency_id = $1";
        params.push(agency_id);
      }

      sql += " ORDER BY u.created_at DESC";

      const leadsResult = await query(sql, params);
      res.json(leadsResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Expenses (Contas a Pagar)
  app.get("/api/expenses", async (req, res) => {
    const { agency_id } = req.query;
    try {
      let sql = "SELECT * FROM expenses";
      let params = [];
      if (agency_id) {
        sql += " WHERE agency_id = $1";
        params.push(agency_id);
      }
      sql += " ORDER BY due_date ASC";
      const expensesResult = await query(sql, params);
      res.json(expensesResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    const { agency_id, description, amount, due_date, status, category } = req.body;

    if (!isFinanceModuleEnabledForAgency(agency_id)) {
      return res.status(403).json({ error: "M├│dulo financeiro desativado para esta ag├¬ncia" });
    }

    try {
      const result = await query(`
        INSERT INTO expenses (agency_id, description, amount, due_date, status, category)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [agency_id, description, amount, due_date, status || 'pending', category]);
      const auditUserId = await getAuditUserId(agency_id);
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agency_id || null, auditUserId, "expense_created", `Despesa: ${description} ($${amount})`]);
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {
    const { description, amount, due_date, status, category } = req.body;

    try {
      const expenseResult = await query("SELECT agency_id FROM expenses WHERE id = $1", [req.params.id]);
      if (expenseResult.rows.length === 0) {
        return res.status(404).json({ error: "Despesa n├úo encontrada" });
      }
      const expense = expenseResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(expense.agency_id || null)) {
        return res.status(403).json({ error: "M├│dulo financeiro desativado para esta ag├¬ncia" });
      }

      await query(`
        UPDATE expenses SET description = $1, amount = $2, due_date = $3, status = $4, category = $5
        WHERE id = $6
      `, [description, amount, due_date, status, category, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const expenseResult = await query("SELECT agency_id FROM expenses WHERE id = $1", [req.params.id]);
      if (expenseResult.rows.length === 0) {
        return res.status(404).json({ error: "Despesa n├úo encontrada" });
      }
      const expense = expenseResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(expense.agency_id || null)) {
        return res.status(403).json({ error: "M├│dulo financeiro desativado para esta ag├¬ncia" });
      }

      await query("DELETE FROM expenses WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Revenues (Contas a Receber)
  app.get("/api/revenues", async (req, res) => {
    const { agency_id } = req.query;
    try {
      let sql = "SELECT * FROM revenues";
      let params = [];
      if (agency_id) {
        sql += " WHERE agency_id = $1";
        params.push(agency_id);
      }
      sql += " ORDER BY due_date ASC";
      const revenuesResult = await query(sql, params);
      res.json(revenuesResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/revenues", async (req, res) => {
    const { agency_id, description, amount, due_date, status, category } = req.body;

    if (!isFinanceModuleEnabledForAgency(agency_id)) {
      return res.status(403).json({ error: "M├│dulo financeiro desativado para esta ag├¬ncia" });
    }

    try {
      const result = await query(`
        INSERT INTO revenues (agency_id, description, amount, due_date, status, category)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [agency_id, description, amount, due_date, status || 'pending', category]);
      const auditUserId = await getAuditUserId(agency_id);
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agency_id || null, auditUserId, "revenue_created", `Receita: ${description} ($${amount})`]);
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/revenues/:id", async (req, res) => {
    const { description, amount, due_date, status, category } = req.body;

    try {
      const revenueResult = await query("SELECT agency_id FROM revenues WHERE id = $1", [req.params.id]);
      if (revenueResult.rows.length === 0) {
        return res.status(404).json({ error: "Receita n├úo encontrada" });
      }
      const revenue = revenueResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(revenue.agency_id || null)) {
        return res.status(403).json({ error: "M├│dulo financeiro desativado para esta ag├¬ncia" });
      }

      await query(`
        UPDATE revenues SET description = $1, amount = $2, due_date = $3, status = $4, category = $5
        WHERE id = $6
      `, [description, amount, due_date, status, category, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/revenues/:id", async (req, res) => {
    try {
      const revenueResult = await query("SELECT agency_id FROM revenues WHERE id = $1", [req.params.id]);
      if (revenueResult.rows.length === 0) {
        return res.status(404).json({ error: "Receita n├úo encontrada" });
      }
      const revenue = revenueResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(revenue.agency_id || null)) {
        return res.status(403).json({ error: "M├│dulo financeiro desativado para esta ag├¬ncia" });
      }

      await query("DELETE FROM revenues WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clients", async (req, res) => {
    const { name, email, password, phone, agency_id } = req.body;

    if (!name || !email || !agency_id) {
      return res.status(400).json({ error: "Nome, email e ag├¬ncia s├úo obrigat├│rios" });
    }

    const passwordToUse = (password || '').trim() ? String(password).trim() : 'password';
    if (passwordToUse.length < 6) {
      return res.status(400).json({ error: "A senha deve ter no m├¡nimo 6 caracteres" });
    }

    try {
      const result = await query(
        "INSERT INTO users (name, email, password, role, agency_id, phone) VALUES ($1, $2, $3, 'client', $4, $5) RETURNING id",
        [name, email, passwordToUse, agency_id, phone || null]
      );
      res.json({ id: result.rows[0].id });
    } catch (e: any) {
      const message = String(e?.message || '');
      if (message.includes('duplicate key value violates unique constraint') && message.includes('users_email_key')) {
        return res.status(400).json({ error: "Email j├í cadastrado" });
      }
      if (message.includes('violates foreign key constraint')) {
        return res.status(400).json({ error: "Ag├¬ncia inv├ílida para cadastro do cliente" });
      }
      return res.status(500).json({ error: "Erro ao cadastrar cliente" });
    }
  });

  app.post("/api/clients/:id/reset-password", async (req, res) => {
    const clientId = Number(req.params.id);
    const { new_password, reset_by_user_id } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "Cliente inv├ílido" });
    }

    if (!new_password || String(new_password).trim().length < 6) {
      return res.status(400).json({ error: "A senha deve ter no m├¡nimo 6 caracteres" });
    }

    try {
      const clientResult = await query("SELECT id, agency_id FROM users WHERE id = $1 AND role = 'client'", [clientId]);
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: "Cliente n├úo encontrado" });
      }
      const client = clientResult.rows[0];

      let resetByUserId = Number(reset_by_user_id || 0);
      if (resetByUserId) {
        const resetActorResult = await query("SELECT id FROM users WHERE id = $1 AND (agency_id = $2 OR role = 'master')", [resetByUserId, client.agency_id]);
        if (resetActorResult.rows.length === 0) {
          resetByUserId = await getAuditUserId(client.agency_id);
        }
      } else {
        resetByUserId = await getAuditUserId(client.agency_id);
      }

      await query("UPDATE users SET password = $1 WHERE id = $2", [String(new_password).trim(), clientId]);
      await query("INSERT INTO client_password_resets (client_id, agency_id, reset_by_user_id) VALUES ($1, $2, $3)", [clientId, client.agency_id, resetByUserId || null]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/clients/password-resets", async (req, res) => {
    const { agency_id } = req.query;

    if (!agency_id) {
      return res.status(400).json({ error: "agency_id ├® obrigat├│rio" });
    }

    try {
      const historyResult = await query(`
        SELECT
          cpr.id,
          cpr.client_id,
          c.name as client_name,
          c.email as client_email,
          cpr.reset_by_user_id,
          rb.name as reset_by_name,
          cpr.created_at
        FROM client_password_resets cpr
        JOIN users c ON c.id = cpr.client_id
        LEFT JOIN users rb ON rb.id = cpr.reset_by_user_id
        WHERE cpr.agency_id = $1
        ORDER BY cpr.created_at DESC, cpr.id DESC
        LIMIT 200
      `, [agency_id]);

      res.json(historyResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agency Users (Consultants and Analysts)
  app.get("/api/agency-users", async (req, res) => {
    const { agency_id } = req.query;
    try {
      let sql = "SELECT id, name, email, role, agency_id, created_at FROM users WHERE role IN ('consultant', 'analyst', 'supervisor', 'gerente_financeiro')";
      let params = [];
      if (agency_id) {
        sql += " AND agency_id = $1";
        params.push(agency_id);
      }
      const usersResult = await query(sql, params);
      res.json(usersResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/global-users", async (req, res) => {
    try {
      const usersResult = await query(`
        SELECT u.id, u.name, u.email, u.role, u.agency_id, a.name as agency_name, u.created_at
        FROM users u
        LEFT JOIN agencies a ON u.agency_id = a.id
        WHERE u.role != 'master'
        ORDER BY u.created_at DESC
      `, []);
      res.json(usersResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agency-users", async (req, res) => {
    const { name, email, password, role, agency_id } = req.body;
    try {
      const result = await query("INSERT INTO users (name, email, password, role, agency_id) VALUES ($1, $2, $3, $4, $5) RETURNING id", [name, email, password, role, agency_id]);
      const auditUserId = await getAuditUserId(agency_id);
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agency_id, auditUserId, "user_created", `Usu├írio criado: ${name} (${role})`]);
      res.json({ id: result.rows[0].id });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.put("/api/agency-users/:id", async (req, res) => {
    const { name, email, role } = req.body;
    try {
      await query("UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4", [name, email, role, req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.delete("/api/agency-users/:id", async (req, res) => {
    try {
      await query("DELETE FROM users WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tasks
  app.get("/api/tasks", async (req, res) => {
    const { agency_id } = req.query;
    try {
      const tasksResult = await query("SELECT * FROM tasks WHERE agency_id = $1 ORDER BY created_at DESC", [agency_id]);
      res.json(tasksResult.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    const { agency_id, title, description } = req.body;
    try {
      const result = await query("INSERT INTO tasks (agency_id, title, description) VALUES ($1, $2, $3) RETURNING id", [agency_id, title, description]);
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    const { title, description, is_active } = req.body;
    try {
      await query("UPDATE tasks SET title = $1, description = $2, is_active = $3 WHERE id = $4", [title, description, is_active, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      await query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BOOT] Ô£ô Servidor rodando em http://localhost:${PORT}`);
    console.log(`[BOOT] Ô£ô Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
