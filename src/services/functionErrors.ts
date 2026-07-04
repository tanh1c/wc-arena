export async function getFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Something went wrong';
  const context = typeof error === 'object' && error && 'context' in error ? error.context : null;

  if (!(context instanceof Response)) return fallback;

  try {
    const body = await context.clone().json() as { error?: unknown; message?: unknown };
    return typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : fallback;
  } catch {
    return fallback;
  }
}
