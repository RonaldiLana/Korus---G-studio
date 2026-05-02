import "dotenv/config";
import { Pool, QueryResult } from "pg";

if (!process.env.DATABASE_URL) {
    console.error("[DB] DATABASE_URL não está definida.");
    throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export async function query(text: string, params?: any[]): Promise<QueryResult> {
    return pool.query(text, params);
}

export async function testConnection(): Promise<boolean> {
    const client = await pool.connect();
    try {
        console.log("[DB] Testando conexão com PostgreSQL...");
        const result = await client.query("SELECT current_database(), current_user, NOW()");
        console.log("[DB] ✓ PostgreSQL conectado com sucesso");
        console.log("[DB] Dados da conexão:", result.rows[0]);
        return true;
    } catch (error: any) {
        console.error("[DB] ✗ Erro detalhado ao conectar com PostgreSQL:");
        console.error({
            message: error.message,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            address: error.address,
            port: error.port,
        });
        throw error;
    } finally {
        client.release();
    }
}