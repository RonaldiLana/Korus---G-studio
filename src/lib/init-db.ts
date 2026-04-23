import "dotenv/config";
import { query } from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseSqlStatements(schemaSQL: string): string[] {
  const normalized = schemaSQL
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const withoutComments = normalized
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    throw new Error("No SQL statements parsed from init.sql");
  }

  return statements;
}

export async function initializeDatabase() {
  console.log("🔄 Inicializando banco de dados...");

  const schemaPath = path.join(__dirname, "../../database/init.sql");
  const schemaSQL = fs.readFileSync(schemaPath, "utf8");

  const statements = parseSqlStatements(schemaSQL);

  console.log(`📦 Executando ${statements.length} statements SQL...`);

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err: any) {
      console.error("❌ Erro ao executar statement:", statement);
      throw err;
    }
  }

  const tableCheck = await query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = 'agencies'
    ) AS exists
  `);

  if (!tableCheck.rows[0]?.exists) {
    throw new Error("❌ Tabela agencies não foi criada corretamente");
  }

  const agencyCount = await query("SELECT COUNT(*)::int AS count FROM agencies");
  const count = agencyCount.rows[0]?.count ?? 0;

  if (count === 0) {
    console.log("🌱 Inserindo dados iniciais...");
    await seedInitialData();
  }

  await ensureMasterUser();
  await applyMigrations();

  console.log("✅ Banco inicializado com sucesso");
}

/**
 * Migrações incrementais para bancos já existentes.
 * Cada ALTER é idempotente (ADD COLUMN IF NOT EXISTS).
 */
async function applyMigrations() {
  const migrations = [
    // forms: adicionar agency_id e destination_id
    `ALTER TABLE forms ADD COLUMN IF NOT EXISTS agency_id INTEGER REFERENCES agencies(id)`,
    `ALTER TABLE forms ADD COLUMN IF NOT EXISTS destination_id INTEGER REFERENCES destinations(id)`,
    `ALTER TABLE forms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    // forms: visa_type_id passar a ser nullable
    `ALTER TABLE forms ALTER COLUMN visa_type_id DROP NOT NULL`,
    `ALTER TABLE forms ALTER COLUMN fields SET DEFAULT '[]'`,
    // process_forms: tabela de vinculação formulário ↔ processo
    `CREATE TABLE IF NOT EXISTS process_forms (
      id SERIAL PRIMARY KEY,
      process_id INTEGER NOT NULL REFERENCES processes(id),
      form_id INTEGER NOT NULL REFERENCES forms(id),
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(process_id, form_id)
    )`,
    // form_responses: garantir coluna status com valor padrão correto
    `ALTER TABLE form_responses ALTER COLUMN status SET DEFAULT 'open'`,
    // processes: coluna para armazenar dados do pré-formulário
    `ALTER TABLE processes ADD COLUMN IF NOT EXISTS pre_form_data TEXT`,
    // process_forms: coluna de ordem para supervisor definir sequência
    `ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0`,
  ];

  for (const sql of migrations) {
    try {
      await query(sql);
    } catch (err: any) {
      // Ignorar erros de "already exists" para garantir idempotência
      if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
        console.warn('⚠️ Migration warning:', err.message);
      }
    }
  }
  console.log("🔧 Migrações aplicadas");
}

async function seedInitialData() {
  try {
    const agencyResult = await query(
      `INSERT INTO agencies (name, slug, status, modules) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      ["Global Visa Solutions", "global-visa", "active", '{"finance": true, "chat": true, "pipefy": true}']
    );

    const agencyId = agencyResult.rows[0].id;

    // Master user is created WITHOUT an agency_id to provide global access
    await query(
      `INSERT INTO users (name, email, password, role, agency_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      ["Master User", "master@korus.com", "Master123456", "master", null]
    );

    console.log("✅ Dados iniciais inseridos com sucesso");
  } catch (error) {
    console.error("❌ Erro ao inserir dados iniciais:", error);
    throw error;
  }
}

async function ensureMasterUser() {
  try {
    const masterPassword = "Master123456";
    
    // Verificar se existe um usuário master
    const masterCheck = await query("SELECT id FROM users WHERE role = 'master' LIMIT 1");
    
    if (masterCheck.rows.length > 0) {
      // Usuário master já existe - atualizar a senha e garantir agency_id = NULL para acesso global
      await query(
        `UPDATE users SET password = $1, agency_id = NULL WHERE role = 'master'`,
        [masterPassword]
      );
      console.log("🔐 Usuário master garantido com agency_id = NULL (acesso global)");
    } else {
      // Master user not found - create new one with NULL agency_id for global access
      await query(
        `INSERT INTO users (name, email, password, role, agency_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        ["Master User", "master@korus.com", masterPassword, "master", null]
      );
      console.log("👤 Usuário master criado com acesso global (agency_id = NULL)");
    }
  } catch (error) {
    console.warn("⚠️ Aviso ao garantir usuário master:", error);
  }
}