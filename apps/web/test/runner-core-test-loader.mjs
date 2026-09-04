export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@gadx/runner-core") {
    return { url: new URL("../../../packages/runner-core/src/sp-qso.ts", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
