import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Factory,
  Store,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  ReplenishmentRecommendation,
  ReplenishmentDiffItem,
  generateReplenishmentDiffPreview,
} from '../services/replenishmentEngine';
import { ProductItem, PsiDataStore } from '../types/psi';
import { ProductionLine, ShiftScheduleRules } from '../types/lineCapa';

interface ReplenishmentDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: ReplenishmentRecommendation[];
  products: ProductItem[];
  dateList: string[];
  dataStore: PsiDataStore;
  lines?: ProductionLine[];
  rules?: ShiftScheduleRules;
  onConfirmApply: (selectedRecs: ReplenishmentRecommendation[]) => void;
}

export const ReplenishmentDiffModal: React.FC<ReplenishmentDiffModalProps> = ({
  isOpen,
  onClose,
  recommendations,
  products,
  dateList,
  dataStore,
  lines,
  rules,
  onConfirmApply,
}) => {
  // 개별 선택 상태 (id -> boolean)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  // Diff 항목 목록 생성
  const diffItems: ReplenishmentDiffItem[] = useMemo(() => {
    if (!isOpen || recommendations.length === 0) return [];
    return generateReplenishmentDiffPreview(
      recommendations,
      products,
      dateList,
      dataStore,
      lines,
      rules
    );
  }, [isOpen, recommendations, products, dateList, dataStore, lines, rules]);

  if (!isOpen) return null;

  const allSelected =
    diffItems.length > 0 && diffItems.every((item) => selectedMap[item.recommendationId] !== false);

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedMap({});
    } else {
      const nextMap: Record<string, boolean> = {};
      diffItems.forEach((item) => {
        nextMap[item.recommendationId] = true;
      });
      setSelectedMap(nextMap);
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedMap((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const activeRecs = recommendations.filter(
    (r) => selectedMap[r.id] !== false
  );

  const totalAddedQty = activeRecs.reduce((sum, r) => sum + r.recommendedReplenish, 0);
  const capaExceededCount = diffItems.filter(
    (item) => selectedMap[item.recommendationId] !== false && item.isCapaExceeded
  ).length;

  const handleConfirm = () => {
    if (activeRecs.length === 0) return;
    onConfirmApply(activeRecs);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 1. Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>공급계획 변경 사전 검토 (Diff Preview)</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  1+2+3 통합 모드
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                D-1 선행 입고, 주말 회피 평일 보정, 공장 라인 순 CAPA 적합성을 검증한 변경 내역입니다.
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

        {/* 2. Policy Summary Banner */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap text-slate-700">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>1안 D-1 선행 입고</strong>: 결품 전일 도착으로 아침 라인 스톱 원천 차단</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <span><strong>주말 회피 보정</strong>: 토/일 휴무일은 직전 금요일로 스케줄링</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Factory className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>2안 CAPA 검증</strong>: 공장 순 가동 CAPA 초과 여부 실시간 체크</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {capaExceededCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                CAPA 초과 주의 {capaExceededCount}건
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                모든 라인 CAPA 안전
              </span>
            )}
          </div>
        </div>

        {/* 3. Diff Table Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                선택 항목: <strong className="text-blue-700 font-mono">{activeRecs.length}</strong> / {diffItems.length}건
              </span>
              <span>·</span>
              <span>
                총 공급 가산량: <strong className="text-slate-900 font-mono font-bold">+{totalAddedQty.toLocaleString()} EA</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleAll}
              className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer underline"
            >
              {allSelected ? '선택 전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">품목명 (코드)</th>
                  <th className="py-2.5 px-3">거점 / 차종</th>
                  <th className="py-2.5 px-3">
                    <div className="flex items-center gap-1 text-slate-800 font-bold">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      <span>거점 입고계획 변동 (Inbound)</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3">
                    <div className="flex items-center gap-1 text-slate-800 font-bold">
                      <Factory className="w-3.5 h-3.5 text-indigo-600" />
                      <span>공장 생산계획 변동 (Prod)</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-center">라인 CAPA 건전성</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diffItems.map((item) => {
                  const isChecked = selectedMap[item.recommendationId] !== false;
                  return (
                    <tr
                      key={item.recommendationId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isChecked ? 'opacity-40 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(item.recommendationId)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{item.productCode}</div>
                        <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                          🚨 위험일: {item.breachDate}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{item.hubName}</div>
                        <div className="text-[11px] text-slate-500">{item.modelName}</div>
                      </td>

                      {/* 거점 입고계획 Diff */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-slate-400">{item.prevInbound.toLocaleString()}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-blue-700">{item.nextInbound.toLocaleString()}</span>
                          <span className="text-blue-600 font-semibold text-[10px]">
                            (+{item.diffInbound.toLocaleString()})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                            <Calendar className="w-3 h-3" />
                            입고일: {item.inboundDate}
                          </span>
                          {item.isD1Advanced && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              D-1 선행 입고
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 공장 생산계획 Diff */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-slate-400">{item.prevProd.toLocaleString()}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-indigo-700">{item.nextProd.toLocaleString()}</span>
                          <span className="text-indigo-600 font-semibold text-[10px]">
                            (+{item.diffProd.toLocaleString()})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            <Factory className="w-3 h-3" />
                            출하일: {item.dispatchDate}
                          </span>
                          {item.isWeekendAdjusted && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                              주말 회피 평일보정
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 라인 CAPA 건전성 */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="text-[11px] font-mono font-bold text-slate-800">
                          {item.lineId}
                        </div>
                        <div className="mt-1">
                          {item.isCapaExceeded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              {item.utilizationPercent}% (CAPA 초과)
                            </span>
                          ) : item.utilizationPercent >= 80 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {item.utilizationPercent}% (부하 높음)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {item.utilizationPercent}% (안전)
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                          기준: {item.dayLineCapa.toLocaleString()} EA
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              확정 반영 시 매트릭스 그리드에 즉시 가산 적용되며, 언제든지 상단의 <strong>[실행 취소(Undo)]</strong> 버튼으로 되돌릴 수 있습니다.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={activeRecs.length === 0}
              className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer ${
                activeRecs.length > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>선택한 {activeRecs.length}건 최종 공급계획 확정 반영</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
