import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Factory,
  Truck,
  Store,
  Layers,
  Activity,
  Boxes,
  Sparkles,
  Lock,
  Settings,
  Car,
  SlidersHorizontal,
  Plus,
  Clock,
  Gauge,
} from 'lucide-react';
import {
  ProductItem,
  DailyHubRecord,
  PsiDataStore,
  CalculatedHubDay,
  VehicleModelConfig,
} from '../types/psi';
import { calculateHubPsi, ensureProductModels } from '../utils/psiEngine';
import {
  ProductionLine,
  loadProductionLines,
  loadShiftRules,
  calculateLineDailyRollup,
} from '../utils/capaEngine';

interface MatrixGridProps {
  products: ProductItem[];
  dateList: string[];
  dataStore: PsiDataStore;
  viewMode?: string;
  selectedLine?: string;
  selectedHub?: string;
  selectedVehicleModel?: string;
  expandedProductIds: Record<string, boolean>;
  onToggleProductExpand: (id: string) => void;
  onCellChange: (
    productId: string,
    modelId: string | null,
    dateStr: string,
    field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual',
    value: number
  ) => void;
  onForwardFillField: (
    productId: string,
    modelId: string | null,
    field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual',
    fromDateStr: string,
    value: number,
    keepWeekendZero: boolean
  ) => void;
  onBeginningStockChange?: (productId: string, modelId: string | null, value: number) => void;
  onSafetyStockChange?: (productId: string, modelId: string, value: number) => void;
  onOpenForwardFillModal: (productId?: string) => void;
  onOpenLineCapaModal?: () => void;
  onEditProduct: (product: ProductItem) => void;
  isReadOnly?: boolean;
}

interface ActiveCell {
  productId: string;
  modelId: string | null;
  dateStr: string;
  field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual' | 'beginningStock';
  initialVal: number;
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({
  products,
  dateList,
  dataStore,
  selectedLine = 'ALL',
  selectedHub = 'ALL',
  selectedVehicleModel = 'ALL',
  expandedProductIds,
  onToggleProductExpand,
  onCellChange,
  onForwardFillField,
  onBeginningStockChange,
  onSafetyStockChange,
  onOpenForwardFillModal,
  onOpenLineCapaModal,
  onEditProduct,
  isReadOnly = false,
}) => {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 현재 조회 기간의 기준 월 (예: "10월")
  const firstDateMonth = dateList[0] ? `${parseInt(dateList[0].split('-')[1], 10)}월` : '';

  // 빠른 안전재고 직접 수정 상태 (modelId -> string)
  const [editingSafetyModelId, setEditingSafetyModelId] = useState<string | null>(null);
  const [editingSafetyValue, setEditingSafetyValue] = useState<string>('');

  // 출고센터(거점) 및 차종별 접기/펼치기 상태: key = `${productId}_${hubOrModelId}`
  const [expandedModelKeys, setExpandedModelKeys] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    products.forEach((p) => {
      const prod = ensureProductModels(p);
      prod.models.forEach((m) => {
        map[`${prod.id}_${m.id}`] = true;
        map[`${prod.id}_${m.hubName}`] = true;
      });
    });
    return map;
  });

  // 품목별 차종 및 거점 세부 공급망 드릴다운 펼침 상태 (key = productId, 기본값: false - 접힌 상태)
  const [expandedVehicleDetails, setExpandedVehicleDetails] = useState<Record<string, boolean>>({});

  const toggleVehicleDetails = (productId: string) => {
    setExpandedVehicleDetails((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const toggleModelExpand = (productId: string, keyId: string) => {
    const key = `${productId}_${keyId}`;
    setExpandedModelKeys((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const setAllModelsForProduct = (productId: string, models: VehicleModelConfig[], expand: boolean) => {
    setExpandedModelKeys((prev) => {
      const next = { ...prev };
      models.forEach((m) => {
        next[`${productId}_${m.id}`] = expand;
        next[`${productId}_${m.hubName}`] = expand;
      });
      return next;
    });
  };

  // 생산라인 마스터 및 교대근무 규칙 로드
  const lines = useMemo(() => loadProductionLines(products), [products]);
  const shiftRules = useMemo(() => loadShiftRules(), []);

  // 생산라인별 접기/펼치기 상태 (기본 펼침)
  const [expandedLineIds, setExpandedLineIds] = useState<Record<string, boolean>>({});

  const toggleLineExpand = (lineId: string) => {
    setExpandedLineIds((prev) => ({
      ...prev,
      [lineId]: prev[lineId] === undefined ? false : !prev[lineId],
    }));
  };

  // 품목을 생산라인별로 그룹화 (어떤 라인에도 배정되지 않은 품목은 미배정 라인으로 보호)
  const lineGroups = useMemo(() => {
    const assignedProductIds = new Set<string>();
    const groups: Array<{
      line: ProductionLine;
      products: ProductItem[];
      isUnassigned?: boolean;
    }> = [];

    lines.forEach((line) => {
      const lineProductIds = new Set(line.productConfigs.map((c) => c.productId));
      const matchedProducts = products.filter((p) => lineProductIds.has(p.id));
      matchedProducts.forEach((p) => assignedProductIds.add(p.id));

      groups.push({
        line,
        products: matchedProducts,
      });
    });

    if (selectedLine && selectedLine !== 'ALL') {
      return groups.filter((g) => g.line.id === selectedLine);
    }

    return groups;
  }, [lines, products, selectedLine]);

  const handleCellClick = (
    productId: string,
    modelId: string | null,
    dateStr: string,
    field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual' | 'beginningStock',
    currentValue: number
  ) => {
    if (isReadOnly) return;
    setActiveCell({ productId, modelId, dateStr, field, initialVal: currentValue });
    setEditValue(String(currentValue));
  };

  const handleSaveCell = () => {
    if (!activeCell || isReadOnly) return;
    const num = Math.max(0, parseInt(editValue.replace(/,/g, ''), 10) || 0);
    if (activeCell.field === 'beginningStock') {
      if (onBeginningStockChange) {
        onBeginningStockChange(activeCell.productId, activeCell.modelId, num);
      }
    } else {
      onCellChange(
        activeCell.productId,
        activeCell.modelId,
        activeCell.dateStr,
        activeCell.field,
        num
      );
    }
    setActiveCell(null);
  };

  const handleForwardFill = (keepWeekendZero: boolean) => {
    if (!activeCell || isReadOnly) return;
    if (activeCell.field === 'beginningStock') {
      handleSaveCell();
      return;
    }
    const num = Math.max(0, parseInt(editValue.replace(/,/g, ''), 10) || 0);
    onForwardFillField(
      activeCell.productId,
      activeCell.modelId,
      activeCell.field,
      activeCell.dateStr,
      num,
      keepWeekendZero
    );
    setActiveCell(null);
  };

  const getCellValue = (
    productId: string,
    modelId: string | null,
    dateStr: string,
    field: ActiveCell['field']
  ): number => {
    const prodRecord = dataStore[productId]?.[dateStr];
    if (!prodRecord) return 0;
    if (!modelId) {
      if (field === 'prodPlan') return prodRecord.prodPlan || 0;
      if (field === 'prodActual') return prodRecord.prodActual || 0;
      return 0;
    }
    const modelRecord = prodRecord.models?.[modelId];
    if (!modelRecord) return 0;
    if (field === 'salesPlan') return modelRecord.salesPlan || 0;
    if (field === 'salesActual') return modelRecord.salesActual || 0;
    if (field === 'inboundPlan') return modelRecord.inboundPlan || 0;
    if (field === 'inboundActual') return modelRecord.inboundActual || 0;
    return 0;
  };

  const handleSaveAndMove = (direction: 'next' | 'prev') => {
    if (!activeCell || isReadOnly) return;
    const num = Math.max(0, parseInt(editValue.replace(/,/g, ''), 10) || 0);

    // 1. Save current cell value
    if (activeCell.field === 'beginningStock') {
      if (onBeginningStockChange) {
        onBeginningStockChange(activeCell.productId, activeCell.modelId, num);
      }
      setActiveCell(null);
      return;
    } else {
      onCellChange(
        activeCell.productId,
        activeCell.modelId,
        activeCell.dateStr,
        activeCell.field,
        num
      );
    }

    // 2. Navigate to adjacent date column
    const curIdx = dateList.indexOf(activeCell.dateStr);
    const targetIdx = direction === 'next' ? curIdx + 1 : curIdx - 1;

    if (targetIdx >= 0 && targetIdx < dateList.length) {
      const nextDate = dateList[targetIdx];
      const nextVal = getCellValue(
        activeCell.productId,
        activeCell.modelId,
        nextDate,
        activeCell.field
      );
      setActiveCell({
        productId: activeCell.productId,
        modelId: activeCell.modelId,
        dateStr: nextDate,
        field: activeCell.field,
        initialVal: nextVal,
      });
      setEditValue(String(nextVal));
    } else {
      setActiveCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleSaveAndMove(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveAndMove('next');
    } else if (e.key === 'ArrowRight' && (e.currentTarget.selectionStart === e.currentTarget.value.length || e.altKey)) {
      e.preventDefault();
      handleSaveAndMove('next');
    } else if (e.key === 'ArrowLeft' && (e.currentTarget.selectionStart === 0 || e.altKey)) {
      e.preventDefault();
      handleSaveAndMove('prev');
    } else if (e.key === 'Escape') {
      setActiveCell(null);
    }
  };

  const handleSaveSafetyStock = (productId: string, modelId: string) => {
    const num = Math.max(0, parseInt(editingSafetyValue.replace(/,/g, ''), 10) || 0);
    if (onSafetyStockChange) {
      onSafetyStockChange(productId, modelId, num);
    }
    setEditingSafetyModelId(null);
  };

  return (
    <div className="flex-1 w-full overflow-auto bg-slate-100 p-4">
      {isReadOnly && (
        <div className="mb-3 px-4 py-2.5 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-white">읽기 전용 모드</strong>: 배포된 주차별 확정 계획입니다. 소유자만 수정 및 배포가 가능합니다.
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            * 차종별 접기/펼치기, 추이 분석 차트 및 CSV 보고서 다운로드는 이용하실 수 있습니다.
          </span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {/* Table Container with Fixed & Scrollable Area */}
        <div className="overflow-x-auto max-h-[calc(100vh-190px)]">
          <table className="w-full border-collapse text-left border-spacing-0">
            {/* Header Row */}
            <thead className="bg-slate-50 sticky top-0 z-30 border-b border-slate-300 shadow-xs">
              <tr>
                {/* Fixed Column 1: Product & Hub & Metric Info */}
                <th
                  scope="col"
                  className={`sticky left-0 z-40 bg-slate-100 border-r border-b border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-800 ${
                    dateList.length <= 7
                      ? 'w-[280px] min-w-[280px] max-w-[280px]'
                      : 'w-[300px] min-w-[300px] max-w-[300px]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>품목 / 계층 / 지표</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {firstDateMonth ? `${firstDateMonth} 기초 / 안전재고` : '기초 / 안전재고'}
                    </span>
                  </div>
                </th>

                {/* Date Columns */}
                {dateList.map((dateStr) => {
                  const [y, m, d] = dateStr.split('-');
                  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                  const dayOfWeek = dayNames[dateObj.getDay()];
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  const today = new Date();
                  const isToday =
                    dateStr ===
                    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                  return (
                    <th
                      key={dateStr}
                      scope="col"
                      className={`border-r border-b border-slate-300 px-2 py-2 text-center ${
                        dateList.length <= 7
                          ? 'w-[102px] min-w-[102px] max-w-[102px]'
                          : 'w-[88px] min-w-[88px] max-w-[88px]'
                      } ${
                        isToday
                          ? 'bg-blue-50/80 font-bold text-blue-900 border-blue-300'
                          : isWeekend
                          ? 'bg-slate-100/70 text-slate-500'
                          : 'bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-mono tracking-tighter text-slate-500">
                        {m}/{d}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          isWeekend ? 'text-rose-500' : isToday ? 'text-blue-700 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {dayOfWeek}요일
                      </div>
                      {isToday && (
                        <div className="inline-block text-[9px] px-1 bg-blue-600 text-white rounded font-medium mt-0.5">
                          TODAY
                        </div>
                      )}
                    </th>
                  );
                })}

                {/* Right Fixed Summary Column */}
                <th
                  scope="col"
                  className={`sticky right-0 z-30 bg-slate-100 border-l border-b border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-800 ${
                    dateList.length <= 7 ? 'w-[140px] min-w-[140px]' : 'w-[150px] min-w-[150px]'
                  }`}
                >
                  주간 누적 / 기말 현황
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 text-xs">
              {products.length === 0 || lineGroups.length === 0 ? (
                <tr>
                  <td colSpan={dateList.length + 2} className="py-12 text-center text-slate-500 text-sm">
                    등록된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                lineGroups.map((group) => {
                  const lineRollup = calculateLineDailyRollup(
                    group.line,
                    group.products,
                    dateList,
                    dataStore,
                    shiftRules
                  );
                  const isLineExpanded = expandedLineIds[group.line.id] !== false;

                  return (
                    <React.Fragment key={group.line.id}>
                      {/* === LEVEL 0: PRODUCTION LINE MASTER HEADER ROW === */}
                      <tr className="bg-slate-950 text-white border-t-4 border-b border-slate-900 sticky z-25 shadow-md">
                        <td className="sticky left-0 z-25 bg-slate-950 px-3.5 py-3 border-r border-slate-800 w-[300px] min-w-[300px]">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => toggleLineExpand(group.line.id)}
                              className="flex items-center gap-2.5 text-left hover:text-blue-300 transition-colors group cursor-pointer"
                            >
                              <span className="p-1 rounded bg-slate-800 text-slate-300 group-hover:bg-slate-700">
                                {isLineExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                                    {group.line.id}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {group.products.length}개 품목 연결
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-white tracking-tight mt-0.5">
                                  {group.line.name}
                                </div>
                              </div>
                            </button>

                            {onOpenLineCapaModal && !isReadOnly && (
                              <button
                                type="button"
                                onClick={onOpenLineCapaModal}
                                title="라인 CAPA & 교대근무 스케줄러 열기"
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Middle Date Span in Line Header */}
                        <td colSpan={dateList.length} className="px-3.5 py-2.5 text-xs text-slate-300">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3 text-[11px]">
                              <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
                                <Clock className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-slate-300">
                                  월·화·목·금 <strong className="text-white">21.0h</strong> (주10.5+야10.5) | 수 {shiftRules.wednesdayOvertime ? '21.0h(잔업)' : '18.5h(고정)'} | 토 {shiftRules.saturdayOperating ? (shiftRules.saturdayMode === 'DAY_ONLY' ? '주간8h' : '주야18.5h') : '휴무'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-blue-950/80 px-2.5 py-1 rounded border border-blue-800 text-blue-200">
                                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                                <span>
                                  1라인 다품목 순차생산: <strong className="text-amber-300">단일 21h(8,064 EA)</strong> | <strong className="text-cyan-300">혼류 C/O 1h 차감 시 20h(7,680 EA)</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {onOpenLineCapaModal && !isReadOnly && (
                                <button
                                  type="button"
                                  onClick={onOpenLineCapaModal}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-[11px] shadow-xs transition-colors cursor-pointer"
                                >
                                  <Factory className="w-3 h-3" />
                                  <span>CAPA 스케줄러 & 품목설정</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Right Summary */}
                        <td className="sticky right-0 z-25 bg-slate-950 px-3 py-2 text-right font-mono text-xs text-slate-200 border-l border-slate-800">
                          <div className="text-[10px] text-slate-400">라인 전체 총재고</div>
                          <div className="font-bold text-amber-300 text-sm">
                            {lineRollup.finalPipelineStock.toLocaleString()} EA
                          </div>
                        </td>
                      </tr>

                      {/* If Line is Expanded */}
                      {isLineExpanded && (
                        <>
                          {group.products.length === 0 ? (
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <td colSpan={dateList.length + 2} className="py-5 text-center text-xs text-slate-500">
                                현재 이 라인에 연결된 품목이 없습니다.{' '}
                                {onOpenLineCapaModal && !isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={onOpenLineCapaModal}
                                    className="text-blue-600 font-semibold underline ml-1 cursor-pointer"
                                  >
                                    [CAPA 스케줄러]에서 품목 연결하기
                                  </button>
                                )}
                              </td>
                            </tr>
                          ) : (
                            group.products.map((rawProduct) => {
                              const product = ensureProductModels(rawProduct);
                              const isExpanded = expandedProductIds[product.id] ?? true;
                              const safeUnit = product.unit;
                              const safePalletQty = product.palletQty || 1;

                  const calc = calculateHubPsi(product, dateList, dataStore[product.id] || {});
                  const dayMap = new Map(calc.days.map((d) => [d.date, d]));
                  const { summary } = calc;

                  const hubNames = Array.from(new Set(product.models.map((m) => m.hubName || '울산 출고센터')));
                  const allHubsExpanded = hubNames.every(
                    (h) => expandedModelKeys[`${product.id}_${h}`] ?? true
                  );
                  const allModelsExpanded = product.models.every(
                    (m) => expandedModelKeys[`${product.id}_${m.id}`] ?? true
                  );
                  const isVehicleDetailsOpen = expandedVehicleDetails[product.id] ?? false;

                  return (
                    <React.Fragment key={product.id}>
                      {/* === LEVEL 1: PRODUCT HEADER ROW === */}
                      <tr className="bg-slate-800 text-white border-t-2 border-b-2 border-slate-900 sticky z-20">
                        <td
                          className="sticky left-0 z-20 bg-slate-800 px-3.5 py-2.5 font-bold border-r border-slate-700 w-[300px] min-w-[300px]"
                        >
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => onToggleProductExpand(product.id)}
                              className="flex items-center gap-2 text-left hover:text-blue-300 transition-colors group cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-blue-300" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-blue-300">{product.code}</span>
                                  <span className="text-[11px] px-1.5 py-0.2 bg-slate-700 text-slate-300 rounded font-normal">
                                    {product.category}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-white tracking-tight">
                                  {product.name}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => onEditProduct(product)}
                                  title="품목 및 고객사 차종·출고센터 공급망 흐름 설정"
                                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Middle Date Span in Header */}
                        <td colSpan={dateList.length} className="px-3 py-2 text-xs font-medium text-slate-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400">
                                🏭 {firstDateMonth ? `${firstDateMonth} ` : ''}공장 기초재고: <strong className="text-white">{product.factoryInitialStock.toLocaleString()}</strong> {safeUnit}
                              </span>
                              <span className="text-slate-400">
                                📦 출고단위: <strong className="text-amber-300">{product.palletQty.toLocaleString()}</strong> {safeUnit}/PLT
                              </span>
                              <span className="text-slate-400">
                                🚗 연결 차종: <strong className="text-blue-300">{product.models.length}개</strong>
                              </span>
                            </div>

                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => onOpenForwardFillModal(product.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] shadow-xs transition-colors"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>오늘 기준 연속 전개</span>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Right Summary */}
                        <td className="sticky right-0 z-20 bg-slate-800 px-3 py-2 text-right font-mono text-xs text-slate-200 border-l border-slate-700">
                          총 재고: <span className="font-bold text-amber-300">{summary.finalPipelineStock.toLocaleString()}</span> {safeUnit}
                        </td>
                      </tr>

                      {/* If Product is Expanded */}
                      {isExpanded && (
                        <>
                          {/* ======================================================== */}
                          {/* SECTION 1: CONSOLIDATED ROLL-UP (품목 전체 합계 및 기말재고 우선 정렬) */}
                          {/* ======================================================== */}
                          <tr className="bg-indigo-900 text-white border-y border-indigo-950">
                            <td
                              colSpan={dateList.length + 2}
                              className="sticky left-0 px-3.5 py-1.5 text-xs font-bold bg-indigo-900 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-indigo-300" />
                                <span className="font-bold">제품 통합 기말재고 및 공급망 총괄 (Consolidated Total Pipeline)</span>
                                <span className="text-[10px] px-2 py-0.2 bg-indigo-800 rounded font-normal text-indigo-200">
                                  품목 전체 합계 우선 정렬
                                </span>
                              </div>
                              <span className="text-[11px] text-indigo-200 font-normal">
                                * 공장 및 모든 고객사 차종·출고센터 지표가 일자별로 자동 합산 연계됩니다.
                              </span>
                            </td>
                          </tr>

                          {/* 1.1 전체 물류 총재고 (공장 + 전체거점) */}
                          <tr className="bg-indigo-100/80 hover:bg-indigo-100 font-bold text-indigo-950 border-b border-indigo-200">
                            <td className="sticky left-0 z-10 bg-indigo-100/90 hover:bg-indigo-100 border-r border-indigo-200 px-3.5 py-2 text-xs text-indigo-950 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                                  <span className="font-extrabold text-[12px]">전체 물류 총재고</span>
                                </span>
                                <span className="text-[10px] text-indigo-900 font-bold bg-indigo-200 px-1.5 py-0.5 rounded">
                                  공장 + 거점 합계
                                </span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.totalPipelineStock ?? 0;
                              const isToday = calcDay?.isToday;
                              return (
                                <td
                                  key={d}
                                  className={`border-r border-indigo-200 px-1 py-1 text-center font-mono text-xs font-extrabold text-indigo-950 ${
                                    isToday ? 'bg-indigo-200/50 ring-1 ring-inset ring-indigo-400' : 'bg-indigo-50/40'
                                  }`}
                                >
                                  {val.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-indigo-100/90 border-l border-indigo-200 px-3 py-2 text-right font-mono text-xs font-extrabold text-indigo-950">
                              총 {summary.finalPipelineStock.toLocaleString()} ({ (summary.finalPipelineStock / safePalletQty).toFixed(1)} PLT)
                            </td>
                          </tr>

                          {/* 1.2 거점 합산재고 */}
                          <tr className="bg-slate-100 hover:bg-slate-200/70 font-semibold border-b border-slate-200">
                            <td className="sticky left-0 z-10 bg-slate-100 hover:bg-slate-200/70 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-900 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5">
                                  <Store className="w-3 h-3 text-slate-600" />
                                  <span>거점 합산재고</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">모든 출고센터</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.totalCenterStock ?? 0;
                              return (
                                <td key={d} className="border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-slate-900">
                                  {val.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-slate-100 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-900">
                              기말 {summary.finalCenterStock.toLocaleString()} {safeUnit}
                            </td>
                          </tr>

                          {/* 1.3 공장 보유재고 */}
                          <tr className="bg-slate-50 hover:bg-slate-100/70 font-medium border-b border-slate-200">
                            <td className="sticky left-0 z-10 bg-slate-50 hover:bg-slate-100/70 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-900 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                                  <Boxes className="w-3 h-3 text-slate-700" />
                                  <span>공장 보유재고</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">기초 {product.factoryInitialStock.toLocaleString()}</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.factoryEndingStock ?? 0;
                              return (
                                <td
                                  key={d}
                                  className="border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-slate-900"
                                >
                                  {val.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-slate-50 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-900">
                              기말 {summary.finalFactoryStock.toLocaleString()} ({ (summary.finalFactoryStock / safePalletQty).toFixed(1)} PLT)
                            </td>
                          </tr>

                          {/* 1.4 총 판매계획 */}
                          <tr className="bg-indigo-50/20 hover:bg-indigo-50/40">
                            <td className="sticky left-0 z-10 bg-indigo-50/20 hover:bg-indigo-50/40 border-r border-slate-200 px-3.5 py-1.5 text-xs text-indigo-950 font-medium w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span>총 판매계획 (소요합계)</span>
                                <span className="text-[10px] text-slate-400">전 차종 합산</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.totalSalesPlan ?? 0;
                              return (
                                <td key={d} className="border-r border-slate-200 px-1 py-1 text-center font-mono text-xs text-slate-800">
                                  {val > 0 ? val.toLocaleString() : '-'}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-indigo-50/20 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-semibold text-indigo-950">
                              {summary.totalSalesPlan.toLocaleString()} {safeUnit}
                            </td>
                          </tr>

                          {/* 1.5 총 판매실적 */}
                          <tr className="bg-indigo-50/20 hover:bg-indigo-50/40 border-b border-slate-200">
                            <td className="sticky left-0 z-10 bg-indigo-50/20 hover:bg-indigo-50/40 border-r border-slate-200 px-3.5 py-1.5 text-xs text-indigo-950 font-medium w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="text-blue-800 font-semibold">총 판매실적 합계</span>
                                <span className="text-[10px] text-blue-700">전 차종 실적</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.totalSalesActual ?? 0;
                              return (
                                <td key={d} className="border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-blue-700">
                                  {val > 0 ? val.toLocaleString() : '-'}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-indigo-50/20 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-bold text-blue-900">
                              {summary.totalSalesActual.toLocaleString()} ({summary.salesAttainment}%)
                            </td>
                          </tr>

                          {/* 1.6 물류 건전성 진단 */}
                          <tr className="bg-white hover:bg-slate-50 border-b-2 border-slate-300">
                            <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>물류 건전성 진단</span>
                                </span>
                                <span className="text-[10px] text-slate-400">총량 vs 배분</span>
                              </div>
                            </td>
                            {dateList.map((d, dIdx) => {
                              const calcDay = dayMap.get(d);
                              if (!calcDay) return <td key={d} className="border-r border-slate-200 px-1 py-1 text-center">-</td>;

                              // 화면 좌우 가장자리 잘림 방지 위치 보정
                              const tooltipAlignClass =
                                dIdx <= 1
                                  ? 'left-0 translate-x-0'
                                  : dIdx >= dateList.length - 2
                                  ? 'right-0 translate-x-0'
                                  : 'left-1/2 -translate-x-1/2';

                              const arrowAlignClass =
                                dIdx <= 1
                                  ? 'left-6'
                                  : dIdx >= dateList.length - 2
                                  ? 'right-6'
                                  : 'left-1/2 -translate-x-1/2';

                              if (calcDay.pipelineStatus === 'SHORTAGE') {
                                return (
                                  <td key={d} className="border-r border-slate-200 px-1 py-1 text-center relative group">
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 cursor-help whitespace-nowrap">
                                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                      <span>총량부족</span>
                                    </span>

                                    {/* 즉각반응 슬림 스마트 칩 카드 (Tooltip) */}
                                    <div
                                      className={`absolute bottom-full mb-1.5 ${tooltipAlignClass} hidden group-hover:block z-50 w-60 p-2.5 bg-slate-900 text-white rounded-lg shadow-xl border border-rose-500/40 text-left text-[11px] pointer-events-none animate-in fade-in duration-0`}
                                    >
                                      <div className="flex items-center gap-1.5 font-bold text-rose-400 border-b border-slate-800 pb-1 mb-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                        <span>🚨 총량 부족 (Supply Shortage)</span>
                                      </div>
                                      <div className="text-[10px] text-slate-300 mb-1.5 leading-snug">
                                        <strong className="text-white">📍 상태:</strong> 파이프라인 전체 공급 부족
                                        <div className="text-rose-300 font-mono text-[9px] mt-0.5 pl-3">
                                          {calcDay.diagnosisMessage}
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-emerald-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60 leading-tight">
                                        <span className="font-semibold text-emerald-400">💡 권장 조치:</span> 공장 긴급 추가 생산 또는 라인 잔업 편성 필요
                                      </div>
                                      <div className={`absolute top-full ${arrowAlignClass} border-4 border-transparent border-t-slate-900`} />
                                    </div>
                                  </td>
                                );
                              }

                              if (calcDay.pipelineStatus === 'IMBALANCE') {
                                return (
                                  <td key={d} className="border-r border-slate-200 px-1 py-1 text-center relative group">
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 cursor-help whitespace-nowrap">
                                      <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                      <span>배분불균형</span>
                                    </span>

                                    {/* 즉각반응 슬림 스마트 칩 카드 (Tooltip) */}
                                    <div
                                      className={`absolute bottom-full mb-1.5 ${tooltipAlignClass} hidden group-hover:block z-50 w-60 p-2.5 bg-slate-900 text-white rounded-lg shadow-xl border border-amber-500/40 text-left text-[11px] pointer-events-none animate-in fade-in duration-0`}
                                    >
                                      <div className="flex items-center gap-1.5 font-bold text-amber-300 border-b border-slate-800 pb-1 mb-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>⚖️ 배분 불균형 (Imbalance)</span>
                                      </div>
                                      <div className="text-[10px] text-slate-300 mb-1.5 leading-snug">
                                        <strong className="text-white">📍 원인:</strong> 총량은 충분하나 거점 편중
                                        <div className="text-amber-300 font-mono text-[9px] mt-0.5 pl-3">
                                          {calcDay.diagnosisMessage}
                                        </div>
                                      </div>
                                      <div className="text-[10px] text-sky-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60 leading-tight">
                                        <span className="font-semibold text-sky-400">💡 권장 조치:</span> 공장 출하 배분량 재조정 및 거점간 전배 권장
                                      </div>
                                      <div className={`absolute top-full ${arrowAlignClass} border-4 border-transparent border-t-slate-900`} />
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td key={d} className="border-r border-slate-200 px-1 py-1 text-center relative group">
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-help whitespace-nowrap">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>정상</span>
                                  </span>

                                  {/* 즉각반응 슬림 스마트 칩 카드 (Tooltip) */}
                                  <div
                                    className={`absolute bottom-full mb-1.5 ${tooltipAlignClass} hidden group-hover:block z-50 w-56 p-2.5 bg-slate-900 text-white rounded-lg shadow-xl border border-emerald-500/40 text-left text-[11px] pointer-events-none animate-in fade-in duration-0`}
                                  >
                                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 border-b border-slate-800 pb-1 mb-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span>✅ 정상 운영 (Stable)</span>
                                    </div>
                                    <div className="text-[10px] text-slate-300 mb-1 leading-snug">
                                      <strong className="text-white">📍 상태:</strong> 공장 및 전 거점 안전재고 충족
                                    </div>
                                    <div className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60 leading-tight">
                                      <span className="font-semibold text-slate-300">💡 권장 조치:</span> 현재 계획대로 출하 및 공급 유지
                                    </div>
                                    <div className={`absolute top-full ${arrowAlignClass} border-4 border-transparent border-t-slate-900`} />
                                  </div>
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-3 py-1.5 text-center text-xs text-slate-600">
                              결품 {summary.totalShortageDays}일 · 불균형 {summary.imbalanceDays}일
                            </td>
                          </tr>

                          {/* ======================================================== */}
                          {/* SECTION 2: PLANT MANUFACTURING (공장 생산 계층)          */}
                          {/* ======================================================== */}
                          <tr className="bg-slate-100/90 text-slate-700 border-y border-slate-300">
                            <td
                              colSpan={dateList.length + 2}
                              className="sticky left-0 px-3.5 py-1.5 text-[11px] font-bold text-slate-800 bg-slate-200/80 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Factory className="w-3.5 h-3.5 text-slate-700" />
                                <span>공장 생산 및 통합 출하 (Plant Manufacturing & Shipments)</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-normal">
                                * 공장에서 생산된 완제품은 차종별 지정 출고센터로 배분 출하됩니다.
                              </span>
                            </td>
                          </tr>

                          {/* 1.0 공장 기초재고 */}
                          <tr className="bg-slate-50/70 hover:bg-slate-100/70 border-b border-slate-200">
                            <td className="sticky left-0 z-10 bg-slate-50/70 hover:bg-slate-100/70 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                                  <Boxes className="w-3 h-3 text-slate-500" />
                                  <span>{firstDateMonth ? `${firstDateMonth} ` : ''}공장 기초재고</span>
                                </span>
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-medium">
                                  첫날 직접수정
                                </span>
                              </div>
                            </td>
                            {dateList.map((d, dIdx) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.factoryBeginningStock ?? 0;
                              const isToday = calcDay?.isToday;
                              const isWeekend = calcDay?.isWeekend;
                              const isFirstDay = dIdx === 0;
                              const isEditing =
                                activeCell?.productId === product.id &&
                                activeCell?.modelId === null &&
                                activeCell?.field === 'beginningStock';

                              return (
                                <td
                                  key={d}
                                  onClick={() =>
                                    isFirstDay &&
                                    !isReadOnly &&
                                    handleCellClick(product.id, null, d, 'beginningStock', product.factoryInitialStock)
                                  }
                                  className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs ${
                                    isFirstDay
                                      ? 'bg-amber-50/80 font-bold text-amber-950 cursor-pointer hover:bg-amber-100 ring-1 ring-inset ring-amber-300'
                                      : isToday
                                      ? 'bg-blue-50/30 text-slate-700'
                                      : isWeekend
                                      ? 'bg-slate-50/40 text-slate-400'
                                      : 'text-slate-700'
                                  }`}
                                  title={isFirstDay ? `클릭하여 당월(${firstDateMonth}) 공장 기초재고 직접 수정` : '전일 공장 보유재고 자동 이월'}
                                >
                                  {isFirstDay && isEditing ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      min="0"
                                      step="1"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleKeyDown}
                                      onBlur={handleSaveCell}
                                      className="w-full text-center bg-white border-2 border-amber-500 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span>{val.toLocaleString()}</span>
                                      {isFirstDay && !isReadOnly && (
                                        <span className="text-[9px] text-amber-700 font-normal">✎</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-slate-50/70 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-slate-700 font-semibold">
                              기초 {product.factoryInitialStock.toLocaleString()} {safeUnit}
                            </td>
                          </tr>

                          {/* 1.1 공장 생산계획 */}
                          <tr className="bg-white hover:bg-slate-50/80">
                            <td className="sticky left-0 z-10 bg-white hover:bg-slate-50/80 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Factory className="w-3 h-3 text-slate-500" />
                                  <span>생산계획</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {onOpenLineCapaModal && !isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenLineCapaModal();
                                      }}
                                      title="라인 CAPA & 교대근무 스케줄러로 일일 생산계획 자동 산출"
                                      className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[9px] font-semibold cursor-pointer transition-colors"
                                    >
                                      CAPA 산출
                                    </button>
                                  )}
                                  <span className="text-[10px] text-slate-400">공장 생산</span>
                                </div>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.prodPlan ?? 0;
                              const isToday = calcDay?.isToday;
                              const isWeekend = calcDay?.isWeekend;
                              const isEditing =
                                activeCell?.productId === product.id &&
                                activeCell?.modelId === null &&
                                activeCell?.dateStr === d &&
                                activeCell?.field === 'prodPlan';

                              return (
                                <td
                                  key={d}
                                  onClick={() => handleCellClick(product.id, null, d, 'prodPlan', val)}
                                  className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs cursor-pointer select-none transition-colors ${
                                    isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/50 text-slate-400' : ''
                                  } ${!isReadOnly ? 'hover:bg-amber-50 hover:outline hover:outline-1 hover:outline-amber-400' : ''}`}
                                >
                                  {isEditing ? (
                                    <div className="relative">
                                      <input
                                        type="number"
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onBlur={handleSaveCell}
                                        className="w-full text-center bg-white border-2 border-blue-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                      />
                                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 bg-slate-900 text-white rounded-md p-1 shadow-lg flex items-center gap-1 text-[10px] z-50 whitespace-nowrap">
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleForwardFill(true);
                                          }}
                                          className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded"
                                        >
                                          오늘기준 전개(주말0)
                                        </button>
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleForwardFill(false);
                                          }}
                                          className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded"
                                        >
                                          매일 전개
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span>{val > 0 ? val.toLocaleString() : '-'}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-slate-800">
                              {summary.totalProdPlan.toLocaleString()} {safeUnit}
                            </td>
                          </tr>

                          {/* 1.2 공장 생산실적 */}
                          <tr className="bg-white hover:bg-slate-50/80">
                            <td className="sticky left-0 z-10 bg-white hover:bg-slate-50/80 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                                  <Factory className="w-3 h-3 text-emerald-600" />
                                  <span>생산실적</span>
                                </span>
                                <span className="text-[10px] text-emerald-600">공장 실적</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.prodActual ?? 0;
                              const isToday = calcDay?.isToday;
                              const isWeekend = calcDay?.isWeekend;
                              const isEditing =
                                activeCell?.productId === product.id &&
                                activeCell?.modelId === null &&
                                activeCell?.dateStr === d &&
                                activeCell?.field === 'prodActual';

                              return (
                                <td
                                  key={d}
                                  onClick={() => handleCellClick(product.id, null, d, 'prodActual', val)}
                                  className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-emerald-700 cursor-pointer select-none transition-colors ${
                                    isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/50 text-slate-400' : ''
                                  } ${!isReadOnly ? 'hover:bg-emerald-50 hover:outline hover:outline-1 hover:outline-emerald-400' : ''}`}
                                >
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleKeyDown}
                                      onBlur={handleSaveCell}
                                      className="w-full text-center bg-white border-2 border-emerald-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                    />
                                  ) : (
                                    <span>{val > 0 ? val.toLocaleString() : '-'}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-emerald-800 font-bold">
                              {summary.totalProdActual.toLocaleString()} ({summary.prodAttainment}%)
                            </td>
                          </tr>

                          {/* 1.3 공장 총출하 */}
                          <tr className="bg-slate-50/70 hover:bg-slate-100/70">
                            <td className="sticky left-0 z-10 bg-slate-50/70 hover:bg-slate-100/70 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                  <Truck className="w-3 h-3 text-slate-600" />
                                  <span>공장 총출하</span>
                                </span>
                                <span className="text-[10px] text-slate-400">전 차종 상차</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.totalFactoryAlloc ?? 0;
                              const isExceeded = calcDay?.allocExceeded;
                              return (
                                <td
                                  key={d}
                                  title={isExceeded ? '공장 가용재고 초과 출하!' : undefined}
                                  className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-medium text-slate-800 ${
                                    isExceeded ? 'bg-rose-100 text-rose-700 font-bold' : ''
                                  }`}
                                >
                                  {val > 0 ? val.toLocaleString() : '-'}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-slate-50/70 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-slate-700">
                              총 {calc.days.reduce((acc, c) => acc + c.totalFactoryAlloc, 0).toLocaleString()} ({ (calc.days.reduce((acc, c) => acc + c.totalFactoryAlloc, 0) / safePalletQty).toFixed(1)} PLT)
                            </td>
                          </tr>

                          {/* 1.4 공장 보유재고 */}
                          <tr className="bg-slate-100 hover:bg-slate-200/70 font-semibold border-b border-slate-300">
                            <td className="sticky left-0 z-10 bg-slate-100 hover:bg-slate-200/70 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-900 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                                  <Boxes className="w-3 h-3 text-slate-700" />
                                  <span>공장 보유재고</span>
                                </span>
                                <span className="text-[10px] text-slate-500">기초 {product.factoryInitialStock}</span>
                              </div>
                            </td>
                            {dateList.map((d) => {
                              const calcDay = dayMap.get(d);
                              const val = calcDay?.factoryEndingStock ?? 0;
                              return (
                                <td
                                  key={d}
                                  className="border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-slate-900"
                                >
                                  {val.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-10 bg-slate-100 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-900">
                              기말 {summary.finalFactoryStock.toLocaleString()} ({ (summary.finalFactoryStock / safePalletQty).toFixed(1)} PLT)
                            </td>
                          </tr>

                          {/* ======================================================== */}
                          {/* SECTION 3: REGIONAL HUBS & VEHICLE MODELS (거점 및 차종 세부 드릴다운) */}
                          {/* ======================================================== */}
                          <tr
                            onClick={() => toggleVehicleDetails(product.id)}
                            className="bg-blue-900 hover:bg-blue-950 text-white border-y border-blue-950 cursor-pointer select-none transition-colors"
                          >
                            <td
                              colSpan={dateList.length + 2}
                              className="sticky left-0 px-3.5 py-2 text-xs font-bold bg-blue-900 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                {isVehicleDetailsOpen ? (
                                  <ChevronDown className="w-4 h-4 text-amber-300 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-blue-300 shrink-0" />
                                )}
                                <Car className="w-4 h-4 text-blue-300 shrink-0" />
                                <span className="font-bold">고객사 차종 및 출고센터별 세부 공급망 드릴다운</span>
                                <span className="text-[11px] px-2 py-0.2 bg-blue-800 rounded font-normal text-blue-200">
                                  총 {hubNames.length}개 출고센터 ({product.models.length}개 차종)
                                </span>
                                <span className="text-[11px] text-amber-300 font-medium ml-1">
                                  {isVehicleDetailsOpen
                                    ? '▲ 클릭 시 차종별 세부 행 접기'
                                    : '▼ 클릭 시 차종별 세부 판매·입고 행 펼치기 (CL4M, BC4 등)'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => toggleVehicleDetails(product.id)}
                                  className="text-[11px] font-semibold text-amber-300 hover:text-white px-2.5 py-1 rounded bg-blue-800 hover:bg-blue-700 border border-blue-700 transition-colors cursor-pointer"
                                >
                                  {isVehicleDetailsOpen ? '차종별 상세 접기 ▲' : '차종별 상세 펼치기 ▼'}
                                </button>
                                {isVehicleDetailsOpen && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedModelKeys((prev) => {
                                        const next = { ...prev };
                                        hubNames.forEach((h) => {
                                          next[`${product.id}_${h}`] = !allHubsExpanded;
                                        });
                                        return next;
                                      });
                                    }}
                                    className="text-[11px] font-medium text-blue-200 hover:text-white px-2 py-0.5 rounded bg-blue-800/80 hover:bg-blue-700 transition-colors"
                                  >
                                    {allHubsExpanded ? '모든 거점 접기' : '모든 거점 펼치기'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Render Each Regional Distribution Center (Hub) when open */}
                          {isVehicleDetailsOpen &&
                            hubNames
                              .filter((h) => selectedHub === 'ALL' || h === selectedHub)
                              .map((hub) => {
                                const allHubModels = product.models.filter((m) => (m.hubName || '울산 출고센터') === hub);
                                const hubModels = allHubModels.filter(
                                  (m) => selectedVehicleModel === 'ALL' || m.name === selectedVehicleModel
                                );

                                // 특정 차종 필터가 적용되어 있고 해당 거점에 그 차종이 없으면 해당 거점 렌더링 생략
                                if (selectedVehicleModel !== 'ALL' && hubModels.length === 0) {
                                  return null;
                                }

                                const primaryModel = hubModels[0] || allHubModels[0] || product.models[0];
                                const isHubExpanded = expandedModelKeys[`${product.id}_${hub}`] ?? true;

                            // Center summary from engine
                            const centerSummary = summary.centers?.[hub] || {
                              hubName: hub,
                              totalSalesPlan: hubModels.reduce((acc, m) => acc + (summary.models[m.id]?.totalSalesPlan || 0), 0),
                              totalSalesActual: hubModels.reduce((acc, m) => acc + (summary.models[m.id]?.totalSalesActual || 0), 0),
                              salesAttainment: 0,
                              totalInboundPlan: summary.models[primaryModel.id]?.totalInboundPlan || 0,
                              totalInboundActual: summary.models[primaryModel.id]?.totalInboundActual || 0,
                              inboundAttainment: 0,
                              finalEndingStock: hubModels.reduce((acc, m) => acc + (m.initialStock || 0), 0),
                              warningDays: 0,
                              safetyStock: hubModels.reduce((acc, m) => acc + (m.safetyStock || 0), 0),
                            };

                            const hasWarning = centerSummary.warningDays > 0;
                            const centerInitialStock = hubModels.reduce((sum, m) => sum + (Number(m.initialStock) || 0), 0);
                            const centerSafetyStock = centerSummary.safetyStock;

                            return (
                              <React.Fragment key={hub}>
                                {/* Hub Sub-header bar */}
                                <tr className="bg-slate-50 hover:bg-slate-100/80 border-t border-slate-300 cursor-pointer">
                                  <td
                                    onClick={() => toggleModelExpand(product.id, hub)}
                                    className="sticky left-0 z-10 bg-slate-50 hover:bg-slate-100/80 border-r border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-900 w-[300px] min-w-[300px]"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        {isHubExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        )}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-slate-900 text-xs">
                                            {hub}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 flex-wrap">
                                        {hubModels.map((m) => {
                                          const badgeColorClass =
                                            m.badgeColor === 'emerald'
                                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                              : m.badgeColor === 'purple'
                                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                                              : m.badgeColor === 'amber'
                                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                                              : m.badgeColor === 'rose'
                                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                                              : 'bg-blue-50 text-blue-800 border-blue-300';
                                          return (
                                            <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${badgeColorClass}`}>
                                              {m.name}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>

                                  <td
                                    onClick={() => toggleModelExpand(product.id, hub)}
                                    colSpan={dateList.length}
                                    className="px-3 py-1.5 text-xs text-slate-600"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 text-[11px] flex-wrap">
                                        <span className="flex items-center gap-1">
                                          <span className="text-slate-600">거점 기초재고:</span>
                                          <strong className="text-slate-900 font-mono">{centerInitialStock.toLocaleString()}</strong>
                                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">첫날 수정가능</span>
                                        </span>

                                        <span className="flex items-center gap-1.5">
                                          <span className="text-amber-900 font-semibold">거점 안전재고:</span>
                                          {editingSafetyModelId === primaryModel.id ? (
                                            <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                              <input
                                                type="number"
                                                autoFocus
                                                min="0"
                                                step="1"
                                                value={editingSafetyValue}
                                                onChange={(e) => setEditingSafetyValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveSafetyStock(product.id, primaryModel.id);
                                                  if (e.key === 'Escape') setEditingSafetyModelId(null);
                                                }}
                                                className="w-20 px-1 py-0.5 text-xs font-mono font-bold text-center bg-white border border-amber-500 rounded text-amber-950 shadow-xs"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleSaveSafetyStock(product.id, primaryModel.id)}
                                                className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px]"
                                              >
                                                저장
                                              </button>
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isReadOnly) {
                                                  setEditingSafetyModelId(primaryModel.id);
                                                  setEditingSafetyValue(String(centerSafetyStock));
                                                }
                                              }}
                                              className="font-mono font-bold text-amber-800 hover:text-amber-950 underline decoration-dotted"
                                              title="클릭하여 거점 안전재고 직접 수정"
                                            >
                                              {centerSafetyStock.toLocaleString()} {safeUnit}
                                            </button>
                                          )}
                                        </span>

                                        {/* Auto Calculate Safety Stock Button (5일분) */}
                                        {!isReadOnly && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const nonWeekendDays = dateList.filter((d) => !dayMap.get(d)?.isWeekend).length || 1;
                                              const avgDailyDemand = centerSummary.totalSalesPlan / nonWeekendDays;
                                              const autoSafety = Math.round(avgDailyDemand * (primaryModel.safetyDays || 5));
                                              if (onSafetyStockChange) {
                                                onSafetyStockChange(product.id, primaryModel.id, autoSafety);
                                              }
                                            }}
                                            className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[10px] font-bold shadow-2xs transition-colors"
                                            title={`합친 일소요량 × ${primaryModel.safetyDays || 5}일치로 거점 안전재고 자동 계산`}
                                          >
                                            ⚡ {primaryModel.safetyDays || 5}일분 자동계산
                                          </button>
                                        )}

                                        {hasWarning && (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded">
                                            <AlertTriangle className="w-3 h-3" />
                                            <span>안전재고 미달 {centerSummary.warningDays}일 발생</span>
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-400">
                                        {isHubExpanded ? '클릭하여 접기' : '클릭하여 세부 판매·입고 열기'}
                                      </span>
                                    </div>
                                  </td>

                                  <td
                                    onClick={() => toggleModelExpand(product.id, hub)}
                                    className="sticky right-0 z-10 bg-slate-50 hover:bg-slate-100 border-l border-slate-300 px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-800"
                                  >
                                    기말 {centerSummary.finalEndingStock.toLocaleString()} {safeUnit}
                                  </td>
                                </tr>

                                {/* When Hub is Expanded: Show Unified Stock Rows & Per-model Demands */}
                                {isHubExpanded && (
                                  <>
                                    {/* 2.0 거점 기초재고 (단일 행) */}
                                    <tr className="bg-slate-50/70 hover:bg-slate-100/70 border-b border-slate-200">
                                      <td className="sticky left-0 z-10 bg-slate-50/70 hover:bg-slate-100/70 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                                        <div className="flex items-center justify-between pl-6">
                                          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                                            <Boxes className="w-3 h-3 text-slate-500" />
                                            <span>{firstDateMonth ? `${firstDateMonth} ` : ''}거점 기초재고</span>
                                          </span>
                                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-medium">
                                            첫날 직접입력
                                          </span>
                                        </div>
                                      </td>
                                      {dateList.map((d, dIdx) => {
                                        const calcDay = dayMap.get(d);
                                        const centerDay = calcDay?.centers?.[hub];
                                        const val = centerDay?.beginningStock ?? 0;
                                        const isToday = calcDay?.isToday;
                                        const isWeekend = calcDay?.isWeekend;
                                        const isFirstDay = dIdx === 0;
                                        const isEditing =
                                          activeCell?.productId === product.id &&
                                          activeCell?.modelId === primaryModel.id &&
                                          activeCell?.field === 'beginningStock';

                                        return (
                                          <td
                                            key={d}
                                            onClick={() =>
                                              isFirstDay &&
                                              !isReadOnly &&
                                              handleCellClick(product.id, primaryModel.id, d, 'beginningStock', centerInitialStock)
                                            }
                                            className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs ${
                                              isFirstDay
                                                ? 'bg-amber-50/80 font-bold text-amber-950 cursor-pointer hover:bg-amber-100 ring-1 ring-inset ring-amber-300'
                                                : isToday
                                                ? 'bg-blue-50/30 text-slate-700'
                                                : isWeekend
                                                ? 'bg-slate-50/40 text-slate-400'
                                                : 'text-slate-700'
                                            }`}
                                            title={isFirstDay ? `클릭하여 당월(${firstDateMonth}) [${hub}] 거점 기초재고 직접 수정` : '전일 거점 기말재고 자동 이월'}
                                          >
                                            {isFirstDay && isEditing ? (
                                              <input
                                                type="number"
                                                autoFocus
                                                min="0"
                                                step="1"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onBlur={handleSaveCell}
                                                className="w-full text-center bg-white border-2 border-amber-500 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                              />
                                            ) : (
                                              <div className="flex items-center justify-center gap-0.5">
                                                <span>{val.toLocaleString()}</span>
                                                {isFirstDay && !isReadOnly && (
                                                  <span className="text-[9px] text-amber-700 font-normal">✎</span>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="sticky right-0 z-10 bg-slate-50/70 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-slate-700 font-semibold">
                                        기초 {centerInitialStock.toLocaleString()} {safeUnit}
                                      </td>
                                    </tr>

                                    {/* 2.1 거점 입고계획 (배분입고) - 거점 단일 행 */}
                                    <tr className="bg-slate-50/40 hover:bg-slate-100/50">
                                      <td className="sticky left-0 z-10 bg-slate-50/40 hover:bg-slate-100/50 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                                        <div className="flex items-center justify-between pl-6">
                                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                            <Truck className="w-3 h-3 text-slate-500" />
                                            <span>거점 입고계획 (배분)</span>
                                          </span>
                                          <span className="text-[10px] text-slate-400">공장 출하배정</span>
                                        </div>
                                      </td>
                                      {dateList.map((d) => {
                                        const calcDay = dayMap.get(d);
                                        const centerDay = calcDay?.centers?.[hub];
                                        const val = centerDay?.inboundPlan ?? 0;
                                        const isToday = calcDay?.isToday;
                                        const isWeekend = calcDay?.isWeekend;
                                        const isEditing =
                                          activeCell?.productId === product.id &&
                                          activeCell?.modelId === primaryModel.id &&
                                          activeCell?.dateStr === d &&
                                          activeCell?.field === 'inboundPlan';

                                        return (
                                          <td
                                            key={d}
                                            onClick={() => handleCellClick(product.id, primaryModel.id, d, 'inboundPlan', val)}
                                            className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs cursor-pointer select-none transition-colors ${
                                              isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/50 text-slate-400' : ''
                                            } ${!isReadOnly ? 'hover:bg-amber-50 hover:outline hover:outline-1 hover:outline-amber-400' : ''}`}
                                          >
                                            {isEditing ? (
                                              <div className="relative">
                                                <input
                                                  type="number"
                                                  autoFocus
                                                  value={editValue}
                                                  onChange={(e) => setEditValue(e.target.value)}
                                                  onKeyDown={handleKeyDown}
                                                  onBlur={handleSaveCell}
                                                  className="w-full text-center bg-white border-2 border-blue-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                                />
                                                <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 bg-slate-900 text-white rounded-md p-1 shadow-lg flex items-center gap-1 text-[10px] z-50 whitespace-nowrap">
                                                  <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      handleForwardFill(true);
                                                    }}
                                                    className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded"
                                                  >
                                                    오늘기준 전개(주말0)
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      handleForwardFill(false);
                                                    }}
                                                    className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded"
                                                  >
                                                    매일 전개
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <span>{val > 0 ? val.toLocaleString() : '-'}</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="sticky right-0 z-10 bg-slate-50/40 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-slate-800">
                                        {centerSummary.totalInboundPlan.toLocaleString()} {safeUnit}
                                      </td>
                                    </tr>

                                    {/* 2.2 거점 입고실적 - 거점 단일 행 */}
                                    <tr className="bg-slate-50/40 hover:bg-slate-100/50">
                                      <td className="sticky left-0 z-10 bg-slate-50/40 hover:bg-slate-100/50 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                                        <div className="flex items-center justify-between pl-6">
                                          <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                                            <Truck className="w-3 h-3 text-emerald-600" />
                                            <span>거점 입고실적</span>
                                          </span>
                                          <span className="text-[10px] text-emerald-600">센터 도착실적</span>
                                        </div>
                                      </td>
                                      {dateList.map((d) => {
                                        const calcDay = dayMap.get(d);
                                        const centerDay = calcDay?.centers?.[hub];
                                        const val = centerDay?.inboundActual ?? 0;
                                        const isToday = calcDay?.isToday;
                                        const isWeekend = calcDay?.isWeekend;
                                        const isEditing =
                                          activeCell?.productId === product.id &&
                                          activeCell?.modelId === primaryModel.id &&
                                          activeCell?.dateStr === d &&
                                          activeCell?.field === 'inboundActual';

                                        return (
                                          <td
                                            key={d}
                                            onClick={() => handleCellClick(product.id, primaryModel.id, d, 'inboundActual', val)}
                                            className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-emerald-700 cursor-pointer select-none transition-colors ${
                                              isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/50 text-slate-400' : ''
                                            } ${!isReadOnly ? 'hover:bg-emerald-50 hover:outline hover:outline-1 hover:outline-emerald-400' : ''}`}
                                          >
                                            {isEditing ? (
                                              <input
                                                type="number"
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onBlur={handleSaveCell}
                                                className="w-full text-center bg-white border-2 border-emerald-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                              />
                                            ) : (
                                              <span>{val > 0 ? val.toLocaleString() : '-'}</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="sticky right-0 z-10 bg-slate-50/40 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-emerald-800 font-bold">
                                        {centerSummary.totalInboundActual.toLocaleString()} ({centerSummary.inboundAttainment}%)
                                      </td>
                                    </tr>

                                    {/* 2.3 차종별 판매계획 (소요량) 및 판매실적 */}
                                    {hubModels.map((model) => {
                                      const modelSummary = summary.models[model.id] || {
                                        totalSalesPlan: 0,
                                        totalSalesActual: 0,
                                        salesAttainment: 0,
                                      };
                                      return (
                                        <React.Fragment key={model.id}>
                                          {/* 차종별 판매계획 */}
                                          <tr className="bg-white hover:bg-blue-50/20">
                                            <td className="sticky left-0 z-10 bg-white hover:bg-blue-50/20 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                                              <div className="flex items-center justify-between pl-6">
                                                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                                                  <Store className="w-3 h-3 text-blue-600" />
                                                  <span>[{model.customer}] {model.name} 판매계획 (소요량)</span>
                                                </span>
                                                <span className="text-[10px] text-slate-400">차종 소요</span>
                                              </div>
                                            </td>
                                            {dateList.map((d) => {
                                              const calcDay = dayMap.get(d);
                                              const mData = calcDay?.models[model.id];
                                              const val = mData?.salesPlan ?? 0;
                                              const isToday = calcDay?.isToday;
                                              const isWeekend = calcDay?.isWeekend;
                                              const isEditing =
                                                activeCell?.productId === product.id &&
                                                activeCell?.modelId === model.id &&
                                                activeCell?.dateStr === d &&
                                                activeCell?.field === 'salesPlan';

                                              return (
                                                <td
                                                  key={d}
                                                  onClick={() => handleCellClick(product.id, model.id, d, 'salesPlan', val)}
                                                  className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs cursor-pointer select-none transition-colors ${
                                                    isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/50 text-slate-400' : ''
                                                  } ${!isReadOnly ? 'hover:bg-amber-50 hover:outline hover:outline-1 hover:outline-amber-400' : ''}`}
                                                >
                                                  {isEditing ? (
                                                    <div className="relative">
                                                      <input
                                                        type="number"
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        onBlur={handleSaveCell}
                                                        className="w-full text-center bg-white border-2 border-blue-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                                      />
                                                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 bg-slate-900 text-white rounded-md p-1 shadow-lg flex items-center gap-1 text-[10px] z-50 whitespace-nowrap">
                                                        <button
                                                          type="button"
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            handleForwardFill(true);
                                                          }}
                                                          className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded"
                                                        >
                                                          오늘기준 전개(주말0)
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            handleForwardFill(false);
                                                          }}
                                                          className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-white rounded"
                                                        >
                                                          매일 전개
                                                        </button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <span>{val > 0 ? val.toLocaleString() : '-'}</span>
                                                  )}
                                                </td>
                                              );
                                            })}
                                            <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-slate-800">
                                              {modelSummary.totalSalesPlan.toLocaleString()} {safeUnit}
                                            </td>
                                          </tr>

                                          {/* 차종별 판매실적 */}
                                          <tr className="bg-white hover:bg-blue-50/20">
                                            <td className="sticky left-0 z-10 bg-white hover:bg-blue-50/20 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-800 w-[300px] min-w-[300px]">
                                              <div className="flex items-center justify-between pl-6">
                                                <span className="flex items-center gap-1.5 font-medium text-blue-700">
                                                  <Store className="w-3 h-3 text-blue-600" />
                                                  <span>[{model.customer}] {model.name} 판매실적</span>
                                                </span>
                                                <span className="text-[10px] text-blue-600">출하실적</span>
                                              </div>
                                            </td>
                                            {dateList.map((d) => {
                                              const calcDay = dayMap.get(d);
                                              const mData = calcDay?.models[model.id];
                                              const val = mData?.salesActual ?? 0;
                                              const isToday = calcDay?.isToday;
                                              const isWeekend = calcDay?.isWeekend;
                                              const isEditing =
                                                activeCell?.productId === product.id &&
                                                activeCell?.modelId === model.id &&
                                                activeCell?.dateStr === d &&
                                                activeCell?.field === 'salesActual';

                                              return (
                                                <td
                                                  key={d}
                                                  onClick={() => handleCellClick(product.id, model.id, d, 'salesActual', val)}
                                                  className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold text-blue-700 cursor-pointer select-none transition-colors ${
                                                    isToday ? 'bg-blue-50/40' : isWeekend ? 'bg-slate-50/50 text-slate-400' : ''
                                                  } ${!isReadOnly ? 'hover:bg-blue-50 hover:outline hover:outline-1 hover:outline-blue-400' : ''}`}
                                                >
                                                  {isEditing ? (
                                                    <input
                                                      type="number"
                                                      autoFocus
                                                      value={editValue}
                                                      onChange={(e) => setEditValue(e.target.value)}
                                                      onKeyDown={handleKeyDown}
                                                      onBlur={handleSaveCell}
                                                      className="w-full text-center bg-white border-2 border-blue-600 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-900 shadow-sm"
                                                    />
                                                  ) : (
                                                    <span>{val > 0 ? val.toLocaleString() : '-'}</span>
                                                  )}
                                                </td>
                                              );
                                            })}
                                            <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs text-blue-800 font-bold">
                                              {modelSummary.totalSalesActual.toLocaleString()} ({modelSummary.salesAttainment}%)
                                            </td>
                                          </tr>
                                        </React.Fragment>
                                      );
                                    })}

                                    {/* 복수 차종일 때: 거점 합친 일판매소요량 요약 행 */}
                                    {hubModels.length > 1 && (
                                      <tr className="bg-blue-50/40 border-t border-blue-100">
                                        <td className="sticky left-0 z-10 bg-blue-50/90 border-r border-slate-200 px-3.5 py-1.5 text-xs text-blue-900 w-[300px] min-w-[300px]">
                                          <div className="flex items-center justify-between pl-6 font-semibold">
                                            <span>∑ [{hub}] 합친 일판매소요량</span>
                                            <span className="text-[10px] text-blue-700">{hubModels.length}개 차종 합계</span>
                                          </div>
                                        </td>
                                        {dateList.map((d) => {
                                          const calcDay = dayMap.get(d);
                                          const centerDay = calcDay?.centers?.[hub];
                                          const val = centerDay?.salesPlan ?? 0;
                                          return (
                                            <td
                                              key={d}
                                              className="border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-bold text-blue-900 bg-blue-50/30"
                                            >
                                              {val > 0 ? val.toLocaleString() : '-'}
                                            </td>
                                          );
                                        })}
                                        <td className="sticky right-0 z-10 bg-blue-50/90 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-bold text-blue-900">
                                          {centerSummary.totalSalesPlan.toLocaleString()} {safeUnit}
                                        </td>
                                      </tr>
                                    )}

                                    {/* 2.4 거점 기말재고 (통합 실물재고) */}
                                    <tr className="bg-slate-100/70 hover:bg-slate-200/50 font-semibold border-b border-slate-300">
                                      <td className="sticky left-0 z-10 bg-slate-100/70 hover:bg-slate-200/50 border-r border-slate-200 px-3.5 py-1.5 text-xs text-slate-900 w-[300px] min-w-[300px]">
                                        <div className="flex items-center justify-between pl-6">
                                          <span className="flex items-center gap-1.5">
                                            <AlertCircle className="w-3 h-3 text-slate-600" />
                                            <span>[{hub}] 거점 기말재고</span>
                                          </span>
                                          <span className="text-[10px] text-slate-500 font-normal">
                                            안전 {centerSafetyStock.toLocaleString()}
                                          </span>
                                        </div>
                                      </td>
                                      {dateList.map((d) => {
                                        const calcDay = dayMap.get(d);
                                        const centerDay = calcDay?.centers?.[hub];
                                        const val = centerDay?.endingStock ?? 0;
                                        const isWarning = centerDay?.isWarning;

                                        return (
                                          <td
                                            key={d}
                                            title={isWarning ? `[${hub}] 안전재고(${centerSafetyStock.toLocaleString()}) 미달 결품위험!` : undefined}
                                            className={`border-r border-slate-200 px-1 py-1 text-center font-mono text-xs font-semibold ${
                                              isWarning ? 'bg-rose-100 text-rose-700 font-bold' : 'text-slate-900'
                                            }`}
                                          >
                                            {val.toLocaleString()}
                                          </td>
                                        );
                                      })}
                                      <td className="sticky right-0 z-10 bg-slate-100/70 border-l border-slate-200 px-3 py-1.5 text-right font-mono text-xs font-bold text-slate-900">
                                        기말 {centerSummary.finalEndingStock.toLocaleString()} ({ (centerSummary.finalEndingStock / safePalletQty).toFixed(1)} PLT)
                                      </td>
                                    </tr>
                                  </>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </>
                      )}
                    </React.Fragment>
                  );
                })
              )}

                          {/* ======================================================== */}
                          {/* LEVEL 5: LINE ROLLUP SUMMARY ROWS AT THE BOTTOM OF THE LINE */}
                          {/* ======================================================== */}
                          {/* 5.1 라인 일일 CAPA 기준선 */}
                          <tr className="bg-slate-900 text-white font-semibold border-t-2 border-slate-800">
                            <td className="sticky left-0 z-20 bg-slate-900 px-3.5 py-2 border-r border-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 text-slate-200">
                                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                                  <span>[{group.line.id}] 일일 순 CAPA 기준선</span>
                                </span>
                                <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-800 px-1.5 py-0.2 rounded font-mono">
                                  {lineRollup.lineUph} UPH
                                </span>
                              </div>
                            </td>
                            {lineRollup.days.map((d) => (
                              <td
                                key={d.date}
                                className={`border-r border-slate-800 px-1 py-1 text-center font-mono text-xs ${
                                  !d.isOperating ? 'text-slate-500 bg-slate-950/40' : 'text-amber-300 font-bold'
                                }`}
                                title={`${d.scheduleDesc} (근무 ${d.grossHours}h${d.setupLossHours > 0 ? ` - 기종교환 ${d.setupLossHours}h` : ''} = 순가동 ${d.netHours}h @ ${lineRollup.lineUph} UPH)`}
                              >
                                <div>{d.dayLineCapa > 0 ? d.dayLineCapa.toLocaleString() : '-'}</div>
                                {d.grossHours > 0 ? (
                                  <div className="text-[9px] font-normal text-slate-400">
                                    {d.netHours}h
                                    {d.setupLossHours > 0 && (
                                      <span className="text-rose-400 ml-0.5 text-[8px] font-medium">(-{d.setupLossHours}h)</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[9px] font-normal text-slate-500">휴무</div>
                                )}
                              </td>
                            ))}
                            <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 px-3 py-2 text-right font-mono text-xs font-bold text-amber-300">
                              총 {lineRollup.totalLineCapa.toLocaleString()} EA
                            </td>
                          </tr>

                          {/* 5.2 라인 총 생산계획 */}
                          <tr className="bg-slate-800 text-white font-semibold">
                            <td className="sticky left-0 z-20 bg-slate-800 px-3.5 py-2 border-r border-slate-700 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 text-white">
                                  <Factory className="w-3.5 h-3.5 text-blue-400" />
                                  <span>[{group.line.id}] 라인 총 생산계획</span>
                                </span>
                                <span className="text-[10px] text-slate-400">전 품목 합계</span>
                              </div>
                            </td>
                            {lineRollup.days.map((d) => (
                              <td
                                key={d.date}
                                className={`border-r border-slate-700 px-1 py-1 text-center font-mono text-xs font-bold ${
                                  d.dayProdPlan > 0 ? 'text-white bg-blue-900/30' : 'text-slate-500'
                                }`}
                              >
                                {d.dayProdPlan > 0 ? d.dayProdPlan.toLocaleString() : '-'}
                              </td>
                            ))}
                            <td className="sticky right-0 z-20 bg-slate-800 border-l border-slate-700 px-3 py-2 text-right font-mono text-xs font-bold text-blue-300">
                              총 {lineRollup.totalProdPlan.toLocaleString()} EA
                            </td>
                          </tr>

                          {/* 5.3 라인 총 생산실적 */}
                          <tr className="bg-slate-800/90 text-white font-semibold">
                            <td className="sticky left-0 z-20 bg-slate-800/90 px-3.5 py-2 border-r border-slate-700 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 text-emerald-400">
                                  <Factory className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>[{group.line.id}] 라인 총 생산실적</span>
                                </span>
                                <span className="text-[10px] text-emerald-400">공장 실적 합계</span>
                              </div>
                            </td>
                            {lineRollup.days.map((d) => (
                              <td
                                key={d.date}
                                className={`border-r border-slate-700 px-1 py-1 text-center font-mono text-xs font-bold ${
                                  d.dayProdActual > 0 ? 'text-emerald-300 bg-emerald-950/30' : 'text-slate-500'
                                }`}
                              >
                                {d.dayProdActual > 0 ? d.dayProdActual.toLocaleString() : '-'}
                              </td>
                            ))}
                            <td className="sticky right-0 z-20 bg-slate-800/90 border-l border-slate-700 px-3 py-2 text-right font-mono text-xs font-bold text-emerald-300">
                              {lineRollup.totalProdActual.toLocaleString()} EA ({lineRollup.overallAttainment}%)
                            </td>
                          </tr>

                          {/* 5.4 라인 전체 파이프라인 재고 */}
                          <tr className="bg-slate-800 text-white font-semibold">
                            <td className="sticky left-0 z-20 bg-slate-800 px-3.5 py-2 border-r border-slate-700 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 text-indigo-300">
                                  <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>[{group.line.id}] 라인 전체 재고</span>
                                </span>
                                <span className="text-[10px] text-slate-400">공장 + 전 거점</span>
                              </div>
                            </td>
                            {lineRollup.days.map((d) => (
                              <td
                                key={d.date}
                                className="border-r border-slate-700 px-1 py-1 text-center font-mono text-xs font-bold text-indigo-200"
                              >
                                {d.dayPipelineStock.toLocaleString()}
                              </td>
                            ))}
                            <td className="sticky right-0 z-20 bg-slate-800 border-l border-slate-700 px-3 py-2 text-right font-mono text-xs font-bold text-indigo-300">
                              기말 {lineRollup.finalPipelineStock.toLocaleString()} EA
                            </td>
                          </tr>

                          {/* 5.5 라인 CAPA 부하 & 실적 이상 감지 알림 */}
                          <tr className="bg-slate-900 border-b-4 border-slate-700 text-white">
                            <td className="sticky left-0 z-20 bg-slate-900 px-3.5 py-2 border-r border-slate-800 w-[300px] min-w-[300px]">
                              <div className="flex items-center justify-between pl-4">
                                <span className="flex items-center gap-1.5 font-bold text-amber-400">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>[{group.line.id}] 부하 & 실적 알림</span>
                                </span>
                                <span className="text-[10px] text-slate-400">실시간 감지</span>
                              </div>
                            </td>
                            {lineRollup.days.map((d) => {
                              if (d.alertStatus === 'OVER_CAPA') {
                                return (
                                  <td key={d.date} className="border-r border-slate-800 px-1 py-1 text-center">
                                    <span
                                      title={d.alertMessage}
                                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-xs cursor-help whitespace-nowrap"
                                    >
                                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                      <span>과부하 {d.planLoadRate}%</span>
                                    </span>
                                  </td>
                                );
                              }
                              if (d.alertStatus === 'LOW_ACTUAL') {
                                return (
                                  <td key={d.date} className="border-r border-slate-800 px-1 py-1 text-center">
                                    <span
                                      title={d.alertMessage}
                                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 shadow-xs cursor-help whitespace-nowrap"
                                    >
                                      <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                      <span>저조 {d.actualAttainmentRate}%</span>
                                    </span>
                                  </td>
                                );
                              }
                              if (d.alertStatus === 'NORMAL') {
                                return (
                                  <td key={d.date} className="border-r border-slate-800 px-1 py-1 text-center">
                                    <span
                                      title={d.alertMessage}
                                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 whitespace-nowrap"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                      <span>정상 {d.planLoadRate}%</span>
                                    </span>
                                  </td>
                                );
                              }
                              if (d.alertStatus === 'OFF') {
                                return (
                                  <td key={d.date} className="border-r border-slate-800 px-1 py-1 text-center text-[10px] text-slate-500">
                                    휴무
                                  </td>
                                );
                              }
                              return (
                                <td key={d.date} className="border-r border-slate-800 px-1 py-1 text-center text-slate-500 text-xs">
                                  -
                                </td>
                              );
                            })}
                            <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 px-3 py-2 text-center font-mono text-xs font-semibold text-slate-300">
                              과부하 {lineRollup.overCapaDayCount}일 · 저조 {lineRollup.lowActualDayCount}일
                            </td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
