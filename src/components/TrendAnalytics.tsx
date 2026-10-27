import React, { useState, useMemo } from 'react';
import { ProductItem, PsiDataStore } from '../types/psi';
import { calculateHubPsi, ensureProductModels } from '../utils/psiEngine';
import {
  TimeframeMode,
  groupAvailableDates,
  calculatePeriodAchievement,
  getAchievementBadge,
  PeriodAchievementResult,
} from '../utils/achievementUtils';
import {
  AlertTriangle,
  TrendingUp,
  Factory,
  Store,
  CheckCircle2,
  AlertCircle,
  Truck,
  Activity,
  Layers,
  Calendar,
  Percent,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
} from 'recharts';

interface TrendAnalyticsProps {
  products: ProductItem[];
  dateList: string[];
  dataStore: PsiDataStore;
}

export const TrendAnalytics: React.FC<TrendAnalyticsProps> = ({
  products,
  dateList,
  dataStore,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || ''
  );
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('weekly');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const rawSelected = products.find((p) => p.id === selectedProductId) || products[0];

  if (!rawSelected) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500">
        등록된 품목이 없습니다. 품목을 먼저 등록해 주세요.
      </div>
    );
  }

  const selectedProduct = ensureProductModels(rawSelected);
  const safeUnit = selectedProduct.unit || 'EA';
  const safePalletQty = selectedProduct.palletQty || 1;

  // 1. Gather all recorded dates for this product and the active view
  const allAvailableDates = useMemo(() => {
    const fromStore = Object.keys(dataStore[selectedProduct.id] || {});
    return Array.from(new Set([...dateList, ...fromStore])).sort();
  }, [selectedProduct.id, dataStore, dateList]);

  // 2. Group available dates into weekly, monthly, and yearly intervals
  const timeframeOptions = useMemo(() => {
    return groupAvailableDates(allAvailableDates);
  }, [allAvailableDates]);

  // Determine current active period ID based on mode
  const currentOptions = timeframeOptions[timeframeMode];
  const activePeriod = useMemo(() => {
    if (!currentOptions || currentOptions.length === 0) {
      return {
        id: 'default',
        label: '전체 가용 기간',
        dates: dateList,
      };
    }
    const found = currentOptions.find((opt) => opt.id === selectedPeriodId);
    return found || currentOptions[0];
  }, [currentOptions, selectedPeriodId, dateList]);

  // 3. Compute achievement data for the active selected period
  const activeResult: PeriodAchievementResult = useMemo(() => {
    return calculatePeriodAchievement(
      selectedProduct,
      dataStore,
      activePeriod.dates,
      timeframeMode,
      activePeriod.id,
      activePeriod.label
    );
  }, [selectedProduct, dataStore, activePeriod, timeframeMode]);

  // 4. Compute all 3 timeframe results (Weekly, Monthly, Yearly) for the Cross-Period Overview Scorecard
  const crossPeriodSummary = useMemo(() => {
    const latestWeekOpt = timeframeOptions.weekly[0] || {
      id: 'w-curr',
      label: '현재 주차',
      dates: dateList.slice(0, 7),
    };
    const latestMonthOpt = timeframeOptions.monthly[0] || {
      id: 'm-curr',
      label: '당월 누적',
      dates: dateList,
    };
    const latestYearOpt = timeframeOptions.yearly[0] || {
      id: 'y-curr',
      label: '연간 누적',
      dates: allAvailableDates,
    };

    const weekRes = calculatePeriodAchievement(
      selectedProduct,
      dataStore,
      latestWeekOpt.dates,
      'weekly',
      latestWeekOpt.id,
      latestWeekOpt.label
    );

    const monthRes = calculatePeriodAchievement(
      selectedProduct,
      dataStore,
      latestMonthOpt.dates,
      'monthly',
      latestMonthOpt.id,
      latestMonthOpt.label
    );

    const yearRes = calculatePeriodAchievement(
      selectedProduct,
      dataStore,
      latestYearOpt.dates,
      'yearly',
      latestYearOpt.id,
      latestYearOpt.label
    );

    return { weekRes, monthRes, yearRes };
  }, [selectedProduct, dataStore, timeframeOptions, dateList, allAvailableDates]);

  // Hub PSI Stock calculation for pipeline trend chart
  const calc = calculateHubPsi(selectedProduct, dateList, dataStore[selectedProduct.id] || {});
  const { days, summary } = calc;

  // Max value calculation for SVG scaling
  const maxStock = Math.max(
    ...days.map((d) =>
      Math.max(
        d.totalPipelineStock,
        d.factoryEndingStock,
        ...Object.values(d.models).map((m) => Math.max(m.endingStock, m.safetyStock))
      )
    ),
    100
  );

  // Badges for the 3 main metrics
  const prodBadge = getAchievementBadge(activeResult.prodAttainment);
  const inboundBadge = getAchievementBadge(activeResult.inboundAttainment);
  const salesBadge = getAchievementBadge(activeResult.salesAttainment);

  // Chart View Mode State (생산 vs 판매 실적 비교 vs 거점별 재고 추이)
  const [chartViewMode, setChartViewMode] = useState<'comparison' | 'inventory'>('comparison');

  // Recharts interactive dataset mapping
  const rechartsData = useMemo(() => {
    return days.map((d) => {
      const dayTrend = activeResult.dailyTrends.find((t) => t.date === d.date);

      const entry: Record<string, any> = {
        date: d.date.slice(5).replace('-', '/'),
        fullDate: d.date,
        dayOfWeek: d.dayOfWeek,
        isWeekend: d.isWeekend,
        isToday: d.isToday,
        // Production vs Sales Metrics
        '생산 계획': dayTrend?.prodPlan ?? d.prodPlan ?? 0,
        '생산 실적': dayTrend?.prodActual ?? d.prodActual ?? 0,
        '판매 소요계획': dayTrend?.salesPlan ?? d.totalSalesPlan ?? 0,
        '판매 실적': dayTrend?.salesActual ?? d.totalSalesActual ?? 0,
        // Stock Levels
        '공장 보유재고': d.factoryEndingStock ?? 0,
        '전체 물류총재고': d.totalPipelineStock ?? 0,
      };

      // Add each vehicle model stock
      selectedProduct.models.forEach((m) => {
        entry[`${m.name} (${m.hubName.replace(' 출고센터', '').replace(' 물류센터', '')})`] =
          d.models[m.id]?.endingStock ?? 0;
      });

      return entry;
    });
  }, [days, activeResult.dailyTrends, selectedProduct.models]);

  return (
    <div className="flex-1 w-full overflow-y-auto bg-slate-100 p-6 space-y-6">
      {/* 1. Header & Timeframe Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <label htmlFor="product-select" className="text-xs font-semibold text-slate-700">
            분석 대상 품목:
          </label>
          <select
            id="product-select"
            value={selectedProduct.id}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.code}] {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Selector Tabs (주간 / 월간 / 연간) */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">집계 주기:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => {
                setTimeframeMode('weekly');
                setSelectedPeriodId('');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                timeframeMode === 'weekly'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              주간 (Weekly)
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeframeMode('monthly');
                setSelectedPeriodId('');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                timeframeMode === 'monthly'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              월간 (Monthly)
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeframeMode('yearly');
                setSelectedPeriodId('');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                timeframeMode === 'yearly'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              연간 (Yearly)
            </button>
          </div>

          {/* Sub Period Dropdown */}
          {currentOptions && currentOptions.length > 1 && (
            <select
              value={activePeriod.id}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              {currentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Product Spec Inline Details */}
        <div className="w-full flex items-center gap-3 text-xs text-slate-600 flex-wrap pt-2 border-t border-slate-100">
          <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            카테고리: {selectedProduct.category}
          </span>
          <span>·</span>
          <span>
            단위: <strong className="text-slate-900">{safeUnit}</strong>
          </span>
          <span>·</span>
          <span className="text-amber-800">
            출하단위: <strong className="font-mono text-amber-950">1PLT = {safePalletQty.toLocaleString()}{safeUnit}</strong>
          </span>
          <span>·</span>
          <span>
            공장 기초: <strong className="text-slate-900 font-mono">{selectedProduct.factoryInitialStock.toLocaleString()}</strong>
          </span>
          <span>·</span>
          <span className="text-blue-700 font-semibold">
            연결 차종({selectedProduct.models.length}): {selectedProduct.models.map((m) => `${m.name}(${m.hubName})`).join(', ')}
          </span>
        </div>
      </div>

      {/* 2. Primary 3-Pillar Achievement Rate Indicators (생산 / 입고 / 출고) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              {activePeriod.label} 계획 대비 실적 달성률 인디케이터
            </h2>
            <span className="text-xs text-slate-500 font-normal">
              ({activeResult.daysCount}일간 데이터 기준)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            * 달성률(%) = (실적 / 계획) × 100
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pillar 1: 공장 생산 달성률 */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded text-slate-700">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">공장 생산 달성률</h3>
                  <p className="text-[11px] text-slate-400">생산계획 vs 생산실적</p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold border ${prodBadge.bgColor} ${prodBadge.textColor} ${prodBadge.borderColor}`}
              >
                {prodBadge.label}
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-900">
                  {activeResult.prodAttainment}
                </span>
                <span className="text-sm font-bold text-slate-500">%</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-semibold text-slate-700">
                  실적 {activeResult.prodActual.toLocaleString()} / 계획 {activeResult.prodPlan.toLocaleString()}
                </div>
                <div
                  className={`text-[11px] font-mono flex items-center justify-end gap-0.5 mt-0.5 ${
                    activeResult.prodVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {activeResult.prodVariance >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>
                    차이 {activeResult.prodVariance >= 0 ? '+' : ''}
                    {activeResult.prodVariance.toLocaleString()} {safeUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar with 100% Target Marker */}
            <div className="space-y-1 mt-3">
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${prodBadge.progressColor}`}
                  style={{ width: `${Math.min(100, (activeResult.prodAttainment / 120) * 100)}%` }}
                />
                {/* 100% Target Marker line at ~83.3% of 120% scale */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                  style={{ left: `${(100 / 120) * 100}%` }}
                  title="목표선 (100%)"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0%</span>
                <span className="text-slate-700 font-semibold">목표 100%</span>
                <span>120%</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>일평균 생산실적:</span>
              <strong className="font-mono text-slate-800">
                {activeResult.daysCount > 0
                  ? Math.round(activeResult.prodActual / activeResult.daysCount).toLocaleString()
                  : 0}{' '}
                {safeUnit}/일
              </strong>
            </div>
          </div>

          {/* Pillar 2: 거점 입고 달성률 */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded text-blue-700">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">거점 입고 달성률</h3>
                  <p className="text-[11px] text-slate-400">공장 출하입고 배분실적</p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold border ${inboundBadge.bgColor} ${inboundBadge.textColor} ${inboundBadge.borderColor}`}
              >
                {inboundBadge.label}
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-blue-700">
                  {activeResult.inboundAttainment}
                </span>
                <span className="text-sm font-bold text-slate-500">%</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-semibold text-slate-700">
                  실적 {activeResult.inboundActual.toLocaleString()} / 계획 {activeResult.inboundPlan.toLocaleString()}
                </div>
                <div
                  className={`text-[11px] font-mono flex items-center justify-end gap-0.5 mt-0.5 ${
                    activeResult.inboundVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {activeResult.inboundVariance >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>
                    차이 {activeResult.inboundVariance >= 0 ? '+' : ''}
                    {activeResult.inboundVariance.toLocaleString()} {safeUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1 mt-3">
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${inboundBadge.progressColor}`}
                  style={{ width: `${Math.min(100, (activeResult.inboundAttainment / 120) * 100)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                  style={{ left: `${(100 / 120) * 100}%` }}
                  title="목표선 (100%)"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0%</span>
                <span className="text-slate-700 font-semibold">목표 100%</span>
                <span>120%</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>입고 물량 환산:</span>
              <strong className="font-mono text-slate-800">
                {(activeResult.inboundActual / safePalletQty).toFixed(1)} PLT
              </strong>
            </div>
          </div>

          {/* Pillar 3: 고객사 출고/판매 달성률 */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded text-indigo-700">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">출고/판매 달성률</h3>
                  <p className="text-[11px] text-slate-400">고객사 라인투입 적기공급</p>
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold border ${salesBadge.bgColor} ${salesBadge.textColor} ${salesBadge.borderColor}`}
              >
                {salesBadge.label}
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold font-mono tracking-tight text-indigo-700">
                  {activeResult.salesAttainment}
                </span>
                <span className="text-sm font-bold text-slate-500">%</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-semibold text-slate-700">
                  실적 {activeResult.salesActual.toLocaleString()} / 계획 {activeResult.salesPlan.toLocaleString()}
                </div>
                <div
                  className={`text-[11px] font-mono flex items-center justify-end gap-0.5 mt-0.5 ${
                    activeResult.salesVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {activeResult.salesVariance >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  <span>
                    차이 {activeResult.salesVariance >= 0 ? '+' : ''}
                    {activeResult.salesVariance.toLocaleString()} {safeUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1 mt-3">
              <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${salesBadge.progressColor}`}
                  style={{ width: `${Math.min(100, (activeResult.salesAttainment / 120) * 100)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                  style={{ left: `${(100 / 120) * 100}%` }}
                  title="목표선 (100%)"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0%</span>
                <span className="text-slate-700 font-semibold">목표 100%</span>
                <span>120%</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>소요계획 대비 공급상태:</span>
              <strong
                className={`font-semibold ${
                  activeResult.salesAttainment >= 98
                    ? 'text-emerald-700'
                    : activeResult.salesAttainment >= 90
                    ? 'text-blue-700'
                    : 'text-rose-700'
                }`}
              >
                {activeResult.salesAttainment >= 98
                  ? '공급 완전 일치'
                  : activeResult.salesAttainment >= 90
                  ? '정상 공급 중'
                  : '출고 차질 위험'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Cross-Period Comparison Matrix: 주간 vs 월간 vs 연간 한눈에 보기 */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              년·월·주간 달성률 종합 비교 매트릭스 (Cross-Period Achievement Matrix)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            주간, 월간, 연간 전체 실적 달성 추이를 수평 비교 분석합니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">구분 지표</th>
                <th className="py-2.5 px-3">
                  <span className="block font-bold text-slate-800">주간 (Weekly)</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {crossPeriodSummary.weekRes.periodLabel}
                  </span>
                </th>
                <th className="py-2.5 px-3">
                  <span className="block font-bold text-slate-800">월간 (Monthly)</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {crossPeriodSummary.monthRes.periodLabel}
                  </span>
                </th>
                <th className="py-2.5 px-3">
                  <span className="block font-bold text-slate-800">연간 (Yearly)</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {crossPeriodSummary.yearRes.periodLabel}
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">종합 진단</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {/* Row 1: 공장 생산 */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-medium text-slate-800 flex items-center gap-2">
                  <Factory className="w-3.5 h-3.5 text-slate-500" />
                  <span>공장 생산 달성률</span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {crossPeriodSummary.weekRes.prodAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.weekRes.prodActual.toLocaleString()}/
                      {crossPeriodSummary.weekRes.prodPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {crossPeriodSummary.monthRes.prodAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.monthRes.prodActual.toLocaleString()}/
                      {crossPeriodSummary.monthRes.prodPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {crossPeriodSummary.yearRes.prodAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.yearRes.prodActual.toLocaleString()}/
                      {crossPeriodSummary.yearRes.prodPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-sans">
                  {crossPeriodSummary.weekRes.prodAttainment >= 95 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> 정상 가동
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <AlertCircle className="w-3 h-3" /> 생산 보정 필요
                    </span>
                  )}
                </td>
              </tr>

              {/* Row 2: 거점 입고 */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-medium text-slate-800 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-blue-500" />
                  <span>거점 입고 달성률</span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700">
                      {crossPeriodSummary.weekRes.inboundAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.weekRes.inboundActual.toLocaleString()}/
                      {crossPeriodSummary.weekRes.inboundPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700">
                      {crossPeriodSummary.monthRes.inboundAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.monthRes.inboundActual.toLocaleString()}/
                      {crossPeriodSummary.monthRes.inboundPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700">
                      {crossPeriodSummary.yearRes.inboundAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.yearRes.inboundActual.toLocaleString()}/
                      {crossPeriodSummary.yearRes.inboundPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-sans">
                  {crossPeriodSummary.weekRes.inboundAttainment >= 95 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> 배분 적기 입고
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <AlertTriangle className="w-3 h-3" /> 입고 지연 발생
                    </span>
                  )}
                </td>
              </tr>

              {/* Row 3: 고객사 출고/판매 */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-medium text-slate-800 flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-indigo-500" />
                  <span>출고/판매 달성률</span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700">
                      {crossPeriodSummary.weekRes.salesAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.weekRes.salesActual.toLocaleString()}/
                      {crossPeriodSummary.weekRes.salesPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700">
                      {crossPeriodSummary.monthRes.salesAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.monthRes.salesActual.toLocaleString()}/
                      {crossPeriodSummary.monthRes.salesPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700">
                      {crossPeriodSummary.yearRes.salesAttainment}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({crossPeriodSummary.yearRes.salesActual.toLocaleString()}/
                      {crossPeriodSummary.yearRes.salesPlan.toLocaleString()})
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-sans">
                  {crossPeriodSummary.weekRes.salesAttainment >= 98 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> 서플라이 충족
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <AlertCircle className="w-3 h-3" /> 결품 위험 감지
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Model Breakdown Table: 차종별 세부 달성률 현황 */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>차종 및 출고센터별 계획 대비 실적 세부 달성률</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              각 완성차 고객사 차종별로 입고 달성률과 판매/출고 소요 충족률을 개별 추적합니다.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
            선택 기간: {activePeriod.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeResult.models.map((m) => {
            const inBadge = getAchievementBadge(m.inboundAttainment);
            const sBadge = getAchievementBadge(m.salesAttainment);

            return (
              <div
                key={m.modelId}
                className="border border-slate-200 rounded-lg p-3.5 bg-white hover:border-slate-300 transition-colors shadow-2xs space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {m.modelName}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      ({m.customer} · {m.hubName})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    안전재고 {m.safetyStock.toLocaleString()}
                  </span>
                </div>

                {/* Inbound Attainment Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1 font-medium">
                      <Truck className="w-3 h-3 text-blue-500" />
                      입고 달성률:
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold font-mono text-blue-700">
                        {m.inboundAttainment}%
                      </span>
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded font-semibold border ${inBadge.bgColor} ${inBadge.textColor} ${inBadge.borderColor}`}
                      >
                        {inBadge.label}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${inBadge.progressColor}`}
                      style={{ width: `${Math.min(100, m.inboundAttainment)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>계획: {m.inboundPlan.toLocaleString()}</span>
                    <span>실적: {m.inboundActual.toLocaleString()}</span>
                  </div>
                </div>

                {/* Sales Attainment Progress */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1 font-medium">
                      <Store className="w-3 h-3 text-indigo-500" />
                      출고/판매 달성률:
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold font-mono text-indigo-700">
                        {m.salesAttainment}%
                      </span>
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded font-semibold border ${sBadge.bgColor} ${sBadge.textColor} ${sBadge.borderColor}`}
                      >
                        {sBadge.label}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${sBadge.progressColor}`}
                      style={{ width: `${Math.min(100, m.salesAttainment)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>소요: {m.salesPlan.toLocaleString()}</span>
                    <span>실적: {m.salesActual.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Recharts Interactive Line Chart Dashboard (생산 계획 vs 판매 실적 & 거점재고 추이) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        {/* Chart Header & Interactive Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                인터랙티브 시계열 분석 차트 (Recharts 대시보드)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                마우스 오버 인터랙션 지원
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              마우스를 그래프 선 위에 올리면(Hover) 일자별 정확한 수치와 달성률 말풍선(Tooltip)이 반응합니다.
            </p>
          </div>

          {/* View Mode Segmented Controls */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setChartViewMode('comparison')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                chartViewMode === 'comparison'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>생산 계획 vs 판매 실적 비교</span>
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('inventory')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                chartViewMode === 'inventory'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>공장 &amp; 거점재고 추이</span>
            </button>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="w-full h-80 pt-2 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rechartsData}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <RechartsTooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    return (
                      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-lg p-3.5 shadow-xl border border-slate-700 text-xs font-mono space-y-2 min-w-[230px]">
                        <div className="font-sans font-bold text-slate-100 border-b border-slate-700/80 pb-1.5 flex justify-between items-center">
                          <span>{data?.fullDate} ({data?.dayOfWeek}요일)</span>
                          {data?.isToday && (
                            <span className="bg-blue-600 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold text-white">
                              TODAY
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {payload.map((entry: any, index: number) => (
                            <div key={`tip-${index}`} className="flex justify-between items-center gap-4">
                              <span className="flex items-center gap-1.5 font-sans text-slate-300" style={{ color: entry.color }}>
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="truncate max-w-[140px]">{entry.name}:</span>
                              </span>
                              <span className="font-bold font-mono text-white tabular-nums">
                                {Number(entry.value).toLocaleString()} {safeUnit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <RechartsLegend
                wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontFamily: 'inherit' }}
              />

              {chartViewMode === 'comparison' ? (
                <>
                  {/* Mode 1: Production Plan vs Sales Actuals comparison */}
                  <Bar
                    dataKey="생산 계획"
                    fill="#93c5fd"
                    radius={[4, 4, 0, 0]}
                    opacity={0.7}
                    maxBarSize={28}
                  />
                  <Line
                    type="monotone"
                    dataKey="생산 실적"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#10b981' }}
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="판매 소요계획"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: '#f59e0b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="판매 실적"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              ) : (
                <>
                  {/* Mode 2: Factory & Distribution Centers Inventory Trend */}
                  <Area
                    type="monotone"
                    dataKey="공장 보유재고"
                    fill="#cbd5e1"
                    stroke="#334155"
                    strokeWidth={2.5}
                    fillOpacity={0.25}
                  />
                  {selectedProduct.models.map((m, idx) => {
                    const strokeColor =
                      idx === 0
                        ? '#2563eb'
                        : idx === 1
                        ? '#059669'
                        : idx === 2
                        ? '#7c3aed'
                        : '#d97706';
                    const dataKey = `${m.name} (${m.hubName.replace(' 출고센터', '').replace(' 물류센터', '')})`;

                    return (
                      <Line
                        key={m.id}
                        type="monotone"
                        dataKey={dataKey}
                        stroke={strokeColor}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: strokeColor }}
                        activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    );
                  })}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom Legend Insights Info Strip */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>💡 <strong>차트 분석 가이드:</strong></span>
            {chartViewMode === 'comparison' ? (
              <span>
                연하늘색 막대(생산계획) 대비 <strong>초록선(생산실적)</strong>과 <strong>보라선(판매실적)</strong>의 추종 격차를 실시간으로 모니터링합니다.
              </span>
            ) : (
              <span>
                짙은 회색 영역(공장 보유재고)과 컬러 라인(차종별 거점재고)의 잔량 추이를 감시하여 안전재고 미달 위험을 사전 예측합니다.
              </span>
            )}
          </div>
          <span className="text-slate-400 font-mono">
            출하단위: 1 PLT = {safePalletQty.toLocaleString()} {safeUnit}
          </span>
        </div>
      </div>
    </div>
  );
};
