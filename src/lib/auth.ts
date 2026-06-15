/* Hardcoded demo authentication (no database).
 *
 * This module is pure and edge-safe (no Node/next APIs) so it can be imported
 * from both middleware and server actions. Swap AUTH_USERS / the session check
 * for a real identity provider when one is available. */

export const SESSION_COOKIE = 'photiades_session';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export interface AuthUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

// Demo accounts. The primary one matches CURRENT_USER shown across the portal.
export const AUTH_USERS: AuthUser[] = [
  { email: 'elena.constantinou@photiades.com.cy', password: 'photiades2026', name: 'Elena Constantinou', role: 'AP Manager' },
];

export function validateCredentials(email: string, password: string): AuthUser | null {
  const e = email.trim().toLowerCase();
  return AUTH_USERS.find(u => u.email.toLowerCase() === e && u.password === password) ?? null;
}

export function isValidSession(value: string | undefined | null): boolean {
  if (!value) return false;
  return AUTH_USERS.some(u => u.email === value);
}
