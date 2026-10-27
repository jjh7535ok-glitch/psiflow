import React, { useState, useEffect } from 'react';
import { X, Sparkles, Calendar, Layers, CheckCircle2, ArrowRight, Car, Check } from 'lucide-react';
import { ProductItem } from '../types/psi';
import { ensureProductModels } from '../utils/psiEngine';

interface ForwardFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  selectedProductId: string;
  dateList: string[];
  onApplyBatchFill: (params: {
    productIds: string[];
    startDateStr: string;
    prodPlan?: number;
    modelPlans: Record<string, number>;
    syncInbound: boolean;
    keepWeekendZero: boolean;
  }) => void;
}

export const ForwardFillModal: React.FC<ForwardFillModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProductId,
  dateList,
  onApplyBatchFill,
}) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const initialStartDate = dateList.includes(todayStr) ? todayStr : (dateList[2] || dateList[0]);

  const [targetProduct, setTargetProduct] = useState<string>(selectedProductId || 'ALL');
  const [startDateStr, setStartDateStr] = useState<string>(initialStartDate);
  const [syncInbound, setSyncInbound] = useState<boolean>(true);
  const [keepWeekendZero, setKeepWeekendZero] = useState<boolean>(true);

  // Model salesPlan values: modelId -> number
  const [modelPlans, setModelPlans] = useState<Record<string, number>>({});

  const activeProduct = products.find((p) => p.id === targetProduct) || products[0];

  useEffect(() => {
    if (activeProduct) {
      const sanitized = ensureProductModels(activeProduct);
      const initialMap: Record<string, number> = {};
      sanitized.models.forEach((m, idx) => {
        if (m.name.includes('GV80') || idx === 0) initialMap[m.id] = 2500;
        else if (m.name.includes('EV9') || idx === 1) initialMap[m.id] = 500;
        else initialMap[m.id] = 1200;
      });
      setModelPlans(initialMap);
    }
  }, [targetProduct, activeProduct]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productIds = targetProduct === 'ALL' ? products.map((p) => p.id) : [targetProduct];

    // 제안 2안: prodPlan을 넘기지 않음으로써 기존 라인 C/T 기반 생산계획 100% 보존
    onApplyBatchFill({
      productIds,
      startDateStr,
      modelPlans,
      syncInbound,
      keepWeekendZero,
    });
    onClose();
  };

  const currentModels = activeProduct ? ensureProductModels(activeProduct).models : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">고객사 차종별 오더 일괄 전개 (Customer Demand Fill)</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                오너가 접수한 고객사 차종별 일소요량을 오늘부터 미래 일자까지 자동으로 일괄 반영합니다.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Information badge regarding production plan preservation */}
          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold">공장 생산계획 보존 모드</span>
            </div>
            <span className="text-[11px] text-emerald-700">
              공장 생산은 [🏭 라인 CAPA 관리] 설정값 100% 유지
            </span>
          </div>

          {/* Target Product */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              적용 대상 품목
            </label>
            <select
              value={targetProduct}
              onChange={(e) => setTargetProduct(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">전체 품목 일괄 적용 ({products.length}개)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              전개 시작 기준일
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {dateList.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === todayStr ? '(오늘 - TODAY)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              * 선택한 기준일부터 마지막 일자까지 일괄 반영됩니다.
            </p>
          </div>

          {/* Section: Vehicle Models Demand */}
          <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2.5">
            <label className="block text-xs font-bold text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-blue-600" />
                <span>차종별 일일 소요량 (판매계획)</span>
              </span>
              <span className="text-[10px] text-blue-700 font-normal">
                {currentModels.length}개 차종 (1개 단위 자유 입력 가능)
              </span>
            </label>

            <div className="space-y-2">
              {currentModels.map((m) => {
                const currentVal = modelPlans[m.id] !== undefined ? modelPlans[m.id] : 0;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 bg-white p-2 rounded border border-blue-100">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        [{m.customer}] {m.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {m.hubName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={currentVal}
                        onChange={(e) =>
                          setModelPlans((prev) => ({
                            ...prev,
                            [m.id]: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-24 px-2 py-1 text-xs font-mono font-bold text-center bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-500 font-medium">{activeProduct?.unit || 'EA'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepWeekendZero}
                onChange={(e) => setKeepWeekendZero(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700">
                <strong className="text-slate-900">토요일/일요일은 0개 유지</strong> (주말 가동 중단 반영)
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncInbound}
                onChange={(e) => setSyncInbound(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700">
                <strong className="text-slate-900">입고계획(공장 출하배분) 자동 일치</strong> (차종별 소요량만큼 공장에서 출하/입고하도록 연계)
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>계획 일괄 전개 실행</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
