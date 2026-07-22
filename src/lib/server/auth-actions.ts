'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { errorMessage } from '@/lib/errorMessage';
import { recordAuditEvent } from '@/lib/server/audit';

export interface LoginState {
  error?: string;
}

// Best-effort — a broken/missing audit_events table (e.g. schema not yet
// applied on a freshly provisioned Supabase project) must never block
// sign-in/sign-out itself. Previously an uncaught failure here surfaced to
// the user as a bare "{}" (JSON.stringify(new Error(...)) is "{}" since
// Error.message is non-enumerable), with no indication the real problem was
// the audit log insert, not authentication.
async function tryRecordAuditEvent(input: Parameters<typeof recordAuditEvent>[0]) {
  try {
    await recordAuditEvent(input);
  } catch (err) {
    console.error('recordAuditEvent failed (non-fatal):', err);
  }
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // No signed-in session exists at this point, so recordAuditEvent's
    // getCurrentAppUser() resolves to the Viewer-role guest fallback — the
    // attempted email is recorded as the target since there's no actor id.
    await tryRecordAuditEvent({ action: 'Failed sign-in attempt', module: 'Auth', target: email, icon: 'alert', tone: 'red' });
    return { error: error.message === 'Invalid login credentials' ? 'Invalid email or password.' : errorMessage(error) };
  }

  // T172 — access log: login history. Session cookies are already set by
  // signInWithPassword above, so recordAuditEvent's getCurrentAppUser() call
  // resolves the user who just signed in.
  await tryRecordAuditEvent({ action: 'Signed in', module: 'Auth', icon: 'logout', tone: 'green' });

  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  // Recorded before signOut() clears the session — recordAuditEvent needs
  // the still-active session to know who's signing out.
  await tryRecordAuditEvent({ action: 'Signed out', module: 'Auth', icon: 'logout', tone: 'gray' });
  await supabase.auth.signOut();
  redirect('/login');
}
