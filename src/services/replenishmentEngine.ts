import { ProductItem, PsiDataStore, CalculatedHubDay } from '../types/psi';
import { calculateHubPsi, getDayOfWeekName } from '../utils/psiEngine';
import {
  ProductionLine,
  ShiftScheduleRules,
  loadProductionLines,
  loadShiftRules,
  simulateLineDailyCapa,
} from '../utils/capaEngine';

export type AlertSeverity = 'CRITICAL_STOCKOUT' | 'WARNING_SAFETY';

export interface ReplenishmentRecommendation {
  id: string; // unique key: productId + hubName + modelId
  productId: string;
  productCode: string;
  productName: string;
  hubName: string;
  modelId?: string;
  modelName: string;
  severity: AlertSeverity;
  breachDate: string; // 최초 결품/미달 발생 일자
  currentEndingStock: number;
  safetyStock: number;
  futureDemand: number; // 향후 7일간 소요 계획 합계
  moq: number; // 박스(적입) 또는 파레트 단위
  rawDeficit: number; // 순수 부족 수량
  recommendedReplenish: number; // MOQ 올림 적용된 최종 권장 발주/보충량
  recommendedTargetDate: string; // [1안] D-1 선행 입고 및 평일 보정 적용된 권장 입고 일자
  recommendedDispatchDate: string; // [1안] 공장 리드타임(2일) 역산 및 휴일 회피 적용된 출하/생산 일자
  isD1Advanced: boolean; // D-1 선행 적용 여부
  isWeekendAdjusted: boolean; // 주말 회피 평일 보정 적용 여부
  applied: boolean;
}

export interface ReplenishmentDiffItem {
  recommendationId: string;
  productId: string;
  productCode: string;
  productName: string;
  hubName: string;
  modelName: string;
  breachDate: string;

  // 거점 입고 변동 내역
  inboundDate: string;
  isD1Advanced: boolean;
  prevInbound: number;
  nextInbound: number;
  diffInbound: number;

  // 공장 생산 변동 내역
  dispatchDate: string;
  lineId: string;
  lineName: string;
  prevProd: number;
  nextProd: number;
  diffProd: number;
  dayLineCapa: number;
  utilizationPercent: number;
  isCapaExceeded: boolean;
  isWeekendAdjusted: boolean;
}

export interface ReplenishmentSimulationSummary {
  criticalCount: number; // 🚨 결품 위기 건수
  warningCount: number; // ⚠️ 안전재고 미달 건수
  totalRecommendedQuantity: number; // 총 권장 보충 수량
  affectedProductsCount: number; // 조치가 필요한 품목 수
  recommendations: ReplenishmentRecommendation[];
}

/**
 * 전 품목 및 거점/차종별 향후 일자별 PSI 기말재고를 전수 시뮬레이션하여
 * 2단계 경보(결품 / 안전재고 미달)를 감지하고
 * [1안] D-1 선행 입고 + 주말 회피 평일 보정
 * [2안] 공장 CAPA 연계 지표를 사전 산출합니다.
 */
export function runReplenishmentSimulation(
  products: ProductItem[],
  dateList: string[],
  dataStore: PsiDataStore
): ReplenishmentSimulationSummary {
  const recommendations: ReplenishmentRecommendation[] = [];
  const factoryLeadTimeDays = 2; // 공장 출하-거점 입고 표준 리드타임

  products.forEach((product) => {
    const calcResult = calculateHubPsi(product, dateList, dataStore[product.id] || {});
    const moq = product.boxQty > 0 ? product.boxQty : 50;

    // 거점/차종별 위험 탐색
    product.models.forEach((model) => {
      const hubName = model.hubName || '울산 출고센터';
      const targetSafetyStock = model.safetyStock || 0;

      let firstBreachDay: CalculatedHubDay | null = null;
      let breachSeverity: AlertSeverity | null = null;
      let breachIndex = -1;

      // 일자 순회하며 최초 위험일 포착
      for (let i = 0; i < calcResult.days.length; i++) {
        const day = calcResult.days[i];
        const modelDay = day.models[model.id];
        if (!modelDay) continue;

        const ending = modelDay.endingStock;

        // 1. 결품(Stockout) 발생 여부
        if (ending <= 0) {
          firstBreachDay = day;
          breachSeverity = 'CRITICAL_STOCKOUT';
          breachIndex = i;
          break; // 가장 심각한 최초 결품일 포착
        }

        // 2. 안전재고 미달(Safety Stock Breach) 발생 여부 (결품 이전 첫 발생일 기록)
        if (ending < targetSafetyStock && !firstBreachDay) {
          firstBreachDay = day;
          breachSeverity = 'WARNING_SAFETY';
          breachIndex = i;
        }
      }

      if (firstBreachDay && breachSeverity && breachIndex >= 0) {
        const modelDay = firstBreachDay.models[model.id];
        const curEnding = modelDay ? modelDay.endingStock : 0;

        // 향후 7일간 소요량(수요) 집계 (결품일 이후의 지속 수요 대비)
        let futureDemand = 0;
        const horizon = Math.min(calcResult.days.length, breachIndex + 7);
        for (let j = breachIndex; j < horizon; j++) {
          const d = calcResult.days[j];
          const md = d.models[model.id];
          if (md) {
            futureDemand += md.salesPlan || 0;
          }
        }

        // 순수 부족 수량 = (안전재고 + 향후 수요) - 현재 예상 기말재고
        const rawDeficit = Math.max(0, (targetSafetyStock + Math.round(futureDemand * 0.5)) - curEnding);
        
        // MOQ 올림 적용: 부족 수량을 MOQ 단위로 정렬
        const batchCount = Math.max(1, Math.ceil(rawDeficit / moq));
        const finalRecommended = batchCount * moq;

        // [1안: D-1 선행 입고 및 평일 보정]
        // 결품 당일이 아닌 1일 전(D-1) 입고를 기본 목표로 설정하여 출근 시점부터 안전재고 확보
        let targetIdx = Math.max(0, breachIndex - 1);
        let isD1Advanced = breachIndex > 0;
        let isWeekendAdjusted = false;

        // 만약 D-1 입고일이 주말이면 직전 평일(금요일 등)로 역산
        while (targetIdx > 0 && getDayOfWeekName(dateList[targetIdx]).isWeekend) {
          targetIdx--;
          isWeekendAdjusted = true;
        }
        const targetDate = dateList[targetIdx] || dateList[0];

        // 공장 리드타임(2일) 역산 출하/생산 일자
        let dispatchIdx = Math.max(0, targetIdx - factoryLeadTimeDays);
        while (dispatchIdx > 0 && getDayOfWeekName(dateList[dispatchIdx]).isWeekend) {
          dispatchIdx--;
          isWeekendAdjusted = true;
        }
        const dispatchDate = dateList[dispatchIdx] || dateList[0];

        recommendations.push({
          id: `${product.id}-${hubName}-${model.id}`,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          hubName,
          modelId: model.id,
          modelName: model.name,
          severity: breachSeverity,
          breachDate: firstBreachDay.date,
          currentEndingStock: curEnding,
          safetyStock: targetSafetyStock,
          futureDemand,
          moq,
          rawDeficit,
          recommendedReplenish: finalRecommended,
          recommendedTargetDate: targetDate,
          recommendedDispatchDate: dispatchDate,
          isD1Advanced,
          isWeekendAdjusted,
          applied: false,
        });
      }
    });
  });

  const criticalCount = recommendations.filter((r) => r.severity === 'CRITICAL_STOCKOUT').length;
  const warningCount = recommendations.filter((r) => r.severity === 'WARNING_SAFETY').length;
  const totalRecommendedQuantity = recommendations.reduce((sum, r) => sum + r.recommendedReplenish, 0);
  const affectedProductsCount = new Set(recommendations.map((r) => r.productId)).size;

  return {
    criticalCount,
    warningCount,
    totalRecommendedQuantity,
    affectedProductsCount,
    recommendations,
  };
}

/**
 * [3안] 변경 전후 Diff 미리보기 목록을 생성합니다.
 * 공장 생산라인의 일일 순 CAPA 및 가동률을 계산하여 과부하 여부를 사전에 파악합니다.
 */
export function generateReplenishmentDiffPreview(
  recommendations: ReplenishmentRecommendation[],
  products: ProductItem[],
  dateList: string[],
  currentStore: PsiDataStore,
  lines?: ProductionLine[],
  rules?: ShiftScheduleRules
): ReplenishmentDiffItem[] {
  const activeLines = lines && lines.length > 0 ? lines : loadProductionLines(products);
  const activeRules = rules || loadShiftRules();

  // 각 라인별 일일 CAPA 시뮬레이션 캐시 (lineId -> CalculatedDayCapa[])
  const lineCapaCache: Record<string, ReturnType<typeof simulateLineDailyCapa>> = {};
  activeLines.forEach((line) => {
    lineCapaCache[line.id] = simulateLineDailyCapa(line, dateList, activeRules, currentStore);
  });

  return recommendations.map((rec) => {
    const {
      productId,
      hubName,
      modelId,
      recommendedTargetDate,
      recommendedDispatchDate,
      recommendedReplenish,
      breachDate,
      isD1Advanced,
      isWeekendAdjusted,
    } = rec;

    // 1. 거점 입고 변동 내역
    const targetDayRecord = currentStore[productId]?.[recommendedTargetDate];
    let prevInbound = 0;
    if (modelId && targetDayRecord?.models?.[modelId]) {
      prevInbound = targetDayRecord.models[modelId].inboundPlan || 0;
    } else if (targetDayRecord?.hubs?.[hubName]) {
      prevInbound = targetDayRecord.hubs[hubName].inboundPlan || 0;
    }
    const nextInbound = prevInbound + recommendedReplenish;

    // 2. 공장 생산 변동 내역 및 CAPA 검증
    const dispatchDayRecord = currentStore[productId]?.[recommendedDispatchDate];
    const prevProd = dispatchDayRecord?.prodPlan || 0;
    const nextProd = prevProd + recommendedReplenish;

    // 해당 품목이 배정된 라인 탐색
    const assignedLine =
      activeLines.find((l) => l.productConfigs.some((c) => c.productId === productId)) ||
      activeLines[0];

    const dayCapas = lineCapaCache[assignedLine.id] || [];
    const dayCapaInfo = dayCapas.find((dc) => dc.date === recommendedDispatchDate);
    const dayLineCapa = dayCapaInfo?.lineTotalCapa || 8000;
    const existingLineTotal = dayCapaInfo
      ? Object.values(dayCapaInfo.productPlans || {}).reduce((sum, p) => sum + (p.allocatedPlan || 0), 0)
      : 0;
    const projectedLineTotal = existingLineTotal + recommendedReplenish;

    const utilizationPercent = Math.round((projectedLineTotal / (dayLineCapa || 1)) * 100);
    const isCapaExceeded = projectedLineTotal > dayLineCapa;

    return {
      recommendationId: rec.id,
      productId,
      productCode: rec.productCode,
      productName: rec.productName,
      hubName,
      modelName: rec.modelName,
      breachDate,
      inboundDate: recommendedTargetDate,
      isD1Advanced,
      prevInbound,
      nextInbound,
      diffInbound: recommendedReplenish,
      dispatchDate: recommendedDispatchDate,
      lineId: assignedLine.id,
      lineName: assignedLine.name,
      prevProd,
      nextProd,
      diffProd: recommendedReplenish,
      dayLineCapa,
      utilizationPercent,
      isCapaExceeded,
      isWeekendAdjusted,
    };
  });
}

/**
 * 선택된 권장 보충량들을 기존 공급계획에 가산(기존수량 + 부족분 추가)하여 새 PsiDataStore를 생성합니다.
 */
export function applyRecommendationsToDataStore(
  currentStore: PsiDataStore,
  recommendationsToApply: ReplenishmentRecommendation[]
): PsiDataStore {
  // 깊은 복사
  const nextStore: PsiDataStore = JSON.parse(JSON.stringify(currentStore));

  recommendationsToApply.forEach((rec) => {
    const { productId, recommendedTargetDate, recommendedDispatchDate, modelId, hubName, recommendedReplenish } = rec;

    if (!nextStore[productId]) {
      nextStore[productId] = {};
    }

    // 1. 공장 생산계획(prodPlan)에 가산 반영 (출하/생산 권장일자에 추가)
    if (!nextStore[productId][recommendedDispatchDate]) {
      nextStore[productId][recommendedDispatchDate] = {
        prodPlan: 0,
        prodActual: 0,
        hubs: {},
        models: {},
      };
    }
    const dispatchDayRecord = nextStore[productId][recommendedDispatchDate];
    dispatchDayRecord.prodPlan = (dispatchDayRecord.prodPlan || 0) + recommendedReplenish;

    // 2. 거점 및 차종 입고계획(inboundPlan)에 가산 반영 (목표 입고일자에 추가)
    if (!nextStore[productId][recommendedTargetDate]) {
      nextStore[productId][recommendedTargetDate] = {
        prodPlan: 0,
        prodActual: 0,
        hubs: {},
        models: {},
      };
    }
    const targetDayRecord = nextStore[productId][recommendedTargetDate];

    // 거점 통합 입고계획 가산
    if (!targetDayRecord.hubs) targetDayRecord.hubs = {};
    if (!targetDayRecord.hubs[hubName]) {
      targetDayRecord.hubs[hubName] = { inboundPlan: 0, inboundActual: 0 };
    }
    targetDayRecord.hubs[hubName].inboundPlan = (targetDayRecord.hubs[hubName].inboundPlan || 0) + recommendedReplenish;

    // 차종별 입고계획 가산
    if (modelId) {
      if (!targetDayRecord.models) targetDayRecord.models = {};
      if (!targetDayRecord.models[modelId]) {
        targetDayRecord.models[modelId] = {
          inboundPlan: 0,
          inboundActual: 0,
          salesPlan: 0,
          salesActual: 0,
        };
      }
      targetDayRecord.models[modelId].inboundPlan =
        (targetDayRecord.models[modelId].inboundPlan || 0) + recommendedReplenish;
    }
  });

  return nextStore;
}
