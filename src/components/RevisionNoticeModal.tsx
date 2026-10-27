import React, { useState } from 'react';
import {
  X,
  BellRing,
  Calendar,
  UserCheck,
  CheckCircle2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { PublishedRevision } from '../services/workspaceSync';

interface RevisionNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  revision: PublishedRevision;
}

export const RevisionNoticeModal: React.FC<RevisionNoticeModalProps> = ({
  isOpen,
  onClose,
  revision,
}) => {
  const [dontShowToday, setDontShowToday] = useState(false);

  if (!isOpen) return null;

  const handleConfirmClose = () => {
    if (dontShowToday) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        localStorage.setItem(`psi_hide_notice_${revision.id}_${todayStr}`, 'true');
      } catch {
        // ignore
      }
    }
    onClose();
  };

  const formattedDate = revision.createdAt
    ? new Date(revision.createdAt).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <BellRing className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>공식 배포본 확정 공지</span>
                <span className="font-mono text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-400/30">
                  {revision.id}
                </span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConfirmClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          {/* Main Title & Metadata */}
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {revision.title || `${revision.weekId} 공식 확정 계획`}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{formattedDate}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-emerald-600" />
                <span>배포자: {revision.createdBy}</span>
              </span>
            </div>
          </div>

          {/* Change Notes (Memo) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>주요 변경 내용 및 안내 사항</span>
            </label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
              {revision.memo || '공식 주간 생산·공급계획 확정 배포본입니다.'}
            </div>
          </div>

          {/* Frozen Baseline Notice */}
          <div className="p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-lg flex items-center gap-2 text-[11px] text-blue-900">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>본 화면은 배포 시점의 확정 수치로 고정(Frozen)된 안전한 읽기 전용 모드입니다.</span>
          </div>

          {/* Footer Controls: Today Don't Show + Close Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>오늘 하루 그만보기</span>
            </label>

            <button
              type="button"
              onClick={handleConfirmClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              확인 및 계획 열람
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
