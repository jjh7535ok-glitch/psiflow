import {
  ProductItem,
  VehicleModelConfig,
  DailyHubRecord,
  DailyModelMetric,
  PsiDataStore,
  CalculatedHubDay,
  CalculatedCenterDay,
  CalculatedModelDay,
  ItemCalculationResult,
  CenterCalculationSummary,
  ModelCalculationSummary,
} from '../types/psi';

export const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-001',
    code: 'EV-MCU-100',
    name: '차량용 통합 모터제어기 (MCU)',
    category: '구동 전장',
    unit: 'EA',
    boxQty: 40,
    palletQty: 3200, // 80박스/PLT (40 * 80 = 3200 EA)
    factoryInitialStock: 16000,
    factorySafetyStock: 4000,
    models: [
      {
        id: 'vm-gv80',
        name: 'GV80',
        customer: '현대자동차',
        hubName: '울산 출고센터',
        initialStock: 5000,
        safetyStock: 2500,
        badgeColor: 'blue',
      },
      {
        id: 'vm-ev9',
        name: 'EV9',
        customer: '기아',
        hubName: '광주 출고센터',
        initialStock: 2000,
        safetyStock: 1000,
        badgeColor: 'emerald',
      },
      {
        id: 'vm-palisade',
        name: '팰리세이드',
        customer: '현대자동차',
        hubName: '울산 출고센터',
        initialStock: 3000,
        safetyStock: 1500,
        badgeColor: 'indigo',
      },
    ],
  },
  {
    id: 'prod-002',
    code: 'BAT-BMS-500',
    name: '고전압 배터리 관리 시스템 (BMS)',
    category: '배터리 시스템',
    unit: 'EA',
    boxQty: 20,
    palletQty: 1600, // 80박스/PLT
    factoryInitialStock: 8000,
    factorySafetyStock: 2000,
    models: [
      {
        id: 'vm-gv60',
        name: 'GV60',
        customer: '현대자동차(제네시스)',
        hubName: '울산 출고센터',
        initialStock: 3200,
        safetyStock: 1600,
        badgeColor: 'blue',
      },
      {
        id: 'vm-carnival',
        name: '카니발 HEV',
        customer: '기아',
        hubName: '화성 출고센터',
        initialStock: 2400,
        safetyStock: 1200,
        badgeColor: 'amber',
      },
      {
        id: 'vm-ev6',
        name: 'EV6',
        customer: '기아',
        hubName: '화성 출고센터',
        initialStock: 2800,
        safetyStock: 1400,
        badgeColor: 'purple',
      },
    ],
  },
  {
    id: 'prod-003',
    code: 'ACT-STR-20',
    name: '전자식 조향 스마트 액추에이터',
    category: '조향/샤시',
    unit: 'EA',
    boxQty: 30,
    palletQty: 1800, // 60박스/PLT
    factoryInitialStock: 6000,
    factorySafetyStock: 1800,
    models: [
      {
        id: 'vm-gv70',
        name: 'GV70',
        customer: '현대자동차',
        hubName: '울산 출고센터',
        initialStock: 1800,
        safetyStock: 1800,
        badgeColor: 'blue',
      },
      {
        id: 'vm-g80',
        name: 'G80',
        customer: '현대자동차',
        hubName: '울산 출고센터',
        initialStock: 1200,
        safetyStock: 1200,
        badgeColor: 'indigo',
      },
      {
        id: 'vm-k8',
        name: 'K8',
        customer: '기아',
        hubName: '화성 출고센터',
        initialStock: 900,
        safetyStock: 1500, // 경고 유발 설정
        badgeColor: 'emerald',
      },
    ],
  },
  {
    id: 'prod-004',
    code: 'INVT-IGBT-80',
    name: 'SiC 전력 모듈 인버터',
    category: '전력 변환',
    unit: 'EA',
    boxQty: 15,
    palletQty: 1200, // 80박스/PLT
    factoryInitialStock: 4800,
    factorySafetyStock: 1200,
    models: [
      {
        id: 'vm-ioniq6',
        name: 'IONIQ 6',
        customer: '현대자동차',
        hubName: '아산 출고센터',
        initialStock: 2400,
        safetyStock: 1200,
        badgeColor: 'blue',
      },
      {
        id: 'vm-ev6gt',
        name: 'EV6 GT',
        customer: '기아',
        hubName: '화성 출고센터',
        initialStock: 2400,
        safetyStock: 1200,
        badgeColor: 'purple',
      },
    ],
  },
];

/**
 * 하위 호환성 보장: 기존 구버전 ProductItem 형식(ulsanUsage, gwangjuUsage)이 있을 경우 models 배열로 자동 승격
 */
export function ensureProductModels(prod: Partial<ProductItem>, idx: number = 0): ProductItem {
  const fallback = INITIAL_PRODUCTS[idx] || INITIAL_PRODUCTS[0];
  const safeCode = prod.code || fallback.code;
  const safeName = prod.name || fallback.name;
  const safeUnit = prod.unit && !/^\d+$/.test(prod.unit.trim()) ? prod.unit.trim() : 'EA';
  const boxQ = prod.boxQty || fallback.boxQty || 40;
  let pltQ = prod.palletQty || fallback.palletQty || 3200;
  if (pltQ > 1000000 && boxQ === 40) pltQ = 3200;

  let factoryStock = prod.factoryInitialStock ?? prod.initialStock?.factory ?? fallback.factoryInitialStock;

  let models: VehicleModelConfig[] = [];
  if (Array.isArray(prod.models) && prod.models.length > 0) {
    models = prod.models.map((m, mIdx) => ({
      id: m.id || `vm-${mIdx}-${Date.now()}`,
      name: m.name || `차종 ${mIdx + 1}`,
      customer: m.customer || '현대/기아',
      hubName: m.hubName || (mIdx === 0 ? '울산 출고센터' : '광주 출고센터'),
      initialStock: Number(m.initialStock) || 0,
      safetyStock: Number(m.safetyStock) || 0,
      safetyDays: m.safetyDays || 5,
      badgeColor: m.badgeColor || (mIdx === 0 ? 'blue' : mIdx === 1 ? 'emerald' : 'indigo'),
    }));
  } else {
    // 구버전 ulsanUsage / gwangjuUsage 기반 마이그레이션
    const ulsanName = (prod.ulsanUsage || 'GV80').replace(/사과주스용\s*\(?차종:?\s*|\)/g, '').trim() || 'GV80';
    const gwangjuName = (prod.gwangjuUsage || 'EV9').replace(/사과잼용\s*\(?차종:?\s*|\)/g, '').trim() || 'EV9';

    models = [
      {
        id: 'vm-ulsan',
        name: ulsanName,
        customer: '현대자동차',
        hubName: '울산 출고센터',
        initialStock: prod.initialStock?.ulsan ?? 5000,
        safetyStock: prod.safetyStock?.ulsan ?? 2500,
        safetyDays: 5,
        badgeColor: 'blue',
      },
      {
        id: 'vm-gwangju',
        name: gwangjuName,
        customer: '기아',
        hubName: '광주 출고센터',
        initialStock: prod.initialStock?.gwangju ?? 2000,
        safetyStock: prod.safetyStock?.gwangju ?? 1000,
        safetyDays: 5,
        badgeColor: 'emerald',
      },
    ];
  }

  return {
    id: prod.id || `prod-${idx + 1}`,
    code: safeCode,
    name: safeName,
    category: prod.category || fallback.category,
    unit: safeUnit,
    boxQty: boxQ,
    palletQty: pltQ,
    factoryInitialStock: factoryStock,
    factorySafetyStock: prod.factorySafetyStock ?? fallback.factorySafetyStock ?? 2000,
    models,
    hubs: prod.hubs,
    monthlyInitialStocks: prod.monthlyInitialStocks,
  };
}

// 기준일(오늘)을 포함한 일자 리스트 생성 (포맷: YYYY-MM-DD)
export function generateDateRange(daysCount: number = 14, offsetDaysBefore: number = 2): string[] {
  const dates: string[] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - offsetDaysBefore);

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// 지정한 시작일(startDateStr)로부터 일자 리스트 생성
export function generateDateRangeFromStart(startDateStr: string, daysCount: number = 14): string[] {
  const dates: string[] = [];
  const [y, m, d] = startDateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);

  for (let i = 0; i < daysCount; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

// 요일 반환
export function getDayOfWeekName(dateStr: string): { name: string; isWeekend: boolean; isToday: boolean } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayIndex = dateObj.getDay();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return {
    name: dayNames[dayIndex],
    isWeekend: dayIndex === 0 || dayIndex === 6,
    isToday: dateStr === todayStr,
  };
}

// 초기 일자별 데이터 자동 생성 (한정된 라인 CAPA 8,064개 내 적정 배분)
export function generateInitialRecords(products: ProductItem[], dates: string[]): PsiDataStore {
  const store: PsiDataStore = {};

  products.forEach((rawProd, pIdx) => {
    const prod = ensureProductModels(rawProd, pIdx);
    store[prod.id] = {};
    
    // 라인 8,064 CAPA 내 품목별 적정 배분 (MCU 4,800 + BMS 3,200 = 8,000 <= 8,064)
    const isPrimaryProd = prod.id === 'prod-001' || pIdx === 0;
    const isSecondProd = prod.id === 'prod-002' || pIdx === 1;
    const baseProd = isPrimaryProd ? 4800 : isSecondProd ? 3200 : (prod.palletQty ? prod.palletQty * 2 : 2400);

    dates.forEach((dateStr, dIdx) => {
      const { isWeekend } = getDayOfWeekName(dateStr);
      const isPastOrToday = dIdx <= 2;
      
      const prodPlan = isWeekend ? 0 : baseProd;
      const prodActual = isPastOrToday && !isWeekend ? prodPlan : 0;

      const modelsRecord: Record<string, DailyModelMetric> = {};

      prod.models.forEach((m, mIdx) => {
        let modelDemand = 0;
        if (!isWeekend) {
          if (isPrimaryProd) {
            // 사용자 요청 값: 울산(GV80) 2500, 광주(EV9) 500, 울산(팰리세이드) 1200
            if (m.name.includes('GV80') || mIdx === 0) modelDemand = 2500;
            else if (m.name.includes('EV9') || mIdx === 1) modelDemand = 500;
            else modelDemand = 1200;
          } else {
            modelDemand = Math.round((baseProd * (0.5 / (mIdx + 1))) / 100) * 100;
          }
        }

        const salesPlan = modelDemand;
        const salesActual = isPastOrToday && !isWeekend ? salesPlan : 0;
        const inboundPlan = salesPlan; // 기본 공장 출하 배분
        const inboundActual = isPastOrToday && !isWeekend ? inboundPlan : 0;

        modelsRecord[m.id] = {
          inboundPlan,
          inboundActual,
          salesPlan,
          salesActual,
        };
      });

      store[prod.id][dateStr] = {
        prodPlan,
        prodActual,
        models: modelsRecord,
      };
    });
  });

  return store;
}

/**
 * 신규 날짜에 대한 구조(스켈레톤)만 안전하게 보완하며,
 * 사용자가 입력한 기존 데이터를 절대 변경하지 않고 임의의 가짜 숫자를 자동 주입하지 않습니다.
 */
export function ensureDatesInDataStore(
  currentStore: PsiDataStore,
  products: ProductItem[],
  dateList: string[]
): PsiDataStore {
  const updatedStore: PsiDataStore = { ...currentStore };

  products.forEach((rawProd, pIdx) => {
    const prod = ensureProductModels(rawProd, pIdx);
    if (!updatedStore[prod.id]) {
      updatedStore[prod.id] = {};
    }
    const prodStore = { ...updatedStore[prod.id] };
    let hasChanges = false;

    dateList.forEach((dateStr) => {
      // 기존에 이미 사용자가 입력한 레코드가 있다면 절대 건드리지 않고 보존
      if (!prodStore[dateStr]) {
        hasChanges = true;
        const modelsRecord: Record<string, DailyModelMetric> = {};
        prod.models.forEach((m) => {
          modelsRecord[m.id] = {
            inboundPlan: 0,
            inboundActual: 0,
            salesPlan: 0,
            salesActual: 0,
          };
        });

        // 신규 날짜는 무조건 순수한 0으로 초기화 (임의의 더미값 주입 원천 차단)
        prodStore[dateStr] = {
          prodPlan: 0,
          prodActual: 0,
          models: modelsRecord,
        };
      }
    });

    if (hasChanges) {
      updatedStore[prod.id] = prodStore;
    }
  });

  return updatedStore;
}

/**
 * 구버전 PsiDataStore(ulsanAlloc/gwangjuAlloc 기반) 레코드를 차종별 models 레코드로 변환 및 하위호환성 보장
 */
export function migrateLegacyDataStore(
  dataStore: PsiDataStore,
  products: ProductItem[]
): PsiDataStore {
  if (!dataStore || typeof dataStore !== 'object') return {};
  const migrated: PsiDataStore = {};

  Object.entries(dataStore).forEach(([prodId, dateMap]) => {
    migrated[prodId] = {};
    const prodConfig = products.find((p) => p.id === prodId) || INITIAL_PRODUCTS.find((p) => p.id === prodId);
    const modelIds = prodConfig?.models?.map((m) => m.id) || ['vm-ulsan', 'vm-gwangju'];

    Object.entries(dateMap || {}).forEach(([dateStr, record]) => {
      const rec = { ...record };
      const modelsRecord: Record<string, DailyModelMetric> = { ...(rec.models || {}) };

      // models 객체가 비어있거나 불완전한 상태에서 구버전 필드가 있는 경우 마이그레이션
      const hasLegacyFields =
        rec.ulsanAlloc !== undefined ||
        rec.gwangjuAlloc !== undefined ||
        rec.ulsanPlan !== undefined ||
        rec.gwangjuPlan !== undefined;

      if (Object.keys(modelsRecord).length === 0 && hasLegacyFields) {
        if (modelIds[0]) {
          modelsRecord[modelIds[0]] = {
            inboundPlan: rec.ulsanAlloc ?? 0,
            inboundActual: rec.ulsanActual ?? 0,
            salesPlan: rec.ulsanPlan ?? 0,
            salesActual: rec.ulsanActual ?? 0,
          };
        }
        if (modelIds[1]) {
          modelsRecord[modelIds[1]] = {
            inboundPlan: rec.gwangjuAlloc ?? 0,
            inboundActual: rec.gwangjuActual ?? 0,
            salesPlan: rec.gwangjuPlan ?? 0,
            salesActual: rec.gwangjuActual ?? 0,
          };
        }
      }

      migrated[prodId][dateStr] = {
        prodPlan: rec.prodPlan ?? 0,
        prodActual: rec.prodActual ?? 0,
        models: modelsRecord,
        ...(rec.hubs ? { hubs: rec.hubs } : {}),
        ...(rec.note ? { note: rec.note } : {}),
      };
    });
  });

  return migrated;
}

/**
 * 수기로 입력한 셀 값을 기준일(오늘 등) 이후 날짜로 연속 전개 (Forward Fill)
 */
export function forwardFillModelField(
  dataStore: PsiDataStore,
  productId: string,
  modelId: string | null, // null for factory fields
  field: 'prodPlan' | 'prodActual' | 'salesPlan' | 'salesActual' | 'inboundPlan' | 'inboundActual',
  fromDateStr: string,
  value: number,
  keepWeekendZero: boolean = true,
  dateList?: string[]
): PsiDataStore {
  const newStore: PsiDataStore = JSON.parse(JSON.stringify(dataStore));
  if (!newStore[productId]) newStore[productId] = {};

  const allDates = dateList && dateList.length > 0 ? dateList : Object.keys(newStore[productId]).sort();
  let start = false;

  for (const dateStr of allDates) {
    if (dateStr === fromDateStr) {
      start = true;
    }
    if (start) {
      const { isWeekend } = getDayOfWeekName(dateStr);
      const cur = newStore[productId][dateStr] || {
        prodPlan: 0,
        prodActual: 0,
        models: {},
      };
      if (!cur.models) cur.models = {};

      const fillVal = keepWeekendZero && isWeekend ? 0 : value;

      if (!modelId) {
        // 공장 생산 필드
        if (field === 'prodPlan' || field === 'prodActual') {
          newStore[productId][dateStr] = {
            ...cur,
            [field]: fillVal,
          };
        }
      } else {
        // 특정 차종 필드
        const curModel = cur.models[modelId] || {
          inboundPlan: 0,
          inboundActual: 0,
          salesPlan: 0,
          salesActual: 0,
        };

        cur.models[modelId] = {
          ...curModel,
          [field]: fillVal,
        };

        newStore[productId][dateStr] = {
          ...cur,
          models: cur.models,
        };
      }
    }
  }

  return newStore;
}

export interface BatchPlanFillOptions {
  productIds: string[]; // empty or 'ALL' applies to all
  startDateStr: string;
  prodPlan?: number; // optional: if omitted, preserves existing line CAPA production plans
  modelPlans?: Record<string, number>; // modelId -> salesPlan
  syncInbound: boolean; // 입고계획(배분)도 판매계획/소요량과 동일하게 자동 반영
  keepWeekendZero: boolean;
  dateList: string[];
}

/**
 * 오늘 기준으로 고객사 차종별 일소요량(및 선택 시 생산계획)을 일괄 전개
 */
export function batchForwardFillPlans(
  dataStore: PsiDataStore,
  products: ProductItem[],
  options: BatchPlanFillOptions
): PsiDataStore {
  const newStore: PsiDataStore = JSON.parse(JSON.stringify(dataStore));
  const { productIds, startDateStr, prodPlan, modelPlans, syncInbound, keepWeekendZero, dateList } = options;

  const targetIds = productIds.length === 0 || productIds.includes('ALL')
    ? Object.keys(newStore)
    : productIds;

  targetIds.forEach((pId) => {
    if (!newStore[pId]) newStore[pId] = {};
    const prodConfig = products.find((p) => p.id === pId) || INITIAL_PRODUCTS.find((p) => p.id === pId);
    let start = false;

    for (const d of dateList) {
      if (d === startDateStr) {
        start = true;
      }
      if (start) {
        const { isWeekend } = getDayOfWeekName(d);
        const cur = newStore[pId][d] || {
          prodPlan: 0,
          prodActual: 0,
          models: {},
        };
        if (!cur.models) cur.models = {};

        // 제안 2안: prodPlan이 명시적으로 제공된 경우에만 덮어쓰고, 미제공 시 기존 라인 CAPA 생산계획 100% 보존
        if (prodPlan !== undefined) {
          const targetProd = keepWeekendZero && isWeekend ? 0 : prodPlan;
          cur.prodPlan = targetProd;
        }

        if (prodConfig?.models) {
          prodConfig.models.forEach((m) => {
            const planValue = modelPlans && modelPlans[m.id] !== undefined
              ? modelPlans[m.id]
              : (cur.models?.[m.id]?.salesPlan ?? (m.name.includes('GV80') ? 2500 : m.name.includes('EV9') ? 500 : 1200));

            const finalDemand = keepWeekendZero && isWeekend ? 0 : planValue;
            const curModel = cur.models?.[m.id] || { inboundPlan: 0, inboundActual: 0, salesPlan: 0, salesActual: 0 };

            cur.models![m.id] = {
              ...curModel,
              salesPlan: finalDemand,
              ...(syncInbound ? { inboundPlan: finalDemand } : {}),
            };
          });
        }

        newStore[pId][d] = cur;
      }
    }
  });

  return newStore;
}

/**
 * 3계층 다차종·다거점 공급망 연산 엔진
 * 1. 공장 생산 풀 (공통 원천)
 * 2. 차종별 공급망 흐름 (고객사/출고센터별 입고-판매-재고)
 * 3. 전체 물류 파이프라인 통합 롤업 및 진단
 */
export function calculateHubPsi(
  rawProduct: ProductItem,
  dateList: string[],
  recordMap: Record<string, DailyHubRecord> = {}
): ItemCalculationResult {
  const product = ensureProductModels(rawProduct);
  const days: CalculatedHubDay[] = [];

  // 계획 기간 기준 월 (예: "2026-10")
  const planMonth = dateList[0] ? dateList[0].slice(0, 7) : '';
  const monthlyInitial = planMonth && product.monthlyInitialStocks?.[planMonth]
    ? product.monthlyInitialStocks[planMonth]
    : null;

  let curFactoryStock = monthlyInitial ? monthlyInitial.factory : product.factoryInitialStock;

  // 출고센터(Hub) 목록 및 소속 차종 매핑
  const hubNames = Array.from(
    new Set(product.models.map((m) => m.hubName || '울산 출고센터'))
  );

  const hubModelsMap: Record<string, VehicleModelConfig[]> = {};
  const curHubStocks: Record<string, number> = {};
  const hubSafetyMap: Record<string, number> = {};

  hubNames.forEach((hub) => {
    const ms = product.models.filter((m) => (m.hubName || '울산 출고센터') === hub);
    hubModelsMap[hub] = ms;

    // 거점 기초재고: 당월 장부(monthlyInitial) 우선, 없으면 hubs 설정 또는 차종 합산
    if (monthlyInitial?.hubs && monthlyInitial.hubs[hub] !== undefined) {
      curHubStocks[hub] = monthlyInitial.hubs[hub];
    } else if (product.hubs?.[hub]?.initialStock !== undefined) {
      curHubStocks[hub] = product.hubs[hub].initialStock;
    } else {
      curHubStocks[hub] = ms.reduce((sum, m) => sum + (Number(m.initialStock) || 0), 0);
    }

    // 거점 안전재고: product.hubs 우선, 없으면 차종 합산
    if (product.hubs?.[hub]?.safetyStock !== undefined) {
      hubSafetyMap[hub] = product.hubs[hub].safetyStock;
    } else {
      hubSafetyMap[hub] = ms.reduce((sum, m) => sum + (Number(m.safetyStock) || 0), 0);
    }
  });

  let totalProdPlan = 0;
  let totalProdActual = 0;
  let totalSalesPlanAll = 0;
  let totalSalesActualAll = 0;
  let totalInboundPlanAll = 0;
  let totalInboundActualAll = 0;

  let totalShortageDays = 0;
  let imbalanceDays = 0;

  // 거점별 요약 맵
  const centerSummaryMap: Record<string, CenterCalculationSummary> = {};
  hubNames.forEach((hub) => {
    centerSummaryMap[hub] = {
      hubName: hub,
      totalSalesPlan: 0,
      totalSalesActual: 0,
      salesAttainment: 0,
      totalInboundPlan: 0,
      totalInboundActual: 0,
      inboundAttainment: 0,
      finalEndingStock: curHubStocks[hub],
      warningDays: 0,
      safetyStock: hubSafetyMap[hub],
    };
  });

  // 차종별 요약 맵 (하위 호환)
  const modelSummaryMap: Record<string, ModelCalculationSummary> = {};
  product.models.forEach((m) => {
    modelSummaryMap[m.id] = {
      modelId: m.id,
      modelName: m.name,
      customer: m.customer,
      hubName: m.hubName,
      totalSalesPlan: 0,
      totalSalesActual: 0,
      salesAttainment: 0,
      totalInboundPlan: 0,
      totalInboundActual: 0,
      inboundAttainment: 0,
      finalEndingStock: m.initialStock,
      warningDays: 0,
    };
  });

  const totalCenterSafety = Object.values(hubSafetyMap).reduce((sum, s) => sum + s, 0);

  for (const dateStr of dateList) {
    const raw = recordMap[dateStr] || {
      prodPlan: 0,
      prodActual: 0,
      models: {},
    };

    const { name: dayOfWeek, isWeekend, isToday } = getDayOfWeekName(dateStr);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isPast = dateStr < todayStr;

    const factoryDayBeginning = curFactoryStock;

    // 거점별 및 차종별 일자별 연산
    const calculatedCenters: Record<string, CalculatedCenterDay> = {};
    const calculatedModels: Record<string, CalculatedModelDay> = {};

    let dayTotalInboundPlan = 0;
    let dayTotalInboundActual = 0;
    let dayTotalSalesPlan = 0;
    let dayTotalSalesActual = 0;
    let anyHubWarning = false;
    const warningHubNames: string[] = [];

    hubNames.forEach((hub) => {
      const ms = hubModelsMap[hub];
      const hubBeginning = curHubStocks[hub];

      let hubSalesPlan = 0;
      let hubSalesActual = 0;
      let hubInboundPlan = 0;
      let hubInboundActual = 0;
      const modelDetailRecord: Record<string, any> = {};

      // 거점 단위 일자별 입고(raw.hubs[hub])가 존재하면 이를 우선 사용
      if (raw.hubs && raw.hubs[hub]) {
        hubInboundPlan = raw.hubs[hub].inboundPlan ?? 0;
        hubInboundActual = raw.hubs[hub].inboundActual ?? 0;
      }

      ms.forEach((m) => {
        let inboundPlan = 0;
        let inboundActual = 0;
        let salesPlan = 0;
        let salesActual = 0;

        if (raw.models && raw.models[m.id]) {
          inboundPlan = raw.models[m.id].inboundPlan ?? 0;
          inboundActual = raw.models[m.id].inboundActual ?? 0;
          salesPlan = raw.models[m.id].salesPlan ?? 0;
          salesActual = raw.models[m.id].salesActual ?? 0;
        }

        hubSalesPlan += salesPlan;
        hubSalesActual += salesActual;

        // raw.hubs에 기록되지 않은 구버전 데이터는 차종별 inbound 합산
        if (!raw.hubs || !raw.hubs[hub]) {
          hubInboundPlan += inboundPlan;
          hubInboundActual += inboundActual;
        }

        modelDetailRecord[m.id] = {
          modelId: m.id,
          modelName: m.name,
          customer: m.customer,
          badgeColor: m.badgeColor || 'blue',
          salesPlan,
          salesActual,
        };

        modelSummaryMap[m.id].totalSalesPlan += salesPlan;
        modelSummaryMap[m.id].totalSalesActual += salesActual;
        modelSummaryMap[m.id].totalInboundPlan += inboundPlan;
        modelSummaryMap[m.id].totalInboundActual += inboundActual;
      });

      // 거점 단위 기말재고 연산:
      // 거점 기말재고 = 거점 기초재고 + 해당 거점 입고실적 - (소속 차종들 합친 일판매실적)
      const effectiveInbound = isPast
        ? hubInboundActual
        : isToday
        ? (hubInboundActual > 0 ? hubInboundActual : hubInboundPlan)
        : hubInboundPlan;

      const effectiveSales = isPast
        ? hubSalesActual
        : isToday
        ? (hubSalesActual > 0 ? hubSalesActual : hubSalesPlan)
        : hubSalesPlan;

      const newHubStock = hubBeginning + effectiveInbound - effectiveSales;
      curHubStocks[hub] = newHubStock;

      const hubSafety = hubSafetyMap[hub];
      const isHubWarning = newHubStock < hubSafety;
      if (isHubWarning) {
        anyHubWarning = true;
        warningHubNames.push(hub);
        centerSummaryMap[hub].warningDays++;
      }

      calculatedCenters[hub] = {
        hubName: hub,
        beginningStock: hubBeginning,
        inboundPlan: hubInboundPlan,
        inboundActual: hubInboundActual,
        salesPlan: hubSalesPlan,
        salesActual: hubSalesActual,
        endingStock: newHubStock,
        safetyStock: hubSafety,
        isWarning: isHubWarning,
        models: modelDetailRecord,
      };

      // 소속 차종별 CalculatedModelDay 매핑 (동일 거점의 기말재고 공유)
      ms.forEach((m) => {
        const mInboundPlan = raw.models?.[m.id]?.inboundPlan ?? 0;
        const mInboundActual = raw.models?.[m.id]?.inboundActual ?? 0;
        const mSalesPlan = raw.models?.[m.id]?.salesPlan ?? 0;
        const mSalesActual = raw.models?.[m.id]?.salesActual ?? 0;

        calculatedModels[m.id] = {
          modelId: m.id,
          modelName: m.name,
          customer: m.customer,
          hubName: hub,
          badgeColor: m.badgeColor || 'blue',
          beginningStock: hubBeginning,
          inboundPlan: mInboundPlan,
          inboundActual: mInboundActual,
          salesPlan: mSalesPlan,
          salesActual: mSalesActual,
          endingStock: newHubStock,
          safetyStock: m.safetyStock,
          isWarning: isHubWarning,
        };
        modelSummaryMap[m.id].finalEndingStock = newHubStock;
        if (isHubWarning) modelSummaryMap[m.id].warningDays++;
      });

      dayTotalInboundPlan += hubInboundPlan;
      dayTotalInboundActual += hubInboundActual;
      dayTotalSalesPlan += hubSalesPlan;
      dayTotalSalesActual += hubSalesActual;

      centerSummaryMap[hub].totalSalesPlan += hubSalesPlan;
      centerSummaryMap[hub].totalSalesActual += hubSalesActual;
      centerSummaryMap[hub].totalInboundPlan += hubInboundPlan;
      centerSummaryMap[hub].totalInboundActual += hubInboundActual;
      centerSummaryMap[hub].finalEndingStock = newHubStock;
    });

    // 1. 공장 생산 & 재고 계산
    const effectiveProd = isPast
      ? raw.prodActual
      : isToday
      ? (raw.prodActual > 0 ? raw.prodActual : raw.prodPlan)
      : raw.prodPlan;

    const availableFactoryStock = factoryDayBeginning + effectiveProd;
    // 당일(isToday)인 경우 실제 거점 입고 실적이 있으면 실적 합계, 없으면 계획 합계 반영
    const totalFactoryAlloc = isPast
      ? dayTotalInboundActual
      : isToday
      ? (dayTotalInboundActual > 0 ? dayTotalInboundActual : dayTotalInboundPlan)
      : dayTotalInboundPlan;
    const allocExceeded = totalFactoryAlloc > availableFactoryStock;

    // 공장 기말재고 = 공장 기초재고 + 공장 생산 - 공장 총출하
    curFactoryStock = availableFactoryStock - totalFactoryAlloc;

    // 3. 통합 지표 계산
    const totalCenterStock = Object.values(curHubStocks).reduce((sum, s) => sum + s, 0);
    const totalPipelineStock = curFactoryStock + totalCenterStock;

    // 거시적 총량 부족 vs 거점별 미시적 배분 불균형 판단
    const isTotalShortage = totalPipelineStock < totalCenterSafety;
    const isAllocationImbalance = !isTotalShortage && anyHubWarning;

    if (isTotalShortage) totalShortageDays++;
    if (isAllocationImbalance) imbalanceDays++;

    const pipelineStatus: 'NORMAL' | 'SHORTAGE' | 'IMBALANCE' = isTotalShortage
      ? 'SHORTAGE'
      : isAllocationImbalance
      ? 'IMBALANCE'
      : 'NORMAL';

    let diagnosisMessage = '정상: 공급망 파이프라인 원활';
    if (isTotalShortage) {
      diagnosisMessage = '🔴 총량 결품 경보: 공장+거점 전체 총재고가 안전재고 합계에 미달 (공장 생산계획 확대 요망)';
    } else if (isAllocationImbalance) {
      diagnosisMessage = `🟡 배분 불균형: [${warningHubNames.join(', ')}] 안전재고 미달 (공장에서 해당 거점으로 우선 배분 출하 요망)`;
    } else if (allocExceeded) {
      diagnosisMessage = '⚠️ 출하한도 초과: 거점별 배분 출하계획이 공장 가용재고를 초과함';
    }

    totalProdPlan += raw.prodPlan;
    totalProdActual += raw.prodActual;
    totalSalesPlanAll += dayTotalSalesPlan;
    totalSalesActualAll += dayTotalSalesActual;
    totalInboundPlanAll += dayTotalInboundPlan;
    totalInboundActualAll += dayTotalInboundActual;

    // 하위 호환 매핑
    const firstCalculated = Object.values(calculatedModels)[0];
    const secondCalculated = Object.values(calculatedModels)[1];

    days.push({
      date: dateStr,
      dayOfWeek,
      isWeekend,
      isToday,
      factoryBeginningStock: factoryDayBeginning,
      prodPlan: raw.prodPlan,
      prodActual: raw.prodActual,
      prodVariance: raw.prodActual - raw.prodPlan,
      factoryEndingStock: curFactoryStock,
      totalFactoryAlloc,
      allocExceeded,
      centers: calculatedCenters,
      models: calculatedModels,
      totalSalesPlan: dayTotalSalesPlan,
      totalSalesActual: dayTotalSalesActual,
      totalInboundPlan: dayTotalInboundPlan,
      totalInboundActual: dayTotalInboundActual,
      totalCenterStock,
      totalPipelineStock,
      isTotalShortage,
      isAllocationImbalance,
      pipelineStatus,
      diagnosisMessage,
      ulsanAlloc: firstCalculated?.inboundPlan ?? 0,
      ulsanPlan: firstCalculated?.salesPlan ?? 0,
      ulsanActual: firstCalculated?.salesActual ?? 0,
      ulsanEndingStock: firstCalculated?.endingStock ?? 0,
      ulsanSafetyStock: firstCalculated?.safetyStock ?? 0,
      isUlsanWarning: firstCalculated?.isWarning ?? false,
      gwangjuAlloc: secondCalculated?.inboundPlan ?? 0,
      gwangjuPlan: secondCalculated?.salesPlan ?? 0,
      gwangjuActual: secondCalculated?.salesActual ?? 0,
      gwangjuEndingStock: secondCalculated?.endingStock ?? 0,
      gwangjuSafetyStock: secondCalculated?.safetyStock ?? 0,
      isGwangjuWarning: secondCalculated?.isWarning ?? false,
      totalAlloc: totalFactoryAlloc,
    });
  }

  // 달성률 계산
  const prodAttainment = totalProdPlan > 0 ? Math.round((totalProdActual / totalProdPlan) * 1000) / 10 : 0;
  const salesAttainment = totalSalesPlanAll > 0 ? Math.round((totalSalesActualAll / totalSalesPlanAll) * 1000) / 10 : 0;
  const inboundAttainment = totalInboundPlanAll > 0 ? Math.round((totalInboundActualAll / totalInboundPlanAll) * 1000) / 10 : 0;

  // 거점별 요약 달성률
  Object.keys(centerSummaryMap).forEach((hub) => {
    const item = centerSummaryMap[hub];
    item.salesAttainment = item.totalSalesPlan > 0 ? Math.round((item.totalSalesActual / item.totalSalesPlan) * 1000) / 10 : 0;
    item.inboundAttainment = item.totalInboundPlan > 0 ? Math.round((item.totalInboundActual / item.totalInboundPlan) * 1000) / 10 : 0;
  });

  // 차종별 요약 달성률
  Object.keys(modelSummaryMap).forEach((mId) => {
    const item = modelSummaryMap[mId];
    item.salesAttainment = item.totalSalesPlan > 0 ? Math.round((item.totalSalesActual / item.totalSalesPlan) * 1000) / 10 : 0;
    item.inboundAttainment = item.totalInboundPlan > 0 ? Math.round((item.totalInboundActual / item.totalInboundPlan) * 1000) / 10 : 0;
  });

  const finalCenterStock = Object.values(curHubStocks).reduce((sum, s) => sum + s, 0);

  return {
    days,
    summary: {
      totalProdPlan,
      totalProdActual,
      prodAttainment,
      totalSalesPlan: totalSalesPlanAll,
      totalSalesActual: totalSalesActualAll,
      salesAttainment,
      totalInboundPlan: totalInboundPlanAll,
      totalInboundActual: totalInboundActualAll,
      inboundAttainment,
      finalFactoryStock: curFactoryStock,
      finalCenterStock,
      finalPipelineStock: curFactoryStock + finalCenterStock,
      totalShortageDays,
      imbalanceDays,
      centers: centerSummaryMap,
      models: modelSummaryMap,
      totalUlsanPlan: Object.values(centerSummaryMap)[0]?.totalSalesPlan ?? 0,
      totalUlsanActual: Object.values(centerSummaryMap)[0]?.totalSalesActual ?? 0,
      ulsanAttainment: Object.values(centerSummaryMap)[0]?.salesAttainment ?? 0,
      totalGwangjuPlan: Object.values(centerSummaryMap)[1]?.totalSalesPlan ?? 0,
      totalGwangjuActual: Object.values(centerSummaryMap)[1]?.totalSalesActual ?? 0,
      gwangjuAttainment: Object.values(centerSummaryMap)[1]?.salesAttainment ?? 0,
      finalUlsanStock: Object.values(centerSummaryMap)[0]?.finalEndingStock ?? 0,
      finalGwangjuStock: Object.values(centerSummaryMap)[1]?.finalEndingStock ?? 0,
      ulsanWarningDays: Object.values(centerSummaryMap)[0]?.warningDays ?? 0,
      gwangjuWarningDays: Object.values(centerSummaryMap)[1]?.warningDays ?? 0,
    },
  };
}

/**
 * CSV 다운로드 헬퍼
 */
export function exportToCsv(
  products: ProductItem[],
  dateList: string[],
  dataStore: PsiDataStore
): string {
  const headers = ['품목코드', '품목명', '구분', '고객사', '차종/출고센터', '지표', ...dateList, '기간누적/기말'];
  const rows: string[][] = [headers];

  products.forEach((rawProd) => {
    const prod = ensureProductModels(rawProd);
    const calc = calculateHubPsi(prod, dateList, dataStore[prod.id] || {});

    // 공장 생산
    rows.push([
      prod.code,
      prod.name,
      '공장생산',
      '자체공장',
      '생산라인',
      '생산계획',
      ...calc.days.map((d) => String(d.prodPlan)),
      String(calc.summary.totalProdPlan),
    ]);
    rows.push([
      prod.code,
      prod.name,
      '공장생산',
      '자체공장',
      '생산라인',
      '생산실적',
      ...calc.days.map((d) => String(d.prodActual)),
      `${calc.summary.totalProdActual} (${calc.summary.prodAttainment}%)`,
    ]);
    rows.push([
      prod.code,
      prod.name,
      '공장생산',
      '자체공장',
      '물류창고',
      '공장보유재고',
      ...calc.days.map((d) => String(d.factoryEndingStock)),
      String(calc.summary.finalFactoryStock),
    ]);

    // 차종별
    prod.models.forEach((m) => {
      rows.push([
        prod.code,
        prod.name,
        '차종별',
        m.customer,
        `${m.name} (${m.hubName})`,
        '판매계획(소요량)',
        ...calc.days.map((d) => String(d.models[m.id]?.salesPlan ?? 0)),
        String(calc.summary.models[m.id]?.totalSalesPlan ?? 0),
      ]);
      rows.push([
        prod.code,
        prod.name,
        '차종별',
        m.customer,
        `${m.name} (${m.hubName})`,
        '판매실적',
        ...calc.days.map((d) => String(d.models[m.id]?.salesActual ?? 0)),
        String(calc.summary.models[m.id]?.totalSalesActual ?? 0),
      ]);
      rows.push([
        prod.code,
        prod.name,
        '차종별',
        m.customer,
        `${m.name} (${m.hubName})`,
        '입고계획(배분)',
        ...calc.days.map((d) => String(d.models[m.id]?.inboundPlan ?? 0)),
        String(calc.summary.models[m.id]?.totalInboundPlan ?? 0),
      ]);
      rows.push([
        prod.code,
        prod.name,
        '차종별',
        m.customer,
        `${m.name} (${m.hubName})`,
        '입고실적',
        ...calc.days.map((d) => String(d.models[m.id]?.inboundActual ?? 0)),
        String(calc.summary.models[m.id]?.totalInboundActual ?? 0),
      ]);
      rows.push([
        prod.code,
        prod.name,
        '차종별',
        m.customer,
        `${m.name} (${m.hubName})`,
        '거점기말재고',
        ...calc.days.map((d) => String(d.models[m.id]?.endingStock ?? 0)),
        String(calc.summary.models[m.id]?.finalEndingStock ?? 0),
      ]);
    });

    // 통합
    rows.push([
      prod.code,
      prod.name,
      '통합',
      '전체고객사',
      '전체거점',
      '전체물류총재고',
      ...calc.days.map((d) => String(d.totalPipelineStock)),
      String(calc.summary.finalPipelineStock),
    ]);
  });

  return rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
