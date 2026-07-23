# PCG | MindRift Workflow Portal

An invoice and document-processing portal for PCG | MindRift, built against
the client SOW, running on a real Supabase (Postgres) backend.

Modules: **Dashboard**, **Document Capture** (Gemini-based field extraction),
**Invoice Processing** (extraction review + line items + per-invoice audit
history), **Workflows** (Stock & Non-Stock task-based approval engines with a
configurable amount-check branch), **Approvals** (derived inbox over
in-progress workflow tasks), **Reports & Analytics** (the six SOW §5.6
reports), **Audit Trail**, **User Administration**, **Notifications**.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript** (strict)
- **Supabase** (Postgres, via `@supabase/supabase-js`) — all data access
- **Gemini** (`@google/genai`, `gemini-2.5-flash`) — document field extraction
- **next/font** — IBM Plex Sans / IBM Plex Mono
- Hand-crafted CSS design system (OKLCH color tokens, light/dark themes,
  adjustable accent hue and density) — no UI framework

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Every route requires a real Supabase Auth session (`src/proxy.ts` redirects
signed-out visitors to `/login`). To sign in the first time, run
`supabase/seed_admin.sql` against your project to create one real login
account, then use those credentials. Once signed in as an Administrator,
User Administration → Add user provisions further accounts.

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
    layout.tsx             # fonts, providers, no-flash theme script
    (app)/layout.tsx        # fetches current user + notifications, wraps AppShell
    globals.css             # the full design system
    <module>/page.tsx       # async page: fetches server-side data, renders the view
  components/
    shell/AppShell.tsx      # sidebar + topbar + profile menu (persistent chrome)
    icons.tsx               # the stroke-icon set (`I`)
    ui.tsx                  # Badge, Avatar, Kpi, BarChart, Donut, LineChart,
                            #   Modal, Drawer, Segmented, MiniStat, Toast, …
    form-fields.tsx         # shared FF / ReadField form controls
    ApprovalChain.tsx       # shared approval-chain timeline
    providers/              # ThemeProvider, ToastProvider, CurrentUserProvider
  lib/
    workflow.ts             # Stock / Non-Stock task/outcome/field DEFINITIONS —
                            #   fixed SOW business rules, not database content
    format.ts                # date/number formatters (relTime, fmtDate, …)
    constants.ts             # reference picklists (ROLES, DEPTS, STOCK_TYPES)
    csv.ts                   # client-side CSV export helper
    utils.ts                 # cx, fmtMoney, fmtNum, tone tokens
    navigation.ts            # useGo() cross-module navigation helper
    supabase/                # browser/server/service clients + Database types
    gemini/                  # Gemini client + extraction prompt/schema
    server/                  # 'use server' modules — one per domain
                            #   (invoices, workflows, users, audit, notifications,
                            #    reports, dashboard, settings) — all data access
                            #   and mutations live here, called from pages and
                            #   directly from client views as Server Actions
  views/                    # one component per module (the ported screens)
supabase/
  config.toml               # Supabase CLI config stub
  migrations/                # SQL schema (run against your own project)
  seed_admin.sql             # creates the first real login account — run this
                            #   once before signing in for the first time
```

## Backend setup (Supabase)

In `.env.local` (gitignored, not committed) set:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...   # from https://aistudio.google.com/apikey — for Capture extraction
```

Run both migrations against your project — paste them into the SQL editor,
or `npm run supabase:link` then `npm run supabase:push`:

1. `supabase/migrations/20260701000000_initial_schema.sql` — the full schema.
2. `supabase/migrations/20260702000000_live_data.sql` — follow-up changes
   (decouples `app_users.id`'s foreign key from `auth.users` so User
   Administration can provision accounts without hand-editing `auth.users`
   directly — `createAppUser()` still sets `app_users.id` to match the real
   `auth.users.id` it creates via the admin API, makes `invoices.stock_type`
   nullable, adds `audit_events.invoice_id`/`changes` for the per-invoice
   audit log).

Optionally run `npm run supabase:types` afterward to replace the
hand-authored `src/lib/supabase/types.ts` with generated types.

Then run `supabase/seed_admin.sql` (edit the email/password/name at the top
first) to create your first real login.

**Data access.** Every `src/lib/server/*.ts` module uses the service-role
client (`src/lib/supabase/service.ts`), bypassing RLS, even though a real
login now exists — switching to the RLS-respecting client and relying on the
migrations' policies as the live authorization boundary is a separate,
not-yet-done change.

**Capture → Invoices → Workflows → Audit/Reports**, in order, is the real
data path: uploading a document in Capture creates a real `invoices` row (+
line items) and starts its Stock/Non-Stock `workflow_instances` row; every
edit and workflow decision writes a `workflow_history` and `audit_events`
row; Reports and the Dashboard aggregate over those tables directly. Nothing
is mocked — an empty database means empty screens until you capture your
first invoice.

## Notes on the port

- **Routing.** Each module is a real route; the persistent sidebar/topbar
  live in the root layout, active state is derived from the pathname, and
  cross-module jumps use `useGo()`. `/` redirects to `/dashboard`. Deep links
  such as `/invoices?id=INV-2026-1480` open that invoice directly (fetched
  server-side from its `code`).
- **Theme.** Accent hue, density, and dark mode are held in `ThemeProvider`,
  applied to `:root`, and persisted to `localStorage`. An inline script in the
  document head applies the saved theme before paint to avoid a flash.
- **TypeScript 6 + postgrest-js.** This project's TypeScript version breaks
  `@supabase/postgrest-js`'s type-level query parser (every `.select()`,
  `.insert()`, `.update()` would otherwise resolve to `never`). Every
  `src/lib/server/*.ts` query works around this with `.overrideTypes<T,
  {merge:false}>()` on reads and an `as never` cast on insert/update payload
  objects — noted inline at each occurrence.
