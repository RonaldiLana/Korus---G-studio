import { query } from './db.js';

// Compatibility layer to mimic better-sqlite3 API with PostgreSQL
class Statement {
  constructor(private sql: string) {}

  async all(...params: any[]) {
    const result = await query(this.sql, params);
    return result.rows;
  }

  async get(...params: any[]) {
    const result = await query(this.sql, params);
    return result.rows[0] || null;
  }

  async run(...params: any[]) {
    const result = await query(this.sql, params);
    return {
      lastInsertRowid: result.rows[0]?.id || null,
      changes: result.rowCount
    };
  }
}

class Database {
  prepare(sql: string) {
    return new Statement(sql);
  }

  async exec(sql: string) {
    await query(sql);
  }
}

export default Database;