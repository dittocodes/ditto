import ExcelJS from 'exceljs';

export async function exportSpreadsheet(name: string, rows: Record<string, unknown>[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  const keys = Object.keys(rows[0] ?? {});
  sheet.columns = keys.map(key => ({ header: key, key, width: 24 }));
  rows.forEach(row => sheet.addRow(keys.map(key => {
    const value = row[key];
    return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  })));
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}