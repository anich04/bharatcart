/**
 * Local, self-contained Postgres for development/preview.
 * Runs a real Postgres (via embedded-postgres) on localhost:5432 with data
 * stored OUTSIDE OneDrive to avoid file-lock issues. Keeps running until killed.
 *
 * Not used in production — production uses Supabase (see .env.example).
 *
 * Usage: node scripts/pg-dev.mjs
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const dataDir = path.join(os.homedir(), "AppData", "Local", "bharatcart-pgdata");
const alreadyInitialised = existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

async function main() {
  if (!alreadyInitialised) {
    console.log("[pg-dev] initialising cluster at", dataDir);
    await pg.initialise();
  } else {
    console.log("[pg-dev] reusing existing cluster at", dataDir);
  }

  console.log("[pg-dev] starting Postgres on localhost:5432 ...");
  await pg.start();

  try {
    await pg.createDatabase("bharatcart");
    console.log("[pg-dev] created database 'bharatcart'");
  } catch {
    console.log("[pg-dev] database 'bharatcart' already exists");
  }

  console.log("[pg-dev] READY — postgresql://postgres:postgres@localhost:5432/bharatcart");

  const shutdown = async () => {
    console.log("\n[pg-dev] stopping ...");
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive so Postgres stays up.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("[pg-dev] failed:", err);
  process.exit(1);
});
