'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function routeFor(key: string, target?: string | null) {
  if (key === 'invoices' && target) return `/invoices?id=${encodeURIComponent(target)}`;
  return key === 'dashboard' ? '/dashboard' : `/${key}`;
}

/** Cross-module navigation helper mirroring the prototype's `go(key, target)`. */
export function useGo() {
  const router = useRouter();
  return useCallback((key: string, target?: string | null) => {
    router.push(routeFor(key, target));
  }, [router]);
}
