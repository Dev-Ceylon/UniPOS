import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Creates a fresh `unipos_test` database, the app role and runs migrations.
 * Needs a Postgres superuser URL in TEST_ADMIN_DATABASE_URL (default: local postgres).
 */
export default async function setup() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const admin = process.env.TEST_ADMIN_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres";
  const dbName = "unipos_test";
  const c = new pg.Client({ connectionString: admin });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await c.query(`CREATE DATABASE ${dbName}`);
  await c.end();
  const ownerUrl = admin.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
  const c2 = new pg.Client({ connectionString: ownerUrl });
  await c2.connect();
  await c2.query(readFileSync(join(root, "prisma/sql/setup-roles.sql"), "utf8"));
  await c2.end();
  execSync("npx prisma migrate deploy", { cwd: root, env: { ...process.env, MIGRATE_DATABASE_URL: ownerUrl }, stdio: "pipe" });
  process.env.TEST_OWNER_DATABASE_URL = ownerUrl;
}
