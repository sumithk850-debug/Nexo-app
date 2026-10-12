import assert from "node:assert/strict";
import { isArtifactRequest } from "../lib/artifactIntent";

const positiveRequests = [
  "Excel sheet එකක් හදලා දෙන්න",
  "මට budget workbook එකක් හදා දෙන්න",
  "Create an Excel workbook for my monthly expenses",
  "එක්සෙල් ෆයිල් එකක් සකස් කරලා දෙන්න",
  "Prepare a spreadsheet and add monthly totals",
];

for (const request of positiveRequests) {
  assert.equal(isArtifactRequest(request), true, `Expected artifact request: ${request}`);
}

const nonCreationRequests = [
  "What is an Excel workbook?",
  "මගේ Excel sheet එකේ formula එක වැරදිද?",
  "Explain how spreadsheets work",
  "Show me the workbook settings",
];

for (const request of nonCreationRequests) {
  assert.equal(isArtifactRequest(request), false, `Expected normal chat request: ${request}`);
}

console.log("Artifact intent verification passed: Sinhala and English workbook creation requests route to Artifact Studio without hijacking normal questions.");
