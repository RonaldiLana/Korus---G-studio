import { Pool, QueryResult } from 'pg';

// Verifica se DATABASE_URL está definida
if (!process.env.DATABASE_URL) {
  console.error('[DB] DATABASE_URL não está definida. Configure-a no arquivo .env ou variáveis de ambiente.');
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Função helper para executar queries com tipagem correta
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Testa a conexão com tratamento robusto
export async function testConnection(): Promise<boolean> {
  try {
    console.log('[DB] Testando conexão com PostgreSQL...');
    await query('SELECT 1');
    console.log('[DB] ✓ PostgreSQL conectado com sucesso');
    return true;
  } catch (error: any) {
    console.error('[DB] ✗ Erro ao conectar com PostgreSQL:', error.message);
    throw error;
  }
}