import "dotenv/config";
import { query } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase() {
  try {
    console.log('Inicializando banco de dados...');

    // Executar schema inicial
    const schemaPath = path.join(__dirname, '../../database/init.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Dividir em statements individuais (PostgreSQL não suporta múltiplos statements em uma query)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
      }
    }

    console.log('Schema criado com sucesso');

    // Verificar se já há dados iniciais
    const agencyCount = await query('SELECT COUNT(*) as count FROM agencies');
    const count = parseInt(agencyCount.rows[0].count);

    if (count === 0) {
      console.log('Inserindo dados iniciais...');
      await seedInitialData();
    } else {
      console.log('Dados iniciais já existem');
    }

    // Garantir usuário master
    await ensureMasterUser();

    console.log('Banco de dados inicializado com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

async function seedInitialData() {
  try {
    // Inserir agência inicial
    const agencyResult = await query(
      'INSERT INTO agencies (name, slug) VALUES ($1, $2) RETURNING id',
      ['Global Visa Solutions', 'global-visa']
    );
    const agencyId = agencyResult.rows[0].id;

    // Inserir usuários
    await query(
      'INSERT INTO users (email, password, name, role, agency_id) VALUES ($1, $2, $3, $4, $5)',
      ['supervisor@globalvisa.com', 'password', 'Agency Supervisor', 'supervisor', agencyId]
    );

    const consultantResult = await query(
      'INSERT INTO users (email, password, name, role, agency_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      ['consultant@globalvisa.com', 'password', 'Senior Consultant', 'consultant', agencyId]
    );

    const analystResult = await query(
      'INSERT INTO users (email, password, name, role, agency_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      ['analyst@globalvisa.com', 'password', 'Visa Analyst', 'analyst', agencyId]
    );

    await query(
      'INSERT INTO users (email, password, name, role, agency_id) VALUES ($1, $2, $3, $4, $5)',
      ['client@example.com', 'password', 'John Doe', 'client', agencyId]
    );

    // Inserir tipo de visto
    await query(
      'INSERT INTO visa_types (agency_id, name, description, base_price, required_docs) VALUES ($1, $2, $3, $4, $5)',
      [agencyId, 'B1/B2 Tourist Visa', 'USA Tourist Visa', 160.0, JSON.stringify(['Passport', 'Photo', 'DS-160 Confirmation'])]
    );

    // Inserir destinos
    await query(
      'INSERT INTO destinations (name, code, flag, description, is_active, agency_id) VALUES ($1, $2, $3, $4, $5, $6)',
      ['Estados Unidos', 'US', '🇺🇸', 'Oportunidades ilimitadas no maior mercado do mundo.', true, agencyId]
    );
    await query(
      'INSERT INTO destinations (name, code, flag, description, is_active, agency_id) VALUES ($1, $2, $3, $4, $5, $6)',
      ['Canadá', 'CA', '🇨🇦', 'Qualidade de vida e acolhimento.', true, agencyId]
    );
    await query(
      'INSERT INTO destinations (name, code, flag, description, is_active, agency_id) VALUES ($1, $2, $3, $4, $5, $6)',
      ['Austrália', 'AU', '🇦🇺', 'Estilo de vida único e economia forte.', true, agencyId]
    );

    // Inserir planos
    await query(
      'INSERT INTO plans (name, description, price, agency_id) VALUES ($1, $2, $3, $4)',
      ['Consultoria Básica', 'Ideal para quem já tem experiência.', 497, agencyId]
    );

    console.log('Dados iniciais inseridos');
  } catch (error) {
    console.error('Erro ao inserir dados iniciais:', error);
    throw error;
  }
}

async function ensureMasterUser() {
  try {
    const masterUser = await query('SELECT * FROM users WHERE email = $1', ['master@korus.com']);

    if (masterUser.rows.length === 0) {
      await query(
        'INSERT INTO users (email, password, name, role, agency_id) VALUES ($1, $2, $3, $4, $5)',
        ['master@korus.com', 'korus123', 'Master Korus', 'master', null]
      );
      console.log('Usuário master criado');
    } else {
      await query(
        'UPDATE users SET password = $1 WHERE email = $2',
        ['korus123', 'master@korus.com']
      );
      console.log('Senha do usuário master atualizada');
    }
  } catch (error) {
    console.error('Erro ao garantir usuário master:', error);
    throw error;
  }
}