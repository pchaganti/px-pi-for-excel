/**
 * Test-time ESM resolver for Node's --experimental-strip-types runner.
 *
 * Source files use explicit ".js" import specifiers (for browser/bundler output),
 * while tests execute TypeScript sources directly. This loader retries relative
 * ".js" specifiers as ".ts" so node --test can resolve source modules.
 */

function hasCode(error) {
  return typeof error === "object" && error !== null && "code" in error;
}

export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    const isModuleNotFound = hasCode(error) && error.code === "ERR_MODULE_NOT_FOUND";
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");

    if (isModuleNotFound && isRelative && specifier.endsWith(".js")) {
      const tsSpecifier = `${specifier.slice(0, -3)}.ts`;
      return defaultResolve(tsSpecifier, context, defaultResolve);
    }

    throw error;
  }
}
