# Phase 3 Excel research

- ExcelJS upstream chart support remains an open issue; the official issue is still open as of the retrieved page and describes native charts as separate XLSX ZIP parts.
- Source: https://github.com/exceljs/exceljs/issues/141
- The issue notes a practical approach: generate the workbook with ExcelJS, then inject chart parts into the finished XLSX buffer. It references `chartsheet` as an implementation and mentions bar, line, pie, doughnut, area, scatter, and radar charts.
- ExcelJS repository: https://github.com/exceljs/exceljs
- Decision for Phase 3: keep ExcelJS for formulas, styles, conditional formatting, validation, and workbook structure; do not claim native chart output until a chart-injection library is validated against Excel's ZIP relationships and tested by opening the resulting workbook. Implement the safer advanced workbook features first and isolate chart support behind a validated builder boundary.
