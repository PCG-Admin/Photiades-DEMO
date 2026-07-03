import { Type } from '@google/genai';
import { getGeminiClient } from './client';

export interface ExtractedLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
  glCode: string | null;
}

/** Bounding box in Gemini's standard 0-1000 normalized [yMin, xMin, yMax,
 * xMax] convention (top-left origin), on the given 0-indexed page. Drives
 * the "click a field, see it highlighted on the document" preview. */
export interface FieldBox {
  field: 'vendor' | 'invoiceNo' | 'date' | 'dueDate' | 'po' | 'companyCode' | 'vendorRef' | 'total';
  page: number;
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

export interface ExtractedInvoice {
  vendor: string;
  invoiceNo: string;
  date: string | null;       // ISO yyyy-mm-dd
  dueDate: string | null;    // ISO yyyy-mm-dd
  po: string | null;
  companyCode: string | null;
  vendorRef: string | null;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  stockType: 'Stock' | 'Non-stock' | 'Stock & Non Stock' | null;
  lineItems: ExtractedLineItem[];
  boxes: FieldBox[];
  confidence: number; // 0-100, Gemini's own estimate of extraction reliability
}

// Mirrors the SOW §5.2 Invoice Data Fields list.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor: { type: Type.STRING, description: 'Supplier / vendor name' },
    invoiceNo: { type: Type.STRING },
    date: { type: Type.STRING, nullable: true, description: 'Invoice date, ISO 8601 yyyy-mm-dd' },
    dueDate: { type: Type.STRING, nullable: true, description: 'Payment due date, ISO 8601 yyyy-mm-dd' },
    po: { type: Type.STRING, nullable: true, description: 'Purchase order number, if referenced on the document' },
    companyCode: { type: Type.STRING, nullable: true },
    vendorRef: { type: Type.STRING, nullable: true, description: "Vendor's own reference / customer number" },
    currency: { type: Type.STRING, description: 'ISO currency code or symbol, e.g. EUR or €' },
    subtotal: { type: Type.NUMBER, description: 'Total before tax' },
    vat: { type: Type.NUMBER, description: 'Total tax / VAT amount' },
    total: { type: Type.NUMBER, description: 'Grand total including tax' },
    stockType: {
      type: Type.STRING, nullable: true,
      enum: ['Stock', 'Non-stock', 'Stock & Non Stock'],
      description: 'Best guess: physical goods/inventory = Stock, services/one-off = Non-stock',
    },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          qty: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER },
          amount: { type: Type.NUMBER },
          glCode: { type: Type.STRING, nullable: true },
        },
        required: ['description', 'qty', 'unitPrice', 'amount'],
      },
    },
    boxes: {
      type: Type.ARRAY,
      description: 'One entry per field you could visually locate on the document — where it is printed on the page, as a bounding box. Skip any field you could not find a matching box for; do not guess.',
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING, enum: ['vendor', 'invoiceNo', 'date', 'dueDate', 'po', 'companyCode', 'vendorRef', 'total'] },
          page: { type: Type.INTEGER, description: '0-indexed page number the box is on' },
          yMin: { type: Type.INTEGER, description: '0-1000 normalized, top edge' },
          xMin: { type: Type.INTEGER, description: '0-1000 normalized, left edge' },
          yMax: { type: Type.INTEGER, description: '0-1000 normalized, bottom edge' },
          xMax: { type: Type.INTEGER, description: '0-1000 normalized, right edge' },
        },
        required: ['field', 'page', 'yMin', 'xMin', 'yMax', 'xMax'],
      },
    },
    confidence: { type: Type.NUMBER, description: 'Your own confidence in this extraction, 0-100' },
  },
  required: ['vendor', 'invoiceNo', 'currency', 'subtotal', 'vat', 'total', 'lineItems', 'boxes', 'confidence'],
};

const PROMPT = `Extract structured invoice data from the attached document for an accounts-payable system.
Read every field carefully from the document text and tables. If a field is not present on the
document, return null for it rather than guessing a value. For "stockType", only set it if the
document clearly indicates physical goods (Stock) vs. services/expenses (Non-stock) — otherwise
return null. Report all monetary amounts as plain numbers (no currency symbols, no thousands
separators).

Also return "boxes": for each of vendor, invoiceNo, date, dueDate, po, companyCode, vendorRef, and
total, locate exactly where that value is printed on the page and report its bounding box using the
0-1000 normalized [yMin, xMin, yMax, xMax] convention (top-left origin of the page, y = 0-1000
top-to-bottom, x = 0-1000 left-to-right), plus the 0-indexed page number it appears on. Only include
a box for a field you can actually see printed on the page — omit it entirely otherwise, never guess
a box.

Return your own confidence (0-100) reflecting how certain you are the numbers/text were read
correctly from the source document.`;

/** Server-only. Sends a single document (PDF or image) to Gemini and returns
 * structured invoice fields matching the SOW §5.2 field list, plus bounding
 * boxes for the "click a field, see it on the document" preview. */
export async function extractInvoiceFromFile(bytes: Uint8Array, mimeType: string): Promise<ExtractedInvoice> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini returned an empty extraction response.');

  return JSON.parse(text) as ExtractedInvoice;
}
