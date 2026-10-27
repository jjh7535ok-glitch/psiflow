import ExcelJS from 'exceljs';
import { ProductItem, PsiDataStore } from '../types/psi';
import { calculateHubPsi, ensureProductModels } from './psiEngine';
import { loadProductionLines, ProductionLine } from './capaEngine';

/**
 * Generates an executive-styled, production-grade Excel (.xlsx) file
 * with full visual hierarchy, cell colors, borders, number formatting,
 * weekend highlights, and freeze panes matching the Matrix Grid.
 *
 * CRITICAL: Only lines that actually have products in the current view/filter
 * will be rendered. No empty ghost lines.
 */
export async function exportToFormattedExcel(
  products: ProductItem[],
  dateList: string[],
  dataStore: PsiDataStore,
  weekId: string,
  revisionTitle?: string,
  selectedLine?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PSI Flow SCM';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('14일 PSI 실행계획', {
    views: [{ state: 'frozen', xSplit: 5, ySplit: 5, showGridLines: true }],
  });

  // Colors Palette matching Matrix Grid
  const COLOR_TITLE_BG = '1E293B'; // Dark Slate
  const COLOR_HEADER_BG = '334155'; // Slate Header
  const COLOR_WEEKEND_HEADER = 'EA580C'; // Orange for weekend header
  const COLOR_LINE_BG = 'FEF3C7'; // Light Amber for Production Line
  const COLOR_LINE_TEXT = '92400E'; // Dark Amber
  const COLOR_PROD_BG = 'F8FAFC'; // Very light slate for Product Master
  const COLOR_PLAN_BG = 'EFF6FF'; // Soft Blue for Production Plan
  const COLOR_STOCK_BG = 'F0FDF4'; // Soft Emerald for Ending Stock
  const COLOR_WARN_BG = 'FEE2E2'; // Soft Rose for Shortage
  const COLOR_WARN_TEXT = 'B91C1C';
  const BORDER_THIN: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: 'CBD5E1' },
  };
  const CELL_BORDER: Partial<ExcelJS.Borders> = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN,
  };

  // 1. Title Banner (Row 1 ~ 2)
  const lineLabel = selectedLine && selectedLine !== 'ALL' ? ` [${selectedLine} 전용]` : '';
  const title = revisionTitle
    ? `[공식 배포본] ${revisionTitle} - 14일 PSI 공급망 실행계획${lineLabel}`
    : `[PSI Flow] ${weekId} 주차 14일 통합 생산 / 출하 / 재고 실행계획${lineLabel}`;

  const titleRow = sheet.addRow([title]);
  titleRow.height = 30;
  sheet.mergeCells(1, 1, 1, 7 + dateList.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.font = { name: '맑은 고딕', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TITLE_BG } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Subtitle / Metadata Row (Row 2)
  const metaRow = sheet.addRow([
    `발행일시: ${new Date().toLocaleString('ko-KR')}`,
    '',
    '',
    '',
    `적용 주차: ${weekId}`,
    `계획 일수: ${dateList.length}일`,
    `출력 대상 품목: ${products.length}종`,
  ]);
  metaRow.height = 20;
  sheet.mergeCells(2, 1, 2, 4);
  sheet.getCell(2, 1).font = { name: '맑은 고딕', size: 10, color: { argb: '64748B' } };
  sheet.getCell(2, 1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Blank Row (Row 3)
  const blankRow = sheet.addRow([]);
  blankRow.height = 10;

  // 2. Table Column Headers (Row 4 & 5)
  const baseHeaders = ['부품코드', '품목명', '구분', '출고센터', '차종/라인', '지표', '기초재고'];
  const fullHeaderRowValues: string[] = [...baseHeaders];

  dateList.forEach((d) => {
    const dt = new Date(d);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayLabel = days[dt.getDay()];
    fullHeaderRowValues.push(`${dt.getMonth() + 1}/${dt.getDate()} (${dayLabel})`);
  });
  fullHeaderRowValues.push('14일 합계/기말');

  const headerRow = sheet.addRow(fullHeaderRowValues);
  headerRow.height = 28;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.borders = CELL_BORDER;

    const dateIdx = colNumber - baseHeaders.length - 1;
    if (dateIdx >= 0 && dateIdx < dateList.length) {
      const dt = new Date(dateList[dateIdx]);
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isWeekend ? COLOR_WEEKEND_HEADER : COLOR_HEADER_BG },
      };
    } else {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_HEADER_BG },
      };
    }
  });

  // 3. Dynamically Group Products by Actual Assigned Lines (NO HARDCODING)
  const allLines = loadProductionLines(products);
  const assignedProductIds = new Set<string>();

  const activeLineGroups: { line: ProductionLine; products: ProductItem[] }[] = [];

  allLines.forEach((line) => {
    // If a specific line filter is active, only process that line
    if (selectedLine && selectedLine !== 'ALL' && line.id !== selectedLine) {
      return;
    }

    const lineProductIds = new Set(line.productConfigs.map((c) => c.productId));
    const matchedProducts = products.filter((p) => lineProductIds.has(p.id));

    // ONLY add the group if it actually has at least 1 product currently visible
    if (matchedProducts.length > 0) {
      matchedProducts.forEach((p) => assignedProductIds.add(p.id));
      activeLineGroups.push({
        line,
        products: matchedProducts,
      });
    }
  });

  const renderProductBlock = (prod: ProductItem) => {
    const calc = calculateHubPsi(prod, dateList, dataStore[prod.id] || {});

    // --- Product Section Header Row ---
    const prodHeaderRow = sheet.addRow([
      prod.code,
      prod.name,
      `카테고리: ${prod.category}`,
      `박스당 ${prod.boxQty}${prod.unit}`,
      `파렛트 ${prod.palletQty}${prod.unit}`,
      '품목 마스터 정보',
      prod.factoryInitialStock,
    ]);
    prodHeaderRow.height = 22;
    prodHeaderRow.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: '0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PROD_BG } };
      cell.borders = CELL_BORDER;
      cell.alignment = { vertical: 'middle' };
    });

    // 1. 공장 생산계획 행 (Prod Plan)
    const prodPlanRow = sheet.addRow([
      prod.code,
      prod.name,
      '공장생산',
      '자체공장',
      '메인라인',
      '생산 계획 (EA)',
      prod.factoryInitialStock,
      ...calc.days.map((d) => d.prodPlan),
      calc.summary.totalProdPlan,
    ]);
    prodPlanRow.height = 20;
    prodPlanRow.eachCell((cell, colNumber) => {
      cell.font = { name: '맑은 고딕', size: 9, bold: colNumber >= 6, color: { argb: '1E40AF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PLAN_BG } };
      cell.borders = CELL_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: colNumber >= 7 ? 'right' : 'left' };
      if (colNumber >= 7) cell.numFmt = '#,##0';
    });

    // 2. 공장 보유재고 행 (Factory Stock)
    const factoryStockRow = sheet.addRow([
      prod.code,
      prod.name,
      '공장생산',
      '자체공장',
      '물류창고',
      '공장 예상재고 (EA)',
      prod.factoryInitialStock,
      ...calc.days.map((d) => d.factoryEndingStock),
      calc.summary.finalFactoryStock,
    ]);
    factoryStockRow.height = 20;
    factoryStockRow.eachCell((cell, colNumber) => {
      cell.font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: '065F46' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_STOCK_BG } };
      cell.borders = CELL_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: colNumber >= 7 ? 'right' : 'left' };
      if (colNumber >= 7) cell.numFmt = '#,##0';
    });

    // 3. 차종별 소요 및 출고센터 재고 행
    prod.models.forEach((m) => {
      // 3-1. 고객 수요(판매) 계획
      const salesRow = sheet.addRow([
        prod.code,
        prod.name,
        '차종별',
        m.hubName || '울산 출고센터',
        `${m.name} (${m.customer})`,
        '고객 수요계획 (EA)',
        0,
        ...calc.days.map((d) => d.models[m.id]?.salesPlan ?? 0),
        calc.summary.models[m.id]?.totalSalesPlan ?? 0,
      ]);
      salesRow.height = 19;
      salesRow.eachCell((cell, colNumber) => {
        cell.font = { name: '맑은 고딕', size: 9, color: { argb: '334155' } };
        cell.borders = CELL_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: colNumber >= 7 ? 'right' : 'left' };
        if (colNumber >= 7) cell.numFmt = '#,##0';
      });

      // 3-2. 출고센터 입고 계획
      const inboundRow = sheet.addRow([
        prod.code,
        prod.name,
        '차종별',
        m.hubName || '울산 출고센터',
        `${m.name} (${m.customer})`,
        '출고센터 입고계획 (EA)',
        0,
        ...calc.days.map((d) => d.models[m.id]?.inboundPlan ?? 0),
        calc.summary.models[m.id]?.totalInboundPlan ?? 0,
      ]);
      inboundRow.height = 19;
      inboundRow.eachCell((cell, colNumber) => {
        cell.font = { name: '맑은 고딕', size: 9, color: { argb: '475569' } };
        cell.borders = CELL_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: colNumber >= 7 ? 'right' : 'left' };
        if (colNumber >= 7) cell.numFmt = '#,##0';
      });

      // 3-3. 차종별 예상재고 (안전재고 미달 시 빨간 경고색 하이라이트)
      const modelStockRow = sheet.addRow([
        prod.code,
        prod.name,
        '차종별',
        m.hubName || '울산 출고센터',
        `${m.name} (${m.customer})`,
        `예상재고 (안전: ${m.safetyStock.toLocaleString()})`,
        m.initialStock,
        ...calc.days.map((d) => d.models[m.id]?.endingStock ?? 0),
        calc.summary.models[m.id]?.finalStock ?? 0,
      ]);
      modelStockRow.height = 20;
      modelStockRow.eachCell((cell, colNumber) => {
        const dateIdx = colNumber - baseHeaders.length - 1;
        let isShortage = false;
        if (dateIdx >= 0 && dateIdx < dateList.length) {
          const ending = calc.days[dateIdx]?.models[m.id]?.endingStock ?? 0;
          isShortage = ending < m.safetyStock;
        }

        cell.font = {
          name: '맑은 고딕',
          size: 9,
          bold: isShortage,
          color: { argb: isShortage ? COLOR_WARN_TEXT : '0F172A' },
        };
        if (isShortage) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WARN_BG } };
        }
        cell.borders = CELL_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: colNumber >= 7 ? 'right' : 'left' };
        if (colNumber >= 7) cell.numFmt = '#,##0';
      });
    });

    // Blank separator row
    const sepRow = sheet.addRow([]);
    sepRow.height = 8;
  };

  // 4. Render Active Line Groups (Only lines with matching products!)
  activeLineGroups.forEach(({ line, products: lineProds }) => {
    const lineRow = sheet.addRow([`[${line.id}] ${line.name}`]);
    lineRow.height = 24;
    sheet.mergeCells(lineRow.number, 1, lineRow.number, 7 + dateList.length);
    const lineCell = sheet.getCell(lineRow.number, 1);
    lineCell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: COLOR_LINE_TEXT } };
    lineCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_LINE_BG } };
    lineCell.borders = CELL_BORDER;
    lineCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    lineProds.forEach((p) => renderProductBlock(p));
  });

  // Auto-fit Column Widths with comfortable padding
  const baseWidths = [16, 26, 12, 18, 24, 22, 14];
  sheet.columns = [
    ...baseWidths.map((w) => ({ width: w })),
    ...dateList.map(() => ({ width: 15 })), // 14 days
    { width: 18 }, // Total
  ];

  // Write Buffer and Trigger Browser Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const dateStamp = new Date().toISOString().slice(0, 10);
  const cleanWeek = weekId.replace(/[^a-zA-Z0-9_-]/g, '');
  const lineSuffix = selectedLine && selectedLine !== 'ALL' ? `_${selectedLine}` : '';
  anchor.download = `PSI_Flow_${cleanWeek}${lineSuffix}_14일실행계획_${dateStamp}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
