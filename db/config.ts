import { readFileSync } from "node:fs";
import path from "node:path";

const configPath = path.resolve(
  process.cwd(),
  "db",
  "config.json",
);
const config = JSON.parse(readFileSync(configPath, "utf8")) as {
  availableSchemaVersions: string[];
  activeSchemaVersion: string;
};

export const availableSchemaVersions = config.availableSchemaVersions as readonly string[];

export type SchemaVersion = (typeof availableSchemaVersions)[number];

export const activeSchemaVersion =
  config.activeSchemaVersion as SchemaVersion;
