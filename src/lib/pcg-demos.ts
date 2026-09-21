/* Cross-application demo switching.
 *
 * Each demo is a SEPARATE Next.js app backed by its own Supabase project, so
 * switching is a cross-origin navigation (window.location), never router.push.
 *
 * The local hostnames are deliberately distinct rather than three ports on
 * `localhost`. Cookies are scoped by host and IGNORE the port (RFC 6265), so
 * three apps on `localhost` share ONE cookie jar: every app receives every
 * other app's Supabase session cookies on every request, and the combined
 * Cookie header overruns Node's 16 KB header limit -> HTTP 431. Distinct
 * hostnames give each app its own jar and make dev match production, where the
 * apps already sit on separate Vercel domains.
 *
 * `*.localhost` resolves to 127.0.0.1 natively in Chrome, Edge and Firefox;
 * no hosts-file entry is required. Override any of these with the matching
 * NEXT_PUBLIC_PCG_*_URL environment variable for deployed environments.
 */
export type DemoId = 'crm' | 'photiades' | 'hr';

export const PCG_DEMOS = [
  { id: 'crm' as const, label: 'CRM', description: 'Customer relationships, pipeline and quotes', url: process.env.NEXT_PUBLIC_PCG_CRM_URL || 'http://crm.localhost:3000/dashboard' },
  { id: 'photiades' as const, label: 'PHOTIADES', description: 'Invoice capture, approvals and workflows', url: process.env.NEXT_PUBLIC_PCG_PHOTIADES_URL || 'http://photiades.localhost:3001/dashboard' },
  { id: 'hr' as const, label: 'HR', description: 'People, leave, performance and onboarding', url: process.env.NEXT_PUBLIC_PCG_HR_URL || 'http://hr.localhost:3002/dashboard' },
];

export const PCG_DEMO_COOKIE = 'pcg-demo';
export const PCG_HANDOFF_PARAM = 'pcg_demo';

/* This app's Supabase auth cookie name. Must be unique per app: PHOTIADES and
 * HR share Supabase project bzdqjdimepilunztvavl, so on the default
 * `sb-<ref>-auth-token` name they wrote the SAME cookie on `localhost` and
 * clobbered each other's session. */
export const PCG_AUTH_COOKIE = 'pcg-photiades-auth';
