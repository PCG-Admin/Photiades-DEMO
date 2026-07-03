'use client';

/* Renders relTime(date) (src/lib/format.ts), but only after mount.
 *
 * relTime() depends on Date.now(), so computing it directly during render
 * causes a hydration mismatch: the server renders it at request time (e.g.
 * "5m ago"), the client hydrates a little later (e.g. "6m ago"), and React
 * flags the text mismatch. Rendering a fixed placeholder on the first
 * (server + hydration) pass and only swapping in the real value from a
 * post-mount effect keeps server and client output identical until after
 * hydration, when it's safe to diverge. */

import { useEffect, useState } from 'react';
import { relTime } from '@/lib/format';

export function RelativeTime({ date }: { date: Date }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: this is the post-mount computation that avoids the SSR/client hydration mismatch (see file comment above)
    setLabel(relTime(date));
    const id = setInterval(() => setLabel(relTime(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  return <>{label ?? ' '}</>;
}
