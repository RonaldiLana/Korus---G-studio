import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

async function fixMaster() {
  try {
    await client.connect();
    console.log('✅ Conexão OK\n');

    // Update master user to have agency_id = NULL for global access
    const result = await client.query(`
      UPDATE users 
      SET agency_id = NULL 
      WHERE role = 'master' AND id = 1
      RETURNING *
    `);

    console.log('🔧 Master user atualizado:');
    console.log(result.rows[0]);

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await client.end();
  }
}

fixMaster();
