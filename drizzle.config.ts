import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/v1/schema.ts",
  out: "./db/v1/generated-sql-ddl",
  dialect: "sqlite",
  dbCredentials: {
    url: "./run/giganttic.sqlite",
  },
  strict: true,
  verbose: true,
});
