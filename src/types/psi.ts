export type HubType = 'FACTORY' | 'DC';

export type ViewMode = 'all' | 'ulsan' | 'gwangju' | string;

export interface VehicleModelConfig {
  id: string;               // 차종 고유 식별자 (예: "vm-gv80", "vm-ev9")
  name: string;             // 차종명 (예: "GV80", "EV9", "팰리세이드", "카니발", "IONIQ 5")
  customer: string;         // 고객사 (예: "현대자동차", "기아", "제네시스")
  hubName: string;          // 출고센터 (예: "울산 출고센터", "광주 출고센터", "화성 출고센터", "아산 출고센터")
  initialStock: number;     // 거점 기초재고 (첫날 기준재고)
  safetyStock: number;      // 거점 안전재고
  safetyDays?: number;      // 안전재고 일수 기준 (기본 5일분)
  badgeColor?: string;      // 시각적 테마 (blue, emerald, purple, amber, rose, indigo)
}

export interface MonthlyInitialStockRecord {
  factory: number;
  hubs: Record<string, number>; // hubName -> initialStock
}

export interface HubInventoryConfig {
  hubName: string;
  initialStock: number;
  safetyStock: number;
  safetyDays?: number;
}

export interface ProductItem {
  id: string;
  code: string;             // 사내 품목코드 (예: EV-MCU-100, BAT-BMS-500)
  name: string;             // 품목명 (예: 차량용 통합 모터제어기 (MCU))
  category: string;         // 카테고리 (구동 전장, 배터리 시스템, 샤시 등)
  unit: string;             // 관리 단위 (기본: EA, SET, ASSY 등)
  boxQty: number;           // 박스당 적입수량
  palletQty: number;        // 1파레트당 수량 (공장 출고 이동 단위)
  factoryInitialStock: number; // 공장 기준/당월 기초재고
  factorySafetyStock?: number; // 공장 안전재고
  
  // 차종별 공급망 매핑 설정 (고객사별 차종 - 출고센터 매핑)
  models: VehicleModelConfig[];

  // 출고센터(거점)별 실물 통합 재고 설정 (hubName -> HubInventoryConfig)
  hubs?: Record<string, HubInventoryConfig>;

  // 월별 기초재고 장부 (월 키: "YYYY-MM", 예: "2026-10" -> { factory: number, hubs: Record<string, number> })
  monthlyInitialStocks?: Record<string, MonthlyInitialStockRecord>;

  // 구버전 하위호환성 유지 필드
  vehicleModel?: string;
  ulsanUsage?: string;
  gwangjuUsage?: string;
  initialStock?: {
    factory: number;
    ulsan: number;
    gwangju: number;
  };
  safetyStock?: {
    ulsan: number;
    gwangju: number;
  };
}

export interface DailyHubMetric {
  inboundPlan: number;      // 거점 입고계획 (공장 -> 해당 거점 배분)
  inboundActual: number;    // 거점 입고실적
}

export interface DailyModelMetric {
  inboundPlan: number;      // 입고계획 (하위호환 및 배분)
  inboundActual: number;    // 입고실적
  salesPlan: number;        // 판매계획 / 일소요량 (고객사 라인 투입 계획)
  salesActual: number;      // 판매실적
}

export interface DailyHubRecord {
  // 공장 생산
  prodPlan: number;
  prodActual: number;

  // 거점(출고센터) 단위 일자별 지표 (hubName -> DailyHubMetric)
  hubs?: Record<string, DailyHubMetric>;

  // 차종별 일자별 지표 (modelId -> DailyModelMetric)
  models?: Record<string, DailyModelMetric>;

  // 비고/메모
  note?: string;

  // 구버전 하위호환성 필드
  ulsanAlloc?: number;
  ulsanPlan?: number;
  ulsanActual?: number;
  gwangjuAlloc?: number;
  gwangjuPlan?: number;
  gwangjuActual?: number;
}

export type PsiDataStore = Record<string, Record<string, DailyHubRecord>>;

export interface CalculatedModelDay {
  modelId: string;
  modelName: string;
  customer: string;
  hubName: string;
  badgeColor: string;
  beginningStock: number;   // 거점 당일 기초재고 (전일 기말 또는 시작일 기초)
  inboundPlan: number;
  inboundActual: number;
  salesPlan: number;
  salesActual: number;
  endingStock: number;
  safetyStock: number;
  isWarning: boolean;
}

export interface CalculatedCenterDay {
  hubName: string;
  beginningStock: number;   // 거점 당일 기초재고 (전일 거점 기말 또는 시작일 기초)
  inboundPlan: number;      // 해당 거점 일입고계획
  inboundActual: number;    // 해당 거점 일입고실적
  salesPlan: number;        // 해당 거점 소속 차종들의 일판매계획(소요량) 합계
  salesActual: number;      // 해당 거점 소속 차종들의 일판매실적 합계
  endingStock: number;      // 해당 거점 당일 기말재고 = 기초 + 입고 - 합친 판매
  safetyStock: number;      // 해당 거점 안전재고 기준 합계
  isWarning: boolean;       // 거점 안전재고 미달 여부
  models: Record<string, {
    modelId: string;
    modelName: string;
    customer: string;
    badgeColor: string;
    salesPlan: number;
    salesActual: number;
  }>;
}

export interface CalculatedHubDay {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isToday: boolean;
  
  // 1. 공장 출하 허브 (공용 생산 풀)
  factoryBeginningStock: number; // 공장 당일 기초재고
  prodPlan: number;
  prodActual: number;
  prodVariance: number;       // 실적 - 계획
  factoryEndingStock: number; // 공장 잔여 보유재고
  totalFactoryAlloc: number;  // 모든 차종으로 배분 출하된 총량
  allocExceeded: boolean;     // 출하량이 공장 가용재고를 초과했는지 여부

  // 2. 거점(출고센터) 및 차종별 계산 결과
  centers?: Record<string, CalculatedCenterDay>;
  models: Record<string, CalculatedModelDay>;

  // 3. 전체 물류 파이프라인 통합 롤업 지표
  totalSalesPlan: number;     // 전 차종 판매계획 합계
  totalSalesActual: number;   // 전 차종 판매실적 합계
  totalInboundPlan: number;   // 전 차종 입고계획 합계
  totalInboundActual: number; // 전 차종 입고실적 합계
  totalCenterStock: number;   // 전 거점/차종 기말재고 합계
  totalPipelineStock: number; // 공장재고 + 전체 거점재고 합계
  
  // 진단 플래그 (거시적 총량 부족 vs 차종·거점별 배분 불균형)
  isTotalShortage: boolean;       // 총량 부족 (전체 파이프라인 총재고 < 전체 거점 안전재고 합계)
  isAllocationImbalance: boolean; // 총량은 충분하나 특정 차종/거점 결품 위험
  pipelineStatus: 'NORMAL' | 'SHORTAGE' | 'IMBALANCE';
  diagnosisMessage: string;       // 진단 상세 사유

  // 하위 호환 필드
  ulsanAlloc?: number;
  ulsanPlan?: number;
  ulsanActual?: number;
  ulsanEndingStock?: number;
  ulsanSafetyStock?: number;
  isUlsanWarning?: boolean;
  gwangjuAlloc?: number;
  gwangjuPlan?: number;
  gwangjuActual?: number;
  gwangjuEndingStock?: number;
  gwangjuSafetyStock?: number;
  isGwangjuWarning?: boolean;
  totalAlloc?: number;
}

export interface CenterCalculationSummary {
  hubName: string;
  totalSalesPlan: number;
  totalSalesActual: number;
  salesAttainment: number;     // %
  totalInboundPlan: number;
  totalInboundActual: number;
  inboundAttainment: number;   // %
  finalEndingStock: number;
  warningDays: number;
  safetyStock: number;
}

export interface ModelCalculationSummary {
  modelId: string;
  modelName: string;
  customer: string;
  hubName: string;
  totalSalesPlan: number;
  totalSalesActual: number;
  salesAttainment: number;     // %
  totalInboundPlan: number;
  totalInboundActual: number;
  inboundAttainment: number;   // %
  finalEndingStock: number;
  warningDays: number;
}

export interface ItemCalculationResult {
  days: CalculatedHubDay[];
  summary: {
    totalProdPlan: number;
    totalProdActual: number;
    prodAttainment: number; // %
    totalSalesPlan: number;
    totalSalesActual: number;
    salesAttainment: number; // %
    totalInboundPlan: number;
    totalInboundActual: number;
    inboundAttainment: number; // %
    finalFactoryStock: number;
    finalCenterStock: number;
    finalPipelineStock: number;
    totalShortageDays: number;
    imbalanceDays: number;
    centers?: Record<string, CenterCalculationSummary>;
    models: Record<string, ModelCalculationSummary>;

    // 하위 호환 요약 필드
    totalUlsanPlan?: number;
    totalUlsanActual?: number;
    ulsanAttainment?: number;
    totalGwangjuPlan?: number;
    totalGwangjuActual?: number;
    gwangjuAttainment?: number;
    finalUlsanStock?: number;
    finalGwangjuStock?: number;
    ulsanWarningDays?: number;
    gwangjuWarningDays?: number;
  };
}
