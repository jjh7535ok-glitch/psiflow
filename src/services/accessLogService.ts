import { AccessLogEntry } from '../types/accessLog';

const VIEWER_ID_KEY = 'psi_flow_viewer_anon_id';
const LOCAL_LOGS_BACKUP_KEY = 'psi_flow_access_logs_cache';

/**
 * 브라우저 및 기기 환경 감지 유틸리티
 */
function getDeviceInfo(): {
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
  screenResolution: string;
} {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'Desktop',
      browser: 'Unknown',
      os: 'Unknown',
      screenResolution: '',
    };
  }

  const ua = navigator.userAgent;
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop|android/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // OS 감지
  let os = '기타 OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // 브라우저 감지
  let browser = '기타 브라우저';
  if (/samsungbrowser/i.test(ua)) browser = '삼성 인터넷';
  else if (/whale/i.test(ua)) browser = '네이버 웨일';
  else if (/kakaotalk/i.test(ua)) browser = '카카오톡 인앱';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/edg/i.test(ua)) browser = 'Edge';

  const screenResolution = `${window.screen.width}x${window.screen.height}`;

  return { deviceType, browser, os, screenResolution };
}

/**
 * 익명 방문자 고유 ID 생성 또는 조회
 */
function getOrCreateViewerId(): string {
  try {
    let vid = localStorage.getItem(VIEWER_ID_KEY);
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(VIEWER_ID_KEY, vid);
    }
    return vid;
  } catch {
    return 'v_guest_' + Math.random().toString(36).slice(2, 8);
  }
}

/**
 * 열람자 모르게 백그라운드에서 조용히 열람 이력 기록
 * (어떠한 팝업, 알림, 지연도 발생시키지 않음)
 */
export async function recordAccessLogSilently(
  weekId: string,
  weekLabel: string,
  isOwner: boolean = false
): Promise<void> {
  try {
    const { deviceType, browser, os, screenResolution } = getDeviceInfo();
    const viewerId = getOrCreateViewerId();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formattedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const payload: Omit<AccessLogEntry, 'id'> = {
      timestamp: now.toISOString(),
      formattedTime,
      weekId,
      weekLabel,
      viewerId,
      deviceType,
      browser,
      os,
      screenResolution,
      userAgent: navigator.userAgent,
      isOwnerView: isOwner,
    };

    // 1. 서버 API로 백그라운드 무음 전송
    fetch('/api/access-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // 서버가 오프라인이거나 응답하지 않아도 열람자에게 에러를 띄우지 않음
    });

    // 2. 브라우저 로컬 캐시에도 백업 저장
    try {
      const cached = localStorage.getItem(LOCAL_LOGS_BACKUP_KEY);
      const list: AccessLogEntry[] = cached ? JSON.parse(cached) : [];
      list.unshift({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        ...payload,
      });
      localStorage.setItem(LOCAL_LOGS_BACKUP_KEY, JSON.stringify(list.slice(0, 100)));
    } catch {
      // ignore
    }
  } catch {
    // 완전 무음 보장
  }
}

/**
 * 소유자 전용: 서버에 축적된 열람 이력 목록 조회
 */
export async function fetchAccessLogs(): Promise<AccessLogEntry[]> {
  try {
    const res = await fetch('/api/access-logs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch access logs from server, falling back to local cache', err);
  }

  // 서버 응답 실패 시 로컬 캐시 폴백
  try {
    const cached = localStorage.getItem(LOCAL_LOGS_BACKUP_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

/**
 * 소유자 전용: 열람 이력 전체 초기화
 */
export async function clearAccessLogs(): Promise<void> {
  try {
    await fetch('/api/access-logs', { method: 'DELETE' });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LOCAL_LOGS_BACKUP_KEY);
  } catch {
    // ignore
  }
}
