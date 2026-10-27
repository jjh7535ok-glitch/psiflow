import { ProductItem, PsiDataStore, DailyHubRecord } from '../types/psi';
import { getDayOfWeekName } from './psiEngine';

export type TimeframeMode = 'weekly' | 'monthly' | 'yearly';

export interface ModelPeriodMetric {
  modelId: string;
  modelName: string;
  customer: string;
  hubName: string;
  badgeColor: string;
  inboundPlan: number;
  inboundActual: number;
  inboundAttainment: number; // %
  inboundVariance: number;   // actual - plan
  salesPlan: number;
  salesActual: number;
  salesAttainment: number;   // %
  salesVariance: number;     // actual - plan
  endingStock: number;
  safetyStock: number;
}

export interface PeriodAchievementResult {
  periodType: TimeframeMode;
  periodId: string;
  periodLabel: string;
  dateList: string[];
  daysCount: number;
  
  // 1. 공장 생산 (Production)
  prodPlan: number;
  prodActual: number;
  prodAttainment: number;   // %
  prodVariance: number;     // actual - plan

  // 2. 거점 입고 (Inbound)
  inboundPlan: number;
  inboundActual: number;
  inboundAttainment: number; // %
  inboundVariance: number;   // actual - plan

  // 3. 고객사 출고/판매 (Shipment/Sales)
  salesPlan: number;
  salesActual: number;
  salesAttainment: number;   // %
  salesVariance: number;     // actual - plan

  // 차종별 세부 현황
  models: ModelPeriodMetric[];

  // 일자별 추이 (그래프 렌더링용)
  dailyTrends: {
    date: string;
    dayOfWeek: string;
    isWeekend: boolean;
    isToday: boolean;
    prodPlan: number;
    prodActual: number;
    prodAttainment: number;
    inboundPlan: number;
    inboundActual: number;
    inboundAttainment: number;
    salesPlan: number;
    salesActual: number;
    salesAttainment: number;
  }[];
}

export interface AchievementBadgeInfo {
  status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
  label: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
}

/**
 * 달성률(%)에 따른 상태 및 스타일 반환
 */
export function getAchievementBadge(rate: number): AchievementBadgeInfo {
  if (rate >= 100) {
    return {
      status: 'EXCELLENT',
      label: rate >= 105 ? '초과 달성' : '목표 달성',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      progressColor: 'bg-emerald-500',
    };
  }
  if (rate >= 90) {
    return {
      status: 'GOOD',
      label: '목표 근접',
      textColor: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      progressColor: 'bg-blue-500',
    };
  }
  if (rate >= 80) {
    return {
      status: 'WARNING',
      label: '관리 주의',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      progressColor: 'bg-amber-500',
    };
  }
  return {
    status: 'CRITICAL',
    label: '미달 경고',
    textColor: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    progressColor: 'bg-rose-500',
  };
}

/**
 * 안전한 달성률 계산 (0 나누기 방지)
 */
export function calculateAttainment(actual: number, plan: number): number {
  if (plan <= 0) {
    return actual > 0 ? 100 : 0;
  }
  const rate = (actual / plan) * 100;
  return Math.round(rate * 10) / 10;
}

/**
 * ISO 주차 ID 반환 (YYYY-Www)
 */
export function getIsoWeekId(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = target.getFullYear();
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

export interface TimeframeOption {
  id: string;
  label: string;
  subLabel?: string;
  dates: string[];
}

/**
 * 가용 일자들을 주간, 월간, 연간으로 그룹핑
 */
export function groupAvailableDates(allDates: string[]): {
  weekly: TimeframeOption[];
  monthly: TimeframeOption[];
  yearly: TimeframeOption[];
} {
  const sorted = Array.from(new Set(allDates)).sort();

  // 1. Weekly grouping
  const weekMap = new Map<string, string[]>();
  sorted.forEach((dt) => {
    const wId = getIsoWeekId(dt);
    if (!weekMap.has(wId)) weekMap.set(wId, []);
    weekMap.get(wId)!.push(dt);
  });
  const weekly: TimeframeOption[] = Array.from(weekMap.entries()).map(([wId, dates]) => {
    const start = dates[0].slice(5).replace('-', '/');
    const end = dates[dates.length - 1].slice(5).replace('-', '/');
    return {
      id: wId,
      label: `${wId}차 (${start} ~ ${end})`,
      subLabel: `${dates.length}일 집계`,
      dates,
    };
  });

  // 2. Monthly grouping
  const monthMap = new Map<string, string[]>();
  sorted.forEach((dt) => {
    const mId = dt.slice(0, 7); // YYYY-MM
    if (!monthMap.has(mId)) monthMap.set(mId, []);
    monthMap.get(mId)!.push(dt);
  });
  const monthly: TimeframeOption[] = Array.from(monthMap.entries()).map(([mId, dates]) => {
    const [y, m] = mId.split('-');
    return {
      id: mId,
      label: `${y}년 ${parseInt(m, 10)}월`,
      subLabel: `${dates.length}일 데이터`,
      dates,
    };
  });

  // 3. Yearly grouping
  const yearMap = new Map<string, string[]>();
  sorted.forEach((dt) => {
    const yId = dt.slice(0, 4); // YYYY
    if (!yearMap.has(yId)) yearMap.set(yId, []);
    yearMap.get(yId)!.push(dt);
  });
  const yearly: TimeframeOption[] = Array.from(yearMap.entries()).map(([yId, dates]) => {
    return {
      id: yId,
      label: `${yId}년 누적`,
      subLabel: `${dates.length}일 데이터 누계`,
      dates,
    };
  });

  return { weekly, monthly, yearly };
}

/**
 * 특정 품목과 일자 목록에 대한 생산/입고/출고 계획 대비 실적 집계
 */
export function calculatePeriodAchievement(
  product: ProductItem,
  dataStore: PsiDataStore,
  targetDates: string[],
  periodType: TimeframeMode,
  periodId: string,
  periodLabel: string
): PeriodAchievementResult {
  const productRecords: Record<string, DailyHubRecord> = dataStore[product.id] || {};

  let totalProdPlan = 0;
  let totalProdActual = 0;

  let totalInboundPlan = 0;
  let totalInboundActual = 0;

  let totalSalesPlan = 0;
  let totalSalesActual = 0;

  // 차종별 임시 집계 맵
  const modelAccumulator: Record<
    string,
    {
      inboundPlan: number;
      inboundActual: number;
      salesPlan: number;
      salesActual: number;
      latestEndingStock: number;
    }
  > = {};

  product.models.forEach((m) => {
    modelAccumulator[m.id] = {
      inboundPlan: 0,
      inboundActual: 0,
      salesPlan: 0,
      salesActual: 0,
      latestEndingStock: m.initialStock,
    };
  });

  const dailyTrends: PeriodAchievementResult['dailyTrends'] = [];

  targetDates.forEach((dt) => {
    const rec = productRecords[dt] || {
      prodPlan: 0,
      prodActual: 0,
      models: {},
    };

    const dayInfo = getDayOfWeekName(dt);
    const pPlan = rec.prodPlan || 0;
    const pActual = rec.prodActual || 0;

    totalProdPlan += pPlan;
    totalProdActual += pActual;

    let dayInboundPlan = 0;
    let dayInboundActual = 0;
    let daySalesPlan = 0;
    let daySalesActual = 0;

    product.models.forEach((m) => {
      const mRec = rec.models?.[m.id] || {
        inboundPlan: 0,
        inboundActual: 0,
        salesPlan: 0,
        salesActual: 0,
      };

      const inPlan = mRec.inboundPlan || 0;
      const inActual = mRec.inboundActual || 0;
      const sPlan = mRec.salesPlan || 0;
      const sActual = mRec.salesActual || 0;

      dayInboundPlan += inPlan;
      dayInboundActual += inActual;
      daySalesPlan += sPlan;
      daySalesActual += sActual;

      const acc = modelAccumulator[m.id];
      if (acc) {
        acc.inboundPlan += inPlan;
        acc.inboundActual += inActual;
        acc.salesPlan += sPlan;
        acc.salesActual += sActual;
      }
    });

    totalInboundPlan += dayInboundPlan;
    totalInboundActual += dayInboundActual;
    totalSalesPlan += daySalesPlan;
    totalSalesActual += daySalesActual;

    dailyTrends.push({
      date: dt,
      dayOfWeek: dayInfo.name,
      isWeekend: dayInfo.isWeekend,
      isToday: dayInfo.isToday,
      prodPlan: pPlan,
      prodActual: pActual,
      prodAttainment: calculateAttainment(pActual, pPlan),
      inboundPlan: dayInboundPlan,
      inboundActual: dayInboundActual,
      inboundAttainment: calculateAttainment(dayInboundActual, dayInboundPlan),
      salesPlan: daySalesPlan,
      salesActual: daySalesActual,
      salesAttainment: calculateAttainment(daySalesActual, daySalesPlan),
    });
  });

  const models: ModelPeriodMetric[] = product.models.map((m) => {
    const acc = modelAccumulator[m.id] || {
      inboundPlan: 0,
      inboundActual: 0,
      salesPlan: 0,
      salesActual: 0,
      latestEndingStock: m.initialStock,
    };

    return {
      modelId: m.id,
      modelName: m.name,
      customer: m.customer,
      hubName: m.hubName,
      badgeColor: m.badgeColor || 'blue',
      inboundPlan: acc.inboundPlan,
      inboundActual: acc.inboundActual,
      inboundAttainment: calculateAttainment(acc.inboundActual, acc.inboundPlan),
      inboundVariance: acc.inboundActual - acc.inboundPlan,
      salesPlan: acc.salesPlan,
      salesActual: acc.salesActual,
      salesAttainment: calculateAttainment(acc.salesActual, acc.salesPlan),
      salesVariance: acc.salesActual - acc.salesPlan,
      endingStock: acc.latestEndingStock,
      safetyStock: m.safetyStock,
    };
  });

  return {
    periodType,
    periodId,
    periodLabel,
    dateList: targetDates,
    daysCount: targetDates.length,
    prodPlan: totalProdPlan,
    prodActual: totalProdActual,
    prodAttainment: calculateAttainment(totalProdActual, totalProdPlan),
    prodVariance: totalProdActual - totalProdPlan,
    inboundPlan: totalInboundPlan,
    inboundActual: totalInboundActual,
    inboundAttainment: calculateAttainment(totalInboundActual, totalInboundPlan),
    inboundVariance: totalInboundActual - totalInboundPlan,
    salesPlan: totalSalesPlan,
    salesActual: totalSalesActual,
    salesAttainment: calculateAttainment(totalSalesActual, totalSalesPlan),
    salesVariance: totalSalesActual - totalSalesPlan,
    models,
    dailyTrends,
  };
}
