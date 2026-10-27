export interface AccessLogEntry {
  id: string;
  timestamp: string;          // ISO string
  formattedTime: string;      // YYYY-MM-DD HH:mm:ss
  weekId: string;             // e.g. "2026-W43"
  weekLabel: string;          // e.g. "2026년 W43차 (10/19 ~ 10/25)"
  viewerId: string;           // persistent random identifier per browser
  ip?: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;            // Chrome, Safari, etc.
  os: string;                 // Windows, macOS, Android, iOS, etc.
  screenResolution: string;   // e.g. "1920x1080"
  userAgent: string;
  isOwnerView: boolean;       // false if viewed by other recipients
}
