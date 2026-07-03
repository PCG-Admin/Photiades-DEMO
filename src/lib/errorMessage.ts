/** Extracts a readable message from anything a Server Action might throw —
 * a real Error, a Supabase PostgrestError-shaped object, or something else
 * entirely — instead of letting `String(err)` produce "[object Object]" or
 * a raw {code, details, hint, message} dump in a toast. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return 'Something went wrong.';
}
