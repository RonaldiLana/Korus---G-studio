import "dotenv/config";
import express from "express";
import cors from "cors";
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

/**
 * Insere dados padrão para uma agência (destinos, tipos de visto, formulários,
 * tarefas, planos e campos de formulário). Idempotente: ignora tabelas que já
 * possuem registros para a agência.
 */
async function seedAgencyDefaults(agencyId: number) {
  // 1. Destinos padrão (com imagens e highlights alinhados ao frontend)
  const existingDestinations = await query(
    "SELECT id FROM destinations WHERE agency_id = $1 LIMIT 1",
    [agencyId]
  );
  const destinationIds: number[] = [];
  const defaultDestinations = [
    {
      name: 'Estados Unidos', code: 'US', flag: '🇺🇸', order: 1,
      description: 'Oportunidades ilimitadas no maior mercado do mundo. Vistos de turismo, negócios e imigração.',
      image: 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=800&q=80',
      highlight_points: ['Turismo', 'Negócios', 'Imigração'],
    },
    {
      name: 'Canadá', code: 'CA', flag: '🇨🇦', order: 2,
      description: 'Qualidade de vida e acolhimento. Explore caminhos para estudo, trabalho e residência permanente.',
      image: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=800&q=80',
      highlight_points: ['Estudo', 'Trabalho', 'Residência'],
    },
    {
      name: 'Reino Unido', code: 'GB', flag: '🇬🇧', order: 3,
      description: 'Tradição e modernidade em um dos países mais influentes do mundo. Vistos de turismo, trabalho e residência.',
      image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
      highlight_points: ['Turismo', 'Trabalho', 'Residência'],
    },
    {
      name: 'Portugal', code: 'PT', flag: '🇵🇹', order: 4,
      description: 'A porta de entrada para a Europa. Programas de residência, trabalho remoto e investimento.',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800&q=80',
      highlight_points: ['Residência', 'Trabalho', 'Investimento'],
    },
    {
      name: 'Austrália', code: 'AU', flag: '🇦🇺', order: 5,
      description: 'Estilo de vida único e economia forte. Vistos de estudante, trabalho qualificado e turismo.',
      image: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?auto=format&fit=crop&w=800&q=80',
      highlight_points: ['Estudante', 'Trabalho Qualificado', 'Turismo'],
    },
  ];

  if (existingDestinations.rows.length === 0) {
    for (const dest of defaultDestinations) {
      const destResult = await query(
        `INSERT INTO destinations (agency_id, name, code, flag, description, image, highlight_points, is_active, "order") VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8) RETURNING id`,
        [agencyId, dest.name, dest.code, dest.flag, dest.description, dest.image, JSON.stringify(dest.highlight_points), dest.order]
      );
      destinationIds.push(destResult.rows[0].id);
    }
  } else {
    const existing = await query("SELECT id FROM destinations WHERE agency_id = $1 ORDER BY \"order\" ASC", [agencyId]);
    existing.rows.forEach((r: any) => destinationIds.push(r.id));
  }

  // 2. Tipos de visto padrão
  const existingVisaTypes = await query(
    "SELECT id FROM visa_types WHERE agency_id = $1 LIMIT 1",
    [agencyId]
  );
  const visaTypeIds: number[] = [];
  if (existingVisaTypes.rows.length === 0) {
    const defaultVisaTypes = [
      { name: 'Turismo',    description: 'Visto de turismo / visitante' },
      { name: 'Estudante',  description: 'Visto para estudos no exterior' },
      { name: 'Trabalho',   description: 'Visto de trabalho temporário ou permanente' },
      { name: 'Residência', description: 'Visto de residência / imigração' },
    ];
    for (const vt of defaultVisaTypes) {
      const vtResult = await query(
        "INSERT INTO visa_types (agency_id, name, description) VALUES ($1, $2, $3) RETURNING id",
        [agencyId, vt.name, vt.description]
      );
      visaTypeIds.push(vtResult.rows[0].id);
    }
  } else {
    const existing = await query("SELECT id FROM visa_types WHERE agency_id = $1", [agencyId]);
    existing.rows.forEach((r: any) => visaTypeIds.push(r.id));
  }

  // 3. Formulários padrão vinculados à agência (agency_id obrigatório para aparecer no painel)
  for (const vtId of visaTypeIds) {
    const existingForm = await query("SELECT id FROM forms WHERE visa_type_id = $1 AND agency_id = $2 LIMIT 1", [vtId, agencyId]);
    if (existingForm.rows.length === 0) {
      await query(
        "INSERT INTO forms (agency_id, visa_type_id, title, fields) VALUES ($1, $2, $3, $4)",
        [agencyId, vtId, 'Formulário de Dados Pessoais', JSON.stringify([
          { id: 'f1', label: 'Nome completo',          type: 'text',   required: true },
          { id: 'f2', label: 'Data de nascimento',     type: 'date',   required: true },
          { id: 'f3', label: 'Número do passaporte',   type: 'text',   required: true },
          { id: 'f4', label: 'Validade do passaporte', type: 'date',   required: true },
          { id: 'f5', label: 'Estado civil',           type: 'select', required: true, options: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'] },
          { id: 'f6', label: 'Profissão',              type: 'text',   required: true },
        ])]
      );
    }
  }

  // 4. Tarefas padrão
  const existingTasks = await query("SELECT id FROM tasks WHERE agency_id = $1 LIMIT 1", [agencyId]);
  if (existingTasks.rows.length === 0) {
    const defaultTasks = [
      { title: 'Documentação pessoal',      description: 'Coleta de documentos pessoais do cliente' },
      { title: 'Formulário de solicitação', description: 'Preenchimento do formulário de solicitação de visto' },
      { title: 'Análise documental',        description: 'Análise e validação dos documentos enviados' },
      { title: 'Agendamento',               description: 'Agendamento da entrevista / biometria' },
      { title: 'Acompanhamento',            description: 'Acompanhamento do processo junto ao consulado' },
      { title: 'Entrega do visto',          description: 'Recebimento e entrega do visto ao cliente' },
    ];
    for (const task of defaultTasks) {
      await query(
        "INSERT INTO tasks (agency_id, title, description, is_active) VALUES ($1, $2, $3, true)",
        [agencyId, task.title, task.description]
      );
    }
  }

  // 5. Planos padrão
  const existingPlans = await query("SELECT id FROM plans WHERE agency_id = $1 LIMIT 1", [agencyId]);
  if (existingPlans.rows.length === 0) {
    const defaultPlans = [
      { name: 'Básico',    description: 'Assessoria básica para solicitação de visto',          price: 500,  features: ['Orientação documental', 'Preenchimento de formulário', 'Suporte por e-mail'], is_recommended: false, icon: 'Star' },
      { name: 'Standard',  description: 'Assessoria completa com acompanhamento',               price: 1200, features: ['Tudo do plano Básico', 'Acompanhamento do processo', 'Suporte por WhatsApp', 'Preparação para entrevista'], is_recommended: true, icon: 'Shield' },
      { name: 'Premium',   description: 'Assessoria premium com atendimento prioritário',       price: 2500, features: ['Tudo do plano Standard', 'Atendimento prioritário', 'Consultoria personalizada', 'Suporte 24h', 'Acompanhamento pós-visto'], is_recommended: false, icon: 'Crown' },
    ];
    for (const plan of defaultPlans) {
      await query(
        "INSERT INTO plans (agency_id, name, description, price, features, is_recommended, icon) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [agencyId, plan.name, plan.description, plan.price, JSON.stringify(plan.features), plan.is_recommended, plan.icon]
      );
    }
  }

  // 6. Campos de formulário padrão
  const existingFormFields = await query("SELECT id FROM form_fields WHERE agency_id = $1 LIMIT 1", [agencyId]);
  if (existingFormFields.rows.length === 0) {
    const defaultFormFields = [
      { label: 'Nome completo',      type: 'text',   required: true,  order: 1, options: null },
      { label: 'E-mail',             type: 'email',  required: true,  order: 2, options: null },
      { label: 'Telefone',           type: 'phone',  required: true,  order: 3, options: null },
      { label: 'Data de nascimento', type: 'date',   required: true,  order: 4, options: null },
      { label: 'Destino desejado',   type: 'select', required: true,  order: 5, options: defaultDestinations.map(d => d.name) },
    ];
    for (const field of defaultFormFields) {
      await query(
        `INSERT INTO form_fields (agency_id, label, type, required, options, "order") VALUES ($1, $2, $3, $4, $5, $6)`,
        [agencyId, field.label, field.type, field.required, field.options ? JSON.stringify(field.options) : null, field.order]
      );
    }
  }

  console.log(`[SEED] Dados padrão garantidos para agência ${agencyId}`);
}

async function startServer() {
  try {
    console.log('[BOOT] Iniciando servidor...');
    await testConnection();
    console.log('[BOOT] Banco de dados conectado com sucesso');

    await initializeDatabase();
    console.log('[BOOT] Banco inicializado com sucesso');
  } catch (dbError) {
    console.error('[BOOT] ✗ Falha na conexão com banco de dados');
    console.error(dbError);
    process.exit(1);
  }

  const app = express();

  // CORS: permitir frontend em produção e localhost
  app.use(cors({
    origin: [
      'https://korus-frontend.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  }));
  const PORT = Number(process.env.PORT);
  if (!PORT) {
    console.error('[BOOT] PORT não definida');
    throw new Error("PORT environment variable is required");
  }

  app.use(express.json());
  app.use(cors());
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
    try {
      const { email, password } = req.body;

      // Validar campos obrigatórios
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Email e senha são obrigatórios"
        });
      }

      // Buscar usuário
      const user = await query(`
        SELECT u.*, a.modules as agency_modules
        FROM users u
        LEFT JOIN agencies a ON u.agency_id = a.id
        WHERE LOWER(u.email) = LOWER($1) AND u.password = $2
      `, [email, password]);

      // Credenciais válidas
      if (user.rows[0]) {
        const userData = user.rows[0];
        const { password, ...userWithoutPassword } = userData;
        
        // Ensure all required fields are present
        const completeUser = {
          ...userWithoutPassword,
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          agency_id: userData.agency_id || null,
          agency_modules: userData.agency_modules || null
        };
        
        return res.json({
          success: true,
          user: completeUser
        });
      }

      // Credenciais inválidas
      return res.status(401).json({
        success: false,
        error: "Credenciais inválidas"
      });

    } catch (err: any) {
      console.error('[LOGIN ERROR]', err);
      return res.status(500).json({
        success: false,
        error: "Erro interno no servidor"
      });
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

  interface StartProcessBody {
    client_id: number | string;
    agency_id: number | string;
    visa_type_id?: number | string | null;
    destination_id?: number | string | null;
    plan_id?: number | string | null;
    is_dependent?: boolean | string | number | null;
    parent_process_id?: number | string | null;
    dependents?: Array<Record<string, unknown>> | null;
    travel_date?: string | null;
    form_responses?: Record<string, unknown> | null;
    service_id?: number | string | null;
  }

  // ---
  // PATCH: Compatibilidade client_id/user_id + query dinâmica segura
  // ---
  app.post("/api/processes/start", async (req, res) => {
    console.log("BODY RECEBIDO:", req.body);
    try {
      const clientId = Number(req.body.user_id ?? req.body.client_id);
      const agencyId = Number(req.body.agency_id);
      if (!clientId || !agencyId || isNaN(clientId) || isNaN(agencyId)) {
        return res.status(400).json({
          error: "user_id/client_id e agency_id são obrigatórios"
        });
      }

      const data: Record<string, any> = {
        client_id: clientId,
        agency_id: agencyId,
        status: "waiting_payment"
      };

      // Valida destination_id: precisa existir e pertencer à agência
      const rawDestinationId = req.body.destination_id;
      if (rawDestinationId !== undefined && rawDestinationId !== null && rawDestinationId !== "" && !isNaN(Number(rawDestinationId))) {
        const destCheck = await query(
          "SELECT id FROM destinations WHERE id = $1 AND agency_id = $2",
          [Number(rawDestinationId), agencyId]
        );
        if (destCheck.rows.length > 0) {
          data.destination_id = Number(rawDestinationId);
        } else {
          // destination_id inválido para esta agência: ignora silenciosamente para não quebrar o processo
          console.warn(`[PROCESS START] destination_id=${rawDestinationId} não pertence à agência ${agencyId}, será ignorado`);
        }
      }

      // Valida plan_id: precisa existir e pertencer à agência
      const rawPlanId = req.body.plan_id;
      if (rawPlanId !== undefined && rawPlanId !== null && rawPlanId !== "" && !isNaN(Number(rawPlanId))) {
        const planCheck = await query(
          "SELECT id FROM plans WHERE id = $1 AND agency_id = $2",
          [Number(rawPlanId), agencyId]
        );
        if (planCheck.rows.length > 0) {
          data.plan_id = Number(rawPlanId);
        } else {
          console.warn(`[PROCESS START] plan_id=${rawPlanId} não pertence à agência ${agencyId}, será ignorado`);
        }
      }

      // Valida visa_type_id: precisa existir e pertencer à agência
      const rawVisaTypeId = req.body.visa_type_id;
      if (rawVisaTypeId !== undefined && rawVisaTypeId !== null && rawVisaTypeId !== "" && !isNaN(Number(rawVisaTypeId))) {
        const vtCheck = await query(
          "SELECT id FROM visa_types WHERE id = $1 AND agency_id = $2",
          [Number(rawVisaTypeId), agencyId]
        );
        if (vtCheck.rows.length > 0) {
          data.visa_type_id = Number(rawVisaTypeId);
        } else {
          console.warn(`[PROCESS START] visa_type_id=${rawVisaTypeId} não pertence à agência ${agencyId}, será ignorado`);
        }
      }

      // Demais campos opcionais sem FK de agência
      const simpleOptionalFields = ["service_id", "parent_process_id"];
      for (const field of simpleOptionalFields) {
        const value = req.body[field];
        if (value !== undefined && value !== null && value !== "" && !isNaN(Number(value))) {
          data[field] = Number(value);
        }
      }

      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const result = await query(
        `INSERT INTO processes (${keys.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        values
      );
      const processId = result.rows[0]?.id;
      if (!processId) {
        throw new Error("Falha ao criar processo");
      }

      // Salvar travel_date
      if (req.body.travel_date) {
        try {
          await query("UPDATE processes SET travel_date = $1 WHERE id = $2", [req.body.travel_date, processId]);
        } catch (_) { /* coluna pode não existir ainda */ }
      }

      // Salvar dependentes
      const dependents: any[] = req.body.dependents || [];
      for (const dep of dependents) {
        try {
          await query(
            "INSERT INTO dependents (process_id, name, birth_date, relationship) VALUES ($1, $2, $3, $4)",
            [processId, dep.name || '', dep.birth_date || null, dep.relationship || null]
          );
        } catch (_) { /* ignorar se tabela não existir */ }
      }

      // Salvar form_responses iniciais (preenchimento feito antes do processo)
      const formResponses: Record<string, any> = req.body.form_responses || {};
      for (const [formId, responseData] of Object.entries(formResponses)) {
        try {
          if (responseData && Object.keys(responseData).length > 0) {
            await query(
              "INSERT INTO form_responses (process_id, form_id, data, status) VALUES ($1, $2, $3, 'in_progress') ON CONFLICT DO NOTHING",
              [processId, Number(formId), JSON.stringify(responseData)]
            );
          }
        } catch (_) { /* ignorar erros */ }
      }

      // Criar registro financeiro pendente
      try {
        const planRow = data.plan_id
          ? (await query("SELECT price FROM plans WHERE id = $1", [data.plan_id])).rows[0]
          : null;
        const amount = planRow?.price || 0;
        await query(
          "INSERT INTO financials (process_id, amount, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING",
          [processId, amount]
        );
      } catch (_) { /* financials pode já ter constraint */ }

      // Audit log
      try {
        await query(
          "INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)",
          [agencyId, clientId, "process_started", `Process ID: ${processId}`]
        );
      } catch (_) {}

      return res.json({ processId });
    } catch (error: any) {
      console.error("[PROCESS START ERROR]", error);
      return res.status(500).json({
        error: error.message || "Erro interno ao criar processo"
      });
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

  app.delete("/api/audit-logs", async (req, res) => {
    try {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o usuário master pode excluir logs.' });
      }

      const userCheck = await query(
        "SELECT id FROM users WHERE id = $1 AND role = 'master'",
        [user_id]
      );

      if (userCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o usuário master pode excluir logs.' });
      }

      await query("DELETE FROM audit_logs", []);
      res.json({ success: true });
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
        return res.status(404).json({ error: "Agência não encontrada" });
      }
      res.json(agencyResult.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agencies", async (req, res) => {
    console.log('Recebendo requisição para criar agência:', req.body);
    if (!req.body) return res.status(400).json({ error: 'Corpo da requisição inválido' });
    const { name, slug, has_finance, admin_name, admin_email, admin_password } = req.body;

    try {
      await query('BEGIN', []);

      const modules = JSON.stringify({ finance: has_finance, chat: true, pipefy: req.body.has_pipefy !== undefined ? req.body.has_pipefy : true, leads: req.body.has_leads !== undefined ? req.body.has_leads : true });
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

      // Seed de dados padrão (destinos, tipos de visto, formulários, tarefas, planos e campos)
      await seedAgencyDefaults(agencyId);

      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agencyId, auditUserId, "agency_created", `Agência criada: ${name}`]);

      await query('COMMIT', []);
      res.json({ id: agencyId });
    } catch (e: any) {
      await query('ROLLBACK', []);
      if (e.message.includes("duplicate key value violates unique constraint") && e.message.includes("users_email_key")) {
        res.status(400).json({ error: "Email do administrador já cadastrado" });
      } else if (e.message.includes("duplicate key value violates unique constraint") && e.message.includes("agencies_slug_key")) {
        res.status(400).json({ error: "Slug da agência já existe" });
      } else {
        console.error('[AGENCY CREATE ERROR]', e);
        res.status(500).json({ error: "Erro ao criar agência" });
      }
    }
  });

  app.put("/api/agencies/:id", async (req, res) => {
    console.log(`Recebendo requisição para atualizar agência ${req.params.id}:`, req.body);
    const { name, slug, has_finance, has_pipefy } = req.body;
    const has_leads = req.body.has_leads !== undefined ? req.body.has_leads : true;
    const modules = JSON.stringify({ finance: has_finance, chat: true, pipefy: has_pipefy, leads: has_leads });
    try {
      await query("UPDATE agencies SET name = $1, slug = $2, modules = $3 WHERE id = $4", [name, slug, modules, req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes("duplicate key value violates unique constraint") && e.message.includes("agencies_slug_key")) {
        res.status(400).json({ error: "Slug da agência já existe" });
      } else {
        res.status(500).json({ error: "Erro ao atualizar agência" });
      }
    }
  });

  // Backfill de dados padrão para agências existentes que não os possuem
  app.post("/api/agencies/:id/seed-defaults", async (req, res) => {
    const agencyId = Number(req.params.id);
    if (!agencyId) return res.status(400).json({ error: "ID de agência inválido" });
    const agency = await query("SELECT id FROM agencies WHERE id = $1", [agencyId]);
    if (agency.rows.length === 0) return res.status(404).json({ error: "Agência não encontrada" });
    try {
      await seedAgencyDefaults(agencyId);
      res.json({ success: true, message: `Dados padrão aplicados à agência ${agencyId}` });
    } catch (e: any) {
      console.error('[SEED DEFAULTS ERROR]', e);
      res.status(500).json({ error: e.message || "Erro ao aplicar dados padrão" });
    }
  });

  app.delete("/api/agencies/:id", async (req, res) => {
    const agencyId = Number(req.params.id);

    if (!agencyId) {
      return res.status(400).json({ error: "ID de agência inválido" });
    }

    try {
      const agencyResult = await query("SELECT id, name FROM agencies WHERE id = $1", [agencyId]);
      if (agencyResult.rows.length === 0) {
        return res.status(404).json({ error: "Agência não encontrada" });
      }
      const agency = agencyResult.rows[0];

      await query('BEGIN', []);

      await query("DELETE FROM process_tasks WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM documents WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM messages WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM form_responses WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM financials WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);
      await query("DELETE FROM dependents WHERE process_id IN (SELECT id FROM processes WHERE agency_id = $1)", [agencyId]);

      await query("DELETE FROM process_forms WHERE form_id IN (SELECT id FROM forms WHERE visa_type_id IN (SELECT id FROM visa_types WHERE agency_id = $1) OR agency_id = $1)", [agencyId, agencyId]);
      await query("DELETE FROM forms WHERE visa_type_id IN (SELECT id FROM visa_types WHERE agency_id = $1) OR agency_id = $1", [agencyId, agencyId]);

      await query("DELETE FROM processes WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM form_fields WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM visa_types WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM destinations WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM plans WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM tasks WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM expenses WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM revenues WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM client_password_resets WHERE agency_id = $1", [agencyId]);

      await query("DELETE FROM audit_logs WHERE agency_id = $1 OR user_id IN (SELECT id FROM users WHERE agency_id = $1)", [agencyId]);

      await query("DELETE FROM users WHERE agency_id = $1", [agencyId]);
      await query("DELETE FROM agencies WHERE id = $1", [agencyId]);

      await query('COMMIT', []);
      return res.json({ success: true, deleted_agency_id: agencyId, deleted_agency_name: agency.name });
    } catch (error: any) {
      await query('ROLLBACK', []);
      console.error('[DELETE AGENCY ERROR]', error.message || error);
      return res.status(500).json({ error: error.message || "Erro ao excluir agência e dados vinculados" });
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
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [req.params.id, auditUserId, "agency_settings_updated", `Configurações da agência atualizadas: ${name}`]);
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
    console.log('[POST /api/visa-types] Dados recebidos:', req.body);
    try {
      if (!agency_id || !name || !description || base_price === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
      }
      const result = await query(
        "INSERT INTO visa_types (agency_id, name, description, base_price, required_docs) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [agency_id, name, description, base_price, JSON.stringify(required_docs || [])]
      );
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      console.error('[POST /api/visa-types] Erro:', err);
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

  // ─── FORMS (listagem geral + por visto/destino/agência) ────────────────────

  app.get("/api/forms", async (req, res) => {
    const { agency_id, visa_type_id, destination_id } = req.query;
    try {
      let sql = `
        SELECT f.*, vt.name as visa_type_name, d.name as destination_name
        FROM forms f
        LEFT JOIN visa_types vt ON f.visa_type_id = vt.id
        LEFT JOIN destinations d ON f.destination_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (agency_id) { params.push(agency_id); sql += ` AND f.agency_id = $${params.length}`; }
      if (visa_type_id) { params.push(visa_type_id); sql += ` AND f.visa_type_id = $${params.length}`; }
      if (destination_id) { params.push(destination_id); sql += ` AND f.destination_id = $${params.length}`; }
      sql += ' ORDER BY f.created_at DESC';
      const forms = await query(sql, params);
      res.json(forms.rows.map((f: any) => ({ ...f, fields: JSON.parse(f.fields || '[]') })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/forms/:visa_type_id", async (req, res) => {
    try {
      const forms = await query(
        `SELECT f.*, vt.name as visa_type_name, d.name as destination_name
         FROM forms f
         LEFT JOIN visa_types vt ON f.visa_type_id = vt.id
         LEFT JOIN destinations d ON f.destination_id = d.id
         WHERE f.visa_type_id = $1 ORDER BY f.created_at DESC`,
        [req.params.visa_type_id]
      );
      res.json(forms.rows.map((f: any) => ({ ...f, fields: JSON.parse(f.fields || '[]') })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/forms", async (req, res) => {
    const { agency_id, visa_type_id, destination_id, title, fields } = req.body;
    try {
      const result = await query(
        "INSERT INTO forms (agency_id, visa_type_id, destination_id, title, fields) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [agency_id || null, visa_type_id || null, destination_id || null, title, JSON.stringify(fields || [])]
      );
      res.json({ id: result.rows[0].id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/forms/:id", async (req, res) => {
    const { agency_id, visa_type_id, destination_id, title, fields } = req.body;
    try {
      await query(
        "UPDATE forms SET agency_id = $1, visa_type_id = $2, destination_id = $3, title = $4, fields = $5 WHERE id = $6",
        [agency_id || null, visa_type_id || null, destination_id || null, title, JSON.stringify(fields || []), req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/forms/:id", async (req, res) => {
    try {
      await query("DELETE FROM process_forms WHERE form_id = $1", [req.params.id]);
      await query("DELETE FROM form_responses WHERE form_id = $1", [req.params.id]);
      await query("DELETE FROM forms WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── PROCESS FORMS (vinculação formulário ↔ processo) ──────────────────────

  app.get("/api/process-forms/:process_id", async (req, res) => {
    try {
      const result = await query(`
        SELECT
          pf.*,
          f.title as form_title,
          f.fields as form_fields,
          f.agency_id,
          f.visa_type_id,
          f.destination_id,
          ab.name as assigned_by_name,
          fr.id as response_id,
          fr.data as response_data,
          fr.status as response_status,
          fr.updated_at as response_updated_at
        FROM process_forms pf
        JOIN forms f ON pf.form_id = f.id
        LEFT JOIN users ab ON pf.assigned_by = ab.id
        LEFT JOIN form_responses fr ON fr.process_id = pf.process_id AND fr.form_id = pf.form_id
        WHERE pf.process_id = $1
        ORDER BY pf.assigned_at ASC
      `, [req.params.process_id]);

      const rows = result.rows.map((row: any) => {
        const fields: any[] = JSON.parse(row.form_fields || '[]');
        const data: Record<string, any> = JSON.parse(row.response_data || '{}');
        const requiredFields = fields.filter((f: any) => f.required);
        const filledRequired = requiredFields.filter((f: any) => {
          const val = data[f.id !== undefined ? f.id : f.label];
          return val !== undefined && val !== null && String(val).trim() !== '';
        });
        const progress = requiredFields.length > 0
          ? Math.round((filledRequired.length / requiredFields.length) * 100)
          : (Object.keys(data).length > 0 ? 100 : 0);

        return {
          ...row,
          form_fields: fields,
          response_data: data,
          progress,
          required_count: requiredFields.length,
          filled_required_count: filledRequired.length,
        };
      });

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/process-forms", async (req, res) => {
    const { process_id, form_id, assigned_by } = req.body;
    try {
      const result = await query(
        "INSERT INTO process_forms (process_id, form_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT (process_id, form_id) DO NOTHING RETURNING id",
        [process_id, form_id, assigned_by || null]
      );
      // Criar form_response inicial se ainda não existir
      await query(
        "INSERT INTO form_responses (process_id, form_id, data, status) VALUES ($1, $2, '{}', 'open') ON CONFLICT DO NOTHING",
        [process_id, form_id]
      );
      res.json({ id: result.rows[0]?.id || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/process-forms/:id", async (req, res) => {
    try {
      // Buscar process_id e form_id antes de deletar para limpar form_responses
      const pf = await query("SELECT process_id, form_id FROM process_forms WHERE id = $1", [req.params.id]);
      if (pf.rows[0]) {
        await query("DELETE FROM form_responses WHERE process_id = $1 AND form_id = $2", [pf.rows[0].process_id, pf.rows[0].form_id]);
      }
      await query("DELETE FROM process_forms WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FORM RESPONSES ─────────────────────────────────────────────────────────

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
      // Calcular status automaticamente baseado no progresso
      const formResult = await query("SELECT fields FROM forms WHERE id = $1", [form_id]);
      const fields: any[] = JSON.parse(formResult.rows[0]?.fields || '[]');
      const requiredFields = fields.filter((f: any) => f.required);
      const filledRequired = requiredFields.filter((f: any) => {
        const val = data[f.id !== undefined ? f.id : f.label];
        return val !== undefined && val !== null && String(val).trim() !== '';
      });
      const allRequiredFilled = requiredFields.length === 0 || filledRequired.length >= requiredFields.length;
      const hasAnyData = Object.keys(data || {}).length > 0;
      const newStatus = allRequiredFilled && hasAnyData ? 'submitted' : hasAnyData ? 'in_progress' : 'open';

      const existingResult = await query("SELECT id, status FROM form_responses WHERE process_id = $1 AND form_id = $2", [process_id, form_id]);

      let responseId: number;
      if (existingResult.rows.length > 0) {
        // Não retroagir de submitted para in_progress pela equipe
        const currentStatus = existingResult.rows[0].status;
        const finalStatus = currentStatus === 'locked' ? 'locked' : newStatus;
        await query(
          "UPDATE form_responses SET data = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
          [JSON.stringify(data), finalStatus, existingResult.rows[0].id]
        );
        responseId = existingResult.rows[0].id;
      } else {
        const result = await query(
          "INSERT INTO form_responses (process_id, form_id, data, status) VALUES ($1, $2, $3, $4) RETURNING id",
          [process_id, form_id, JSON.stringify(data), newStatus]
        );
        responseId = result.rows[0].id;
      }
      res.json({ id: responseId, status: newStatus, progress: requiredFields.length > 0 ? Math.round((filledRequired.length / requiredFields.length) * 100) : 100 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Edição de respostas pela equipe (master, supervisor, consultor, analista, financeiro)
  app.put("/api/form-responses/:id", async (req, res) => {
    const { data } = req.body;
    try {
      const existing = await query("SELECT id, form_id, status FROM form_responses WHERE id = $1", [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: "Resposta não encontrada" });

      const formId = existing.rows[0].form_id;
      const formResult = await query("SELECT fields FROM forms WHERE id = $1", [formId]);
      const fields: any[] = JSON.parse(formResult.rows[0]?.fields || '[]');
      const requiredFields = fields.filter((f: any) => f.required);
      const filledRequired = requiredFields.filter((f: any) => {
        const val = data[f.id !== undefined ? f.id : f.label];
        return val !== undefined && val !== null && String(val).trim() !== '';
      });
      const allRequiredFilled = requiredFields.length === 0 || filledRequired.length >= requiredFields.length;
      const hasAnyData = Object.keys(data || {}).length > 0;
      const newStatus = allRequiredFilled && hasAnyData ? 'submitted' : hasAnyData ? 'in_progress' : 'open';

      await query(
        "UPDATE form_responses SET data = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
        [JSON.stringify(data), newStatus, req.params.id]
      );
      res.json({ success: true, status: newStatus });
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
        return res.status(400).json({ error: "Tipo de visto inválido" });
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
        return res.status(404).json({ error: "Processo não encontrado" });
      }
      const existingProcess = existingProcessResult.rows[0];

      if (existingProcess.status === 'completed') {
        return res.status(400).json({ error: "Processos concluídos não podem ser editados" });
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
      const { user_id, role } = req.query;

      // Verificar no banco se o usuário realmente tem role master
      if (!user_id || !role) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o usuário master pode excluir processos.' });
      }

      const userCheck = await query(
        "SELECT id FROM users WHERE id = $1 AND role = 'master'",
        [user_id]
      );

      if (userCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o usuário master pode excluir processos.' });
      }

      const processId = req.params.id;

      await query('BEGIN', []);
      // Remover FK self-referenciante (processos filhos) antes de deletar o processo pai
      await query("UPDATE processes SET parent_process_id = NULL WHERE parent_process_id = $1", [processId]);
      await query("DELETE FROM process_tasks WHERE process_id = $1", [processId]);
      await query("DELETE FROM form_responses WHERE process_id = $1", [processId]);
      await query("DELETE FROM process_forms WHERE process_id = $1", [processId]);
      await query("DELETE FROM documents WHERE process_id = $1", [processId]);
      await query("DELETE FROM messages WHERE process_id = $1", [processId]);
      await query("DELETE FROM financials WHERE process_id = $1", [processId]);
      await query("DELETE FROM dependents WHERE process_id = $1", [processId]);
      await query("DELETE FROM processes WHERE id = $1", [processId]);
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
          pl.name as plan_name,
          cu.name as consultant_name,
          cu.email as consultant_email,
          an.name as analyst_name
        FROM processes p
        JOIN users u ON p.client_id = u.id
        LEFT JOIN visa_types v ON p.visa_type_id = v.id
        LEFT JOIN destinations d ON p.destination_id = d.id
        LEFT JOIN plans pl ON p.plan_id = pl.id
        LEFT JOIN users cu ON p.consultant_id = cu.id
        LEFT JOIN users an ON p.analyst_id = an.id
        WHERE p.id = $1
      `, [req.params.id]);

      if (processResult.rows.length === 0) {
        return res.status(404).json({ error: "Processo não encontrado" });
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

      // Buscar process_forms com progresso calculado
      const processFormsResult = await query(`
        SELECT
          pf.*,
          f.title as form_title,
          f.fields as form_fields,
          ab.name as assigned_by_name,
          fr.id as response_id,
          fr.data as response_data,
          fr.status as response_status,
          fr.updated_at as response_updated_at
        FROM process_forms pf
        JOIN forms f ON pf.form_id = f.id
        LEFT JOIN users ab ON pf.assigned_by = ab.id
        LEFT JOIN form_responses fr ON fr.process_id = pf.process_id AND fr.form_id = pf.form_id
        WHERE pf.process_id = $1
        ORDER BY pf.assigned_at ASC
      `, [req.params.id]);

      const processFormsWithProgress = processFormsResult.rows.map((row: any) => {
        const fields: any[] = JSON.parse(row.form_fields || '[]');
        const data: Record<string, any> = JSON.parse(row.response_data || '{}');
        const requiredFields = fields.filter((f: any) => f.required);
        const filledRequired = requiredFields.filter((f: any) => {
          const val = data[f.id !== undefined ? f.id : f.label];
          return val !== undefined && val !== null && String(val).trim() !== '';
        });
        const progress = requiredFields.length > 0
          ? Math.round((filledRequired.length / requiredFields.length) * 100)
          : (Object.keys(data).length > 0 ? 100 : 0);
        return { ...row, form_fields: fields, response_data: data, progress, required_count: requiredFields.length, filled_required_count: filledRequired.length };
      });

      res.json({
        ...process,
        documents: documentsResult.rows,
        messages: messagesResult.rows,
        financial: financialResult.rows[0] || null,
        responses: responsesResult.rows,
        dependents: dependentsResult.rows,
        tasks: tasksResult.rows,
        process_forms: processFormsWithProgress,
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
    console.log(`Recebendo requisição para resetar senha da agência ${req.params.id}`);
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "Nova senha é obrigatória" });

    try {
      const supervisorResult = await query("SELECT id FROM users WHERE agency_id = $1 AND role = 'supervisor' LIMIT 1", [req.params.id]);
      const fallbackAgencyUserResult = await query("SELECT id FROM users WHERE agency_id = $1 ORDER BY id ASC LIMIT 1", [req.params.id]);
      const userToReset = supervisorResult.rows[0]?.id || fallbackAgencyUserResult.rows[0]?.id;

      if (!userToReset) {
        return res.status(404).json({ error: "Administrador da agência não encontrado" });
      }

      await query("UPDATE users SET password = $1 WHERE id = $2", [new_password, userToReset]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar senha" });
    }
  });

  app.post("/api/users/:id/reset-password", async (req, res) => {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "Nova senha é obrigatória" });

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
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
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
        return res.status(404).json({ error: "Despesa não encontrada" });
      }
      const expense = expenseResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(expense.agency_id || null)) {
        return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
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
        return res.status(404).json({ error: "Despesa não encontrada" });
      }
      const expense = expenseResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(expense.agency_id || null)) {
        return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
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
      return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
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
        return res.status(404).json({ error: "Receita não encontrada" });
      }
      const revenue = revenueResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(revenue.agency_id || null)) {
        return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
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
        return res.status(404).json({ error: "Receita não encontrada" });
      }
      const revenue = revenueResult.rows[0];

      if (!isFinanceModuleEnabledForAgency(revenue.agency_id || null)) {
        return res.status(403).json({ error: "Módulo financeiro desativado para esta agência" });
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
      return res.status(400).json({ error: "Nome, email e agência são obrigatórios" });
    }

    const passwordToUse = (password || '').trim() ? String(password).trim() : 'password';
    if (passwordToUse.length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
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
        return res.status(400).json({ error: "Email já cadastrado" });
      }
      if (message.includes('violates foreign key constraint')) {
        return res.status(400).json({ error: "Agência inválida para cadastro do cliente" });
      }
      return res.status(500).json({ error: "Erro ao cadastrar cliente" });
    }
  });

  app.post("/api/clients/:id/reset-password", async (req, res) => {
    const clientId = Number(req.params.id);
    const { new_password, reset_by_user_id } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "Cliente inválido" });
    }

    if (!new_password || String(new_password).trim().length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
    }

    try {
      const clientResult = await query("SELECT id, agency_id FROM users WHERE id = $1 AND role = 'client'", [clientId]);
      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado" });
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
      return res.status(400).json({ error: "agency_id é obrigatório" });
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
      await query("INSERT INTO audit_logs (agency_id, user_id, action, details) VALUES ($1, $2, $3, $4)", [agency_id, auditUserId, "user_created", `Usuário criado: ${name} (${role})`]);
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

  // Vite middleware for development only
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  // In production: backend is API-only, frontend served separately

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BOOT] ✓ Servidor rodando em http://localhost:${PORT}`);
    console.log(`[BOOT] ✓ Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
