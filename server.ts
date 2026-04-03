import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { testConnection, query } from "./src/lib/db.js";
import { initializeDatabase } from "./src/lib/init-db.js";
import Database from "./src/lib/compat-db.js";
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

// Create database instance for compatibility
const db = new Database();

// Round Robin Helper
function getNextConsultant(agencyId: number) {
  const consultants = db.prepare("SELECT id FROM users WHERE role = 'consultant' AND agency_id = ?").all(agencyId) as { id: number }[];
  if (consultants.length === 0) return null;
  
  // Simple Round Robin: find consultant with fewest active processes
  const counts = db.prepare(`
    SELECT u.id, COUNT(p.id) as proc_count 
    FROM users u 
    LEFT JOIN processes p ON u.id = p.consultant_id AND p.status != 'completed'
    WHERE u.role = 'consultant' AND u.agency_id = ?
    GROUP BY u.id
    ORDER BY proc_count ASC
    LIMIT 1
  `).get(agencyId) as { id: number };
  
  return counts?.id || consultants[0].id;
}

function getAuditUserId(agencyId?: number | string | null) {
  const parsedAgencyId = agencyId ? Number(agencyId) : null;

  if (parsedAgencyId) {
    const supervisor = db
      .prepare("SELECT id FROM users WHERE agency_id = ? AND role = 'supervisor' LIMIT 1")
      .get(parsedAgencyId) as { id: number } | undefined;

    if (supervisor?.id) {
      return supervisor.id;
    }
  }

  const master = db
    .prepare("SELECT id FROM users WHERE role = 'master' ORDER BY id ASC LIMIT 1")
    .get() as { id: number } | undefined;

  return master?.id || 1;
}

function isFinanceModuleEnabledForAgency(agencyId?: number | string | null) {
  const parsedAgencyId = agencyId ? Number(agencyId) : null;
  if (!parsedAgencyId) return true;

  const agency = db.prepare("SELECT modules FROM agencies WHERE id = ?").get(parsedAgencyId) as { modules?: string } | undefined;
  if (!agency) return false;

  try {
    const modules = JSON.parse(agency.modules || '{}');
    return Boolean(modules.finance);
  } catch {
    return false;
  }
}

async function startServer() {
  // Test database connection
  await testConnection();

  const app = express();
  const PORT = Number(process.env.PORT);
  if (!PORT) {
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

  app.get("/api/test-db", (req, res) => {
    try {
      const users = db.prepare("SELECT email, role FROM users").all();
      res.json({ status: "ok", users });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare(`
      SELECT u.*, a.modules as agency_modules 
      FROM users u 
      LEFT JOIN agencies a ON u.agency_id = a.id 
      WHERE LOWER(u.email) = LOWER(?) AND u.password = ?
    `).get(email, password) as any;
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/visa-types", (req, res) => {
    const { agency_id } = req.query;
    const visas = db.prepare("SELECT * FROM visa_types WHERE agency_id = ?").all(agency_id);
    res.json(visas);
  });

  app.post("/api/processes/start", (req, res) => {
    try {
      const { client_id, agency_id, visa_type_id, destination_id, plan_id, is_dependent, parent_process_id, dependents, travel_date, form_responses } = req.body;
      
      if (!client_id || !agency_id) {
        return res.status(400).json({ error: "client_id and agency_id are required" });
      }

      const consultant_id = getNextConsultant(agency_id);
      
      // Get price from plan if provided, otherwise from visa type
      let amount = 0;
      let planName = null;
      let visaTypeName = null;
      let destinationName = null;

      if (plan_id) {
        // Handle numeric ID or string ID (for default plans)
        const plan = db.prepare("SELECT name, price FROM plans WHERE id = ?").get(plan_id) as { name: string, price: number } | undefined;
        if (plan) {
          amount = plan.price;
          planName = plan.name;
        } else {
          // Fallback for default plans if not in DB
          if (plan_id === 'basic') { amount = 497; planName = 'Consultoria Básica'; }
          else if (plan_id === 'complete') { amount = 1497; planName = 'Consultoria Completa'; }
          else if (plan_id === 'premium') { amount = 2997; planName = 'Consultoria Premium'; }
        }
      }

      // Handle visa_type_id (can be numeric ID or string name/goal)
      let db_visa_type_id = typeof visa_type_id === 'number' ? visa_type_id : null;
      if (!db_visa_type_id && typeof visa_type_id === 'string') {
        const existing = db.prepare("SELECT id, name, base_price FROM visa_types WHERE agency_id = ? AND LOWER(name) = LOWER(?)").get(agency_id, visa_type_id) as { id: number, name: string, base_price: number } | undefined;
        if (existing) {
          db_visa_type_id = existing.id;
          visaTypeName = existing.name;
          if (amount === 0) amount = existing.base_price;
        } else {
          // Use the string as name
          visaTypeName = visa_type_id.charAt(0).toUpperCase() + visa_type_id.slice(1);
        }
      } else if (db_visa_type_id) {
        const visa = db.prepare("SELECT name, base_price FROM visa_types WHERE id = ?").get(db_visa_type_id) as { name: string, base_price: number } | undefined;
        if (visa) {
          visaTypeName = visa.name;
          if (amount === 0) amount = visa.base_price;
        }
      }

      // Handle destination_id
      let db_destination_id = typeof destination_id === 'number' ? destination_id : null;
      if (db_destination_id) {
        const dest = db.prepare("SELECT name FROM destinations WHERE id = ?").get(db_destination_id) as { name: string } | undefined;
        if (dest) destinationName = dest.name;
      } else if (typeof destination_id === 'string') {
        destinationName = destination_id;
      }

      const db_plan_id = typeof plan_id === 'number' ? plan_id : null;

      // Fallback for visa_type_id if it's still null (due to NOT NULL constraint in some DB versions)
      if (db_visa_type_id === null) {
        // Try to find ANY visa type for this agency to use as a placeholder
        const anyVisa = db.prepare("SELECT id FROM visa_types WHERE agency_id = ? LIMIT 1").get(agency_id) as { id: number } | undefined;
        if (anyVisa) {
          db_visa_type_id = anyVisa.id;
        } else {
          // If no visa types exist at all for this agency, create a default one
          const result = db.prepare("INSERT INTO visa_types (agency_id, name, base_price) VALUES (?, ?, ?)").run(agency_id, visaTypeName || 'Visto Geral', 0);
          db_visa_type_id = Number(result.lastInsertRowid);
        }
      }

      const result = db.prepare(`
        INSERT INTO processes (
          client_id, agency_id, visa_type_id, destination_id, plan_id, 
          consultant_id, status, amount, internal_status, is_dependent, 
          parent_process_id, travel_date, visa_type_name, plan_name, destination_name
        )
        VALUES (?, ?, ?, ?, ?, ?, 'waiting_payment', ?, 'pending', ?, ?, ?, ?, ?, ?)
      `).run(
        client_id, agency_id, db_visa_type_id, db_destination_id, db_plan_id, 
        consultant_id, amount, is_dependent ? 1 : 0, parent_process_id || null, 
        travel_date || null, visaTypeName, planName, destinationName
      );

      const processId = result.lastInsertRowid;
      
      // Save form responses if any
      if (form_responses) {
        let formId = null;
        if (db_visa_type_id) {
          const form = db.prepare("SELECT id FROM forms WHERE visa_type_id = ?").get(db_visa_type_id) as { id: number } | undefined;
          if (form) formId = form.id;
        }
        
        if (formId) {
          db.prepare("INSERT INTO form_responses (process_id, form_id, data, status) VALUES (?, ?, ?, ?)").run(processId, formId, JSON.stringify(form_responses), 'submitted');
        }
      }

      // Create mandatory financial record
      db.prepare("INSERT INTO financials (process_id, type, category, amount, status) VALUES (?, ?, ?, ?, ?)").run(processId, 'income', 'Consultoria', amount, "pending");

      // Save dependents if any
      if (dependents && Array.isArray(dependents)) {
        const insertDependent = db.prepare("INSERT INTO dependents (process_id, name, relationship, age, passport) VALUES (?, ?, ?, ?, ?)");
        for (const dep of dependents) {
          insertDependent.run(processId, dep.name, dep.relationship, dep.age, dep.passport || null);
        }
      }

      // Create process tasks from agency tasks
      const agencyTasks = db.prepare("SELECT id FROM tasks WHERE agency_id = ? AND is_active = 1").all(agency_id) as { id: number }[];
      for (const task of agencyTasks) {
        db.prepare("INSERT INTO process_tasks (process_id, task_id) VALUES (?, ?)").run(processId, task.id);
      }

      // Log action
      db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(agency_id, client_id, "process_started", `Process ID: ${processId}`);

      res.json({ id: processId, success: true });
    } catch (error: any) {
      console.error('Error in /api/processes/start:', error);
      if (error.stack) console.error(error.stack);
      res.status(500).json({ error: error.message || "Internal server error", stack: error.stack });
    }
  });

  app.get("/api/audit-logs", (req, res) => {
    const logs = db.prepare(`
      SELECT l.*, u.name as user_name, a.name as agency_name 
      FROM audit_logs l 
      LEFT JOIN users u ON l.user_id = u.id 
      LEFT JOIN agencies a ON l.agency_id = a.id 
      ORDER BY l.created_at DESC
      LIMIT 100
    `).all();
    res.json(logs);
  });

  app.get("/api/agencies", (req, res) => {
    const agencies = db.prepare(`
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
    `).all();
    res.json(agencies);
  });

  app.get("/api/agencies/:id", (req, res) => {
    const agency = db.prepare(`
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
      WHERE a.id = ?
    `).get(req.params.id);
    if (!agency) {
      return res.status(404).json({ error: "Agência não encontrada" });
    }
    res.json(agency);
  });

  app.post("/api/agencies", (req, res) => {
    console.log('Recebendo requisição para criar agência:', req.body);
    const { name, slug, has_finance, admin_name, admin_email, admin_password } = req.body;
    
    const transaction = db.transaction(() => {
      try {
        const modules = JSON.stringify({ finance: has_finance, chat: true, pipefy: req.body.has_pipefy !== undefined ? req.body.has_pipefy : true });
        const agencyResult = db.prepare("INSERT INTO agencies (name, slug, modules) VALUES (?, ?, ?)").run(name, slug, modules);
        const agencyId = agencyResult.lastInsertRowid;

        let auditUserId = getAuditUserId(null);

        if (admin_email && admin_password) {
          const adminInsertResult = db.prepare("INSERT INTO users (email, password, name, role, agency_id) VALUES (?, ?, ?, 'supervisor', ?)").run(
            admin_email,
            admin_password,
            admin_name || `Admin ${name}`,
            agencyId
          );
          auditUserId = Number(adminInsertResult.lastInsertRowid);
        }

        db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(agencyId, auditUserId, "agency_created", `Agência criada: ${name}`);

        return { id: agencyId };
      } catch (e: any) {
        throw e;
      }
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed: users.email")) {
        res.status(400).json({ error: "Email do administrador já cadastrado" });
      } else if (e.message.includes("UNIQUE constraint failed: agencies.slug")) {
        res.status(400).json({ error: "Slug da agência já existe" });
      } else {
        res.status(500).json({ error: "Erro ao criar agência" });
      }
    }
  });

  app.put("/api/agencies/:id", (req, res) => {
    console.log(`Recebendo requisição para atualizar agência ${req.params.id}:`, req.body);
    const { name, slug, has_finance, has_pipefy } = req.body;
    const modules = JSON.stringify({ finance: has_finance, chat: true, pipefy: has_pipefy });
    try {
      db.prepare("UPDATE agencies SET name = ?, slug = ?, modules = ? WHERE id = ?").run(name, slug, modules, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed: agencies.slug")) {
        res.status(400).json({ error: "Slug da agência já existe" });
      } else {
        res.status(500).json({ error: "Erro ao atualizar agência" });
      }
    }
  });

  app.delete("/api/agencies/:id", (req, res) => {
    const agencyId = Number(req.params.id);

    if (!agencyId) {
      return res.status(400).json({ error: "ID de agência inválido" });
    }

    const agency = db.prepare("SELECT id, name FROM agencies WHERE id = ?").get(agencyId) as { id: number; name: string } | undefined;
    if (!agency) {
      return res.status(404).json({ error: "Agência não encontrada" });
    }

    const deleteAgencyTransaction = db.transaction((targetAgencyId: number) => {
      db.prepare("DELETE FROM process_tasks WHERE process_id IN (SELECT id FROM processes WHERE agency_id = ?)").run(targetAgencyId);
      db.prepare("DELETE FROM documents WHERE process_id IN (SELECT id FROM processes WHERE agency_id = ?)").run(targetAgencyId);
      db.prepare("DELETE FROM messages WHERE process_id IN (SELECT id FROM processes WHERE agency_id = ?)").run(targetAgencyId);
      db.prepare("DELETE FROM form_responses WHERE process_id IN (SELECT id FROM processes WHERE agency_id = ?)").run(targetAgencyId);
      db.prepare("DELETE FROM financials WHERE process_id IN (SELECT id FROM processes WHERE agency_id = ?)").run(targetAgencyId);

      db.prepare("DELETE FROM forms WHERE visa_type_id IN (SELECT id FROM visa_types WHERE agency_id = ?)").run(targetAgencyId);

      db.prepare("DELETE FROM processes WHERE agency_id = ?").run(targetAgencyId);
      db.prepare("DELETE FROM visa_types WHERE agency_id = ?").run(targetAgencyId);
      db.prepare("DELETE FROM tasks WHERE agency_id = ?").run(targetAgencyId);
      db.prepare("DELETE FROM expenses WHERE agency_id = ?").run(targetAgencyId);
      db.prepare("DELETE FROM revenues WHERE agency_id = ?").run(targetAgencyId);

      db.prepare("DELETE FROM audit_logs WHERE agency_id = ? OR user_id IN (SELECT id FROM users WHERE agency_id = ?)").run(targetAgencyId, targetAgencyId);

      db.prepare("DELETE FROM users WHERE agency_id = ?").run(targetAgencyId);
      db.prepare("DELETE FROM agencies WHERE id = ?").run(targetAgencyId);
    });

    try {
      deleteAgencyTransaction(agencyId);
      return res.json({ success: true, deleted_agency_id: agencyId, deleted_agency_name: agency.name });
    } catch (error) {
      return res.status(500).json({ error: "Erro ao excluir agência e dados vinculados" });
    }
  });

  app.get("/api/agencies/by-slug/:slug", (req, res) => {
    const agency = db.prepare("SELECT * FROM agencies WHERE slug = ?").get(req.params.slug);
    if (agency) {
      res.json(agency);
    } else {
      res.status(404).json({ error: "Agency not found" });
    }
  });

  app.put("/api/agencies/:id/settings", (req, res) => {
    const { name, logo_url, pre_form_questions } = req.body;
    console.log(`Updating settings for agency ${req.params.id}:`, { name, logo_url, preFormQuestionsCount: pre_form_questions?.length });
    try {
      db.prepare("UPDATE agencies SET name = ?, logo_url = ?, pre_form_questions = ? WHERE id = ?").run(
        name, 
        logo_url, 
        pre_form_questions ? JSON.stringify(pre_form_questions) : null,
        req.params.id
      );
      const auditUserId = getAuditUserId(req.params.id);
      db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(req.params.id, auditUserId, "agency_settings_updated", `Configurações da agência atualizadas: ${name}`);
      res.json({ success: true });
    } catch (e) {
      console.error('Error updating agency settings:', e);
      res.status(500).json({ error: "Failed to update agency settings" });
    }
  });

  // Destinations CRUD
  app.get("/api/destinations", (req, res) => {
    const { agency_id } = req.query;
    let query = "SELECT * FROM destinations";
    let params = [];
    if (agency_id) {
      query += " WHERE agency_id = ?";
      params.push(agency_id);
    }
    query += " ORDER BY \"order\" ASC, name ASC";
    const destinations = db.prepare(query).all(...params).map((d: any) => ({
      ...d,
      highlight_points: JSON.parse(d.highlight_points || '[]')
    }));
    res.json(destinations);
  });

  app.post("/api/destinations", (req, res) => {
    const { agency_id, name, code, description, image, highlight_points, order } = req.body;
    try {
      const result = db.prepare(
        "INSERT INTO destinations (agency_id, name, code, description, image, highlight_points, \"order\") VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(agency_id, name, code, description, image, JSON.stringify(highlight_points || []), order || 0);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      console.error("Error creating destination:", e);
      res.status(500).json({ error: "Erro ao criar destino" });
    }
  });

  app.put("/api/destinations/:id", (req, res) => {
    const { name, code, description, image, highlight_points, is_active, order } = req.body;
    try {
      db.prepare(
        "UPDATE destinations SET name = ?, code = ?, description = ?, image = ?, highlight_points = ?, is_active = ?, \"order\" = ? WHERE id = ?"
      ).run(name, code, description, image, JSON.stringify(highlight_points || []), is_active ? 1 : 0, order || 0, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Error updating destination:", e);
      res.status(500).json({ error: "Erro ao atualizar destino" });
    }
  });

  app.delete("/api/destinations/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM destinations WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Error deleting destination:", e);
      res.status(500).json({ error: "Erro ao excluir destino" });
    }
  });

  app.get("/api/visa-types", (req, res) => {
    const { agency_id } = req.query;
    if (!agency_id) return res.status(400).json({ error: "agency_id is required" });
    const visaTypes = db.prepare("SELECT * FROM visa_types WHERE agency_id = ? ORDER BY created_at DESC").all(agency_id).map((v: any) => ({
      ...v,
      required_docs: JSON.parse(v.required_docs || '[]')
    }));
    res.json(visaTypes);
  });

  app.post("/api/visa-types", (req, res) => {
    const { agency_id, name, description, base_price, required_docs } = req.body;
    const result = db.prepare("INSERT INTO visa_types (agency_id, name, description, base_price, required_docs) VALUES (?, ?, ?, ?, ?)").run(agency_id, name, description, base_price, JSON.stringify(required_docs || []));
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/visa-types/:id", (req, res) => {
    const { name, description, base_price, required_docs } = req.body;
    db.prepare("UPDATE visa_types SET name = ?, description = ?, base_price = ?, required_docs = ? WHERE id = ?").run(name, description, base_price, JSON.stringify(required_docs || []), req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/visa-types/:id", (req, res) => {
    db.prepare("DELETE FROM forms WHERE visa_type_id = ?").run(req.params.id);
    db.prepare("DELETE FROM visa_types WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/forms/:visa_type_id", (req, res) => {
    const forms = db.prepare("SELECT * FROM forms WHERE visa_type_id = ?").all(req.params.visa_type_id).map((f: any) => ({
      ...f,
      fields: JSON.parse(f.fields || '[]')
    }));
    res.json(forms);
  });

  app.post("/api/forms", (req, res) => {
    const { visa_type_id, title, fields } = req.body;
    const result = db.prepare("INSERT INTO forms (visa_type_id, title, fields) VALUES (?, ?, ?)").run(visa_type_id, title, JSON.stringify(fields || []));
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/forms/:id", (req, res) => {
    const { title, fields } = req.body;
    db.prepare("UPDATE forms SET title = ?, fields = ? WHERE id = ?").run(title, JSON.stringify(fields || []), req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/forms/:id", (req, res) => {
    db.prepare("DELETE FROM forms WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/form-responses/:process_id", (req, res) => {
    const responses = db.prepare("SELECT * FROM form_responses WHERE process_id = ?").all(req.params.process_id).map((r: any) => ({
      ...r,
      data: JSON.parse(r.data || '{}')
    }));
    res.json(responses);
  });

  app.post("/api/form-responses", (req, res) => {
    const { process_id, form_id, data } = req.body;
    const existing = db.prepare("SELECT id FROM form_responses WHERE process_id = ? AND form_id = ?").get(process_id, form_id) as { id: number };
    
    if (existing) {
      db.prepare("UPDATE form_responses SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(data), existing.id);
      res.json({ id: existing.id });
    } else {
      const result = db.prepare("INSERT INTO form_responses (process_id, form_id, data) VALUES (?, ?, ?)").run(process_id, form_id, JSON.stringify(data));
      res.json({ id: result.lastInsertRowid });
    }
  });

  app.post("/api/financials/confirm-proof", upload.single('file'), (req, res) => {
    const { process_id } = req.body;
    const file = req.file;
    const proof_url = file ? `/uploads/${file.filename}` : null;

    try {
      db.prepare("UPDATE financials SET status = 'proof_received', proof_url = ? WHERE process_id = ?").run(proof_url, process_id);
      res.json({ success: true, proof_url });
    } catch (e) {
      console.error('Error confirming proof:', e);
      res.status(500).json({ error: "Failed to confirm proof" });
    }
  });

  app.post("/api/financials/validate", (req, res) => {
    const { process_id, status } = req.body; // status: 'confirmed'
    
    try {
      const transaction = db.transaction(() => {
        db.prepare("UPDATE financials SET status = ?, confirmed_at = CURRENT_TIMESTAMP WHERE process_id = ?").run(status, process_id);
        if (status === 'confirmed') {
          db.prepare("UPDATE processes SET status = 'analyzing', internal_status = 'reviewing' WHERE id = ?").run(process_id);
        }
      });

      transaction();
      res.json({ success: true });
    } catch (e) {
      console.error('Error validating financial:', e);
      res.status(500).json({ error: "Failed to validate financial" });
    }
  });

  app.post("/api/documents/validate", (req, res) => {
    const { id, status, rejection_reason } = req.body;
    db.prepare("UPDATE documents SET status = ?, rejection_reason = ? WHERE id = ?").run(status, rejection_reason || null, id);
    res.json({ success: true });
  });

  app.post("/api/documents", upload.single('file'), (req, res) => {
    const { process_id, name } = req.body;
    const file = req.file;
    const url = file ? `/uploads/${file.filename}` : null;

    try {
      const result = db.prepare("INSERT INTO documents (process_id, name, url, status) VALUES (?, ?, ?, 'uploaded')").run(process_id, name, url);
      res.json({ id: result.lastInsertRowid, url });
    } catch (e) {
      console.error('Error uploading document:', e);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });
  // Plans CRUD
  app.get("/api/plans", (req, res) => {
    const { agency_id } = req.query;
    let query = "SELECT * FROM plans";
    let params = [];
    if (agency_id) {
      query += " WHERE agency_id = ?";
      params.push(agency_id);
    }
    query += " ORDER BY price ASC";
    const plans = db.prepare(query).all(...params).map((p: any) => ({
      ...p,
      features: JSON.parse(p.features || '[]')
    }));
    res.json(plans);
  });

  app.post("/api/plans", (req, res) => {
    const { agency_id, name, description, price, features, is_recommended, icon } = req.body;
    const result = db.prepare(
      "INSERT INTO plans (agency_id, name, description, price, features, is_recommended, icon) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(agency_id, name, description, price, JSON.stringify(features || []), is_recommended ? 1 : 0, icon || 'Star');
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/plans/:id", (req, res) => {
    const { name, description, price, features, is_recommended, icon } = req.body;
    db.prepare(
      "UPDATE plans SET name = ?, description = ?, price = ?, features = ?, is_recommended = ?, icon = ? WHERE id = ?"
    ).run(name, description, price, JSON.stringify(features || []), is_recommended ? 1 : 0, icon || 'Star', req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/plans/:id", (req, res) => {
    db.prepare("DELETE FROM plans WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Form Fields CRUD
  app.get("/api/form-fields", (req, res) => {
    const { agency_id, destination_id } = req.query;
    let query = "SELECT * FROM form_fields WHERE agency_id = ?";
    let params = [agency_id];
    if (destination_id) {
      query += " AND (destination_id = ? OR destination_id IS NULL)";
      params.push(destination_id);
    }
    query += " ORDER BY \"order\" ASC";
    const fields = db.prepare(query).all(...params).map((f: any) => ({
      ...f,
      options: JSON.parse(f.options || '[]')
    }));
    res.json(fields);
  });

  app.post("/api/form-fields", (req, res) => {
    const { agency_id, destination_id, label, type, required, options, order } = req.body;
    const result = db.prepare(
      "INSERT INTO form_fields (agency_id, destination_id, label, type, required, options, \"order\") VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(agency_id, destination_id || null, label, type, required ? 1 : 0, JSON.stringify(options || []), order || 0);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/form-fields/:id", (req, res) => {
    const { destination_id, label, type, required, options, order } = req.body;
    db.prepare(
      "UPDATE form_fields SET destination_id = ?, label = ?, type = ?, required = ?, options = ?, \"order\" = ? WHERE id = ?"
    ).run(destination_id || null, label, type, required ? 1 : 0, JSON.stringify(options || []), order || 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/form-fields/:id", (req, res) => {
    db.prepare("DELETE FROM form_fields WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/processes", (req, res) => {
    const { agency_id, role, user_id } = req.query;
    let query = `
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
      query += " WHERE p.client_id = ?";
      params.push(user_id);
    } else if (role === 'consultant') {
      query += " WHERE p.consultant_id = ?";
      params.push(user_id);
    } else if (role === 'analyst') {
      query += " WHERE p.analyst_id = ? OR (p.internal_status = 'reviewing' AND p.agency_id = ?)";
      params.push(user_id, agency_id);
    } else {
      query += " WHERE p.agency_id = ?";
      params.push(agency_id);
    }

    query += " ORDER BY p.created_at DESC";

    const processes = db.prepare(query).all(...params);
    res.json(processes);
  });

  app.post("/api/processes", (req, res) => {
    const { client_id, agency_id, visa_type_id, consultant_id, analyst_id, status, internal_status } = req.body;
    
    const visa = db.prepare("SELECT base_price FROM visa_types WHERE id = ?").get(visa_type_id) as { base_price: number } | undefined;
    if (!visa) {
      return res.status(400).json({ error: "Tipo de visto inválido" });
    }

    const result = db.prepare(`
      INSERT INTO processes (client_id, agency_id, visa_type_id, consultant_id, analyst_id, status, internal_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(client_id, agency_id, visa_type_id, consultant_id || null, analyst_id || null, status || 'started', internal_status || 'pending');

    const processId = result.lastInsertRowid;
    
    // Create mandatory financial record
    db.prepare("INSERT INTO financials (process_id, amount, status) VALUES (?, ?, ?)").run(processId, visa.base_price, "pending");

    // Create process tasks from agency tasks
    const agencyTasks = db.prepare("SELECT id FROM tasks WHERE agency_id = ? AND is_active = 1").all(agency_id) as { id: number }[];
    for (const task of agencyTasks) {
      db.prepare("INSERT INTO process_tasks (process_id, task_id) VALUES (?, ?)").run(processId, task.id);
    }

    // Log action
    db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(agency_id, client_id, "process_created", `Process ID: ${processId}`);

    // Return tasks for the UI as requested
    const tasks = db.prepare(`
      SELECT pt.*, t.title, t.description 
      FROM process_tasks pt 
      JOIN tasks t ON pt.task_id = t.id 
      WHERE pt.process_id = ?
    `).all(processId);

    res.json({ id: processId, tasks });
  });

  app.put("/api/processes/:id", (req, res) => {
    const { visa_type_id, consultant_id, analyst_id, status, internal_status } = req.body;

    const existingProcess = db
      .prepare("SELECT id, status, internal_status, visa_type_id FROM processes WHERE id = ?")
      .get(req.params.id) as { id: number; status: string; internal_status: string; visa_type_id: number } | undefined;

    if (!existingProcess) {
      return res.status(404).json({ error: "Processo não encontrado" });
    }

    if (existingProcess.status === 'completed') {
      return res.status(400).json({ error: "Processos concluídos não podem ser editados" });
    }

    db.prepare(`
      UPDATE processes 
      SET visa_type_id = ?, consultant_id = ?, analyst_id = ?, status = ?, internal_status = ?
      WHERE id = ?
    `).run(
      visa_type_id !== undefined ? visa_type_id : existingProcess.visa_type_id,
      consultant_id !== undefined ? consultant_id : existingProcess.consultant_id,
      analyst_id !== undefined ? analyst_id : existingProcess.analyst_id,
      status !== undefined ? status : existingProcess.status,
      internal_status !== undefined ? internal_status : existingProcess.internal_status,
      req.params.id,
    );

    res.json({ success: true });
  });

  app.delete("/api/processes/:id", (req, res) => {
    // Transactional delete
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM process_tasks WHERE process_id = ?").run(req.params.id);
      db.prepare("DELETE FROM form_responses WHERE process_id = ?").run(req.params.id);
      db.prepare("DELETE FROM documents WHERE process_id = ?").run(req.params.id);
      db.prepare("DELETE FROM messages WHERE process_id = ?").run(req.params.id);
      db.prepare("DELETE FROM financials WHERE process_id = ?").run(req.params.id);
      db.prepare("DELETE FROM processes WHERE id = ?").run(req.params.id);
    });
    transaction();
    res.json({ success: true });
  });

  app.get("/api/processes/:id", (req, res) => {
    const process = db.prepare(`
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
      WHERE p.id = ?
    `).get(req.params.id);
    
    const documents = db.prepare("SELECT * FROM documents WHERE process_id = ?").all(req.params.id);
    const messages = db.prepare("SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.process_id = ? ORDER BY sent_at ASC").all(req.params.id);
    const financial = db.prepare("SELECT * FROM financials WHERE process_id = ?").get(req.params.id);
    const responses = db.prepare(`
      SELECT fr.*, f.title as form_title, f.fields as form_fields 
      FROM form_responses fr 
      JOIN forms f ON fr.form_id = f.id 
      WHERE fr.process_id = ?
    `).all(req.params.id);
    const dependents = db.prepare("SELECT * FROM dependents WHERE process_id = ?").all(req.params.id);
    const tasks = db.prepare(`
      SELECT pt.*, t.title, t.description 
      FROM process_tasks pt 
      JOIN tasks t ON pt.task_id = t.id 
      WHERE pt.process_id = ?
    `).all(req.params.id);
    
    res.json({ ...process, documents, messages, financial, responses, dependents, tasks });
  });

  app.post("/api/process-tasks/:id/toggle", (req, res) => {
    const { status } = req.body;
    const completed_at = status === 'completed' ? new Date().toISOString() : null;
    db.prepare("UPDATE process_tasks SET status = ?, completed_at = ? WHERE id = ?").run(status, completed_at, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/messages", (req, res) => {
    const { process_id, sender_id, content, is_proof } = req.body;
    const result = db.prepare("INSERT INTO messages (process_id, sender_id, content, is_proof) VALUES (?, ?, ?, ?)").run(process_id, sender_id, content, is_proof ? 1 : 0);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/agencies/:id/reset-password", (req, res) => {
    console.log(`Recebendo requisição para resetar senha da agência ${req.params.id}`);
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "Nova senha é obrigatória" });

    try {
      const supervisor = db.prepare("SELECT id FROM users WHERE agency_id = ? AND role = 'supervisor' LIMIT 1").get(req.params.id) as { id: number } | undefined;
      const fallbackAgencyUser = db
        .prepare("SELECT id FROM users WHERE agency_id = ? ORDER BY id ASC LIMIT 1")
        .get(req.params.id) as { id: number } | undefined;
      const userToReset = supervisor?.id || fallbackAgencyUser?.id;
      
      if (!userToReset) {
        return res.status(404).json({ error: "Administrador da agência não encontrado" });
      }

      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(new_password, userToReset);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.post("/api/users/:id/reset-password", (req, res) => {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "Nova senha é obrigatória" });

    try {
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(new_password, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.get("/api/leads", (req, res) => {
    const { agency_id } = req.query;
    
    let query = `
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
      query += " AND u.agency_id = ?";
      params.push(agency_id);
    }
    
    query += " ORDER BY u.created_at DESC";

    const leads = db.prepare(query).all(...params);
    res.json(leads);
  });

  // Expenses (Contas a Pagar)
  app.get("/api/expenses", (req, res) => {
    const { agency_id } = req.query;
    let query = "SELECT * FROM expenses";
    let params = [];
    if (agency_id) {
      query += " WHERE agency_id = ?";
      params.push(agency_id);
    }
    query += " ORDER BY due_date ASC";
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  });

  app.post("/api/expenses", (req, res) => {
    const { agency_id, description, amount, due_date, status, category } = req.body;

    if (!isFinanceModuleEnabledForAgency(agency_id)) {
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
    }

    const result = db.prepare(`
      INSERT INTO expenses (agency_id, description, amount, due_date, status, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(agency_id, description, amount, due_date, status || 'pending', category);
    const auditUserId = getAuditUserId(agency_id);
    db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(agency_id || null, auditUserId, "expense_created", `Despesa: ${description} ($${amount})`);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/expenses/:id", (req, res) => {
    const { description, amount, due_date, status, category } = req.body;

    const expense = db.prepare("SELECT agency_id FROM expenses WHERE id = ?").get(req.params.id) as { agency_id?: number } | undefined;
    if (!expense) {
      return res.status(404).json({ error: "Despesa não encontrada" });
    }

    if (!isFinanceModuleEnabledForAgency(expense.agency_id || null)) {
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
    }

    db.prepare(`
      UPDATE expenses SET description = ?, amount = ?, due_date = ?, status = ?, category = ?
      WHERE id = ?
    `).run(description, amount, due_date, status, category, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/expenses/:id", (req, res) => {
    const expense = db.prepare("SELECT agency_id FROM expenses WHERE id = ?").get(req.params.id) as { agency_id?: number } | undefined;
    if (!expense) {
      return res.status(404).json({ error: "Despesa não encontrada" });
    }

    if (!isFinanceModuleEnabledForAgency(expense.agency_id || null)) {
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
    }

    db.prepare("DELETE FROM expenses WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Revenues (Contas a Receber)
  app.get("/api/revenues", (req, res) => {
    const { agency_id } = req.query;
    let query = "SELECT * FROM revenues";
    let params = [];
    if (agency_id) {
      query += " WHERE agency_id = ?";
      params.push(agency_id);
    }
    query += " ORDER BY due_date ASC";
    const revenues = db.prepare(query).all(...params);
    res.json(revenues);
  });

  app.post("/api/revenues", (req, res) => {
    const { agency_id, description, amount, due_date, status, category } = req.body;

    if (!isFinanceModuleEnabledForAgency(agency_id)) {
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
    }

    const result = db.prepare(`
      INSERT INTO revenues (agency_id, description, amount, due_date, status, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(agency_id, description, amount, due_date, status || 'pending', category);
    const auditUserId = getAuditUserId(agency_id);
    db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(agency_id || null, auditUserId, "revenue_created", `Receita: ${description} ($${amount})`);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/revenues/:id", (req, res) => {
    const { description, amount, due_date, status, category } = req.body;

    const revenue = db.prepare("SELECT agency_id FROM revenues WHERE id = ?").get(req.params.id) as { agency_id?: number } | undefined;
    if (!revenue) {
      return res.status(404).json({ error: "Receita não encontrada" });
    }

    if (!isFinanceModuleEnabledForAgency(revenue.agency_id || null)) {
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
    }

    db.prepare(`
      UPDATE revenues SET description = ?, amount = ?, due_date = ?, status = ?, category = ?
      WHERE id = ?
    `).run(description, amount, due_date, status, category, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/revenues/:id", (req, res) => {
    const revenue = db.prepare("SELECT agency_id FROM revenues WHERE id = ?").get(req.params.id) as { agency_id?: number } | undefined;
    if (!revenue) {
      return res.status(404).json({ error: "Receita não encontrada" });
    }

    if (!isFinanceModuleEnabledForAgency(revenue.agency_id || null)) {
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
    }

    db.prepare("DELETE FROM revenues WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/clients", (req, res) => {
    const { name, email, password, phone, agency_id } = req.body;

    if (!name || !email || !agency_id) {
      return res.status(400).json({ error: "Nome, email e agência são obrigatórios" });
    }

    const passwordToUse = (password || '').trim() ? String(password).trim() : 'password';
    if (passwordToUse.length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
    }

    try {
      const result = db
        .prepare("INSERT INTO users (name, email, password, role, agency_id, phone) VALUES (?, ?, ?, 'client', ?, ?)")
        .run(name, email, passwordToUse, agency_id, phone || null);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      const message = String(e?.message || '');
      if (message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }
      if (message.includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ error: "Agência inválida para cadastro do cliente" });
      }
      return res.status(500).json({ error: "Erro ao cadastrar cliente" });
    }
  });

  app.post("/api/clients/:id/reset-password", (req, res) => {
    const clientId = Number(req.params.id);
    const { new_password, reset_by_user_id } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "Cliente inválido" });
    }

    if (!new_password || String(new_password).trim().length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
    }

    const client = db
      .prepare("SELECT id, agency_id FROM users WHERE id = ? AND role = 'client'")
      .get(clientId) as { id: number; agency_id: number } | undefined;
    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    let resetByUserId = Number(reset_by_user_id || 0);
    if (resetByUserId) {
      const resetActor = db
        .prepare("SELECT id FROM users WHERE id = ? AND (agency_id = ? OR role = 'master')")
        .get(resetByUserId, client.agency_id) as { id: number } | undefined;
      if (!resetActor) {
        resetByUserId = getAuditUserId(client.agency_id);
      }
    } else {
      resetByUserId = getAuditUserId(client.agency_id);
    }

    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(String(new_password).trim(), clientId);
    db.prepare("INSERT INTO client_password_resets (client_id, agency_id, reset_by_user_id) VALUES (?, ?, ?)")
      .run(clientId, client.agency_id, resetByUserId || null);
    res.json({ success: true });
  });

  app.get("/api/clients/password-resets", (req, res) => {
    const { agency_id } = req.query;

    if (!agency_id) {
      return res.status(400).json({ error: "agency_id é obrigatório" });
    }

    const history = db.prepare(`
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
      WHERE cpr.agency_id = ?
      ORDER BY cpr.created_at DESC, cpr.id DESC
      LIMIT 200
    `).all(agency_id);

    res.json(history);
  });

  // Agency Users (Consultants and Analysts)
  app.get("/api/agency-users", (req, res) => {
    const { agency_id } = req.query;
    let query = "SELECT id, name, email, role, agency_id, created_at FROM users WHERE role IN ('consultant', 'analyst', 'supervisor', 'gerente_financeiro')";
    let params = [];
    if (agency_id) {
      query += " AND agency_id = ?";
      params.push(agency_id);
    }
    const users = db.prepare(query).all(...params);
    res.json(users);
  });

  app.get("/api/global-users", (req, res) => {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.agency_id, a.name as agency_name, u.created_at 
      FROM users u 
      LEFT JOIN agencies a ON u.agency_id = a.id 
      WHERE u.role != 'master'
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  });

  app.post("/api/agency-users", (req, res) => {
    const { name, email, password, role, agency_id } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (name, email, password, role, agency_id) VALUES (?, ?, ?, ?, ?)").run(name, email, password, role, agency_id);
      const auditUserId = getAuditUserId(agency_id);
      db.prepare("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES (?, ?, ?, ?)").run(agency_id, auditUserId, "user_created", `Usuário criado: ${name} (${role})`);
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.put("/api/agency-users/:id", (req, res) => {
    const { name, email, role } = req.body;
    try {
      db.prepare("UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?").run(name, email, role, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.delete("/api/agency-users/:id", (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Tasks
  app.get("/api/tasks", (req, res) => {
    const { agency_id } = req.query;
    const tasks = db.prepare("SELECT * FROM tasks WHERE agency_id = ? ORDER BY created_at DESC").all(agency_id);
    res.json(tasks);
  });

  app.post("/api/tasks", (req, res) => {
    const { agency_id, title, description } = req.body;
    const result = db.prepare("INSERT INTO tasks (agency_id, title, description) VALUES (?, ?, ?)").run(agency_id, title, description);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/tasks/:id", (req, res) => {
    const { title, description, is_active } = req.body;
    db.prepare("UPDATE tasks SET title = ?, description = ?, is_active = ? WHERE id = ?").run(title, description, is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
