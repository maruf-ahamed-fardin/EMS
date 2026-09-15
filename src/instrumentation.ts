export async function register() {
  // Node-only startup checks live in their own file so the Edge bundle never includes them
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
