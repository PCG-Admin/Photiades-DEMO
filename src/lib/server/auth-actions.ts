'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { errorMessage } from '@/lib/errorMessage';
import { recordAuditEvent } from '@/lib/server/audit';

export interface LoginState {
  error?: string;
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
    await recordAuditEvent({ action: 'Failed sign-in attempt', module: 'Auth', target: email, icon: 'alert', tone: 'red' });
    return { error: error.message === 'Invalid login credentials' ? 'Invalid email or password.' : errorMessage(error) };
  }

  // T172 — access log: login history. Session cookies are already set by
  // signInWithPassword above, so recordAuditEvent's getCurrentAppUser() call
  // resolves the user who just signed in.
  await recordAuditEvent({ action: 'Signed in', module: 'Auth', icon: 'logout', tone: 'green' });

  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  // Recorded before signOut() clears the session — recordAuditEvent needs
  // the still-active session to know who's signing out.
  await recordAuditEvent({ action: 'Signed out', module: 'Auth', icon: 'logout', tone: 'gray' });
  await supabase.auth.signOut();
  redirect('/login');
}
