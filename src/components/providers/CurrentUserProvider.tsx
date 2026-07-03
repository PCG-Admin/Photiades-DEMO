'use client';

import * as React from 'react';
import { createContext, useContext } from 'react';
import type { CurrentAppUser } from '@/lib/server/users';

const CurrentUserContext = createContext<CurrentAppUser | null>(null);

export function useCurrentUser(): CurrentAppUser {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser() called outside <CurrentUserProvider>');
  return user;
}

export function CurrentUserProvider({ user, children }: { user: CurrentAppUser; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}
