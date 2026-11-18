// Runs once when the Next.js server starts.
//
// The Node-only work lives in ./instrumentation-node and is imported inside a
// positive NEXT_RUNTIME check so the bundler can drop it from the Edge build
// (which cannot load fs / pg and would otherwise fail to compile).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
