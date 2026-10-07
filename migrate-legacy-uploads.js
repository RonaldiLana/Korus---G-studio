// Uso: node migrate-legacy-uploads.js [--apply] [--delete-orphans]
// Sem flags apenas lista. --apply importa arquivos locais de ./uploads para a tabela `files` e reaponta as URLs.
// --delete-orphans (com --apply) remove materiais de treinamento cujo arquivo não existe mais.
import "dotenv/config";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
const apply = process.argv.includes('--apply');
const deleteOrphans = process.argv.includes('--delete-orphans');
const backendUrl = (process.env.BACKEND_URL || 'https://api.korus.me').replace(/\/$/, '');

const targets = [
  { table: 'training_materials', column: 'file_url', label: 'title', relative: true },
  { table: 'documents', column: 'url', label: 'name', relative: false },
  { table: 'financials', column: 'proof_url', label: 'process_id', relative: false },
  { table: 'contract_templates', column: 'file_url', label: 'name', relative: false },
];

const mimeByExt = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

let imported = 0, orphans = 0;
try {
  for (const { table, column, label, relative } of targets) {
    const rows = (await client.query(
      `SELECT id, ${label} AS label, ${column} AS url FROM ${table} WHERE ${column} LIKE '%/uploads/%'`
    )).rows;
    console.log(`\n${table}: ${rows.length} registro(s) com URL legada`);

    for (const row of rows) {
      const rel = decodeURIComponent(new URL(row.url, 'http://x').pathname).replace(/^\/uploads\//, '');
      const localPath = path.resolve(uploadsDir, rel);
      const safe = localPath.startsWith(uploadsDir + path.sep) && fs.existsSync(localPath);

      if (!safe) {
        orphans++;
        console.log(`  [ÓRFÃO] #${row.id} ${row.label} -> ${row.url}`);
        if (apply && deleteOrphans && table === 'training_materials') {
          await client.query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
          console.log('    removido');
        }
        continue;
      }

      console.log(`  [LOCAL] #${row.id} ${row.label} -> ${rel}`);
      if (!apply) continue;

      const data = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const agencyId = table === 'training_materials'
        ? (await client.query('SELECT agency_id FROM training_materials WHERE id = $1', [row.id])).rows[0]?.agency_id
        : null;
      const accessKey = randomBytes(24).toString('hex');
      await client.query(
        `INSERT INTO files (agency_id, original_name, mime_type, size, data, access_key) VALUES ($1, $2, $3, $4, $5, $6)`,
        [agencyId, path.basename(localPath), mimeByExt[ext] || 'application/octet-stream', data.length, data, accessKey]
      );
      const newUrl = `${relative ? '' : backendUrl}/api/files/${accessKey}`;
      await client.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [newUrl, row.id]);
      imported++;
    }
  }
} finally {
  await client.end();
}

console.log(`\nResumo: ${imported} importado(s), ${orphans} órfão(s)${apply ? '' : ' (simulação, use --apply para gravar)'}`);
