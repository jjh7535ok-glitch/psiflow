import {
  ProductionLine,
  ProductLineConfig,
  ShiftScheduleRules,
  CapaAllocationMode,
  CalculatedDayCapa,
} from '../types/lineCapa';
export type { ProductionLine, ProductLineConfig, ShiftScheduleRules, CapaAllocationMode, CalculatedDayCapa };
import { ProductItem, PsiDataStore } from '../types/psi';
import { getDayOfWeekName, calculateHubPsi } from './psiEngine';

export const DEFAULT_SHIFT_RULES: ShiftScheduleRules = {
  wednesdayOvertime: false,        // 기본: 수요일 18.5h 고정 (주간 8.0h + 야간 10.5h, 잔업 시 21.0h)
  saturdayOperating: false,        // 기본: 토요일 휴무
  saturdayMode: 'DAY_ONLY',        // 토요일 가동 시 기본: 주간만 (8.0시간)
  sundayOperating: false,          // 기본: 일요일 휴무
  dailyDowntimeMin: 0,             // 비가동 제외
  changeoverTimeMin: 0,            // 기종교환시간 제외
};

/**
 * C/T(초)와 가동률(%)로부터 유효 UPH 계산
 * UPH = (3600 / CT) * (OEE / 100)
 */
export function calculateUphFromCt(cycleTimeSec: number, operationRate: number): number {
  if (cycleTimeSec <= 0) return 0;
  const theoreticalUph = 3600 / cycleTimeSec;
  const effectiveUph = Math.round(theoreticalUph * (operationRate / 100));
  return Math.max(1, effectiveUph);
}

/**
 * UPH와 가동률(%)로부터 C/T(초) 역산
 * CT = (3600 * (OEE / 100)) / UPH
 */
export function calculateCtFromUph(targetUph: number, operationRate: number): number {
  if (targetUph <= 0) return 0;
  const ct = (3600 * (operationRate / 100)) / targetUph;
  return Math.round(ct * 10) / 10;
}

export interface DayShiftHoursResult {
  dayHours: number;
  nightHours: number;
  grossHours: number;
  isOperating: boolean;
  scheduleDescription: string;
}

/**
 * 요일별 공장 가동 시간 계산
 * - 월, 화, 목, 금: 주간 10.5h + 야간 10.5h = 21.0h
 * - 수요일: 주간 8.0h (+ 잔업 2.5h 선택 가능 -> 10.5h)
 * - 토요일: 선택 가능 (주간 8.0h vs 주/야간 18.5h)
 * - 일요일: 선택 가능 (주간 8.0h만 가능, 야간 없음)
 */
export function getDayShiftHours(
  dateStr: string,
  rules: ShiftScheduleRules
): DayShiftHoursResult {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  switch (dayIndex) {
    case 1: // 월
    case 2: // 화
    case 4: // 목
    case 5: // 금
      return {
        dayHours: 10.5,
        nightHours: 10.5,
        grossHours: 21.0,
        isOperating: true,
        scheduleDescription: '정규 2교대 (주간 10.5h + 야간 10.5h)',
      };

    case 3: // 수요일: 기본 18.5h 고정 2교대 (주간 8.0h + 야간 10.5h), 주간 2.5h 잔업 시 21.0h
      const wedDayHours = rules.wednesdayOvertime ? 10.5 : 8.0;
      const wedNightHours = 10.5; // 야간근무는 고정 정상 가동
      const wedTotal = wedDayHours + wedNightHours; // 18.5h 또는 21.0h
      return {
        dayHours: wedDayHours,
        nightHours: wedNightHours,
        grossHours: wedTotal,
        isOperating: true,
        scheduleDescription: rules.wednesdayOvertime
          ? '수요일 2교대 잔업 가동 (주간 10.5h + 야간 10.5h = 21.0h)'
          : '수요일 2교대 기본 가동 (주간 8.0h + 야간 10.5h = 18.5h 고정)',
      };

    case 6: // 토요일
      if (!rules.saturdayOperating) {
        return {
          dayHours: 0,
          nightHours: 0,
          grossHours: 0,
          isOperating: false,
          scheduleDescription: '토요일 휴무',
        };
      }
      if (rules.saturdayMode === 'DAY_ONLY') {
        return {
          dayHours: 8.0,
          nightHours: 0,
          grossHours: 8.0,
          isOperating: true,
          scheduleDescription: '토요일 특근 [주간만 가동] (8.0h)',
        };
      }
      return {
        dayHours: 8.0,
        nightHours: 10.5,
        grossHours: 18.5,
        isOperating: true,
        scheduleDescription: '토요일 특근 [주/야간 2교대] (주간 8h + 야간 10.5h = 18.5h)',
      };

    case 0: // 일요일
      if (!rules.sundayOperating) {
        return {
          dayHours: 0,
          nightHours: 0,
          grossHours: 0,
          isOperating: false,
          scheduleDescription: '일요일 휴무',
        };
      }
      return {
        dayHours: 8.0,
        nightHours: 0,
        grossHours: 8.0,
        isOperating: true,
        scheduleDescription: '일요일 특근 [주간 단근무] (8.0h, 야간 없음)',
      };

    default:
      return {
        dayHours: 0,
        nightHours: 0,
        grossHours: 0,
        isOperating: false,
        scheduleDescription: '휴무',
      };
  }
}

export const STORAGE_KEY_SHIFT_RULES = 'psi_flow_shift_rules_v2';

/**
 * 저장소에서 교대근무 스케줄 규칙 불러오기
 */
export function loadShiftRules(): ShiftScheduleRules {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_SHIFT_RULES);
      if (saved) {
        return { ...DEFAULT_SHIFT_RULES, ...JSON.parse(saved) };
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHIFT_RULES;
}

/**
 * 교대근무 스케줄 규칙 저장
 */
export function saveShiftRules(rules: ShiftScheduleRules): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SHIFT_RULES, JSON.stringify(rules));
    }
  } catch {
    // ignore
  }
}

/**
 * 기본 생산라인 마스터 생성기 (초기 데이터)
 * - 1라인 다품목(혼류) 생산 체제 지원: 1개 품목 생산 중일 때는 다른 품목 동시 생산 불가
 * - 품목 간 전환 시 기종교환시간(C/O Setup Time, 기본 1시간=60분)이 차감되어 순 가용시간 내에서 분할 생산
 * - LINE-01: 제1공장 다품목 혼류라인 (MCU & BMS 교대 생산, 기종교환시간 1시간 반영)
 *   단독 생산 시 21.0h = 8,064 EA, 교대 생산 시 1시간 C/O 차감 후 순 20.0h 가동 (7,680 EA)
 */
export function createDefaultProductionLines(products: ProductItem[]): ProductionLine[] {
  const mcuProd = products.find((p) => p.code.includes('MCU') || p.id === 'prod-001') || products[0];
  const bmsProd = products.find((p) => p.code.includes('BMS') || p.id === 'prod-002') || products[1];
  const otherProds = products.filter((p) => p.id !== mcuProd?.id && p.id !== bmsProd?.id);

  const lines: ProductionLine[] = [];

  if (mcuProd) {
    const configs: ProductLineConfig[] = [
      {
        productId: mcuProd.id,
        productCode: mcuProd.code,
        productName: mcuProd.name,
        cycleTimeSec: 9.4,
        operationRate: 100,
        targetUph: 384, // 21h * 384 UPH = 8,064 EA (단독 가동 시)
        setupTimeMin: 60, // 기종교환시간 1시간 (60분)
      },
    ];

    if (bmsProd) {
      configs.push({
        productId: bmsProd.id,
        productCode: bmsProd.code,
        productName: bmsProd.name,
        cycleTimeSec: 9.4,
        operationRate: 100,
        targetUph: 384, // 21h * 384 UPH = 8,064 EA (단독 가동 시)
        setupTimeMin: 60, // 기종교환시간 1시간 (60분)
      });
    }

    lines.push({
      id: 'LINE-01',
      name: '제1공장 다품목 혼류라인 (MCU & BMS)',
      isMixedModel: true,
      baseDowntimeMin: 0,
      productConfigs: configs,
    });
  }

  otherProds.forEach((p, idx) => {
    lines.push({
      id: `LINE-0${idx + 2}`,
      name: `제${idx + 2}공장 ${p.name.split('(')[0].trim()} 라인`,
      isMixedModel: false,
      baseDowntimeMin: 0,
      productConfigs: [
        {
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          cycleTimeSec: 15.0,
          operationRate: 95,
          targetUph: 228,
          setupTimeMin: 45,
        },
      ],
    });
  });

  return lines;
}

export const STORAGE_KEY_LINES = 'psi_flow_production_lines_v4';

/**
 * 저장소에서 생산라인 구성 불러오기 (없으면 기본값 생성)
 */
export function loadProductionLines(products: ProductItem[]): ProductionLine[] {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_LINES);
      if (saved) {
        const parsed: ProductionLine[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 등록된 품목과 동기화 확인
          return parsed.map((line) => {
            const isLine1 = line.id === 'LINE-01';
            return {
              ...line,
              productConfigs: line.productConfigs.map((cfg) => {
                const matchedProd = products.find((p) => p.id === cfg.productId);
                const uph = isLine1 && cfg.targetUph < 100 ? 384 : cfg.targetUph;
                const ct = isLine1 && cfg.targetUph < 100 ? 9.4 : cfg.cycleTimeSec;
                return {
                  ...cfg,
                  cycleTimeSec: ct,
                  targetUph: uph,
                  setupTimeMin: cfg.setupTimeMin ?? (isLine1 ? 60 : 45),
                  productCode: matchedProd?.code || cfg.productCode,
                  productName: matchedProd?.name || cfg.productName,
                };
              }),
            };
          });
        }
      }
    }
  } catch {
    // ignore
  }
  const defaultLines = createDefaultProductionLines(products);
  saveProductionLines(defaultLines);
  return defaultLines;
}

/**
 * 생산라인 구성을 저장소에 보관
 */
export function saveProductionLines(lines: ProductionLine[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LINES, JSON.stringify(lines));
    }
  } catch {
    // ignore
  }
}

/**
 * 특정 생산라인에 신규 품목 연결 추가
 */
export function linkProductToLine(
  lines: ProductionLine[],
  lineId: string,
  product: ProductItem,
  customConfig?: Partial<ProductLineConfig>
): ProductionLine[] {
  const defaultCt = 45;
  const defaultOee = 90;
  const defaultUph = calculateUphFromCt(defaultCt, defaultOee);

  const newConfig: ProductLineConfig = {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    cycleTimeSec: customConfig?.cycleTimeSec || defaultCt,
    operationRate: customConfig?.operationRate || defaultOee,
    targetUph: customConfig?.targetUph || defaultUph,
    setupTimeMin: customConfig?.setupTimeMin || 45,
  };

  const updated = lines.map((line) => {
    if (line.id !== lineId) return line;
    // 중복 방지
    const filtered = line.productConfigs.filter((c) => c.productId !== product.id);
    return {
      ...line,
      productConfigs: [...filtered, newConfig],
    };
  });

  saveProductionLines(updated);
  return updated;
}

/**
 * 특정 생산라인에서 품목 연결 해제
 */
export function unlinkProductFromLine(
  lines: ProductionLine[],
  lineId: string,
  productId: string
): ProductionLine[] {
  const updated = lines.map((line) => {
    if (line.id !== lineId) return line;
    return {
      ...line,
      productConfigs: line.productConfigs.filter((c) => c.productId !== productId),
    };
  });

  saveProductionLines(updated);
  return updated;
}

/**
 * 신규 생산라인 추가
 */
export function addNewProductionLine(
  lines: ProductionLine[],
  name: string,
  isMixedModel: boolean = true
): ProductionLine[] {
  const nextNum = lines.length + 1;
  const newId = `LINE-0${nextNum}`;
  const newLine: ProductionLine = {
    id: newId,
    name: name.trim() || `제${nextNum} 생산라인`,
    isMixedModel,
    baseDowntimeMin: 60,
    productConfigs: [],
  };

  const updated = [...lines, newLine];
  saveProductionLines(updated);
  return updated;
}

/**
 * 생산라인 삭제
 */
export function deleteProductionLine(
  lines: ProductionLine[],
  lineId: string
): ProductionLine[] {
  if (lines.length <= 1) return lines;
  const updated = lines.filter((l) => l.id !== lineId);
  saveProductionLines(updated);
  return updated;
}

/**
 * 라인 일자별 생산능력(CAPA) 및 일일 생산계획 시뮬레이션
 */
export function simulateLineDailyCapa(
  line: ProductionLine,
  dateList: string[],
  rules: ShiftScheduleRules,
  dataStore: PsiDataStore,
  allocationMode: CapaAllocationMode = 'FULL_CAPA'
): CalculatedDayCapa[] {
  const result: CalculatedDayCapa[] = [];

  // 라인 가중평균 UPH
  const avgUph = line.productConfigs.length > 0
    ? Math.round(
        line.productConfigs.reduce((sum, c) => sum + c.targetUph, 0) /
          line.productConfigs.length
      )
    : 70;

  for (const dateStr of dateList) {
    const configs = line.productConfigs;
    const { name: dayOfWeek, isWeekend, isToday } = getDayOfWeekName(dateStr);
    const shiftInfo = getDayShiftHours(dateStr, rules);

    // 품목별 당일 소요량(판매계획) 파악
    const demands: Record<string, number> = {};
    let totalDemand = 0;

    configs.forEach((cfg) => {
      const rec = dataStore[cfg.productId]?.[dateStr];
      let itemDemand = 0;
      if (rec?.models) {
        itemDemand = Object.values(rec.models).reduce(
          (sum, m) => sum + (m.salesPlan || 0),
          0
        );
      }
      demands[cfg.productId] = itemDemand;
      totalDemand += itemDemand;
    });

    if (!shiftInfo.isOperating || shiftInfo.grossHours <= 0) {
      // 비가동일 (휴무)
      const emptyProductPlans: CalculatedDayCapa['productPlans'] = {};
      configs.forEach((cfg) => {
        emptyProductPlans[cfg.productId] = {
          productId: cfg.productId,
          productName: cfg.productName,
          demand: demands[cfg.productId] || 0,
          allocatedPlan: 0,
          uph: cfg.targetUph,
          requiredHours: 0,
        };
      });

      result.push({
        date: dateStr,
        dayOfWeek,
        isWeekend,
        isToday,
        dayHours: 0,
        nightHours: 0,
        grossHours: 0,
        downtimeHours: 0,
        netProductionHours: 0,
        changeoverCount: 0,
        lineTotalCapa: 0,
        totalDemand,
        utilizationRate: 0,
        isOverCapacity: false,
        productPlans: emptyProductPlans,
      });
      continue;
    }

    // 1라인 다품목 혼류 생산 시 생산 대상 품목 판별
    // FULL_CAPA 모드: 라인에 연결된 모든 품목 생산
    // DEMAND_MATCH 모드: 당일 소요량 > 0 인 품목만 생산
    let activeConfigs = configs.filter((cfg: ProductLineConfig) => {
      if (allocationMode === 'FULL_CAPA') return true;
      return (demands[cfg.productId] || 0) > 0;
    });
    if (activeConfigs.length === 0 && configs.length > 0) {
      activeConfigs = configs.slice(0, 1);
    }

    // 기종교환시간 계산:
    // 1개 품목 생산 시: 기종교환 0회, 비가동 0h -> 21.0h 전량 생산 (8,064 EA @ 384 UPH)
    // 2개 이상 품목 생산 시: 기종교환 (N - 1)회 발생
    // 전환되는 품목의 setupTimeMin(기본 60분 = 1.0h)만큼 가동시간 차감
    // 예: AX에서 GB로 전환 시 1시간 소요 -> 순 생산가동시간 = 21h - 1h = 20시간!
    let changeoverCount = 0;
    let downtimeHours = 0;

    if (activeConfigs.length > 1) {
      changeoverCount = activeConfigs.length - 1;
      let totalSetupMinutes = 0;
      for (let k = 1; k < activeConfigs.length; k++) {
        totalSetupMinutes += activeConfigs[k].setupTimeMin ?? 60;
      }
      downtimeHours = Math.round((totalSetupMinutes / 60) * 10) / 10;
    }

    const netProductionHours = Math.max(0, Math.round((shiftInfo.grossHours - downtimeHours) * 10) / 10);

    // 순 생산 가용시간 동안 각 품목별 생산시간 및 생산량 배분 (합계 시간 = netProductionHours)
    const productPlans: CalculatedDayCapa['productPlans'] = {};
    const totalActiveDemand = activeConfigs.reduce((sum: number, cfg: ProductLineConfig) => sum + (demands[cfg.productId] || 0), 0);
    let accumulatedHours = 0;
    let lineTotalCapa = 0;

    configs.forEach((cfg: ProductLineConfig) => {
      const isActive = activeConfigs.some((ac: ProductLineConfig) => ac.productId === cfg.productId);
      const demand = demands[cfg.productId] || 0;

      if (!isActive || netProductionHours <= 0) {
        productPlans[cfg.productId] = {
          productId: cfg.productId,
          productName: cfg.productName,
          demand,
          allocatedPlan: 0,
          uph: cfg.targetUph,
          requiredHours: 0,
        };
        return;
      }

      const activeIdx = activeConfigs.findIndex((ac) => ac.productId === cfg.productId);
      const isLastActive = activeIdx === activeConfigs.length - 1;

      // 시간 배분 (합계가 정확히 netProductionHours가 되도록 보정)
      let allocatedHours = 0;
      if (activeConfigs.length === 1) {
        allocatedHours = netProductionHours;
      } else if (isLastActive) {
        allocatedHours = Math.max(0, Math.round((netProductionHours - accumulatedHours) * 10) / 10);
      } else {
        const ratio = totalActiveDemand > 0 ? demand / totalActiveDemand : 1 / activeConfigs.length;
        allocatedHours = Math.round(netProductionHours * ratio * 10) / 10;
        accumulatedHours += allocatedHours;
      }

      // 수량 배분 = 배분시간 * 품목 UPH
      let allocatedPlan = Math.round(allocatedHours * cfg.targetUph);
      if (allocationMode === 'DEMAND_MATCH') {
        allocatedPlan = Math.min(demand, allocatedPlan);
      }

      lineTotalCapa += allocatedPlan;

      productPlans[cfg.productId] = {
        productId: cfg.productId,
        productName: cfg.productName,
        demand,
        allocatedPlan,
        uph: cfg.targetUph,
        requiredHours: allocatedHours,
      };
    });

    // 부하율 (%) = (총 소요량 / 라인 총 가용 CAPA) * 100
    const theoreticalNetCapa = Math.round(netProductionHours * avgUph);
    const effectiveCapa = lineTotalCapa > 0 ? lineTotalCapa : theoreticalNetCapa;
    const utilizationRate = effectiveCapa > 0
      ? Math.round((totalDemand / effectiveCapa) * 1000) / 10
      : 0;
    const isOverCapacity = utilizationRate > 100;

    result.push({
      date: dateStr,
      dayOfWeek,
      isWeekend,
      isToday,
      dayHours: shiftInfo.dayHours,
      nightHours: shiftInfo.nightHours,
      grossHours: shiftInfo.grossHours,
      downtimeHours,
      netProductionHours,
      changeoverCount,
      lineTotalCapa,
      totalDemand,
      utilizationRate,
      isOverCapacity,
      productPlans,
    });
  }

  return result;
}

export interface LineDailyRollupDay {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isToday: boolean;
  isPast: boolean;
  grossHours: number;
  isOperating: boolean;
  scheduleDesc: string;
  changeoverCount: number;
  setupLossHours: number;
  netHours: number;
  dayLineCapa: number; // e.g. 21h * 384 UPH = 8,064 EA on LINE-01 (기종교환 시 순가용시간 비례 산출)
  dayProdPlan: number;
  dayProdActual: number;
  dayPipelineStock: number;
  planLoadRate: number; // %
  actualAttainmentRate: number; // %
  alertStatus: 'OVER_CAPA' | 'LOW_ACTUAL' | 'NORMAL' | 'OFF' | 'NO_PLAN';
  alertMessage: string;
}

export interface LineDailyRollupResult {
  lineId: string;
  lineName: string;
  lineUph: number;
  days: LineDailyRollupDay[];
  totalLineCapa: number;
  totalProdPlan: number;
  totalProdActual: number;
  overallAttainment: number;
  finalPipelineStock: number;
  overCapaDayCount: number;
  lowActualDayCount: number;
}

/**
 * 라인별 일일 CAPA 기준선, 총 생산계획, 실적, 재고 및 이상감지 알림 산출
 * - 1라인 다품목 생산 시: 1개 품목 생산 중에는 다른 품목 생산 불가 원칙 적용
 * - 품목 전환 시 기종교환시간(setupTimeMin, 예: 1시간=60분)을 차감하여 순 가용시간(20h) 및 순 CAPA(7,680 EA) 산출
 * - 라인 순 CAPA 초과 시 과부하 알림
 */
export function calculateLineDailyRollup(
  line: ProductionLine,
  lineProducts: ProductItem[],
  dateList: string[],
  dataStore: PsiDataStore,
  rules: ShiftScheduleRules
): LineDailyRollupResult {
  // 라인 UPH 산출: LINE-01 기본 384 UPH (21h * 384 = 8,064 EA)
  let lineUph = 384;
  if (line.productConfigs && line.productConfigs.length > 0) {
    const sumUph = line.productConfigs.reduce((acc, c) => acc + (c.targetUph || 0), 0);
    lineUph = Math.round(sumUph / line.productConfigs.length) || 384;
  } else if (line.id === 'LINE-01') {
    lineUph = 384;
  } else {
    lineUph = 250;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 각 품목별 PSI 계산값 캐싱
  const productCalculations = lineProducts.map((p) => {
    return {
      product: p,
      calc: calculateHubPsi(p, dateList, dataStore[p.id] || {}),
    };
  });

  const days: LineDailyRollupDay[] = [];
  let totalLineCapa = 0;
  let totalProdPlan = 0;
  let totalProdActual = 0;
  let overCapaDayCount = 0;
  let lowActualDayCount = 0;

  for (const dateStr of dateList) {
    const { name: dayOfWeek, isWeekend } = getDayOfWeekName(dateStr);
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    const shiftInfo = getDayShiftHours(dateStr, rules);

    // 당일 생산계획이 편성된 품목들 확인
    const activePlannedConfigs: ProductLineConfig[] = [];
    let dayProdPlan = 0;
    let dayProdActual = 0;
    let dayPipelineStock = 0;

    productCalculations.forEach(({ product, calc }) => {
      const dayRec = calc.days.find((d) => d.date === dateStr);
      if (dayRec) {
        if (dayRec.prodPlan > 0) {
          const cfg = line.productConfigs.find((c) => c.productId === product.id);
          if (cfg) activePlannedConfigs.push(cfg);
        }
        dayProdPlan += dayRec.prodPlan || 0;
        dayProdActual += dayRec.prodActual || 0;
        dayPipelineStock += dayRec.totalPipelineStock || 0;
      }
    });

    totalProdPlan += dayProdPlan;
    totalProdActual += dayProdActual;

    // 1라인 다품목 기종교환 손실 계산:
    // 1개 품목만 생산 시: 기종교환 없음 (0h) -> 21.0h 생산 (8,064 EA @ 384 UPH)
    // 2개 이상 품목 생산 시: 기종교환 (N - 1)회 발생, 품목별 setupTimeMin(기본 60분=1.0h) 차감!
    // 예: AX + GB 생산 시 1시간 기종교환 -> 순 생산시간 = 20.0h, CAPA = 20h * 384 = 7,680 EA!
    let changeoverCount = 0;
    let setupLossHours = 0;

    if (shiftInfo.isOperating && activePlannedConfigs.length > 1) {
      changeoverCount = activePlannedConfigs.length - 1;
      let totalSetupMin = 0;
      for (let i = 1; i < activePlannedConfigs.length; i++) {
        totalSetupMin += activePlannedConfigs[i].setupTimeMin ?? 60;
      }
      setupLossHours = Math.round((totalSetupMin / 60) * 10) / 10;
    }

    const netHours = shiftInfo.isOperating
      ? Math.max(0, Math.round((shiftInfo.grossHours - setupLossHours) * 10) / 10)
      : 0;

    // 기종교환을 반영한 순 CAPA (예: 20.0h * 384 = 7,680 EA)
    const dayLineCapa = shiftInfo.isOperating ? Math.round(netHours * lineUph) : 0;
    totalLineCapa += dayLineCapa;

    const planLoadRate = dayLineCapa > 0 ? Math.round((dayProdPlan / dayLineCapa) * 100) : 0;
    const actualAttainmentRate = dayProdPlan > 0 ? Math.round((dayProdActual / dayProdPlan) * 100) : 0;

    let alertStatus: LineDailyRollupDay['alertStatus'] = 'NORMAL';
    let alertMessage = '정상 가동';

    if (!shiftInfo.isOperating || dayLineCapa === 0) {
      alertStatus = 'OFF';
      alertMessage = shiftInfo.scheduleDescription || '휴무 비가동';
    } else if (dayProdPlan > dayLineCapa) {
      alertStatus = 'OVER_CAPA';
      overCapaDayCount++;
      const overQty = dayProdPlan - dayLineCapa;
      if (changeoverCount > 0) {
        alertMessage = `과부하 경고: 기종교환(${setupLossHours}h, ${changeoverCount}회) 차감 후 순가용 ${netHours}h CAPA(${dayLineCapa.toLocaleString()} EA) 대비 ${planLoadRate}% 초과 배정 (+${overQty.toLocaleString()} EA 초과)`;
      } else {
        alertMessage = `과부하 경고: CAPA(${dayLineCapa.toLocaleString()} EA) 대비 ${planLoadRate}% 배정 (+${overQty.toLocaleString()} EA 초과)`;
      }
    } else if ((isToday || isPast) && dayProdPlan > 0 && dayProdActual < dayProdPlan * 0.85) {
      alertStatus = 'LOW_ACTUAL';
      lowActualDayCount++;
      const shortQty = dayProdPlan - dayProdActual;
      alertMessage = `실적 저조: 달성률 ${actualAttainmentRate}% (${dayProdActual.toLocaleString()}/${dayProdPlan.toLocaleString()} EA, -${shortQty.toLocaleString()} EA 미달)`;
    } else if (dayProdPlan > 0) {
      alertStatus = 'NORMAL';
      if (changeoverCount > 0) {
        alertMessage = `정상: 기종교환 ${setupLossHours}h 반영 순가용 ${netHours}h (부하율 ${planLoadRate}%, ${dayProdPlan.toLocaleString()}/${dayLineCapa.toLocaleString()} EA)`;
      } else {
        alertMessage = `정상: 단일품목 전일가동 ${netHours}h (부하율 ${planLoadRate}%, ${dayProdPlan.toLocaleString()}/${dayLineCapa.toLocaleString()} EA)`;
      }
    } else {
      alertStatus = 'NO_PLAN';
      alertMessage = '생산계획 없음';
    }

    days.push({
      date: dateStr,
      dayOfWeek,
      isWeekend,
      isToday,
      isPast,
      grossHours: shiftInfo.grossHours,
      isOperating: shiftInfo.isOperating,
      scheduleDesc: shiftInfo.scheduleDescription,
      changeoverCount,
      setupLossHours,
      netHours,
      dayLineCapa,
      dayProdPlan,
      dayProdActual,
      dayPipelineStock,
      planLoadRate,
      actualAttainmentRate,
      alertStatus,
      alertMessage,
    });
  }

  const overallAttainment = totalProdPlan > 0 ? Math.round((totalProdActual / totalProdPlan) * 100) : 0;
  const finalPipelineStock = days.length > 0 ? days[days.length - 1].dayPipelineStock : 0;

  return {
    lineId: line.id,
    lineName: line.name,
    lineUph,
    days,
    totalLineCapa,
    totalProdPlan,
    totalProdActual,
    overallAttainment,
    finalPipelineStock,
    overCapaDayCount,
    lowActualDayCount,
  };
}
