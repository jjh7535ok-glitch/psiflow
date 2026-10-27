import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  Check,
  Copy,
  Globe,
  Lock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { ProductItem, PsiDataStore } from '../types/psi';
import { HubMasterItem, CustomerMasterItem, CategoryMasterItem } from '../types/masterData';
import { ProductionLine, ShiftScheduleRules } from '../types/lineCapa';
import { WeekInfo, getPublicShareUrl } from '../utils/weeklyUtils';
import {
  createRevisionSnapshot,
  fetchRevisionList,
  PublishedRevision,
} from '../services/workspaceSync';

interface PublishRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: WeekInfo;
  products: ProductItem[];
  dataStore: PsiDataStore;
  hubs: HubMasterItem[];
  customers: CustomerMasterItem[];
  categories: CategoryMasterItem[];
  lines: ProductionLine[];
  shiftRules: ShiftScheduleRules;
  ownerEmail: string;
  onPublishSuccess: (newRev: PublishedRevision) => void;
  onShowToast: (msg: string) => void;
}

export const PublishRevisionModal: React.FC<PublishRevisionModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  products,
  dataStore,
  hubs,
  customers,
  categories,
  lines,
  shiftRules,
  ownerEmail,
  onPublishSuccess,
  onShowToast,
}) => {
  const [versionNumber, setVersionNumber] = useState<number>(1);
  const [versionId, setVersionId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-calculate next revision number for current week
  useEffect(() => {
    if (!isOpen) {
      setPublishedUrl(null);
      setCopied(false);
      return;
    }

    async function determineNextVersion() {
      const existingList = await fetchRevisionList(currentWeek.weekId);
      const nextVer = existingList.length > 0
        ? Math.max(...existingList.map((r) => r.versionNumber || 1)) + 1
        : 1;

      const nextId = `${currentWeek.weekId}-v${nextVer}`;
      setVersionNumber(nextVer);
      setVersionId(nextId);
      setTitle(`${currentWeek.weekId} 생산·공급계획 공식 확정본 (${nextVer}차)`);
      setMemo('');
    }

    determineNextVersion();
  }, [isOpen, currentWeek.weekId]);

  if (!isOpen) return null;

  const handleExecutePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    setIsPublishing(true);
    try {
      const now = new Date().toISOString();
      const newRevision: PublishedRevision = {
        id: versionId,
        weekId: currentWeek.weekId,
        versionNumber,
        title: title.trim() || `${currentWeek.weekId} 공식 확정본 (v${versionNumber})`,
        memo: memo.trim() || '공식 주간 생산·공급계획 확정 배포',
        createdAt: now,
        createdBy: ownerEmail,
        products: JSON.parse(JSON.stringify(products)),
        dataStore: JSON.parse(JSON.stringify(dataStore)),
        hubs: JSON.parse(JSON.stringify(hubs)),
        customers: JSON.parse(JSON.stringify(customers)),
        categories: JSON.parse(JSON.stringify(categories)),
        lines: JSON.parse(JSON.stringify(lines)),
        shiftRules: JSON.parse(JSON.stringify(shiftRules)),
      };

      await createRevisionSnapshot(newRevision);

      const base = getPublicShareUrl();
      const finalUrl = `${base}?rev=${encodeURIComponent(versionId)}`;
      setPublishedUrl(finalUrl);
      onPublishSuccess(newRevision);
      onShowToast(`🎉 [${versionId}] 공식 배포본이 클라우드에 영구 박제되었습니다!`);
    } catch (err: any) {
      console.error('Failed to publish revision:', err);
      onShowToast('배포 저장 중 오류가 발생했습니다.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = () => {
    if (publishedUrl && navigator.clipboard) {
      navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      onShowToast('🔗 배포 링크가 복사되었습니다!');
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>공식 배포본 확정 발행 (Baseline Freeze)</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                기준 시점 박제: 이 버전으로 생성된 링크는 이후 수정에도 절대 변하지 않습니다
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700 overflow-y-auto max-h-[75vh]">
          {!publishedUrl ? (
            <form onSubmit={handleExecutePublish} className="space-y-4">
              {/* Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-relaxed">
                  <strong>시점 고정(Baseline) 안내:</strong> 배포를 완료하면 현재의 품목 마스터, 공장 생산계획, 거점별 입고/출고 계획이 <strong>[{versionId}]</strong>로 영구 보존됩니다. 1시간 뒤 대표님이 실시간 화면에서 숫자를 바꾸더라도, 이 링크를 열람하는 상대방은 지금 박제한 계획을 그대로 보게 됩니다.
                </div>
              </div>

              {/* Version & Week Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    배포 버전 식별자 (A안)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={versionId}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-mono text-xs font-bold text-blue-700 select-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    대상 주차
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={currentWeek.weekLabel}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  배포본 제목
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026년 W43차 공식 확정본 (1차)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Memo (Release Notes) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>주요 변경 내용 / 공지 사항</span>
                  <span className="text-[10px] text-blue-600 font-normal">
                    * 수신자가 링크 접속 시 팝업 안내창으로 표시됩니다
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="예: GV80 긴급 증산 오더(+500대) 반영 및 울산 출고센터 입고 일정 확정. 기아 EV9 배터리 모듈 공급 일정 동기화 완료."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPublishing ? '클라우드 박제 저장 중...' : '확정 배포 및 링크 발급'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Result Box after publishing */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-900 leading-relaxed">
                  <strong>[{versionId}] 공식 배포본이 발행되었습니다!</strong>
                  <br />
                  이 링크는 영구 불변(Frozen) 상태로 박제되었습니다. 상대방에게 아래 링크를 전달하시면 됩니다.
                </div>
              </div>

              {/* Published Link Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                  <span>발급된 고유 배포 링크</span>
                  <span className="font-mono text-blue-700 font-semibold">{versionId}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publishedUrl}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-800 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 shadow-xs cursor-pointer ${
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
                    onClick={() => window.open(publishedUrl, '_blank')}
                    title="새 창에서 열어보기"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shrink-0 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Notice Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>수신자 팝업 안내 내용</span>
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  "{memo || '공식 주간 생산·공급계획 확정 배포'}"
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
