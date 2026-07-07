'use client';

import ExcelJS from 'exceljs';

export async function downloadXlsx(filename: string, rows: Record<string, unknown>[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.columns = headers.map(h => ({ header: h, key: h, width: Math.min(40, Math.max(10, h.length + 4)) }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
