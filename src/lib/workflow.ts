/* Stock / Non-Stock invoice workflow task/outcome/field DEFINITIONS — fixed
 * SOW §5.3/§5.4 business rules, not database content. Workflow INSTANCES
 * and their history live in Supabase (src/lib/server/workflows.ts). */

export interface WFField {
  k: string;
  label: string;
  type: 'text' | 'currency' | 'select' | 'textarea' | 'ro' | 'ro-currency';
  src?: string;
  options?: string[];
  required?: boolean;
}
export interface WFAction {
  key: string;
  label: string;
  tone: string;
  icon: string;
  fields: WFField[];
}
export interface WFBranch {
  threshold: number;
  overIdx: number;
  underIdx: number;
  over: string;
  under: string;
  skipIdx: number;
}
export interface WFTask {
  id: string;
  name: string;
  role: string;
  stage: string;
  desc: string;
  auto?: boolean;
  actions?: WFAction[];
  branch?: WFBranch;
}
export interface Workflow {
  id: string;
  name: string;
  short: string;
  tasks: WFTask[];
}
// ---- Picklists ----
const WF_DOCS_OPTS = ['Yes', 'No', 'NA'];
const WF_STK_OPTS = ['Stock', 'Non-stock', 'Stock & Non Stock'];
const WF_SENT_OPTS = ['Yes', 'No', 'NA'];

// ---- Stock Invoice Workflow definition ----
export const WF_STOCK_TASKS: WFTask[] = [
  {
    id: 't1', name: 'Stock Inv Imported', role: 'AP Clerk', stage: 'Capture',
    desc: 'Verify the imported stock invoice and confirm supporting documents before routing.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'text', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'text', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'currency', src: 'amount' },
          { k: 'docsAttached', label: 'Is all documents attached / linked', type: 'select', options: WF_DOCS_OPTS },
          { k: 'stockType', label: 'Stk / Non-Stk', type: 'select', options: WF_STK_OPTS },
          { k: 'comStored', label: 'Comment when stored', type: 'textarea' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 't2', name: 'PurchDep-Approval', role: 'Purchasing Department', stage: 'Approval',
    desc: 'Purchasing department reviews the invoice and selects how to route it.',
    actions: [
      { key: 'additional', label: 'Additional Approval', tone: 'violet', icon: 'users',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'approver', label: 'Select user to approve', type: 'select', options: [], required: true },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'notPlaced', label: 'Order not placed via PD', tone: 'gray', icon: 'flag',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 't3', name: 'Amount check over 500', role: 'System', stage: 'Routing', auto: true,
    desc: 'Automatic threshold check. Invoices over €500 route to the Purchasing Manager; €500 and under route to the Account Manager.',
    branch: { threshold: 500, overIdx: 3, underIdx: 4, over: 'PurchMgr-Approval', under: 'AM - AcDep-Review', skipIdx: 3 },
  },
  {
    id: 't4', name: 'PurchMgr-Approval', role: 'Purchasing Manager', stage: 'Approval',
    desc: 'Purchasing Manager approval for invoices over €500, before accounts review.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'notPlaced', label: 'Order not placed via PD', tone: 'gray', icon: 'flag',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 't5', name: 'AM - AcDep-Review', role: 'Account Manager', stage: 'Review',
    desc: 'Accounts Department review — confirm posting details and SAP invoice text.',
    actions: [
      { key: 'reviewed', label: 'Reviewed', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'sapText', label: 'SAP Invoice Text', type: 'textarea' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 't6', name: 'AcMgr-Approval', role: 'Accounts Manager', stage: 'Approval',
    desc: 'Final Accounts Manager approval to release the invoice.',
    actions: [
      { key: 'additional', label: 'Additional Approval', tone: 'violet', icon: 'users',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'approver', label: 'Select user to approve', type: 'select', options: [], required: true },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 't7', name: 'AcDep-Approval', role: 'Accounts Department', stage: 'Approval',
    desc: 'Accounts Department final approval — confirm document numbers before releasing for payment.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'stkDoc', label: 'Stock Document Number', type: 'text' },
          { k: 'nonStkDoc', label: 'Non-Stock Document Number', type: 'text' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'pendPmt', label: 'Pend. Pmt', tone: 'teal', icon: 'clock',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'stkDoc', label: 'Stock Document Number', type: 'text' },
          { k: 'nonStkDoc', label: 'Non-Stock Document Number', type: 'text' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
    ],
  },
];

// ---- Non-Stock Invoice Workflow definition ----
export const WF_NONSTOCK_TASKS: WFTask[] = [
  {
    id: 'n1', name: 'Non Stock Inv Imported', role: 'AP Clerk', stage: 'Capture',
    desc: 'Verify the imported non-stock invoice and confirm where it should be routed for approval.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'text', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'text', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'currency', src: 'amount' },
          { k: 'docsAttached', label: 'Is all documents attached / linked', type: 'select', options: WF_DOCS_OPTS },
          { k: 'stockType', label: 'Stk / Non-Stk', type: 'select', options: WF_STK_OPTS },
          { k: 'sentToReqner', label: 'Sent to Req/ner', type: 'select', options: WF_SENT_OPTS },
          { k: 'comStored', label: 'Comment when stored', type: 'textarea' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 'n2', name: 'Req/ner-Approval', role: 'Requisitioner', stage: 'Approval',
    desc: 'The requisitioner reviews and approves the non-stock invoice.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 'n3', name: 'PurchDep-Approval', role: 'Purchasing Department', stage: 'Approval',
    desc: 'Purchasing department reviews the non-stock invoice and selects how to route it.',
    actions: [
      { key: 'additional', label: 'Additional Approval', tone: 'violet', icon: 'users',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'approver', label: 'Select user to approve', type: 'select', options: [], required: true },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'notPlaced', label: 'Order not placed via PD', tone: 'gray', icon: 'flag',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 'n4', name: 'Amount check over 500', role: 'System', stage: 'Routing', auto: true,
    desc: 'Automatic threshold check. Invoices over €500 route to the Purchasing Manager; €500 and under route to FM.',
    branch: { threshold: 500, overIdx: 4, underIdx: 5, over: 'PurchMgr-Approval', under: 'AM - AcDep-Review', skipIdx: 4 },
  },
  {
    id: 'n5', name: 'PurchMgr-Approval', role: 'Purchasing Manager', stage: 'Approval',
    desc: 'Purchasing Manager approval for non-stock invoices over €500, before accounts review.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'notPlaced', label: 'Order not placed via PD', tone: 'gray', icon: 'flag',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 'n6', name: 'AM - AcDep-Review', role: 'Account Manager', stage: 'Review',
    desc: 'Accounts Department review — confirm posting details and SAP invoice text.',
    actions: [
      { key: 'reviewed', label: 'Reviewed', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'sapText', label: 'SAP Invoice Text', type: 'textarea' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 'n7', name: 'AcMgr-Approval', role: 'Accounts Manager', stage: 'Approval',
    desc: 'Final Accounts Manager approval to release the non-stock invoice.',
    actions: [
      { key: 'additional', label: 'Additional Approval', tone: 'violet', icon: 'users',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'approver', label: 'Select user to approve', type: 'select', options: [], required: true },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
    ],
  },
  {
    id: 'n8', name: 'AcDep-Approval', role: 'Accounts Department', stage: 'Approval',
    desc: 'Accounts Department final approval — confirm document numbers before releasing for payment.',
    actions: [
      { key: 'approved', label: 'Approved', tone: 'green', icon: 'check',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'stkDoc', label: 'Stock Document Number', type: 'text' },
          { k: 'nonStkDoc', label: 'Non-Stock Document Number', type: 'text' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
      { key: 'requestInfo', label: 'Request Info', tone: 'amber', icon: 'refresh',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'declined', label: 'Declined', tone: 'red', icon: 'x',
        fields: [{ k: 'com', label: 'Comment', type: 'textarea', required: true }] },
      { key: 'pendPmt', label: 'Pend. Pmt', tone: 'teal', icon: 'clock',
        fields: [
          { k: 'invNo', label: 'Invoice Number', type: 'ro', src: 'invNo' },
          { k: 'po', label: 'PO Number', type: 'ro', src: 'po' },
          { k: 'amount', label: 'Amount', type: 'ro-currency', src: 'amount' },
          { k: 'stkDoc', label: 'Stock Document Number', type: 'text' },
          { k: 'nonStkDoc', label: 'Non-Stock Document Number', type: 'text' },
          { k: 'com', label: 'Comment', type: 'textarea' },
        ] },
    ],
  },
];

// ---- Workflow registry ----
export const WORKFLOWS: Workflow[] = [
  { id: 'stock', name: 'Stock Invoice Workflow', short: 'Stock', tasks: WF_STOCK_TASKS },
  { id: 'nonstock', name: 'Non-Stock Invoice Workflow', short: 'Non-Stock', tasks: WF_NONSTOCK_TASKS },
];
export const wfById = (id: string) => WORKFLOWS.find(w => w.id === id) || WORKFLOWS[0];

/** Tasks an admin can point an approver_mappings row at — excludes 'auto'
 * (System-routed) tasks like the amount-check branch, since those never
 * carry a human assignee. Used by AdminView's Approver Mapping tab.
 * `name`/`workflowShort` are kept separate (rather than pre-joined into
 * `label`) so callers can run each half through tr() independently. */
export const ASSIGNABLE_TASKS: { id: string; name: string; workflowShort: string; defaultRole: string }[] = WORKFLOWS.flatMap(wf =>
  wf.tasks.filter(t => !t.auto).map(t => ({ id: t.id, name: t.name, workflowShort: wf.short, defaultRole: t.role })));

export const ACTION_TONE_VAR = (t: string) => (({ green: 'var(--green)', red: 'var(--red)', amber: 'var(--amber)', violet: 'var(--violet)', teal: 'var(--teal)', gray: 'var(--muted)' } as Record<string, string>)[t]);
export const ACTION_SOFT_VAR = (t: string) => (({ green: 'var(--green-soft)', red: 'var(--red-soft)', amber: 'var(--amber-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)', gray: 'var(--surface-3)' } as Record<string, string>)[t]);
