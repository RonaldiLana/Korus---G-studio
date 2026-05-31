import crypto from 'crypto';
import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://korus_db_z3ve_user:gSvJuOGTGB1U9MGpvXsOWRIsMgpAk4ua@dpg-d783d3tm5p6s73ehpddg-a.virginia-postgres.render.com:5432/korus_db_z3ve',
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(async () => {
    console.log('🔍 Buscando URLs antigas com korus.me...\n');
    
    // Encontrar documentos com URLs antigas
    const result = await client.query(
      `SELECT id, name, url FROM documents WHERE url LIKE '%korus.me%' AND url NOT LIKE '%api.korus.me%'`
    );
    
    console.log(`📋 Encontrados ${result.rows.length} documentos com URL antiga:\n`);
    
    if (result.rows.length === 0) {
      console.log('✅ Nenhum documento com URL antiga encontrado!');
      process.exit(0);
    }
    
    result.rows.forEach((row, idx) => {
      const oldUrl = row.url;
      const newUrl = row.url.replace('https://korus.me', 'https://api.korus.me');
      console.log(`${idx + 1}. ID ${row.id}: ${row.name}`);
      console.log(`   ❌ Antiga: ${oldUrl}`);
      console.log(`   ✅ Nova:  ${newUrl}\n`);
    });
    
    // Perguntar se deseja fazer a migração
    console.log('\n⚠️  Deseja atualizar todas as URLs? (S/N)');
    
    // Para automatizar, vou fazer a migração
    const updateResult = await client.query(
      `UPDATE documents 
       SET url = REPLACE(url, 'https://korus.me/uploads/', 'https://api.korus.me/uploads/')
       WHERE url LIKE '%korus.me/uploads/%' AND url NOT LIKE '%api.korus.me%'
       RETURNING id, url`
    );
    
    console.log(`\n✅ ${updateResult.rows.length} documentos atualizados:\n`);
    updateResult.rows.forEach((row) => {
      console.log(`ID ${row.id}: ${row.url}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
