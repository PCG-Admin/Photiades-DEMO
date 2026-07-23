'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/lib/server/auth-actions';
import { I } from '@/components/icons';
import { Spinner } from '@/components/ui';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" placeholder="name@pcg.com" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" placeholder="••••••••" autoComplete="current-password" required />
      </div>

      {state.error && (
        <div className="row" style={{ gap: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 500, background: 'var(--red-soft)', padding: '9px 12px', borderRadius: 'var(--radius-sm)' }}>
          <I.alert size={15} />{state.error}
        </div>
      )}

      <button type="submit" className="btn primary lg" disabled={pending} style={{ width: '100%', marginTop: 4 }}>
        {pending ? <><Spinner size={15} />Signing in…</> : <>Sign in<I.arrowR size={16} /></>}
      </button>
    </form>
  );
}
