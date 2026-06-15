# Photiades Workflow Portal

An invoice and document-processing portal for Photiades Group, rebuilt from the
Claude Design prototype into a production Next.js application.

Modules: **Dashboard**, **Document Capture**, **Invoice Processing** (document
facsimile + extraction form + 3-way PO match + line items + approval routing),
**Workflows** (Stock & Non-Stock task-based approval engines with an automatic
€500 amount-check branch), **Reports & Analytics**, **Audit Trail**, **User
Administration**, plus an **Approvals** inbox (reachable at `/approvals`).

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript** (strict)
- **next/font** — IBM Plex Sans / IBM Plex Mono
- Hand-crafted CSS design system (OKLCH color tokens, light/dark themes,
  adjustable accent hue and density) — no UI framework

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

You'll land on the sign-in screen. **Demo credentials** (also shown on the login
page):

```text
elena.constantinou@photiades.com.cy
photiades2026
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint (flat config, next/core-web-vitals + typescript)
```

## Project structure

```text
src/
  app/                     # App Router routes (one per module) + root layout
    layout.tsx             # fonts, providers, no-flash theme script, AppShell
    globals.css            # the full design system (ported from the prototype)
    <module>/page.tsx      # thin page that renders the matching view
  components/
    shell/AppShell.tsx     # sidebar + topbar + profile menu (persistent chrome)
    icons.tsx              # the stroke-icon set (`I`)
    ui.tsx                 # Badge, Avatar, Kpi, BarChart, Donut, LineChart,
                           #   Modal, Drawer, Segmented, MiniStat, Toast, …
    form-fields.tsx        # shared FF / ReadField form controls
    ApprovalChain.tsx      # shared approval-chain timeline
    providers/             # ThemeProvider (accent/density/dark) + ToastProvider
  lib/
    data.ts                # mock data, formatters, deterministic PRNG, types
    workflow.ts            # Stock / Non-Stock workflow definitions + instances
    utils.ts               # cx, fmtMoney, fmtNum, tone tokens
    navigation.ts          # useGo() cross-module navigation helper
  views/                   # one component per module (the ported screens)
```

## Notes on the port

- **Authentication.** A cookie-based session gate with hardcoded demo
  credentials (no database). `src/middleware.ts` redirects unauthenticated
  requests to `/login`; the portal routes live in the `(app)` route group so the
  login screen renders without the sidebar/topbar. Sign-in/out are React 19
  Server Actions in `src/lib/auth-actions.ts`, and the credential list lives in
  `src/lib/auth.ts` (`AUTH_USERS`) — replace it with a real identity provider
  when one is available.
- **Routing.** The prototype switched views with local state; here each module is
  a real route. The persistent sidebar/topbar live in the root layout, active
  state is derived from the pathname, and cross-module jumps use `useGo()`.
  `/` redirects to `/dashboard`. Deep links such as
  `/invoices?id=INV-2026-1480` open that invoice directly (the id is read as a
  server-side search param, so the detail renders during SSR).
- **Deterministic data.** The prototype rolled some values during render, which
  would cause SSR/CSR hydration mismatches. All pseudo-random values are now
  generated once at module load (seeded PRNG) and stored on the records, so
  server and client renders are identical.
- **Theme.** Accent hue, density, and dark mode are held in `ThemeProvider`,
  applied to `:root`, and persisted to `localStorage`. An inline script in the
  document head applies the saved theme before paint to avoid a flash.
- **Styling.** The design is reproduced with the original CSS design system plus
  inline styles, matching the prototype's visual output rather than its
  internal structure.
