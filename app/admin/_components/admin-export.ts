/**
 * Export the administrator's current filtered view without storing a second
 * copy on the server. A UTF-8 BOM keeps Chinese headings readable in Excel.
 */
export function downloadAdminCsv(
  filename: string,
  rows: Array<Array<string | number | boolean | null | undefined>>,
) {
  const escapeCell = (value: string | number | boolean | null | undefined) => {
    const text = value == null ? "" : String(value);
    // Prevent spreadsheet applications from executing customer-controlled
    // values as formulas when the export is opened.
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };
  const content = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
