import React, { useState, useEffect, useMemo } from 'react';
import { AccessLogEntry } from '../types/accessLog';
import { fetchAccessLogs, clearAccessLogs } from '../services/accessLogService';
import {
  X,
  Eye,
  Clock,
  Laptop,
  Smartphone,
  Tablet,
  RotateCcw,
  Trash2,
  Download,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface AccessLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

export const AccessLogModal: React.FC<AccessLogModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('ALL');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAccessLogs();
      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Unique weeks in logs
  const availableWeeks = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.weekId && l.weekId !== '미지정') set.add(l.weekId);
    });
    return Array.from(set).sort().reverse();
  }, [logs]);

  // Filtered logs (exclude owner's own visits by default or show badge)
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (selectedWeekFilter !== 'ALL' && l.weekId !== selectedWeekFilter) return false;
      return true;
    });
  }, [logs, selectedWeekFilter]);

  const uniqueViewers = useMemo(() => {
    return new Set(filteredLogs.map((l) => l.viewerId || l.ip)).size;
  }, [filteredLogs]);

  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState<boolean>(false);

  const handleClear = async () => {
    setIsConfirmClearOpen(false);
    await clearAccessLogs();
    setLogs([]);
    if (onShowToast) onShowToast('열람 이력이 안전하게 초기화되었습니다.');
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['열람일시', '열람주차', '주차라벨', '기기형태', '운영체제(OS)', '브라우저', 'IP주소', '화면해상도', '방문자식별자'];
    const rows = filteredLogs.map((l) => [
      l.formattedTime || l.timestamp,
      l.weekId,
      l.weekLabel,
      l.deviceType,
      l.os,
      l.browser,
      l.ip || '-',
      l.screenResolution || '-',
      l.viewerId,
    ]);

    const csvContent =
      '\uFEFF' + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PSI_링크_열람이력_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (onShowToast) onShowToast('열람 이력 CSV 파일이 다운로드되었습니다.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  배포 링크 열람 이력 모니터링
                </h2>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 소유자 단독 확인
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                열람자에게는 알리지 않고 백그라운드에서 자동 수집된 주차별 링크 접속 로그입니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-600">주차 필터:</span>
            <select
              value={selectedWeekFilter}
              onChange={(e) => setSelectedWeekFilter(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">전체 주차 열람 이력 ({logs.length}건)</option>
              {availableWeeks.map((w) => (
                <option key={w} value={w}>
                  {w}차 열람 내역
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 transition-colors cursor-pointer"
              title="최신 열람 이력 새로고침"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>새로고침</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              title="CSV 파일로 다운로드"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV 다운로드</span>
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded border border-rose-200 transition-colors cursor-pointer ml-1"
                title="모든 로그 비우기"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>이력 초기화</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 grid grid-cols-3 gap-4 text-xs shrink-0">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 block">총 누적 열람수</span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {filteredLogs.length}{' '}
              <span className="text-xs font-normal text-slate-500">회</span>
            </span>
          </div>
          <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200">
            <span className="text-[11px] text-blue-700 block">순 열람자 수 (식별 기준)</span>
            <span className="text-xl font-bold font-mono text-blue-900">
              {uniqueViewers}{' '}
              <span className="text-xs font-normal text-blue-600">명/기기</span>
            </span>
          </div>
          <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
            <span className="text-[11px] text-emerald-700 block">최근 열람 시각</span>
            <span className="text-sm font-bold font-mono text-emerald-950 block mt-1">
              {filteredLogs[0]?.formattedTime || '열람 이력 없음'}
            </span>
          </div>
        </div>

        {/* Log Table Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Eye className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">아직 수집된 링크 열람 이력이 없습니다.</p>
              <p className="text-[11px] text-slate-400">
                주차별 공유 링크를 발행하여 배포하면, 상대방이 링크를 열었을 때 자동으로 이곳에 기록됩니다.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">열람 일시</th>
                    <th className="py-2.5 px-3">열람 주차</th>
                    <th className="py-2.5 px-3">기기 / 브라우저</th>
                    <th className="py-2.5 px-3">네트워크 (IP)</th>
                    <th className="py-2.5 px-3">해상도</th>
                    <th className="py-2.5 px-3 text-center">유형</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 text-slate-900 font-semibold font-sans flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{entry.formattedTime || entry.timestamp.slice(0, 19).replace('T', ' ')}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                          {entry.weekId}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-sans">
                          {entry.weekLabel.split('(')[1]?.replace(')', '') || ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          {entry.deviceType === 'Mobile' ? (
                            <Smartphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : entry.deviceType === 'Tablet' ? (
                            <Tablet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : (
                            <Laptop className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <span>{entry.os} · {entry.browser}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {entry.ip || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {entry.screenResolution || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {entry.isOwnerView ? (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            소유자 본인
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            외부 열람
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            * 열람자의 화면에는 어떠한 추적 창이나 알림도 노출되지 않으며, 오직 소유자 화면에서만 확인 가능합니다.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>

      {/* In-app Clear Confirmation Dialog (replaces blocked window.confirm) */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">열람 이력 전체 초기화</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              지금까지 기록된 모든 외부 열람자의 방문 로그({logs.length}건)를 완전히 삭제하시겠습니까?<br />
              <span className="text-slate-400 text-[11px]">(삭제된 이력은 복구되지 않습니다.)</span>
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                초기화 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
