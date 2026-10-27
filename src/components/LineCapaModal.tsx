import React, { useState, useMemo } from 'react';
import { ProductItem, PsiDataStore } from '../types/psi';
import {
  ProductionLine,
  ProductLineConfig,
  ShiftScheduleRules,
  CapaAllocationMode,
} from '../types/lineCapa';
import {
  DEFAULT_SHIFT_RULES,
  loadShiftRules,
  saveShiftRules,
  calculateUphFromCt,
  calculateCtFromUph,
  loadProductionLines,
  saveProductionLines,
  linkProductToLine,
  unlinkProductFromLine,
  addNewProductionLine,
  deleteProductionLine,
  simulateLineDailyCapa,
} from '../utils/capaEngine';
import {
  X,
  Factory,
  Clock,
  Gauge,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  Sliders,
  Info,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';

interface LineCapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  dateList: string[];
  dataStore: PsiDataStore;
  onApplyCapaPlans: (updatedStore: PsiDataStore) => void;
  onShowToast?: (msg: string) => void;
}

export const LineCapaModal: React.FC<LineCapaModalProps> = ({
  isOpen,
  onClose,
  products,
  dateList,
  dataStore,
  onApplyCapaPlans,
  onShowToast,
}) => {
  // Production lines state initialized from localStorage
  const [lines, setLines] = useState<ProductionLine[]>(() =>
    loadProductionLines(products)
  );
  const [selectedLineId, setSelectedLineId] = useState<string>(
    lines[0]?.id || 'LINE-01'
  );

  // New line inline creation UI state
  const [isCreatingLine, setIsCreatingLine] = useState<boolean>(false);
  const [newLineName, setNewLineName] = useState<string>('');

  // Link product inline state
  const [isLinkingProduct, setIsLinkingProduct] = useState<boolean>(false);
  const [selectedProductToLink, setSelectedProductToLink] = useState<string>('');
  const [newProductCt, setNewProductCt] = useState<number>(9.4);
  const [newProductOee, setNewProductOee] = useState<number>(100);
  const [newProductSetupMin, setNewProductSetupMin] = useState<number>(60);

  // Line deletion confirmation modal state
  const [lineToDelete, setLineToDelete] = useState<ProductionLine | null>(null);

  // Shift schedule rules state with localStorage persistence
  const [rules, setRulesState] = useState<ShiftScheduleRules>(() => loadShiftRules());

  const setRules = (action: React.SetStateAction<ShiftScheduleRules>) => {
    setRulesState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      saveShiftRules(next);
      return next;
    });
  };

  // Plan generation allocation mode
  const [allocationMode, setAllocationMode] = useState<CapaAllocationMode>('FULL_CAPA');

  const currentLine = lines.find((l) => l.id === selectedLineId) || lines[0];

  // Products available to be linked to current line (not yet linked)
  const unlinkedProducts = useMemo(() => {
    if (!currentLine) return products;
    const linkedIds = new Set(currentLine.productConfigs.map((c) => c.productId));
    return products.filter((p) => !linkedIds.has(p.id));
  }, [currentLine, products]);

  // Handle bidirectional CT/UPH edit and setup time for a product in current line
  const handleProductConfigChange = (
    productId: string,
    field: 'cycleTimeSec' | 'operationRate' | 'targetUph' | 'setupTimeMin',
    value: number
  ) => {
    setLines((prev) => {
      const updated = prev.map((line) => {
        if (line.id !== currentLine.id) return line;
        const updatedConfigs = line.productConfigs.map((cfg) => {
          if (cfg.productId !== productId) return cfg;

          const updatedItem = { ...cfg, [field]: value };
          if (field === 'cycleTimeSec' || field === 'operationRate') {
            updatedItem.targetUph = calculateUphFromCt(
              updatedItem.cycleTimeSec,
              updatedItem.operationRate
            );
          } else if (field === 'targetUph') {
            updatedItem.cycleTimeSec = calculateCtFromUph(
              updatedItem.targetUph,
              updatedItem.operationRate
            );
          }
          return updatedItem;
        });

        return { ...line, productConfigs: updatedConfigs };
      });
      saveProductionLines(updated);
      return updated;
    });
  };

  // Add new production line
  const handleAddNewLine = () => {
    if (!newLineName.trim()) return;
    const updated = addNewProductionLine(lines, newLineName, true);
    setLines(updated);
    setSelectedLineId(updated[updated.length - 1].id);
    setNewLineName('');
    setIsCreatingLine(false);
    if (onShowToast) onShowToast('새 생산라인이 추가되었습니다.');
  };

  // Request deletion of current production line (shows confirmation modal)
  const handleDeleteCurrentLine = () => {
    if (lines.length <= 1) {
      if (onShowToast) onShowToast('최소 1개 이상의 생산라인이 유지되어야 합니다.');
      return;
    }
    setLineToDelete(currentLine);
  };

  // Confirm and execute production line deletion
  const handleConfirmDeleteLine = () => {
    if (!lineToDelete) return;
    if (lines.length <= 1) {
      if (onShowToast) onShowToast('최소 1개 이상의 생산라인이 유지되어야 합니다.');
      setLineToDelete(null);
      return;
    }
    const targetName = lineToDelete.name;
    const updated = deleteProductionLine(lines, lineToDelete.id);
    setLines(updated);
    setSelectedLineId(updated[0].id);
    setLineToDelete(null);
    if (onShowToast) onShowToast(`[${targetName}] 라인이 성공적으로 삭제되었습니다.`);
  };

  // Link selected product to current line
  const handleExecuteLinkProduct = () => {
    const prod = products.find((p) => p.id === selectedProductToLink);
    if (!prod) return;

    const uph = calculateUphFromCt(newProductCt, newProductOee);
    const updated = linkProductToLine(lines, currentLine.id, prod, {
      cycleTimeSec: newProductCt,
      operationRate: newProductOee,
      targetUph: uph,
      setupTimeMin: newProductSetupMin,
    });
    setLines(updated);
    setIsLinkingProduct(false);
    setSelectedProductToLink('');
    if (onShowToast) {
      onShowToast(`[${prod.name}] 품목이 [${currentLine.name}] 라인에 연결되었습니다.`);
    }
  };

  // Unlink product from current line
  const handleUnlinkProduct = (productId: string, productName: string) => {
    const updated = unlinkProductFromLine(lines, currentLine.id, productId);
    setLines(updated);
    if (onShowToast) {
      onShowToast(`[${productName}] 품목 연결이 해제되었습니다.`);
    }
  };

  // Run simulation for current line across the active date range
  const simulationResults = useMemo(() => {
    if (!currentLine) return [];
    return simulateLineDailyCapa(currentLine, dateList, rules, dataStore, allocationMode);
  }, [currentLine, dateList, rules, dataStore, allocationMode]);

  // Overall statistics for the period
  const totalCapa = simulationResults.reduce((s, d) => s + d.lineTotalCapa, 0);
  const totalDemand = simulationResults.reduce((s, d) => s + d.totalDemand, 0);
  const operatingDays = simulationResults.filter((d) => d.grossHours > 0).length;
  const overCapaDays = simulationResults.filter((d) => d.isOverCapacity).length;

  // Apply calculated production plans to PSI DataStore
  const handleApplyToPsi = () => {
    const newStore: PsiDataStore = JSON.parse(JSON.stringify(dataStore));

    simulationResults.forEach((dayRes) => {
      const { date, productPlans } = dayRes;

      Object.entries(productPlans).forEach(([pId, planInfo]: [string, any]) => {
        if (!newStore[pId]) newStore[pId] = {};
        if (!newStore[pId][date]) {
          newStore[pId][date] = {
            prodPlan: 0,
            prodActual: 0,
            models: {},
          };
        }
        // 공장 생산계획(prodPlan)에 산출된 수량 반영
        newStore[pId][date].prodPlan = planInfo.allocatedPlan || 0;
      });
    });

    onApplyCapaPlans(newStore);
    if (onShowToast) {
      onShowToast(
        `[${currentLine.name}] 라인의 CAPA 기반 일일 생산계획(${operatingDays}일치)이 PSI에 성공적으로 반영되었습니다!`
      );
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 1. Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  생산라인 CAPA & 품목 연결 스케줄러
                </h2>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-semibold">
                  계층형 라인 관리
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                생산라인 하위에 품목을 자유롭게 연결하고, 교대근무(월화목금 21h, 수 8/10.5h, 토 8/18.5h)와 C/T·UPH 기반으로 계획을 자동 산출합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {/* Top Line Selector & Management Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label htmlFor="line-select" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Factory className="w-4 h-4 text-blue-600" />
                  <span>현재 생산라인:</span>
                </label>
                <select
                  id="line-select"
                  value={selectedLineId}
                  onChange={(e) => setSelectedLineId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      [{l.id}] {l.name} ({l.productConfigs.length}개 품목 소속)
                    </option>
                  ))}
                </select>

                {/* Add new line button */}
                {!isCreatingLine ? (
                  <button
                    type="button"
                    onClick={() => setIsCreatingLine(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>새 라인 추가</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="신규 라인명 (예: 제3공장 인버터 라인)"
                      value={newLineName}
                      onChange={(e) => setNewLineName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNewLine()}
                      className="px-2.5 py-1 text-xs border border-blue-400 rounded bg-white font-medium text-slate-900 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewLine}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingLine(false)}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>

              {/* Right options: Mode & Delete Line */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">배분 모드:</span>
                  <div className="inline-flex rounded border border-slate-200 bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setAllocationMode('FULL_CAPA')}
                      className={`px-2 py-0.5 text-xs font-semibold rounded transition-colors ${
                        allocationMode === 'FULL_CAPA'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="라인의 가용 생산시간을 100% 채워 생산계획 배분"
                    >
                      풀 CAPA 생산 (권장)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationMode('DEMAND_MATCH')}
                      className={`px-2 py-0.5 text-xs font-semibold rounded transition-colors ${
                        allocationMode === 'DEMAND_MATCH'
                          ? 'bg-white text-blue-700 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="소요량 한도 내에서만 생산"
                    >
                      소요량 한도
                    </button>
                  </div>
                </div>

                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentLine}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition-colors"
                    title="현재 선택된 생산라인 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>라인 삭제</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Linked Products Hierarchy Table (품목 하위 연결 & C/T, 가동률, UPH) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  <span>[{currentLine.name}] 소속 하위 품목 목록 ({currentLine.productConfigs.length}개)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  이 생산라인에서 교대(혼류) 생산할 품목을 연결하고, C/T(초) 또는 가동률을 입력하면 유효 UPH가 양방향 자동 계산됩니다.
                </p>
              </div>

              {/* Link Product Button */}
              {!isLinkingProduct ? (
                <button
                  type="button"
                  onClick={() => {
                    if (unlinkedProducts.length > 0) {
                      setSelectedProductToLink(unlinkedProducts[0].id);
                      setIsLinkingProduct(true);
                    }
                  }}
                  disabled={unlinkedProducts.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-2xs transition-colors ${
                    unlinkedProducts.length > 0
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ 품목 연결 추가</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLinkingProduct(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  연결 닫기
                </button>
              )}
            </div>

            {/* Inline Product Linking Form */}
            {isLinkingProduct && unlinkedProducts.length > 0 && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-3 animate-in fade-in duration-100">
                <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>[{currentLine.name}]에 연결할 신규 품목 지정</span>
                  </span>
                  <span className="text-[10px] text-blue-700 font-normal">
                    * 등록된 전체 품목 마스터에서 선택합니다.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      연결 대상 품목:
                    </label>
                    <select
                      value={selectedProductToLink}
                      onChange={(e) => setSelectedProductToLink(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded text-xs font-semibold text-slate-900 focus:outline-none"
                    >
                      {unlinkedProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.code}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      C/T (Cycle Time):
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={newProductCt}
                        onChange={(e) => setNewProductCt(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded font-mono font-bold text-slate-900 text-center"
                      />
                      <span className="text-[11px] text-slate-500 shrink-0">초</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      설비 가동률 (OEE):
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={newProductOee}
                        onChange={(e) => setNewProductOee(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 90)))}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded font-mono font-bold text-slate-900 text-center"
                      />
                      <span className="text-[11px] text-slate-500 shrink-0">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                      기종교환(C/O) 소요:
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="480"
                        step="10"
                        value={newProductSetupMin}
                        onChange={(e) => setNewProductSetupMin(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded font-mono font-bold text-amber-900 text-center"
                      />
                      <span className="text-[11px] text-amber-800 shrink-0 font-medium">분 ({Math.round((newProductSetupMin / 60) * 10) / 10}h)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-blue-800">
                    산출 예상 유효 UPH:{' '}
                    <strong className="font-mono text-blue-950 font-bold">
                      {calculateUphFromCt(newProductCt, newProductOee)} EA/h
                    </strong>
                    <span className="ml-2 text-slate-500 text-[10px]">
                      (기종교환 시 {Math.round((newProductSetupMin / 60) * 10) / 10}시간 차감)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLinkingProduct(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200/60 rounded"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteLinkProduct}
                      className="px-4 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs cursor-pointer"
                    >
                      이 라인에 연결 확정
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table of Linked Products */}
            {currentLine.productConfigs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                현재 이 라인에 연결된 품목이 없습니다. 우측 상단의 <strong>[+ 품목 연결 추가]</strong> 버튼을 눌러 생산할 품목을 추가해 주세요.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2 px-3">소속 품목코드 / 품목명</th>
                      <th className="py-2 px-3 w-28">
                        <span className="block text-slate-800">C/T (Cycle Time)</span>
                        <span className="text-[10px] font-normal text-slate-400">초 (Sec / EA)</span>
                      </th>
                      <th className="py-2 px-3 w-24">
                        <span className="block text-slate-800">가동률 (OEE)</span>
                        <span className="text-[10px] font-normal text-slate-400">백분율 (%)</span>
                      </th>
                      <th className="py-2 px-3 w-28">
                        <span className="block text-blue-700 font-bold">유효 UPH</span>
                        <span className="text-[10px] font-normal text-slate-400">시간당 생산</span>
                      </th>
                      <th className="py-2 px-3 w-36">
                        <span className="block text-amber-800 font-bold">기종교환(C/O) 소요</span>
                        <span className="text-[10px] font-normal text-amber-600/80">분 단위 (시간 환산)</span>
                      </th>
                      <th className="py-2 px-3 text-center w-16">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentLine.productConfigs.map((cfg) => (
                      <tr key={cfg.productId} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-slate-900 block">
                            [{cfg.productCode}]
                          </span>
                          <span className="text-slate-600 text-[11px]">{cfg.productName}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              value={cfg.cycleTimeSec}
                              onChange={(e) =>
                                handleProductConfigChange(
                                  cfg.productId,
                                  'cycleTimeSec',
                                  Math.max(1, parseFloat(e.target.value) || 1)
                                )
                              }
                              className="w-16 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900 text-center focus:bg-white focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-500">초</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="10"
                              max="100"
                              step="1"
                              value={cfg.operationRate}
                              onChange={(e) =>
                                handleProductConfigChange(
                                  cfg.productId,
                                  'operationRate',
                                  Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 90))
                                )
                              }
                              className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900 text-center focus:bg-white focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-[11px] text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={cfg.targetUph}
                              onChange={(e) =>
                                handleProductConfigChange(
                                  cfg.productId,
                                  'targetUph',
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              }
                              className="w-18 px-1.5 py-1 bg-blue-50/60 border border-blue-300 rounded font-mono font-bold text-blue-900 text-center focus:bg-white focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-[11px] font-semibold text-blue-700">EA/h</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="480"
                              step="10"
                              value={cfg.setupTimeMin ?? 60}
                              onChange={(e) =>
                                handleProductConfigChange(
                                  cfg.productId,
                                  'setupTimeMin',
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              className="w-14 px-1.5 py-1 bg-amber-50 border border-amber-300 rounded font-mono font-bold text-amber-950 text-center focus:bg-white focus:ring-1 focus:ring-amber-500"
                            />
                            <span className="text-[11px] font-semibold text-amber-800">
                              분 ({Math.round(((cfg.setupTimeMin ?? 60) / 60) * 10) / 10}h)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleUnlinkProduct(cfg.productId, cfg.productName)}
                            title="이 라인에서 품목 연결 해제"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Shift Schedule Rules (요일별 실제 가동시간 & 토요일 2단계 선택) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  현장 교대 근무 캘린더 규칙 (요일별 가동시간 & 특근 옵션)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                공장 현장의 실제 가동 규칙을 100% 반영합니다.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Box 1: 월, 화, 목, 금 (정규 2교대) */}
              <div className="border border-slate-200 bg-slate-50/60 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">월 · 화 · 목 · 금</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                    정규 2교대
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-slate-900">
                  21.0 <span className="text-xs font-normal text-slate-500">시간/일</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  주간 10.5h + 야간 10.5h 고정 가동
                </p>
              </div>

              {/* Box 2: 수요일 (18.5h 고정 2교대 + 주간 잔업 2.5h 선택) */}
              <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950">수요일 (2교대)</span>
                  <span className="text-[10px] font-semibold text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded">
                    18.5h 고정 (야간 정상)
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-blue-900">
                  {rules.wednesdayOvertime ? '21.0' : '18.5'}{' '}
                  <span className="text-xs font-normal text-slate-500">시간/일</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  야간 10.5h 정상 가동 + 주간 기본 8.0h ({rules.wednesdayOvertime ? '잔업 2.5h 추가' : '잔업 없음'})
                </p>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer pt-0.5 border-t border-blue-200/60">
                  <input
                    type="checkbox"
                    checked={rules.wednesdayOvertime}
                    onChange={(e) =>
                      setRules((prev) => ({ ...prev, wednesdayOvertime: e.target.checked }))
                    }
                    className="w-3.5 h-3.5 text-blue-600 rounded cursor-pointer"
                  />
                  <span>주간 2.5h 잔업 추가 (총 21.0h)</span>
                </label>
              </div>

              {/* Box 3: 토요일 (가동 선택 시 주간 vs 주/야간 2단계 선택) */}
              <div
                className={`border rounded-lg p-3 space-y-2 transition-colors ${
                  rules.saturdayOperating
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-slate-50/60 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">토요일 특근</span>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rules.saturdayOperating}
                      onChange={(e) =>
                        setRules((prev) => ({ ...prev, saturdayOperating: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 text-amber-600 rounded cursor-pointer"
                    />
                    <span>특근 가동</span>
                  </label>
                </div>

                <div className="text-lg font-bold font-mono text-amber-950">
                  {!rules.saturdayOperating
                    ? '0.0 (휴무)'
                    : rules.saturdayMode === 'DAY_ONLY'
                    ? '8.0'
                    : '18.5'}{' '}
                  <span className="text-xs font-normal text-slate-500">시간</span>
                </div>

                {rules.saturdayOperating ? (
                  <div className="pt-1 border-t border-amber-200 space-y-1">
                    <span className="text-[10px] text-amber-800 font-semibold block">
                      근무 형태 선택:
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setRules((prev) => ({ ...prev, saturdayMode: 'DAY_ONLY' }))
                        }
                        className={`px-1.5 py-0.5 rounded text-center font-semibold transition-colors cursor-pointer ${
                          rules.saturdayMode === 'DAY_ONLY'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-amber-200'
                        }`}
                      >
                        주간만(8h)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRules((prev) => ({ ...prev, saturdayMode: 'DAY_NIGHT' }))
                        }
                        className={`px-1.5 py-0.5 rounded text-center font-semibold transition-colors cursor-pointer ${
                          rules.saturdayMode === 'DAY_NIGHT'
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-amber-200'
                        }`}
                      >
                        주/야(18.5h)
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">토요일 기본 휴무</p>
                )}
              </div>

              {/* Box 4: 일요일 (주간만 가능) */}
              <div
                className={`border rounded-lg p-3 space-y-2 transition-colors ${
                  rules.sundayOperating
                    ? 'border-indigo-300 bg-indigo-50/50'
                    : 'border-slate-200 bg-slate-50/60 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">일요일 특근</span>
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rules.sundayOperating}
                      onChange={(e) =>
                        setRules((prev) => ({ ...prev, sundayOperating: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                    />
                    <span>특근 가동</span>
                  </label>
                </div>

                <div className="text-lg font-bold font-mono text-indigo-950">
                  {rules.sundayOperating ? '8.0' : '0.0 (휴무)'}{' '}
                  <span className="text-xs font-normal text-slate-500">시간</span>
                </div>

                <p className="text-[11px] text-slate-500 leading-tight">
                  {rules.sundayOperating
                    ? '주간 8시간 단근무만 가능 (야간 불가)'
                    : '일요일 기본 휴무'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Daily Simulation Results Preview Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>일자별 생산능력(CAPA) 및 산출 생산계획 시뮬레이션 프리뷰</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  총 {dateList.length}일간의 가동시간과 유효 UPH를 바탕으로 산출된 일일 생산계획을 확인합니다.
                </p>
              </div>

              {/* Summary KPIs */}
              <div className="flex items-center gap-3 text-xs">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                  가동일: <strong className="font-mono text-slate-900">{operatingDays}일</strong>
                </span>
                <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-800 font-medium border border-blue-200">
                  총 CAPA: <strong className="font-mono">{totalCapa.toLocaleString()} EA</strong>
                </span>
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                  소요량: <strong className="font-mono text-slate-900">{totalDemand.toLocaleString()} EA</strong>
                </span>
                {overCapaDays > 0 ? (
                  <span className="bg-rose-50 px-2 py-0.5 rounded text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> 과부하 {overCapaDays}일
                  </span>
                ) : (
                  <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 안정 공급
                  </span>
                )}
              </div>
            </div>

            {/* Changeover principle domain banner */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs text-amber-950 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span>1라인 다품목 순차 생산 및 기종교환(Changeover) 손실시간 차감 공식 적용</span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-semibold">
                    IE 표준 반영
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  • <strong>동일 라인 단일 품목 생산 시:</strong> 기종교환 없이 총 근무시간(21.0h) 전부 투입 &rarr; 일일 최대 CAPA <strong>8,064 EA</strong> (384 UPH 기준)<br />
                  • <strong>당일 2개 이상 품목 혼류 생산 시:</strong> 품목 교체 시 기종교환시간(기본 60분 = 1.0h)이 차감되어 <strong>순 가동시간(20.0h)</strong>만 가용됩니다.<br />
                  &nbsp;&nbsp;&bull; <em>계산식: 총 근무(21.0h) - 기종교환 손실(1.0h) = 순 가동시간(20.0h) &rarr; <strong>순 CAPA 7,680 EA</strong></em><br />
                  • 가용 순 가동시간(20.0h) 내에서 품목별 가동시간(예: 12.0h, 8.0h)과 생산계획이 오차 없이 배분됩니다.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 z-10 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">일자 (요일)</th>
                    <th className="py-2 px-2.5 text-center">총 근무시간</th>
                    <th className="py-2 px-2.5 text-center text-amber-800 bg-amber-50/60">기종교환(C/O)</th>
                    <th className="py-2 px-2.5 text-center text-blue-900 bg-blue-50/60">순 가동시간</th>
                    <th className="py-2 px-3 text-right">순 라인 CAPA</th>
                    <th className="py-2 px-3 text-right">고객 소요량</th>
                    <th className="py-2 px-2 text-center">부하율 (%)</th>
                    {currentLine.productConfigs.map((cfg) => (
                      <th key={cfg.productId} className="py-2 px-3 text-right bg-blue-50/80 text-blue-900">
                        {cfg.productCode} 계획 (가동시간)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {simulationResults.map((day) => {
                    const isOver = day.isOverCapacity;

                    return (
                      <tr
                        key={day.date}
                        className={`hover:bg-slate-50 ${
                          day.isToday
                            ? 'bg-blue-50/40 font-semibold'
                            : day.isWeekend
                            ? 'bg-slate-50/30'
                            : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-sans">
                          <span className={day.isToday ? 'text-blue-700 font-bold' : 'text-slate-800'}>
                            {day.date} ({day.dayOfWeek})
                          </span>
                          {day.isToday && (
                            <span className="ml-1 text-[9px] bg-blue-600 text-white px-1 py-0.2 rounded font-mono">
                              TODAY
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-800">
                          {day.grossHours > 0 ? `${day.grossHours}h` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold bg-amber-50/30">
                          {day.downtimeHours > 0 ? (
                            <span className="text-rose-600 font-bold">
                              -{day.downtimeHours}h ({day.changeoverCount}회)
                            </span>
                          ) : day.grossHours > 0 ? (
                            <span className="text-slate-400 font-normal">0h</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-blue-900 bg-blue-50/30">
                          {day.netProductionHours > 0 ? `${day.netProductionHours}h` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {day.lineTotalCapa > 0 ? day.lineTotalCapa.toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {day.totalDemand > 0 ? day.totalDemand.toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {day.lineTotalCapa > 0 ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isOver
                                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                  : day.utilizationRate >= 90
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {day.utilizationRate}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        {currentLine.productConfigs.map((cfg) => {
                          const pPlan = day.productPlans[cfg.productId]?.allocatedPlan || 0;
                          const pHours = day.productPlans[cfg.productId]?.requiredHours || 0;
                          return (
                            <td
                              key={cfg.productId}
                              className="py-2 px-3 text-right font-bold text-blue-700 bg-blue-50/20"
                            >
                              {pPlan > 0 ? (
                                <div>
                                  <span>{pPlan.toLocaleString()} EA</span>
                                  <span className="block text-[10px] text-slate-500 font-normal">
                                    ({pHours}h)
                                  </span>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              [PSI 공장 생산계획에 일괄 반영하기]를 누르면 메인 매트릭스의 해당 품목 생산계획 행이 자동 업데이트됩니다.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleApplyToPsi}
              disabled={currentLine.productConfigs.length === 0}
              className={`px-5 py-2 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors ${
                currentLine.productConfigs.length > 0
                  ? 'text-white bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>PSI 공장 생산계획에 일괄 반영하기</span>
            </button>
          </div>
        </div>
      </div>

      {/* Line Deletion Confirmation Popup Modal */}
      {lineToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    생산라인 삭제 확인
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    정말로 <strong>[{lineToDelete.name}]</strong> 생산라인을 삭제하시겠습니까?
                  </p>
                  <div className="mt-2.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">
                    * 해당 라인에 연결된 품목({lineToDelete.productConfigs.length}개)의 라인 배정이 해제되며, 시스템상 최소 1개 라인은 항상 유지되어야 합니다.
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLineToDelete(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteLine}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  삭제 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
