/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HubMasterItem, CustomerMasterItem, CategoryMasterItem } from '../types/masterData';
import { ProductItem } from '../types/psi';

export const STORAGE_KEY_HUBS = 'psi_flow_master_hubs_v1';
export const STORAGE_KEY_CUSTOMERS = 'psi_flow_master_customers_v1';
export const STORAGE_KEY_CATEGORIES = 'psi_flow_master_categories_v1';

export const INITIAL_HUBS: HubMasterItem[] = [
  {
    id: 'hub-ulsan',
    name: '울산 출고센터',
    address: '울산광역시 북구 염포로 700 (현대차 울산공장 물류게이트)',
    contactName: '김철수 파트장',
    contactPhone: '052-280-2114',
    contactEmail: 'chulsoo.kim@hyundai-scm.com',
    memo: '현대차 1~5공장 직납 허브 (GV80, 팰리세이드 메인)',
  },
  {
    id: 'hub-gwangju',
    name: '광주 출고센터',
    address: '광주광역시 서구 내방로 240 (기아 광주공장 외곽물류센터)',
    contactName: '박성호 팀장',
    contactPhone: '062-370-1234',
    contactEmail: 'sh.park@kia-scm.com',
    memo: '기아 AutoLand 광주 납품 허브 (EV9, 스포티지)',
  },
  {
    id: 'hub-hwaseong',
    name: '화성 출고센터',
    address: '경기도 화성시 우정읍 기아자동차로 700',
    contactName: '이진우 과장',
    contactPhone: '031-359-2000',
    contactEmail: 'jinwoo.lee@kia-scm.com',
    memo: '기아 화성공장 하이브리드/전기차 라인 전용 (카니발, EV6)',
  },
  {
    id: 'hub-asan',
    name: '아산 출고센터',
    address: '충청남도 아산시 인주면 현대로 1077',
    contactName: '정대원 차장',
    contactPhone: '041-530-3114',
    contactEmail: 'dw.jung@hyundai-scm.com',
    memo: '현대차 아산공장 전용 (IONIQ 6, 쏘나타 납품)',
  },
  {
    id: 'hub-pyeongtaek',
    name: '평택 출고센터',
    address: '경기도 평택시 포승읍 평택항로 268',
    contactName: '송기선 대리',
    contactPhone: '031-680-4500',
    contactEmail: 'gs.song@logistics-hub.com',
    memo: '수도권 및 수출 물류 통합 PDI 센터',
  },
  {
    id: 'hub-changwon',
    name: '창원 출고센터',
    address: '경상남도 창원시 성산구 정동로 62',
    contactName: '최민기 반장',
    contactPhone: '055-280-5000',
    contactEmail: 'mk.choi@logistics-hub.com',
    memo: '남부권 영남권역 협력사 공동 출하센터',
  },
];

export const INITIAL_CUSTOMERS: CustomerMasterItem[] = [
  {
    id: 'cust-hmc',
    name: '현대자동차',
    address: '서울특별시 서초구 헌릉로 12 (양재동 본사)',
    contactName: '강동현 책임매니저',
    contactPhone: '02-3464-1114',
    contactEmail: 'dh.kang@hyundai.com',
    memo: '완성차 1차 조달 협력 및 울산/아산공장 구매팀',
  },
  {
    id: 'cust-kia',
    name: '기아',
    address: '서울특별시 서초구 헌릉로 12 (양재동 사옥)',
    contactName: '윤미경 파트장',
    contactPhone: '02-3464-5000',
    contactEmail: 'mk.yoon@kia.com',
    memo: '기아 AutoLand 구매/부품공급실',
  },
  {
    id: 'cust-genesis',
    name: '제네시스',
    address: '서울특별시 강남구 영동대로 410',
    contactName: '한상욱 수석연구원',
    contactPhone: '02-3464-7000',
    contactEmail: 'sw.han@genesis.com',
    memo: '럭셔리 브랜드 독립 조달 라인 (GV60, GV70, G80)',
  },
  {
    id: 'cust-kgm',
    name: 'KG모빌리티',
    address: '경기도 평택시 동삭로 455',
    contactName: '유병철 팀장',
    contactPhone: '031-610-1114',
    contactEmail: 'bc.yoo@kg-mobility.com',
    memo: '구 쌍용자동차, 평택공장 부품구매팀',
  },
  {
    id: 'cust-renault',
    name: '르노코리아',
    address: '부산광역시 강서구 르노삼성대로 61',
    contactName: '오세훈 차장',
    contactPhone: '051-970-1114',
    contactEmail: 'sh.oh@renaultkorea.com',
    memo: '부산공장 신차 프로젝트 구매본부',
  },
];

export const INITIAL_CATEGORIES: CategoryMasterItem[] = [
  {
    id: 'cat-01',
    name: '구동 전장',
    description: '모터제어기(MCU), 인버터 등 구동 제어 핵심 전장품군',
  },
  {
    id: 'cat-02',
    name: '배터리 시스템',
    description: 'BMS, 배터리 팩, 고전압 접합 박스 어셈블리',
  },
  {
    id: 'cat-03',
    name: '조향/샤시',
    description: '전자식 조향 액추에이터(MDPS), 스마트 서스펜션 제어기',
  },
  {
    id: 'cat-04',
    name: '전력 변환',
    description: 'SiC/IGBT 전력 모듈, 직류 변환기(LDC), 탑재형 충전기(OBC)',
  },
  {
    id: 'cat-05',
    name: '바디 전장',
    description: '바디 컨트롤 모듈(BCM), 스마트 정션 블록, 도어 래치 시스템',
  },
  {
    id: 'cat-06',
    name: '의장/내장',
    description: '시트 프레임 어셈블리, 콕핏 모듈, 센터페시아 컨트롤러',
  },
  {
    id: 'cat-07',
    name: '파워트레인',
    description: '엔진 매니지먼트 유닛, 변속기 밸브 바디 전장 모듈',
  },
  {
    id: 'cat-08',
    name: '센서 모듈',
    description: 'ADAS 전방 레이더, 라이다 모듈, 서라운드 뷰 카메라',
  },
  {
    id: 'cat-09',
    name: '하네스/와이어',
    description: '특수 고전압 오렌지 케이블, 차체 메인 와이어링 하네스',
  },
  {
    id: 'cat-10',
    name: '기타',
    description: '일반 기구물, 전장 하우징 케이스 및 체결 브라켓류',
  },
];

// Loaders & Savers
export function loadHubMasters(): HubMasterItem[] {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_HUBS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  return INITIAL_HUBS;
}

export function saveHubMasters(hubs: HubMasterItem[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_HUBS, JSON.stringify(hubs));
    }
  } catch {}
}

export function loadCustomerMasters(): CustomerMasterItem[] {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  return INITIAL_CUSTOMERS;
}

export function saveCustomerMasters(customers: CustomerMasterItem[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
    }
  } catch {}
}

export function loadCategoryMasters(): CategoryMasterItem[] {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  return INITIAL_CATEGORIES;
}

export function saveCategoryMasters(categories: CategoryMasterItem[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    }
  } catch {}
}

/**
 * 참조 무결성(Referential Integrity) 안전장치 검사 함수들:
 * 삭제하려는 기준정보 항목이 현재 등록된 부품에서 사용 중인지 확인하고 사용 중인 품목명 목록 반환
 */
export function checkHubUsage(hubName: string, products: ProductItem[]): string[] {
  const target = hubName.trim();
  const usingProducts: string[] = [];
  products.forEach((p) => {
    const isUsed = p.models.some((m) => (m.hubName || '').trim() === target);
    if (isUsed) {
      usingProducts.push(`[${p.code}] ${p.name}`);
    }
  });
  return usingProducts;
}

export function checkCustomerUsage(customerName: string, products: ProductItem[]): string[] {
  const target = customerName.trim();
  const usingProducts: string[] = [];
  products.forEach((p) => {
    const isUsed = p.models.some((m) => (m.customer || '').trim() === target);
    if (isUsed) {
      usingProducts.push(`[${p.code}] ${p.name}`);
    }
  });
  return usingProducts;
}

export function checkCategoryUsage(categoryName: string, products: ProductItem[]): string[] {
  const target = categoryName.trim();
  const usingProducts: string[] = [];
  products.forEach((p) => {
    if ((p.category || '').trim() === target) {
      usingProducts.push(`[${p.code}] ${p.name}`);
    }
  });
  return usingProducts;
}
