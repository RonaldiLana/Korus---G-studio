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

  console.log("✅ Banco inicializado com sucesso");
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

    await query(
      `INSERT INTO users (name, email, password, role, agency_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      ["Master User", "master@korus.com", "Korus2024!", "master", agencyId]
    );

    console.log("✅ Dados iniciais inseridos com sucesso");
  } catch (error) {
    console.error("❌ Erro ao inserir dados iniciais:", error);
    throw error;
  }
}

async function ensureMasterUser() {
  try {
    const masterCheck = await query("SELECT id FROM users WHERE role = 'master' LIMIT 1");
    if (masterCheck.rows.length === 0) {
      const agencyCheck = await query("SELECT id FROM agencies LIMIT 1");
      if (agencyCheck.rows.length > 0) {
        const agencyId = agencyCheck.rows[0].id;
        await query(
          `INSERT INTO users (name, email, password, role, agency_id) 
           VALUES ($1, $2, $3, $4, $5)`,
          ["Master User", "master@korus.com", "Korus2024!", "master", agencyId]
        );
      }
    }
  } catch (error) {
    console.warn("⚠️ Aviso ao garantir usuário master:", error);
  }
}