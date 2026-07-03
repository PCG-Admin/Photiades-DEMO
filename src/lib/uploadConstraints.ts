/** Shared between the client (CaptureView, for an instant pre-flight check
 * and the file picker's accept filter) and the server (extraction.ts, as
 * the authoritative check) — kept in one place so they can't drift. */
export const ACCEPTED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
export const ACCEPTED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // stay well under Gemini's inline-request size limit
