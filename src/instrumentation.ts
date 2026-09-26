export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadRuntimeSecrets } = await import("./server/secrets");
    await loadRuntimeSecrets();
    const { assertRuntimeSafety } = await import("./server/config");
    assertRuntimeSafety();
  }
}
