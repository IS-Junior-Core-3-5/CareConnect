/**
 * Small client-side CSV helper for admin exports.
 *
 * Values are escaped for CSV, arrays are joined with semicolons, and cells that
 * start with a spreadsheet formula character are prefixed so Excel/Sheets treat
 * them as text instead of running them.
 */
function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join("; ")
        : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv<T>(
  filename: string,
  columns: { key: keyof T; label: string }[],
  rows: T[],
) {
  const lines = [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column.key])).join(",")),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
