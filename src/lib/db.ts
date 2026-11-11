import mysql, { type Pool } from "mysql2/promise";

declare global {
  var gradebookPool: Pool | undefined;
  var gradebookSchemaReady: Promise<void> | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to MariaDB.");
  }

  const url = new URL(connectionString);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// scheme.");
  }

  return mysql.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: 3,
    waitForConnections: true,
    queueLimit: 0,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
}

export function getPool(): Pool {
  globalThis.gradebookPool ??= createPool();
  return globalThis.gradebookPool;
}

async function initializeSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_id INT UNSIGNED NOT NULL,
      student_code VARCHAR(30) NOT NULL,
      name VARCHAR(120) NOT NULL,
      class_name VARCHAR(80) NOT NULL,
      assignment_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      quiz_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      midterm_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      final_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_owner_student_code (owner_id, student_code),
      KEY students_owner_id (owner_id),
      CONSTRAINT students_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureSchema(): Promise<Pool> {
  const pool = getPool();
  globalThis.gradebookSchemaReady ??= initializeSchema(pool).catch((error: unknown) => {
    globalThis.gradebookSchemaReady = undefined;
    throw error;
  });
  await globalThis.gradebookSchemaReady;
  return pool;
}
