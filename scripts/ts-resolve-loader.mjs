/**
 * Node's native ESM resolver requires explicit file extensions; this
 * project's TypeScript (like every bundler-resolved TS codebase) uses
 * extensionless relative imports, which Next.js/webpack/tsc all resolve
 * fine. This loader exists only so scripts/test-calculators.mjs can import
 * those same files directly with plain `node --experimental-strip-types`,
 * without changing any import in src/ just to please a standalone test
 * runner that isn't the app's real bundler.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw err;
    const base = dirname(fileURLToPath(context.parentURL));
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const candidate = join(base, specifier + ext);
      if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
    throw err;
  }
}
