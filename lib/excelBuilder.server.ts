import ExcelJS from "exceljs";
import type { ArtifactDescriptor, ArtifactPreviewRow } from "./artifactTypes";

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function safeCellText(value: string): string {
  const trimmed = value.trim().slice(0, 500);
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

function extractTitle(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("budget") || /බජට්/.test(prompt)) return "Business Budget";
  if (lower.includes("expense") || /වියදම්/.test(prompt)) return "Expense Tracker";
  if (lower.includes("invoice") || /ඉන්වොයිස්/.test(prompt)) return "Invoice Workbook";
  return "KYVORIX Workbook";
}

function buildRows(prompt: string): ArtifactPreviewRow[] {
  const lower = prompt.toLowerCase();
  if (lower.includes("budget") || /බජට්/.test(prompt)) {
    return [
      ["January", "Income", "Sales", 125000],
      ["January", "Expense", "Rent", 45000],
      ["February", "Income", "Sales", 140000],
      ["February", "Expense", "Marketing", 18000],
      ["March", "Income", "Sales", 152000],
      ["March", "Expense", "Operations", 32000],
    ];
  }
  return [
    ["2026-01-01", "Operations", "Example expense", 0],
    ["2026-01-02", "Marketing", "Example expense", 0],
  ];
}

export async function buildExcelArtifact(prompt: string): Promise<ArtifactDescriptor> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KYVORIX AI";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const title = extractTitle(prompt);
  const rows = buildRows(prompt);
  const readme = workbook.addWorksheet("Read Me");
  readme.columns = [{ width: 24 }, { width: 90 }];
  readme.addRows([
    ["Workbook", title],
    ["Purpose", safeCellText(prompt)],
    ["How to use", "Enter or replace values in the Input Data sheet. Formula cells are calculated automatically."],
    ["Legend", "Blue headers are labels; pale yellow cells are editable inputs; green cells are calculated outputs. Type uses a safe dropdown and invalid amounts are highlighted."],
  ]);
  readme.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  readme.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14213D" } };
  readme.getColumn(1).font = { bold: true, color: { argb: "FF1D4ED8" } };
  readme.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  readme.getRow(2).height = 42;

  const input = workbook.addWorksheet("Input Data");
  input.columns = [
    { header: "Month", key: "month", width: 16 },
    { header: "Type", key: "type", width: 16 },
    { header: "Category", key: "category", width: 24 },
    { header: "Amount (LKR)", key: "amount", width: 18 },
  ];
  input.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  input.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  rows.forEach((row) => input.addRow(row.map((cell) => typeof cell === "string" ? safeCellText(cell) : cell)));
  input.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.getCell(4).numFmt = '"LKR" #,##0.00';
      row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBEB" } };
    }
  });
  input.autoFilter = { from: "A1", to: "D100" };
  input.views = [{ state: "frozen", ySplit: 1 }];
  input.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = { type: "list", allowBlank: false, formulae: ['"Income,Expense"'], showErrorMessage: true, errorTitle: "Choose a type", error: "Select Income or Expense from the dropdown." };
    }
  });
  input.getColumn(4).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: "Invalid amount", error: "Enter a zero or positive amount." };
    }
  });
  input.addConditionalFormatting({
    ref: "D2:D100",
    rules: [{ type: "cellIs", priority: 1, operator: "lessThan", formulae: [0], style: { font: { color: { argb: "FFB91C1C" } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFEE2E2" }, fgColor: { argb: "FFFEE2E2" } } } }],
  });
  input.addConditionalFormatting({
    ref: "B2:B100",
    rules: [{ type: "containsText", priority: 2, operator: "containsText", text: "Expense", style: { font: { color: { argb: "FF9A3412" } }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFEDD5" }, fgColor: { argb: "FFFFEDD5" } } } }],
  });

  const calc = workbook.addWorksheet("Calculations");
  calc.columns = [{ width: 28 }, { width: 22 }, { width: 18 }];
  calc.addRows([
    ["Metric", "Formula", "Value"],
    ["Total income", "SUMIF(Input Data!B:B, Income, Input Data!D:D)", { formula: 'SUMIF(\'Input Data\'!B:B,"Income",\'Input Data\'!D:D)' }],
    ["Total expenses", "SUMIF(Input Data!B:B, Expense, Input Data!D:D)", { formula: 'SUMIF(\'Input Data\'!B:B,"Expense",\'Input Data\'!D:D)' }],
    ["Net profit", "Income minus expenses", { formula: "C2-C3" }],
  ]);
  calc.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  calc.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  calc.getColumn(3).eachCell((cell, rowNumber) => { if (rowNumber > 1) cell.numFmt = '"LKR" #,##0.00'; });
  calc.views = [{ state: "frozen", ySplit: 1 }];

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 28 }, { width: 24 }];
  summary.addRows([
    ["Summary", "Value"],
    ["Total income", { formula: "Calculations!C2" }],
    ["Total expenses", { formula: "Calculations!C3" }],
    ["Net profit", { formula: "Calculations!C4" }],
    ["Generated by", "KYVORIX Artifact Studio"],
  ]);
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
  summary.getColumn(2).eachCell((cell, rowNumber) => { if (rowNumber > 1 && rowNumber < 5) cell.numFmt = '"LKR" #,##0.00'; });

  const monthly = workbook.addWorksheet("Monthly Summary");
  monthly.columns = [{ width: 18 }, { width: 20 }, { width: 20 }, { width: 20 }];
  monthly.addRow(["Month", "Income (LKR)", "Expenses (LKR)", "Net (LKR)"]);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  months.forEach((month) => {
    const row = monthly.addRow([month, null, null, null]);
    const rowNumber = row.number;
    row.getCell(2).value = { formula: `SUMIFS('Input Data'!$D:$D,'Input Data'!$A:$A,A${rowNumber},'Input Data'!$B:$B,"Income")` };
    row.getCell(3).value = { formula: `SUMIFS('Input Data'!$D:$D,'Input Data'!$A:$A,A${rowNumber},'Input Data'!$B:$B,"Expense")` };
    row.getCell(4).value = { formula: `B${rowNumber}-C${rowNumber}` };
  });
  monthly.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  monthly.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0891B2" } };
  monthly.eachRow((row, rowNumber) => { if (rowNumber > 1) row.eachCell((cell, columnNumber) => { if (columnNumber > 1) cell.numFmt = '"LKR" #,##0.00'; }); });
  monthly.addConditionalFormatting({
    ref: "D2:D13",
    rules: [{ type: "colorScale", priority: 3, cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }], color: [{ argb: "FFFECACA" }, { argb: "FFFEF3C7" }, { argb: "FFBBF7D0" }] }],
  });
  monthly.views = [{ state: "frozen", ySplit: 1 }];

  const dashboard = workbook.addWorksheet("Dashboard");
  dashboard.columns = [{ width: 30 }, { width: 22 }, { width: 22 }];
  dashboard.addRows([
    [title, "", ""],
    ["KPI", "Value", "Status"],
    ["Income", { formula: "Summary!B2" }, "Calculated"],
    ["Expenses", { formula: "Summary!B3" }, "Calculated"],
    ["Net profit", { formula: "Summary!B4" }, "Calculated"],
  ]);
  dashboard.mergeCells("A1:C1");
  dashboard.getRow(1).font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  dashboard.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  dashboard.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
  dashboard.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0891B2" } };
  dashboard.getColumn(2).eachCell((cell, rowNumber) => { if (rowNumber > 2) cell.numFmt = '"LKR" #,##0.00'; });
  dashboard.addConditionalFormatting({
    ref: "B3:B5",
    rules: [{ type: "dataBar", priority: 4, gradient: true, showValue: true, cfvo: [{ type: "min" }, { type: "max" }] }],
  });
  dashboard.addRows([
    [],
    ["Monthly trend data", "Open the Monthly Summary sheet to view formula-driven monthly data ready for charting."],
  ]);
  dashboard.mergeCells("B7:C7");
  dashboard.getCell("A7").font = { bold: true, color: { argb: "FF0E7490" } };
  dashboard.getCell("B7").alignment = { wrapText: true };
  dashboard.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = Buffer.from(buffer as ArrayBuffer);
  return {
    id: `artifact_${Date.now().toString(36)}`,
    type: "excel",
    title,
    filename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kyvorix-workbook"}.xlsx`,
    mimeType: MIME,
    sizeBytes: bytes.byteLength,
    createdAt: new Date().toISOString(),
    sheets: ["Read Me", "Input Data", "Calculations", "Summary", "Monthly Summary", "Dashboard"],
    highlights: ["Real formulas added", "Dropdown data validation", "Conditional formatting", "Monthly summary formulas", "KPI data bars", "Dashboard-ready chart data"],
    preview: { columns: ["Month", "Type", "Category", "Amount (LKR)"], rows },
    fileBase64: bytes.toString("base64"),
  };
}
