import { Pool } from 'pg';

// Verifica se DATABASE_URL está definida
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Função helper para executar queries
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Testa a conexão
export async function testConnection() {
  try {
    await query('SELECT 1');
    console.log('PostgreSQL conectado com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao conectar com PostgreSQL:', error);
    throw error;
  }
}