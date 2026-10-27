export type SaturdayShiftMode = 'DAY_ONLY' | 'DAY_NIGHT'; // 주간(8h) vs 주/야간(18.5h)
export type CapaAllocationMode = 'FULL_CAPA' | 'DEMAND_MATCH'; // 가용 CAPA 100% 생산 vs 소요량 한도 생산

export interface ProductLineConfig {
  productId: string;
  productCode: string;
  productName: string;
  cycleTimeSec: number;     // C/T (초 단위, 예: 9.4초)
  operationRate: number;    // 가동률 (%, 예: 100%)
  targetUph: number;        // 유효 UPH (시간당 생산, 예: 384 EA/h)
  setupTimeMin: number;     // 기종교환시간 (분 단위, 예: 60분 = 1.0시간)
}

export interface ProductionLine {
  id: string;               // 라인 식별자 (예: "LINE-01")
  name: string;             // 라인명 (예: "제1공장 전장 복합 혼류라인")
  isMixedModel: boolean;    // 혼류 라인 여부 (true)
  baseDowntimeMin?: number; // (선택) 하위호환용
  productConfigs: ProductLineConfig[];
}

export interface ShiftScheduleRules {
  // 수요일 잔업 유무 (기본: false -> 18.5h(주간8h+야간10.5h), true -> 주간 2.5h 잔업 추가로 21.0h(주간10.5h+야간10.5h))
  wednesdayOvertime: boolean;
  
  // 토요일 특근 설정
  saturdayOperating: boolean;
  saturdayMode: SaturdayShiftMode; // 'DAY_ONLY' (8.0h) | 'DAY_NIGHT' (18.5h)

  // 일요일 특근 설정 (야간 없음, 주간 8.0h만)
  sundayOperating: boolean;

  // 하위호환용 선택 필드
  dailyDowntimeMin?: number;
  changeoverTimeMin?: number;
}

export interface CalculatedDayCapa {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  isToday: boolean;

  // 가동시간 산출 내역
  dayHours: number;
  nightHours: number;
  grossHours: number;        // 총 근무시간
  downtimeHours: number;     // 비가동시간 (기본 비가동 + 기종교환시간)
  netProductionHours: number;// 순 생산 가용시간
  changeoverCount: number;   // 당일 기종교환 횟수
  
  // 라인 전체 종합 CAPA
  lineTotalCapa: number;     // 순가용시간 * 기준 UPH
  totalDemand: number;       // 당일 전 품목 고객사 소요량 합계
  utilizationRate: number;   // 부하율 (%) = (소요량 / CAPA) * 100
  isOverCapacity: boolean;   // 부하율 100% 초과 여부

  // 품목별 산출 계획 수량 (productId -> 생산계획 수량)
  productPlans: Record<
    string,
    {
      productId: string;
      productName: string;
      demand: number;
      allocatedPlan: number;
      uph: number;
      requiredHours: number;
    }
  >;
}
