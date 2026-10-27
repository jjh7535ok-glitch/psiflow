import React, { useState } from 'react';
import {
  Download,
  Upload,
  Plus,
  RotateCcw,
  TableProperties,
  BarChart3,
  Package,
  Share2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Lock,
  Eye,
  Cloud,
  CloudUpload,
  RefreshCw,
  Check,
  Loader2,
  ChevronDown,
  Sparkles,
  Send,
  FileText,
  History,
  MoreHorizontal,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { WeekInfo } from '../utils/weeklyUtils';
import { PublishedRevision, RevisionSummary } from '../services/workspaceSync';

interface TopBarProps {
  currentTab: 'matrix' | 'analytics' | 'products';
  onTabChange: (tab: 'matrix' | 'analytics' | 'products') => void;
  currentWeek: WeekInfo;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectWeek: (week: WeekInfo) => void;
  availableWeeks: WeekInfo[];
  isOwner: boolean;
  currentUserEmail: string | null;
  onLoginOwner?: () => void;
  onLogoutOwner?: () => void;
  onOpenWeeklyShareModal?: () => void;
  onOpenAccessLogModal?: () => void;
  onOpenNewProductModal: () => void;
  onResetDemoData: () => void;
  syncStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedTime?: string | null;
  onManualSave?: () => void;
  onReloadRemote?: () => void;
  activeRevision?: PublishedRevision | null;
  revisionList?: RevisionSummary[];
  onSelectRevision?: (revId: string | null) => void;
  onOpenPublishModal?: () => void;
  onQuickPublishSnapshot?: () => void;
  onOpenNoticeModal?: () => void;
  onExportExcel?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onTabChange,
  currentWeek,
  onPrevWeek,
  onNextWeek,
  onSelectWeek,
  availableWeeks,
  isOwner,
  currentUserEmail,
  onLoginOwner,
  onLogoutOwner,
  onOpenWeeklyShareModal,
  onOpenAccessLogModal,
  onOpenNewProductModal,
  onResetDemoData,
  syncStatus = 'idle',
  lastSavedTime,
  onManualSave,
  onReloadRemote,
  activeRevision = null,
  revisionList = [],
  onSelectRevision,
  onOpenPublishModal,
  onQuickPublishSnapshot,
  onOpenNoticeModal,
  onExportExcel,
}) => {
  const [showWeekDropdown, setShowWeekDropdown] = useState(false);
  const [showRevDropdown, setShowRevDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const closeAllDropdowns = () => {
    setShowWeekDropdown(false);
    setShowRevDropdown(false);
    setShowMoreMenu(false);
  };

  return (
    <>
      {/* Invisible backdrop to dismiss any open dropdown when clicking outside */}
      {(showWeekDropdown || showRevDropdown || showMoreMenu) && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={closeAllDropdowns}
        />
      )}

      <header className="relative z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-white shrink-0 w-full min-w-0">
        {/* Zone 1: Wordmark, Week Navigator & Revision Baseline Selector */}
        <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white tracking-wider text-xs shadow-xs">
            PSI
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
              PSI Flow
            </span>
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
              다거점 공급망 관리
            </span>
          </div>
        </div>

        {/* Weekly Navigator Selector */}
        <div className="relative flex items-center bg-slate-800/90 rounded-md border border-slate-700/80 p-0.5">
          <button
            type="button"
            onClick={onPrevWeek}
            title="이전 주차"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowWeekDropdown(!showWeekDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-[11px]">{currentWeek.weekId}</span>
            <span className="hidden lg:inline text-[11px] text-slate-400 font-normal">
              ({currentWeek.startDateStr.slice(5).replace('-', '/')}~{currentWeek.endDateStr.slice(5).replace('-', '/')})
            </span>
          </button>

          <button
            type="button"
            onClick={onNextWeek}
            title="다음 주차"
            className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Week Dropdown */}
          {showWeekDropdown && (
            <div className="absolute top-full left-0 mt-1 z-[100] w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 text-xs text-slate-200">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-700 uppercase tracking-wider">
                주차별 계획 선택
              </div>
              <div className="max-h-56 overflow-y-auto">
                {availableWeeks.map((w) => (
                  <button
                    key={w.weekId}
                    type="button"
                    onClick={() => {
                      onSelectWeek(w);
                      setShowWeekDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/70 transition-colors ${
                      w.weekId === currentWeek.weekId
                        ? 'bg-blue-600/30 text-blue-300 font-semibold'
                        : ''
                    }`}
                  >
                    <span className="font-mono">{w.weekId}</span>
                    <span className="text-[11px] text-slate-400">{w.weekLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Revision / Baseline Selector Dropdown (1안) */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setShowRevDropdown(!showRevDropdown)}
            title="실시간 작업본과 과거 공식 배포본(v1, v2...) 간의 시점을 전환합니다"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer shadow-xs ${
              activeRevision
                ? 'bg-amber-950/90 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                : 'bg-slate-800/90 border-slate-700/80 text-emerald-300 hover:text-white'
            }`}
          >
            {activeRevision ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono text-[11px] font-bold">{activeRevision.id}</span>
                <span className="text-[10px] bg-amber-900/80 text-amber-200 px-1.5 py-0.2 rounded font-medium">
                  박제본 열람
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-medium">실시간 작업본</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded font-medium border border-emerald-800">
                  편집중
                </span>
              </>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Revision Dropdown Menu */}
          {showRevDropdown && (
            <div className="absolute top-full left-0 mt-1 z-[100] w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-xs text-slate-200 animate-in fade-in">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>계획 시점 및 배포본 전환</span>
                <span className="text-[9px] font-normal text-slate-400">Baseline Control</span>
              </div>

              {/* Option 1: Live Working Draft */}
              <button
                type="button"
                onClick={() => {
                  if (onSelectRevision) onSelectRevision(null);
                  setShowRevDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-slate-700/70 transition-colors border-b border-slate-700/50 cursor-pointer ${
                  !activeRevision ? 'bg-blue-600/20 text-white font-semibold' : ''
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">⚡ 실시간 작업본</span>
                    <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-1 rounded">수정 가능</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    현재 소유자가 자유롭게 숫자를 시뮬레이션·편집하는 라이브 작업 공간
                  </p>
                </div>
              </button>

              {/* Published Revisions List */}
              <div className="max-h-56 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] text-slate-400 font-semibold bg-slate-850">
                  발행된 공식 확정본 ({revisionList.length}건)
                </div>
                {revisionList.length === 0 ? (
                  <div className="px-3 py-2.5 text-center text-[11px] text-slate-500">
                    아직 공식 배포된 확정본이 없습니다.
                  </div>
                ) : (
                  revisionList.map((rev) => (
                    <button
                      key={rev.id}
                      type="button"
                      onClick={() => {
                        if (onSelectRevision) onSelectRevision(rev.id);
                        setShowRevDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-slate-700/70 transition-colors cursor-pointer ${
                        activeRevision?.id === rev.id ? 'bg-amber-600/30 text-amber-200 font-semibold' : ''
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-amber-300 text-[11px]">{rev.id}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {rev.createdAt.slice(5, 16).replace('T', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 truncate mt-0.5">{rev.title}</p>
                        {rev.memo && (
                          <p className="text-[10px] text-slate-400 truncate italic mt-0.2">
                            "{rev.memo}"
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Navigation Links / Segmented Tabs or Clean Title */}
      {!activeRevision ? (
        <nav className="flex items-center gap-1 p-1 bg-slate-800/90 rounded-lg border border-slate-700/60 shrink-0">
          <button
            type="button"
            onClick={() => onTabChange('matrix')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'matrix'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>매트릭스 그리드</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>추이 분석 차트</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('products')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'products'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>기준정보 마스터</span>
          </button>
        </nav>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs font-medium text-slate-300 shadow-inner">
          <span className="font-bold text-white flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>14일 PSI 공급망 실행계획 공식 배포본</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            | {activeRevision.memo || '링크 발급 시점 영구 불변 고정'}
          </span>
        </div>
      )}

      {/* Zone 3: Primary Actions, Excel Export, Print & Governance */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Direct Excel (.xlsx) Download Button */}
        {onExportExcel && (
          <button
            type="button"
            onClick={onExportExcel}
            title="14일 생산/출하/재고 계획을 완벽한 서식의 실무용 Excel(.xlsx) 파일로 다운로드합니다"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md shadow-xs transition-all whitespace-nowrap cursor-pointer active:scale-95 border border-emerald-500/60"
          >
            <Download className="w-3.5 h-3.5 text-emerald-100" />
            <span>Excel 다운로드 (.xlsx)</span>
          </button>
        )}

        {/* Print / PDF Button (A3/A4 Landscape Meeting Report) */}
        <button
          type="button"
          onClick={() => window.print()}
          title="A3/A4 가로 회의용 인쇄 또는 PDF 파일로 저장"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">인쇄/PDF</span>
        </button>

        {/* If Active Revision Mode (Frozen Baseline View) */}
        {activeRevision ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-950/90 border border-amber-500/80 rounded whitespace-nowrap shadow-xs">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>[{activeRevision.id}] 확정본 열람 중 (읽기 전용)</span>
            </div>

            {onOpenNoticeModal && (
              <button
                type="button"
                onClick={onOpenNoticeModal}
                title="배포 시 작성된 변경 내용 및 안내 사항 팝업을 다시 엽니다"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>공지 내용</span>
              </button>
            )}

            {isOwner && onSelectRevision && (
              <button
                type="button"
                onClick={() => onSelectRevision(null)}
                title="상대방 배포본 열람을 종료하고 내 실시간 편집 공간으로 복귀합니다"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded shadow-xs transition-colors whitespace-nowrap cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>작업본 복귀</span>
              </button>
            )}
          </div>
        ) : (
          /* Live Editor Mode */
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-200 bg-slate-800/90 border border-slate-700 rounded whitespace-nowrap shadow-xs"
              title={`로그인 계정: ${currentUserEmail || 'jjh7535ok@gmail.com'} (소유자 권한)`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-white">jjh7535ok</span>
              <span className="text-[9px] bg-emerald-900/60 text-emerald-300 px-1 py-0.2 rounded font-medium border border-emerald-700/50">
                소유자
              </span>
            </div>

            {/* Cloud & Local Real-time Sync Status Indicator */}
            {syncStatus === 'saving' && (
              <button
                type="button"
                onClick={onManualSave}
                title="Firestore 클라우드 및 백엔드 서버에 변경 사항을 동기화하고 있습니다"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-200 bg-sky-950/90 border border-sky-500/70 px-2.5 py-1 rounded-md shadow-xs animate-pulse cursor-wait"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                <span className="font-mono">클라우드 저장 중...</span>
              </button>
            )}
            {syncStatus === 'saved' && (
              <button
                type="button"
                onClick={onManualSave}
                title={`클라우드 Firestore 원격 DB와 로컬 캐시에 안전하게 저장 완료되었습니다.\n마지막 저장: ${lastSavedTime || '방금 전'}\n(클릭 시 즉시 수동 재동기화)`}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-600/70 px-2.5 py-1 rounded-md shadow-xs transition-colors hover:bg-emerald-900/90 cursor-pointer active:scale-95"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden lg:inline text-emerald-200">클라우드·로컬 동기화 완료</span>
                <span className="lg:hidden text-emerald-200">동기화 완료</span>
                {lastSavedTime && (
                  <span className="text-[10px] text-emerald-400/80 font-mono hidden xl:inline">
                    ({lastSavedTime})
                  </span>
                )}
              </button>
            )}
            {syncStatus === 'error' && (
              <button
                type="button"
                onClick={onManualSave}
                title="원격 저장 통신이 지연되었습니다. 로컬 캐시에는 안전하게 보관되어 있습니다. (클릭하여 재시도)"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-950/90 border border-amber-600/80 px-2.5 py-1 rounded-md shadow-xs transition-colors hover:bg-amber-900 cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>로컬 보관 (재시도)</span>
              </button>
            )}

            {/* Instant 1-Click Snapshot Share Link (핵심: 링크 복사 시점 계획으로 영구 고정) */}
            {onQuickPublishSnapshot && isOwner && (
              <button
                type="button"
                onClick={onQuickPublishSnapshot}
                title="⚡ 현재 시점의 계획을 불변 스냅샷으로 즉시 동결하고, 다른 사람에게 공유할 고유 고정 링크를 클립보드에 복사합니다"
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-md shadow-xs transition-all whitespace-nowrap cursor-pointer active:scale-95 ring-1 ring-blue-400/50"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-200" />
                <span>시점 고정 배포 (링크 복사)</span>
              </button>
            )}
          </div>
        )}

        {/* Management Tools Dropdown (품목 등록, 열람 이력, 최신 동기화, 초기화) - Only in live editor */}
        {!activeRevision && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="관리 도구 (품목 등록, 열람 이력, 최신 새로고침, 초기화)"
              className={`p-1 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors cursor-pointer ${
                showMoreMenu ? 'bg-slate-700 text-white' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 text-xs text-slate-200 z-[100] animate-in fade-in slide-in-from-top-1 duration-150"
                onClick={() => setShowMoreMenu(false)}
              >
                {isOwner && (
                  <button
                    type="button"
                    onClick={onOpenNewProductModal}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/80 transition-colors text-blue-300 cursor-pointer font-medium border-b border-slate-700/60"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>신규 품목 등록</span>
                  </button>
                )}

                {isOwner && onOpenAccessLogModal && (
                  <button
                    type="button"
                    onClick={onOpenAccessLogModal}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/80 transition-colors text-emerald-300 cursor-pointer border-b border-slate-700/60"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>열람 이력 확인</span>
                  </button>
                )}

                {onReloadRemote && (
                  <button
                    type="button"
                    onClick={onReloadRemote}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/80 transition-colors text-slate-300 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>클라우드 최신 동기화</span>
                  </button>
                )}

                {isOwner && (
                  <button
                    type="button"
                    onClick={onResetDemoData}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-rose-950/40 text-rose-300 transition-colors cursor-pointer border-t border-slate-700/60 mt-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>초기 샘플 데이터 복원</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
    </>
  );
};
