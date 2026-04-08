import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

async function checkMaster() {
  try {
    await client.connect();
    console.log('✅ Conexão OK\n');

    // Check master users
    const masterRes = await client.query(`
      SELECT id, name, email, role, agency_id 
      FROM users 
      WHERE role = 'master'
    `);

    console.log(`🔍 Usuários com role='master': ${masterRes.rows.length}`);
    masterRes.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Email: ${row.email}, Role: ${row.role}, Agency_ID: ${row.agency_id}`);
    });

    // Check all users
    console.log('\n📋 Todos os usuários:');
    const allRes = await client.query(`
      SELECT id, name, email, role, agency_id 
      FROM users
    `);

    allRes.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Name: ${row.name}, Email: ${row.email}, Role: ${row.role}, Agency_ID: ${row.agency_id}`);
    });

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await client.end();
  }
}

checkMaster();
