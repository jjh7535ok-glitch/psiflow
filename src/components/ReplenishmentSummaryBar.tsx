import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { ReplenishmentSimulationSummary, ReplenishmentRecommendation } from '../services/replenishmentEngine';

interface ReplenishmentSummaryBarProps {
  simulation: ReplenishmentSimulationSummary;
  isOwner: boolean;
  hasUndoHistory: boolean;
  onApplyReplenishment: (selectedRecommendations: ReplenishmentRecommendation[]) => void;
  onOpenDiffModal?: (selectedRecommendations: ReplenishmentRecommendation[]) => void;
  onUndoReplenishment: () => void;
  onTriggerOwnerLogin?: () => void;
}

export const ReplenishmentSummaryBar: React.FC<ReplenishmentSummaryBarProps> = ({
  simulation,
  isOwner,
  hasUndoHistory,
  onApplyReplenishment,
  onOpenDiffModal,
  onUndoReplenishment,
  onTriggerOwnerLogin,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const { criticalCount, warningCount, totalRecommendedQuantity, recommendations } = simulation;
  const totalBreaches = criticalCount + warningCount;

  // 전체 선택/해제 핸들러
  const allSelected =
    recommendations.length > 0 &&
    recommendations.every((r) => selectedIds[r.id] !== false);

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds({});
    } else {
      const map: Record<string, boolean> = {};
      recommendations.forEach((r) => {
        map[r.id] = true;
      });
      setSelectedIds(map);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const activeRecommendations = recommendations.filter(
    (r) => selectedIds[r.id] !== false
  );

  const handleApplyClick = () => {
    if (!isOwner) return;
    if (activeRecommendations.length === 0) return;
    onApplyReplenishment(activeRecommendations);
  };

  // 결품이나 안전재고 미달이 전혀 없을 때
  if (totalBreaches === 0) {
    return (
      <div className="mx-6 mt-3 px-4 py-2 bg-emerald-50/90 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">안전재고 시뮬레이션 양호:</span>
          <span>현재 분석 기간 내 결품 위기 및 안전재고 미달 품목이 감지되지 않았습니다.</span>
        </div>
        {hasUndoHistory && isOwner && (
          <button
            type="button"
            onClick={onUndoReplenishment}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition-colors cursor-pointer"
            title="방금 공급계획에 자동 반영한 수량을 되돌립니다"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>반영 취소 (Undo)</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-6 mt-3 bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden shrink-0 transition-all">
      {/* 1. Header Bar: Compact Overview & Action Buttons */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-300 font-semibold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>재고 보충 시뮬레이터</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                결품 위험 {criticalCount}건
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                안전재고 미달 {warningCount}건
              </span>
            )}
            <span className="text-slate-300 hidden sm:inline">
              권장 긴급 공급: <strong className="text-white font-mono">{totalRecommendedQuantity.toLocaleString()}</strong>개
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {hasUndoHistory && isOwner && (
            <button
              type="button"
              onClick={onUndoReplenishment}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 transition-colors cursor-pointer"
              title="직전에 공급계획에 자동 추가했던 수량을 이전 상태로 원복합니다"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>실행 취소 (Undo)</span>
            </button>
          )}

          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                if (onOpenDiffModal) {
                  onOpenDiffModal(activeRecommendations);
                } else {
                  handleApplyClick();
                }
              }}
              disabled={activeRecommendations.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded shadow-xs transition-colors whitespace-nowrap cursor-pointer ${
                activeRecommendations.length > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
              title="D-1 선행 입고 및 공장 CAPA 검증이 적용된 변경 전후(Diff) 내역을 미리 검토하고 최종 승인합니다"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span>공급계획 반영 검토 ({activeRecommendations.length}건)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onTriggerOwnerLogin}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 rounded border border-amber-600/50 transition-colors cursor-pointer"
              title="소유자 계정(jjh7535ok@gmail.com)으로 로그인하면 즉시 반영 기능을 사용할 수 있습니다"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>소유자 로그인 후 반영 가능</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <span>{isExpanded ? '접기' : '상세 분석'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Expanded Detail Drawer */}
      {isExpanded && (
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                조치 권장 품목 상세 목록 ({recommendations.length}건)
              </span>
              <span>·</span>
              <span>
                로직: <strong>향후 7일 수요량 + 안전재고 부족분</strong> 합산 후 <strong>MOQ({recommendations[0]?.moq || 50}개 단위) 올림</strong> 및 <strong>공장 리드타임 2일</strong> 역산
              </span>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
              >
                {allSelected ? '선택 전체 해제' : '전체 선택'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-md bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  {isOwner && (
                    <th className="py-2 px-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-2 px-3">경보 등급</th>
                  <th className="py-2 px-3">품목명 (코드)</th>
                  <th className="py-2 px-3">거점 / 차종</th>
                  <th className="py-2 px-3 text-center">최초 위험일</th>
                  <th className="py-2 px-3 text-right">예상 기말재고</th>
                  <th className="py-2 px-3 text-right">목표 안전재고</th>
                  <th className="py-2 px-3 text-right">MOQ 적입</th>
                  <th className="py-2 px-3 text-right text-blue-700 font-bold">권장 보충량</th>
                  <th className="py-2 px-3 text-center">공장 출하 권장일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recommendations.map((rec) => {
                  const isChecked = selectedIds[rec.id] !== false;
                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isChecked ? 'opacity-50 bg-slate-50/50' : ''
                      }`}
                    >
                      {isOwner && (
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectOne(rec.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {rec.severity === 'CRITICAL_STOCKOUT' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            결품 위기
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            안전 미달
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                        {rec.productName}{' '}
                        <span className="font-mono text-[10px] text-slate-400">({rec.productCode})</span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        <span className="font-medium text-slate-700">{rec.hubName}</span>
                        {rec.modelName && (
                          <span className="text-[11px] text-slate-400 ml-1">/ {rec.modelName}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono whitespace-nowrap text-rose-700 font-semibold">
                        {rec.breachDate}
                      </td>
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                        <span
                          className={
                            rec.currentEndingStock <= 0
                              ? 'text-rose-600 font-bold'
                              : 'text-amber-600 font-medium'
                          }
                        >
                          {rec.currentEndingStock.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                        {rec.safetyStock.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {rec.moq.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                        +{rec.recommendedReplenish.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {rec.recommendedDispatchDate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
