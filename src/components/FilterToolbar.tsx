import React from 'react';
import {
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Filter,
  Car,
  Factory,
  Package,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { ProductItem } from '../types/psi';
import { ProductionLine } from '../types/lineCapa';

interface FilterToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  // 4 Core Filters (전체 품목, 생산라인, 전체 차종, 전체 거점)
  products: ProductItem[];
  selectedProductId: string;
  onProductIdChange: (id: string) => void;
  lines: ProductionLine[];
  selectedLine: string;
  onLineChange: (lineId: string) => void;
  vehicleModels: string[];
  selectedVehicleModel: string;
  onVehicleModelChange: (vm: string) => void;
  hubs: string[];
  selectedHub: string;
  onHubChange: (hub: string) => void;
  // Timeline Navigation (과거/미래 자유 이동)
  startDateStr: string;
  onStartDateChange: (date: string) => void;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  onJumpToday: () => void;
  daysRange: number;
  onDaysRangeChange: (days: number) => void;
  // View & Actions
  allExpanded: boolean;
  onToggleExpandAll: () => void;
  onOpenForwardFillModal: () => void;
  onOpenLineCapaModal?: () => void;
  isReadOnly?: boolean;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  products,
  selectedProductId,
  onProductIdChange,
  lines,
  selectedLine,
  onLineChange,
  vehicleModels,
  selectedVehicleModel,
  onVehicleModelChange,
  hubs,
  selectedHub,
  onHubChange,
  startDateStr,
  onStartDateChange,
  onPrevPeriod,
  onNextPeriod,
  onJumpToday,
  daysRange,
  onDaysRangeChange,
  allExpanded,
  onToggleExpandAll,
  onOpenForwardFillModal,
  onOpenLineCapaModal,
  isReadOnly = false,
}) => {
  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedProductId !== 'ALL' ||
    selectedLine !== 'ALL' ||
    selectedVehicleModel !== 'ALL' ||
    selectedHub !== 'ALL';

  const handleResetFilters = () => {
    onSearchChange('');
    onProductIdChange('ALL');
    onLineChange('ALL');
    onVehicleModelChange('ALL');
    onHubChange('ALL');
  };

  return (
    <div className="bg-white border-b border-slate-200 text-slate-700 text-xs shadow-2xs">
      {/* Top Filter Bar: 4 Core Filters (품목, 생산라인, 차종, 거점) & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. 품목 드롭다운 (전체 품목 / 특정 품목 선택 시 해당 품목만 드릴다운) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">품목:</span>
            <select
              value={selectedProductId}
              onChange={(e) => onProductIdChange(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer max-w-[150px] truncate"
              title="특정 품목을 선택하면 해당 품목만 화면에 집중 표시됩니다."
            >
              <option value="ALL">전체 품목 ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. 생산라인 드롭다운 (카테고리 대신 실무 생산라인 필터로 교체) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <Factory className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">생산라인:</span>
            <select
              value={selectedLine}
              onChange={(e) => onLineChange(e.target.value)}
              className="bg-transparent text-xs text-slate-900 font-bold focus:outline-none cursor-pointer max-w-[170px] truncate"
              title="생산라인별로 소속 품목 및 일일 CAPA를 집중 필터링합니다."
            >
              <option value="ALL">전체 생산라인 ({lines.length})</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  [{l.id}] {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. 차종 드롭다운 (전체 차종 / 특정 차종 선택 시 해당 차종만 드릴다운) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">차종:</span>
            <select
              value={selectedVehicleModel}
              onChange={(e) => onVehicleModelChange(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer"
              title="특정 차종을 선택하면 해당 차종의 소요 행만 드릴다운에 표시됩니다."
            >
              <option value="ALL">전체 차종 ({vehicleModels.length})</option>
              {vehicleModels.map((vm) => (
                <option key={vm} value={vm}>
                  {vm}
                </option>
              ))}
            </select>
          </div>

          {/* 4. 거점 드롭다운 (전체 거점 / 특정 출고센터 선택 시 해당 거점만 드릴다운) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">거점:</span>
            <select
              value={selectedHub}
              onChange={(e) => onHubChange(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer"
              title="특정 거점(출고센터)을 선택하면 해당 센터의 세부 수급 행만 표시됩니다."
            >
              <option value="ALL">전체 거점 ({hubs.length})</option>
              {hubs.map((hub) => (
                <option key={hub} value={hub}>
                  {hub}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="품목명, 코드, 차종 검색..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-2.5 py-1 w-44 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Reset Filters Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              title="모든 필터를 기본값으로 초기화"
              className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded text-[11px] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>초기화</span>
            </button>
          )}
        </div>

        {/* View Mode & Quick Actions on Right */}
        <div className="flex items-center gap-2">
          {/* Expand / Collapse All */}
          <button
            type="button"
            onClick={onToggleExpandAll}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded border border-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            {allExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>전체 접기</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>전체 펼치기</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Timeline & Planner Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2 bg-slate-50/50">
        {/* Timeline Navigator: 과거/미래 자유 이동 & 직접 일자 선택 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={onPrevPeriod}
              title={`이전 ${daysRange === 7 ? '7일' : '14일'} 이동 (과거 데이터 조회)`}
              className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>이전</span>
            </button>

            <button
              type="button"
              onClick={onJumpToday}
              title="오늘 기준으로 즉시 이동 (D-2 ~ 향후 계획 윈도우)"
              className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
            >
              오늘
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              title={`다음 ${daysRange === 7 ? '7일' : '14일'} 이동 (미래 일정 조회)`}
              className="flex items-center gap-0.5 px-2 py-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>다음</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2.5 py-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-500">시작일:</span>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
              title="조회할 시작 일자를 직접 선택하여 과거 또는 미래로 이동할 수 있습니다."
            />
          </div>

          {/* Days Range Selector (7일, 14일, 30일) */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-200/60 rounded border border-slate-300">
            {[
              { label: '7일', days: 7 },
              { label: '14일', days: 14 },
              { label: '30일', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={days}
                type="button"
                onClick={() => onDaysRangeChange(days)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  daysRange === days
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Action Tools: Plan Generation, Line CAPA */}
        {!isReadOnly && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Forward Fill Quick Action Button */}
            <button
              type="button"
              onClick={onOpenForwardFillModal}
              title="공장 생산계획 및 센터 소요량 오늘 이후 일괄 전개"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>일괄 계획 전개</span>
            </button>

            {/* Line CAPA Scheduler Modal Button */}
            {onOpenLineCapaModal && (
              <button
                type="button"
                onClick={onOpenLineCapaModal}
                title="공장 생산라인 C/T, 가동률, 교대근무 기반 CAPA 계산 및 생산계획 자동 산출"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Factory className="w-3.5 h-3.5 text-blue-600" />
                <span>라인 CAPA 스케줄러</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
