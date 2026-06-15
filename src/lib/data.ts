/* Mock data layer for the Photiades Workflow Portal.
 *
 * Ported from the design prototype. All pseudo-random values are consumed at
 * module load (deterministic PRNG seeded at 42), so server and client renders
 * produce identical output — no hydration mismatches. Values previously rolled
 * during render (extraction confidence, facsimile details, vendor spend) are
 * precomputed here and stored on the records. */

export interface Person {
  name: string;
  role: string;
  dept: string;
}

export interface LineItem {
  desc: string;
  qty: number;
  unit: number;
  amount: number;
  gl: string;
}

export interface Invoice {
  id: string;
  vendor: string;
  po: string | null;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  status: string;
  received: Date;
  due: Date;
  dueOverdue: boolean;
  confidence: number;
  poMatch: string;
  assignee: string;
  dept: string;
  lineItems: LineItem[];
  flags: string[];
  invoiceNo: string;
  priority?: string;
  /* render-stable extras */
  extractedConf: Record<string, number>;
  grn: string;
  facsimile: {
    street: number;
    city: string;
    postcode: number;
    vatNo: number;
    ibanA: number;
    ibanB: number;
    ibanC: number;
  };
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  typeConf: number;
  status: string;
  source: string;
  pages: number;
  size: string;
  received: Date;
  progress: number;
}

export interface ChainStep {
  role: string;
  name: string;
  action: string;
  when: Date | null;
}

export interface Approval {
  id: string;
  type: string;
  title: string;
  requester: string;
  amount: number;
  currency: string;
  priority: string;
  submitted: Date;
  dueIn: number;
  step: number;
  chain: ChainStep[];
  ref: string;
  dept: string;
}

export interface AuditEvent {
  id: string;
  user: string;
  role: string;
  action: string;
  icon: string;
  tone: string;
  target: string | null;
  when: Date;
  ip: string;
  module: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  dept: string;
  status: string;
  lastActive: Date;
  mfa: boolean;
  isNew?: boolean;
}

export const VENDORS = [
  'Aegean Logistics Ltd', 'Mediterranean Glassworks', 'CyTech Solutions',
  'Olympus Freight S.A.', 'Nicosia Office Supplies', 'Apollo Packaging',
  'Levant Bottling Co.', 'Hermes Distribution', 'Pafos Print House',
  'Cyprus Power & Utilities', 'Demetriou Legal Partners', 'Limassol Cold Storage',
  'Anatolia Raw Materials', 'KPMG Advisory', 'Larnaca Maintenance Group',
];

export const PEOPLE: Person[] = [
  { name: 'Elena Constantinou', role: 'AP Manager', dept: 'Finance' },
  { name: 'Markos Theodorou', role: 'Finance Director', dept: 'Finance' },
  { name: 'Sophia Ioannou', role: 'AP Clerk', dept: 'Finance' },
  { name: 'Andreas Pavlou', role: 'Procurement Lead', dept: 'Operations' },
  { name: 'Christina Georgiou', role: 'Controller', dept: 'Finance' },
  { name: 'Dimitris Nicolaou', role: 'CFO', dept: 'Executive' },
  { name: 'Maria Antoniou', role: 'AP Clerk', dept: 'Finance' },
  { name: 'Nikos Charalambous', role: 'Auditor', dept: 'Compliance' },
  { name: 'Anna Stylianou', role: 'IT Administrator', dept: 'IT' },
  { name: 'Petros Michael', role: 'Warehouse Manager', dept: 'Operations' },
];

export const CURRENT_USER: Person = { name: 'Elena Constantinou', role: 'AP Manager', dept: 'Finance' };

export const DEPTS = ['Finance', 'Operations', 'Procurement', 'Marketing', 'IT', 'Logistics', 'Executive'];

// deterministic pseudo-random
let seed = 42;
export const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
export const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
export const range = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

export function daysAgo(n: number): Date {
  const d = new Date('2026-05-29T10:30:00');
  d.setDate(d.getDate() - n);
  return d;
}
export function fmtDate(d: Date) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function fmtDateShort(d: Date) { return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
export function fmtTime(d: Date) { return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
export function relTime(d: Date) {
  const mins = Math.round((daysAgo(0).getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
}

const INV_STATUSES = ['Awaiting Approval', 'In Review', 'Approved', 'Paid', 'Exception', 'Processing'];

// ---------- Invoices ----------
function genLineItems(total: number): LineItem[] {
  const n = range(2, 5);
  const items: LineItem[] = [];
  let remaining = total;
  const descs = ['Freight & handling', 'Glass bottles 330ml (palletised)', 'Consulting services', 'Maintenance contract', 'Raw materials — barley malt', 'Packaging — shrink film', 'Cold storage rental', 'Electricity supply', 'Office consumables', 'Label printing run', 'Pallet hire', 'Quality testing'];
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amt = isLast ? remaining : +(remaining * (0.2 + rnd() * 0.4)).toFixed(2);
    remaining = +(remaining - amt).toFixed(2);
    const qty = range(1, 40);
    items.push({
      desc: pick(descs),
      qty,
      unit: +(amt / qty).toFixed(2),
      amount: amt,
      gl: `${range(4000, 6999)}`,
    });
  }
  return items;
}

export const INVOICES: Invoice[] = Array.from({ length: 28 }, (_, i): Invoice => {
  const vendor = pick(VENDORS);
  const subtotal = +(range(800, 48000) + rnd()).toFixed(2);
  const vat = +(subtotal * 0.19).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  const status = i < 6 ? 'Awaiting Approval' : pick(INV_STATUSES);
  const recd = daysAgo(range(0, 24));
  const due = daysAgo(range(-30, 5));
  const conf = range(82, 99) + (status === 'Exception' ? -20 : 0);
  const poMatch = status === 'Exception' ? pick(['Mismatch', 'No PO Found']) : 'Matched';
  const po = rnd() > 0.15 ? `PO-${range(40000, 49999)}` : null;
  const confidence = Math.max(40, conf);
  const lineItems = genLineItems(subtotal);
  const flags = (status === 'Exception'
    ? [poMatch === 'Mismatch' ? 'PO amount mismatch (€420.00)' : 'No matching PO found', 'Duplicate vendor invoice number'].slice(0, range(1, 2))
    : (conf < 90 ? ['Low OCR confidence on total field'] : []));
  // precompute render-stable extras
  const extractedConf = {
    vendor: range(94, 99),
    invoiceNo: range(90, 99),
    date: range(88, 98),
    due: range(85, 97),
    po: po ? range(82, 98) : 40,
    subtotal: range(91, 99),
    vat: range(88, 98),
    total: confidence,
  };
  const grn = `GRN-${range(8000, 8999)}`;
  const facsimile = {
    street: range(10, 99),
    city: pick(['Nicosia', 'Limassol', 'Larnaca']),
    postcode: range(1000, 9999),
    vatNo: range(10000000, 99999999),
    ibanA: range(10, 99),
    ibanB: range(1000, 9999),
    ibanC: range(1000, 9999),
  };
  return {
    id: `INV-2026-${String(1480 + i).padStart(4, '0')}`,
    vendor,
    po,
    subtotal, vat, total,
    currency: '€',
    status,
    received: recd,
    due,
    dueOverdue: due < daysAgo(0) && !['Paid', 'Approved'].includes(status),
    confidence,
    poMatch,
    assignee: pick(PEOPLE).name,
    dept: pick(DEPTS),
    lineItems,
    flags,
    invoiceNo: `${pick(['A', 'INV', 'F', 'R'])}${range(10000, 99999)}`,
    extractedConf,
    grn,
    facsimile,
  };
});

// ---------- Documents (capture queue) ----------
export const DOC_TYPES = ['Invoice', 'Purchase Order', 'Delivery Note', 'Contract', 'Receipt', 'Statement', 'Credit Note'];
const CAPTURE_STATUSES = ['Queued', 'Scanned', 'Classifying', 'Extracting', 'Verified', 'Exception'];
const SOURCES = ['Email — invoices@photiades', 'Scanner — Nicosia HQ', 'Mobile Upload', 'API — SAP Connector', 'Manual Upload', 'EDI Gateway'];

export const DOCUMENTS: DocumentRecord[] = Array.from({ length: 22 }, (_, i): DocumentRecord => {
  const type = pick(DOC_TYPES);
  const status = i < 4 ? pick(['Classifying', 'Extracting']) : pick(CAPTURE_STATUSES);
  return {
    id: `DOC-${String(90210 + i)}`,
    name: `${type.toLowerCase().replace(' ', '_')}_${range(1000, 9999)}.pdf`,
    type,
    typeConf: range(88, 99),
    status,
    source: pick(SOURCES),
    pages: range(1, 6),
    size: `${(rnd() * 3 + 0.2).toFixed(1)} MB`,
    received: daysAgo(range(0, 8)),
    progress: status === 'Verified' ? 100 : status === 'Queued' ? 0 : range(20, 92),
  };
});

// ---------- Approvals (workflow inbox) ----------
const APPROVAL_TYPES = ['Invoice Payment', 'Purchase Requisition', 'Vendor Onboarding', 'Expense Claim', 'Contract Renewal', 'Budget Variance'];
export function genChain(currentStep: number): ChainStep[] {
  return [
    { role: 'AP Clerk', name: 'Sophia Ioannou', action: 'Submitted', when: daysAgo(2) },
    { role: 'AP Manager', name: 'Elena Constantinou', action: currentStep >= 1 ? 'Approved' : 'Pending', when: currentStep >= 1 ? daysAgo(1) : null },
    { role: 'Finance Director', name: 'Markos Theodorou', action: currentStep >= 2 ? 'Approved' : (currentStep === 1 ? 'Pending' : 'Waiting'), when: currentStep >= 2 ? daysAgo(0) : null },
    { role: 'CFO', name: 'Dimitris Nicolaou', action: 'Waiting', when: null },
  ];
}
export const APPROVALS: Approval[] = Array.from({ length: 9 }, (_, i): Approval => {
  const type = pick(APPROVAL_TYPES);
  const amount = +(range(2000, 95000) + rnd()).toFixed(2);
  const priority = amount > 50000 ? 'High' : amount > 15000 ? 'Medium' : 'Low';
  return {
    id: `APR-${String(7100 + i)}`,
    type,
    title: type === 'Invoice Payment' ? `${pick(VENDORS)} — invoice payment` : type === 'Vendor Onboarding' ? `New vendor: ${pick(VENDORS)}` : `${type} request`,
    requester: pick(PEOPLE).name,
    amount,
    currency: '€',
    priority,
    submitted: daysAgo(range(0, 5)),
    dueIn: range(1, 4),
    step: range(1, 2),
    chain: genChain(range(1, 2)),
    ref: pick(INVOICES).id,
    dept: pick(DEPTS),
  };
});

// ---------- Audit trail ----------
const AUDIT_ACTIONS = [
  { action: 'approved invoice', icon: 'approve', tone: 'green', target: () => pick(INVOICES).id },
  { action: 'rejected invoice', icon: 'x', tone: 'red', target: () => pick(INVOICES).id },
  { action: 'uploaded document', icon: 'upload', tone: 'blue', target: () => pick(DOCUMENTS).name },
  { action: 'edited extracted field on', icon: 'edit', tone: 'amber', target: () => pick(INVOICES).id },
  { action: 'created user account for', icon: 'users', tone: 'violet', target: () => pick(PEOPLE).name },
  { action: 'changed role permissions for', icon: 'shield', tone: 'violet', target: () => pick(PEOPLE).name },
  { action: 'exported report', icon: 'download', tone: 'teal', target: () => pick(['AP Aging', 'Vendor Spend', 'Approval Cycle Time']) },
  { action: 'flagged exception on', icon: 'flag', tone: 'red', target: () => pick(INVOICES).id },
  { action: 'matched PO to', icon: 'link', tone: 'green', target: () => pick(INVOICES).id },
  { action: 'logged in', icon: 'logout', tone: 'gray', target: (): string | null => null },
  { action: 'submitted for approval', icon: 'send', tone: 'blue', target: () => pick(INVOICES).id },
];
export const AUDIT: AuditEvent[] = Array.from({ length: 40 }, (_, i): AuditEvent => {
  const a = pick(AUDIT_ACTIONS);
  const person = pick(PEOPLE);
  const mins = i * range(12, 90) + range(1, 30);
  const d = new Date(daysAgo(0).getTime() - mins * 60000);
  return {
    id: `EVT-${String(500000 - i * 7)}`,
    user: person.name,
    role: person.role,
    action: a.action,
    icon: a.icon,
    tone: a.tone,
    target: a.target(),
    when: d,
    ip: `10.${range(0, 4)}.${range(1, 250)}.${range(1, 250)}`,
    module: pick(['Invoices', 'Capture', 'Approvals', 'Admin', 'Reports', 'Auth']),
  };
});

// ---------- Users ----------
export const ROLES = ['Administrator', 'AP Manager', 'AP Clerk', 'Approver', 'Auditor', 'Viewer'];
export const USERS: User[] = PEOPLE.map((p, i): User => ({
  id: `USR-${String(2010 + i)}`,
  name: p.name,
  email: `${p.name.toLowerCase().replace(' ', '.')}@photiades.com.cy`,
  role: i === 8 ? 'Administrator' : i === 7 ? 'Auditor' : i === 5 ? 'Approver' : pick(['AP Manager', 'AP Clerk', 'Approver', 'Viewer']),
  dept: p.dept,
  status: i === 6 ? 'Inactive' : 'Active',
  lastActive: daysAgo(range(0, 14)),
  mfa: rnd() > 0.25,
}));

export interface ChartDatum { label: string; value: number; color?: string }

// ---------- Dashboard aggregates ----------
export const DASHBOARD = {
  kpis: {
    captured: { value: 1284, delta: '12.4%', dir: 'up' },
    pending: { value: 6, delta: '3', dir: 'up' },
    awaitingYou: { value: 6, delta: '2', dir: 'down' },
    avgCycle: { value: '1.8d', delta: '0.4d', dir: 'down' },
  },
  volume: [
    { label: 'Mon', value: 142 }, { label: 'Tue', value: 198 }, { label: 'Wed', value: 167 },
    { label: 'Thu', value: 224 }, { label: 'Fri', value: 189 }, { label: 'Sat', value: 64 }, { label: 'Sun', value: 41 },
  ] as ChartDatum[],
  statusMix: [
    { label: 'Approved', value: 412, color: 'oklch(0.58 0.12 150)' },
    { label: 'In Review', value: 168, color: 'oklch(0.72 0.13 75)' },
    { label: 'Awaiting', value: 94, color: 'oklch(0.48 0.13 255)' },
    { label: 'Exception', value: 37, color: 'oklch(0.58 0.16 25)' },
  ] as ChartDatum[],
  pipeline: [
    { stage: 'Captured', count: 1284, color: 'var(--teal)' },
    { stage: 'Classified', count: 1190, color: 'var(--accent)' },
    { stage: 'Extracted', count: 1098, color: 'var(--violet)' },
    { stage: 'In Approval', count: 262, color: 'var(--amber)' },
    { stage: 'Approved', count: 412, color: 'var(--green)' },
    { stage: 'Paid', count: 388, color: 'var(--green)' },
  ],
  // Live count of invoices sitting at each workflow task
  workflowTasks: [
    { stage: 'Stock Inv Imported', count: 34, color: 'var(--teal)' },
    { stage: 'PurchDep-Approval', count: 21, color: 'var(--accent)' },
    { stage: 'Amount check', count: 12, color: 'var(--violet)' },
    { stage: 'PurchMgr-Approval', count: 9, color: 'var(--amber)' },
    { stage: 'AM - AcDep-Review', count: 15, color: 'oklch(0.6 0.13 230)' },
    { stage: 'AcMgr-Approval', count: 7, color: 'var(--violet)' },
    { stage: 'AcDep-Approval', count: 11, color: 'var(--green)' },
  ],
  stockMix: [
    { label: 'Stock', value: 268, color: 'var(--accent)' },
    { label: 'Non-stock', value: 184, color: 'var(--teal)' },
    { label: 'Stock & Non Stock', value: 73, color: 'var(--violet)' },
  ] as ChartDatum[],
  cycleTrend: [2.6, 2.4, 2.5, 2.2, 2.3, 2.0, 1.9, 2.1, 1.8, 1.7, 1.9, 1.8],
  spendTrend: [320, 410, 380, 460, 520, 490, 540, 610, 580, 640, 690, 720],
};

// Reports: precomputed vendor-spend (render-stable)
export const VENDOR_SPEND: ChartDatum[] = VENDORS.slice(0, 7)
  .map((v, i) => ({ label: v.split(' ')[0], value: range(40, 320) * (7 - i) }))
  .sort((a, b) => b.value - a.value);
