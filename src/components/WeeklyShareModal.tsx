import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Globe,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { ProductItem, PsiDataStore } from '../types/psi';
import { WeekInfo, getPublicShareUrl, SHARED_APP_URL } from '../utils/weeklyUtils';
import { exportToCsv, downloadFile } from '../utils/psiEngine';

interface WeeklyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: WeekInfo;
  products: ProductItem[];
  dateList: string[];
  dataStore: PsiDataStore;
  ownerEmail: string;
  isOwner: boolean;
  onShowToast: (msg: string) => void;
}

export const WeeklyShareModal: React.FC<WeeklyShareModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  products,
  dateList,
  dataStore,
  ownerEmail,
  isOwner,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Real public application URL (works everywhere, never gives AI Studio 404)
  const publicShareUrl = getPublicShareUrl();

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicShareUrl);
      setCopied(true);
      onShowToast('🔗 시스템 배포 링크가 클립보드에 복사되었습니다!');
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleOpenExternal = () => {
    if (typeof window !== 'undefined') {
      window.open(publicShareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadWeeklyCsv = () => {
    const csvData = exportToCsv(products, dateList, dataStore);
    downloadFile(csvData, `PSI_Flow_Report_${currentWeek.weekId}.csv`);
    onShowToast(`[${currentWeek.weekId}] 엑셀 CSV 파일이 다운로드되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>시스템 배포 링크 공유</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  실시간 연동
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                단일 고유 웹 주소로 언제나 최신 생산·판매·재고 계획 공유
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700 overflow-y-auto max-h-[75vh]">
          {/* Key Advantage Notice */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-blue-900 text-xs">
                주차별 링크 생성 없이, 이 링크 하나로 영구 공유됩니다
              </p>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                매주 복잡한 주차별 링크를 새로 만들 필요가 없습니다. 소유자가 PC나 노트북에서 수정한 최신 계획이 
                클라우드(Firestore)에 자동 반영되므로, <strong>다음 주에 거래처나 팀원이 이 링크로 접속하면 그 주차의 최신 계획이 자동으로 열립니다.</strong>
              </p>
            </div>
          </div>

          {/* Share URL Box */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>PSI Flow 공개 웹 링크 (바로 접속 가능)</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                AI Studio 404 오류 없음
              </span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicShareUrl}
                className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-800 select-all focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all shrink-0 shadow-xs cursor-pointer active:scale-95 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>복사 완료!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>링크 복사</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleOpenExternal}
                title="새 브라우저 탭에서 실제 화면 열어보기"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shrink-0 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * 카카오톡, 사내 메신저(슬랙, 잔디), 이메일, 주간 업무 보고에 이 단일 링크를 붙여넣으시면 됩니다.
            </p>
          </div>

          {/* Current Working Week Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-[11px] text-slate-600 font-medium">현재 시스템 기준 주차:</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                {currentWeek.weekId}
              </span>
              <span className="text-[11px] text-slate-500">({currentWeek.startDateStr} ~ {currentWeek.endDateStr})</span>
            </div>
            <div className="text-[11px] text-slate-500">
              등록 품목: <strong className="text-slate-800 font-mono">{products.length}</strong>개
            </div>
          </div>

          {/* Offline CSV Download Option */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600">오프라인 엑셀 보고서:</span>
              <button
                type="button"
                onClick={handleDownloadWeeklyCsv}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>[{currentWeek.weekId}] 엑셀(CSV) 다운로드</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
