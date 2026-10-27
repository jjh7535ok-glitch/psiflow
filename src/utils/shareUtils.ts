import LZString from 'lz-string';
import { ProductItem, PsiDataStore } from '../types/psi';

export interface WorkspaceSnapshot {
  version: number;
  exportedAt: string;
  appName: string;
  products: ProductItem[];
  dataStore: PsiDataStore;
}

/**
 * 워크스페이스 전체 데이터 (품목 마스터 + PSI 일자별 계획/실적)를 JSON 파일로 내보내기
 */
export function exportWorkspaceToJson(products: ProductItem[], dataStore: PsiDataStore): string {
  const snapshot: WorkspaceSnapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'PSI Flow',
    products,
    dataStore,
  };
  return JSON.stringify(snapshot, null, 2);
}

/**
 * 업로드된 JSON 문자열을 검증하고 복원
 */
export function importWorkspaceFromJson(jsonStr: string): { products: ProductItem[]; dataStore: PsiDataStore } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.products) || typeof parsed.dataStore !== 'object') {
      throw new Error('유효한 PSI Flow 워크스페이스 형식이 아닙니다.');
    }
    return {
      products: parsed.products,
      dataStore: parsed.dataStore,
    };
  } catch (err: any) {
    throw new Error(`파일 파싱 실패: ${err.message || '올바른 JSON 파일이 아닙니다.'}`);
  }
}

/**
 * URL Hash 기반 초경량 압축 공유 링크 생성
 */
export function generateShareableUrl(products: ProductItem[], dataStore: PsiDataStore): string {
  const payload = {
    v: 1,
    p: products,
    d: dataStore,
    t: Date.now(),
  };
  const jsonStr = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(jsonStr);
  const base = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
  return `${base}#snapshot=${compressed}`;
}

/**
 * URL Hash에서 공유된 스냅샷 데이터 추출
 */
export function parseShareableUrl(): { products: ProductItem[]; dataStore: PsiDataStore; timestamp?: number } | null {
  try {
    const hash = window.location.hash;
    if (!hash || !hash.includes('#snapshot=')) return null;

    const compressed = hash.split('#snapshot=')[1];
    if (!compressed) return null;

    const jsonStr = LZString.decompressFromEncodedURIComponent(compressed);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.p) && typeof parsed.d === 'object') {
      return {
        products: parsed.p,
        dataStore: parsed.d,
        timestamp: parsed.t,
      };
    }
  } catch (e) {
    console.warn('URL 스냅샷 파싱 실패:', e);
  }
  return null;
}
