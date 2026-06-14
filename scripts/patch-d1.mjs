// Inject the real Cloudflare D1 binding into the vinext-generated deploy config.
//
// `vinext build` writes dist/server/wrangler.json with a placeholder D1 binding
// (database_id 0000...). vinext owns that file and the .wrangler deploy redirect,
// so instead of maintaining a competing root wrangler config (which gets merged
// and creates duplicate DB bindings), we patch the generated file after each
// build. Values come from cloudflare.d1.json, overridable via env for CI.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const cfgPath = path.join(root, "dist", "server", "wrangler.json");
const d1Path = path.join(root, "cloudflare.d1.json");

const d1 = JSON.parse(readFileSync(d1Path, "utf8"));
const binding = process.env.D1_BINDING ?? d1.binding ?? "DB";
const database_name = process.env.D1_DATABASE_NAME ?? d1.database_name;
const database_id = process.env.D1_DATABASE_ID ?? d1.database_id;

if (!database_id || database_id.startsWith("REPLACE")) {
  throw new Error(
    "No real D1 database_id. Set it in cloudflare.d1.json or via D1_DATABASE_ID.",
  );
}

const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
cfg.d1_databases = [{ binding, database_name, database_id }];
writeFileSync(cfgPath, JSON.stringify(cfg));

console.log(
  `Patched ${path.relative(root, cfgPath)}: D1 "${binding}" -> ${database_name} (${database_id})`,
);
