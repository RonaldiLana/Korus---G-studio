import crypto from 'crypto';
import { Client } from 'pg';

const token = crypto.randomBytes(32).toString('hex');
console.log('🔑 Token gerado:', token);
console.log('📍 Link:', 'https://api.korus.me/acompanhamento/' + token);

const client = new Client({
  connectionString: 'postgresql://korus_db_z3ve_user:gSvJuOGTGB1U9MGpvXsOWRIsMgpAk4ua@dpg-d783d3tm5p6s73ehpddg-a.virginia-postgres.render.com:5432/korus_db_z3ve',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    const query = `
      INSERT INTO processes (
        destination_id, visa_type_id, plan_id, agency_id, client_name, client_email,
        status, internal_status, process_type, tracking_token
      ) VALUES (1, 1, 1, 1, 'Cliente Teste', 'teste@test.com', 'started', 'started', 'simplified', $1)
      RETURNING id, tracking_token, client_name, status
    `;
    return client.query(query, [token]);
  })
  .then(result => {
    console.log('\n✅ Processo criado com sucesso!');
    console.log('Dados:', result.rows[0]);
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erro:', err.message);
    process.exit(1);
  });
