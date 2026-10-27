import React, { useState, useMemo } from 'react';
import { ProductItem, MonthlyInitialStockRecord } from '../types/psi';
import { X, Check, Calendar, Boxes, Factory, Car, Info, Sparkles, RefreshCw } from 'lucide-react';
import { ensureProductModels } from '../utils/psiEngine';

interface MonthlyInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  currentDateMonth: string; // e.g. "2026-10"
  onSaveMonthlyInventory: (
    month: string,
    updatedData: Record<string, MonthlyInitialStockRecord>
  ) => void;
  isReadOnly?: boolean;
}

const MONTH_PRESETS = [
  { value: '2026-10', label: '2026년 10월 (당월)' },
  { value: '2026-11', label: '2026년 11월 (차월)' },
  { value: '2026-12', label: '2026년 12월' },
  { value: '2027-01', label: '2027년 01월' },
];

export const MonthlyInventoryModal: React.FC<MonthlyInventoryModalProps> = ({
  isOpen,
  onClose,
  products,
  currentDateMonth,
  onSaveMonthlyInventory,
  isReadOnly = false,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    currentDateMonth || '2026-10'
  );

  // Local state: productId -> { factory: number, hubs: Record<string, number> }
  const [inventoryState, setInventoryState] = useState<
    Record<string, MonthlyInitialStockRecord>
  >(() => {
    const initial: Record<string, MonthlyInitialStockRecord> = {};
    products.forEach((p) => {
      const sanitized = ensureProductModels(p);
      const hubMap: Record<string, number> = {};
      const uniqueHubs = Array.from(new Set(sanitized.models.map((m) => m.hubName || '울산 출고센터')));

      uniqueHubs.forEach((hub) => {
        const ms = sanitized.models.filter((m) => (m.hubName || '울산 출고센터') === hub);
        const hubStock =
          sanitized.monthlyInitialStocks?.[selectedMonth]?.hubs?.[hub] ??
          sanitized.hubs?.[hub]?.initialStock ??
          ms.reduce((sum, m) => sum + (Number(m.initialStock) || 0), 0);
        hubMap[hub] = hubStock;
      });

      const factoryStock =
        sanitized.monthlyInitialStocks?.[selectedMonth]?.factory ??
        sanitized.factoryInitialStock;

      initial[p.id] = {
        factory: factoryStock,
        hubs: hubMap,
      };
    });
    return initial;
  });

  // Re-sync when selectedMonth changes
  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    const updated: Record<string, MonthlyInitialStockRecord> = {};
    products.forEach((p) => {
      const sanitized = ensureProductModels(p);
      const hubMap: Record<string, number> = {};
      const uniqueHubs = Array.from(new Set(sanitized.models.map((m) => m.hubName || '울산 출고센터')));

      uniqueHubs.forEach((hub) => {
        const ms = sanitized.models.filter((m) => (m.hubName || '울산 출고센터') === hub);
        const hubStock =
          sanitized.monthlyInitialStocks?.[newMonth]?.hubs?.[hub] ??
          sanitized.hubs?.[hub]?.initialStock ??
          ms.reduce((sum, m) => sum + (Number(m.initialStock) || 0), 0);
        hubMap[hub] = hubStock;
      });

      const factoryStock =
        sanitized.monthlyInitialStocks?.[newMonth]?.factory ??
        sanitized.factoryInitialStock;

      updated[p.id] = {
        factory: factoryStock,
        hubs: hubMap,
      };
    });
    setInventoryState(updated);
  };

  const handleFactoryChange = (productId: string, val: number) => {
    setInventoryState((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { factory: 0, hubs: {} }),
        factory: Math.max(0, val || 0),
      },
    }));
  };

  const handleHubChange = (productId: string, hubName: string, val: number) => {
    setInventoryState((prev) => {
      const cur = prev[productId] || { factory: 0, hubs: {} };
      return {
        ...prev,
        [productId]: {
          ...cur,
          hubs: {
            ...cur.hubs,
            [hubName]: Math.max(0, val || 0),
          },
        },
      };
    });
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveMonthlyInventory(selectedMonth, inventoryState);
    onClose();
  };

  const monthYearDisplay = `${selectedMonth.split('-')[0]}년 ${parseInt(selectedMonth.split('-')[1], 10)}월`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>월별 기초재고 장부 관리</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-600 font-normal">
                  {monthYearDisplay}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                품목 마스터 기본 정보와 분리하여, 각 계획 월별 시작 시점의 공장 및 출고센터 실물 재고를 독립적으로 관리합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">관리 대상 월 선택:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {MONTH_PRESETS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleMonthChange(m.value)}
                  className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors ${
                    selectedMonth === m.value
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>매트릭스 그리드 첫날 셀을 수정해도 이 월별 장부에 자동 기록됩니다.</span>
          </div>
        </div>

        {/* Scrollable Inventory Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong>SCM 재고 관리 기준 안내:</strong>
              <p className="text-[11px] text-amber-800">
                품목 마스터는 규격(차종, 포장수량)을 정의하고, <strong>기초재고는 월(Month) 단위로 기록</strong>됩니다.
                동일 출고센터에 복수 차종(예: GV80, 팰리세이드)이 배정된 경우에도 해당 센터의 실물 재고는 거점 단위로 통합 단일 관리됩니다.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {products.map((rawProduct) => {
              const product = ensureProductModels(rawProduct);
              const pStock = inventoryState[product.id] || {
                factory: product.factoryInitialStock,
                hubs: {},
              };
              const uniqueHubs = Array.from(new Set(product.models.map((m) => m.hubName || '울산 출고센터')));

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
                >
                  {/* Product Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {product.code}
                      </span>
                      <strong className="text-xs text-slate-900">{product.name}</strong>
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({product.category} · {product.unit})
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-500">
                      연결 차종 {product.models.length}개 / 출고센터 {uniqueHubs.length}개
                    </span>
                  </div>

                  {/* Stock Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Factory Beginning Stock */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Factory className="w-3.5 h-3.5 text-slate-600" />
                          <span>[{monthYearDisplay}] 공장 기초재고</span>
                        </label>
                        <span className="text-[10px] text-slate-500">공장 완제품창고</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={isReadOnly}
                          value={pStock.factory}
                          onChange={(e) =>
                            handleFactoryChange(product.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-600 shrink-0">{product.unit}</span>
                      </div>
                    </div>

                    {/* Regional Hub Beginning Stocks */}
                    {uniqueHubs.map((hub) => {
                      const currentHubVal = pStock.hubs[hub] ?? 0;
                      const connectedModels = product.models.filter(
                        (m) => (m.hubName || '울산 출고센터') === hub
                      );

                      return (
                        <div
                          key={hub}
                          className="bg-blue-50/40 p-3 rounded-lg border border-blue-200"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-blue-600" />
                              <span>[{hub}] 기초재고</span>
                            </label>
                            <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/60 px-1.5 py-0.2 rounded">
                              거점 단일
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              disabled={isReadOnly}
                              value={currentHubVal}
                              onChange={(e) =>
                                handleHubChange(product.id, hub, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-blue-300 rounded text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs font-semibold text-blue-900 shrink-0">{product.unit}</span>
                          </div>

                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400">차종:</span>
                            {connectedModels.map((m) => (
                              <span
                                key={m.id}
                                className="text-[10px] px-1 py-0.2 bg-white rounded border border-blue-200 text-blue-800 font-medium"
                              >
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            * 저장 시 현재 선택된 <strong>{monthYearDisplay}</strong>의 기초재고 장부에 저장되며, 해당 기간의 PSI 매트릭스에 즉시 반영됩니다.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
            >
              닫기
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>{monthYearDisplay} 기초재고 장부 저장</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
