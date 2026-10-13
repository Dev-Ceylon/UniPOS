import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run as the owner role; the app connects as unipos_app (RLS enforced).
    url: process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/unipos",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
