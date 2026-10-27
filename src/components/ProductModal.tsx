import React, { useState, useEffect } from 'react';
import { ProductItem, VehicleModelConfig } from '../types/psi';
import { HubMasterItem, CustomerMasterItem, CategoryMasterItem } from '../types/masterData';
import { INITIAL_HUBS, INITIAL_CUSTOMERS, INITIAL_CATEGORIES } from '../utils/masterDataEngine';
import { X, Check, Car, Box, Boxes, Package, Plus, Trash2, Layers, HelpCircle } from 'lucide-react';
import { ensureProductModels } from '../utils/psiEngine';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ProductItem) => void;
  productToEdit?: ProductItem | null;
  hubs?: HubMasterItem[];
  customers?: CustomerMasterItem[];
  categories?: CategoryMasterItem[];
}

const COLOR_OPTIONS = [
  { id: 'blue', label: '블루', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'emerald', label: '에메랄드', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'indigo', label: '인디고', class: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { id: 'purple', label: '퍼플', class: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'amber', label: '앰버', class: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'rose', label: '로즈', class: 'bg-rose-100 text-rose-800 border-rose-300' },
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  hubs = INITIAL_HUBS,
  customers = INITIAL_CUSTOMERS,
  categories = INITIAL_CATEGORIES,
}) => {
  const availableHubs = hubs && hubs.length > 0 ? hubs : INITIAL_HUBS;
  const availableCustomers = customers && customers.length > 0 ? customers : INITIAL_CUSTOMERS;
  const availableCategories = categories && categories.length > 0 ? categories : INITIAL_CATEGORIES;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('구동 전장');
  const [unit, setUnit] = useState('EA');
  const [boxQty, setBoxQty] = useState<number>(40);
  const [boxesPerPallet, setBoxesPerPallet] = useState<number>(80);
  const [palletQty, setPalletQty] = useState<number>(3200);

  // 공장 재고
  const [factoryStock, setFactoryStock] = useState<number>(16000);
  const [factorySafety, setFactorySafety] = useState<number>(4000);

  // 차종별 공급망 흐름 목록
  const [models, setModels] = useState<VehicleModelConfig[]>([]);

  // 출고센터(거점)별 실물 통합 재고 설정 (hubName -> { initialStock, safetyStock, safetyDays })
  const [hubStockMap, setHubStockMap] = useState<
    Record<string, { initialStock: number; safetyStock: number; safetyDays: number }>
  >({});

  useEffect(() => {
    if (productToEdit) {
      const sanitized = ensureProductModels(productToEdit);
      setCode(sanitized.code);
      setName(sanitized.name);
      setCategory(sanitized.category || '구동 전장');
      setUnit(sanitized.unit || 'EA');

      const bQty = Math.max(1, Number(sanitized.boxQty) || 40);
      let pQty = Math.max(1, Number(sanitized.palletQty) || 3200);
      if (pQty > 1000000 && bQty === 40) pQty = 3200;

      setBoxQty(bQty);
      setPalletQty(pQty);
      setBoxesPerPallet(Math.max(1, Math.round(pQty / bQty)));

      setFactoryStock(sanitized.factoryInitialStock);
      setFactorySafety(sanitized.factorySafetyStock || 2000);
      setModels(sanitized.models.map((m) => ({ ...m })));

      const hubMap: Record<string, { initialStock: number; safetyStock: number; safetyDays: number }> = {};
      sanitized.models.forEach((m) => {
        const hub = m.hubName?.trim() || '울산 출고센터';
        if (!hubMap[hub]) {
          hubMap[hub] = {
            initialStock: 0,
            safetyStock: 0,
            safetyDays: m.safetyDays || 5,
          };
        }
        hubMap[hub].initialStock += Number(m.initialStock) || 0;
        hubMap[hub].safetyStock += Number(m.safetyStock) || 0;
      });
      setHubStockMap(hubMap);
    } else {
      setCode('');
      setName('');
      setCategory('구동 전장');
      setUnit('EA');
      setBoxQty(40);
      setBoxesPerPallet(80);
      setPalletQty(3200);
      setFactoryStock(16000);
      setFactorySafety(4000);
      setModels([
        {
          id: `vm-${Date.now()}-1`,
          name: 'GV80',
          customer: '현대자동차',
          hubName: '울산 출고센터',
          initialStock: 5000,
          safetyStock: 2500,
          safetyDays: 5,
          badgeColor: 'blue',
        },
        {
          id: `vm-${Date.now()}-2`,
          name: 'EV9',
          customer: '기아',
          hubName: '광주 출고센터',
          initialStock: 2000,
          safetyStock: 1000,
          safetyDays: 5,
          badgeColor: 'emerald',
        },
        {
          id: `vm-${Date.now()}-3`,
          name: '팰리세이드',
          customer: '현대자동차',
          hubName: '울산 출고센터',
          initialStock: 0,
          safetyStock: 0,
          safetyDays: 5,
          badgeColor: 'indigo',
        },
      ]);
      setHubStockMap({
        '울산 출고센터': { initialStock: 5000, safetyStock: 2500, safetyDays: 5 },
        '광주 출고센터': { initialStock: 2000, safetyStock: 1000, safetyDays: 5 },
      });
    }
  }, [productToEdit, isOpen]);

  const handleBoxQtyChange = (val: number) => {
    const safeBox = Math.max(1, val || 1);
    setBoxQty(safeBox);
    setPalletQty(safeBox * boxesPerPallet);
  };

  const handleBoxesPerPalletChange = (val: number) => {
    const safeBoxes = Math.max(1, val || 1);
    setBoxesPerPallet(safeBoxes);
    setPalletQty(boxQty * safeBoxes);
  };

  const handlePalletQtyChange = (val: number) => {
    const safePallet = Math.max(1, val || 1);
    setPalletQty(safePallet);
    if (boxQty > 0) {
      setBoxesPerPallet(Math.max(1, Math.round(safePallet / boxQty)));
    }
  };

  // 차종 추가
  const handleAddModel = () => {
    const newIdx = models.length + 1;
    const defaultColor = COLOR_OPTIONS[(newIdx - 1) % COLOR_OPTIONS.length].id;
    setModels([
      ...models,
      {
        id: `vm-${Date.now()}-${newIdx}`,
        name: `신규 차종 ${newIdx}`,
        customer: '현대자동차',
        hubName: '울산 출고센터',
        initialStock: 0,
        safetyStock: 0,
        safetyDays: 5,
        badgeColor: defaultColor,
      },
    ]);
  };

  // 차종 필드 업데이트
  const handleModelFieldChange = (
    index: number,
    field: keyof VehicleModelConfig,
    value: any
  ) => {
    setModels((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  // 차종 삭제
  const handleDeleteModel = (index: number) => {
    if (models.length <= 1) {
      alert('최소 1개 이상의 차종 공급망 흐름이 필요합니다.');
      return;
    }
    setModels((prev) => prev.filter((_, i) => i !== index));
  };

  // 추출된 고유 출고센터(거점) 목록
  const uniqueHubs = Array.from(
    new Set(models.map((m) => m.hubName?.trim() || '울산 출고센터'))
  );

  const getHubStock = (hub: string) => {
    return hubStockMap[hub] || { initialStock: 5000, safetyStock: 2500, safetyDays: 5 };
  };

  const updateHubStock = (
    hub: string,
    field: 'initialStock' | 'safetyStock' | 'safetyDays',
    value: number
  ) => {
    setHubStockMap((prev) => ({
      ...prev,
      [hub]: {
        ...(prev[hub] || { initialStock: 5000, safetyStock: 2500, safetyDays: 5 }),
        [field]: value,
      },
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert('품목코드와 품목명을 입력해 주세요.');
      return;
    }

    if (models.length === 0) {
      alert('최소 1개 이상의 차종을 등록해 주세요.');
      return;
    }

    const cleanUnit = unit.trim() && !/^\d+$/.test(unit.trim()) ? unit.trim() : 'EA';

    const newProduct: ProductItem = {
      id: productToEdit ? productToEdit.id : `prod-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      category: category.trim() || '구동 전장',
      unit: cleanUnit,
      boxQty,
      palletQty,
      factoryInitialStock: Math.max(0, factoryStock),
      factorySafetyStock: Math.max(0, factorySafety),
      models: models.map((m, idx) => {
        const hub = m.hubName.trim() || '울산 출고센터';
        const hubConfig = getHubStock(hub);
        const isFirstForHub =
          models.findIndex((item) => (item.hubName.trim() || '울산 출고센터') === hub) === idx;
        return {
          ...m,
          id: m.id || `vm-${idx}-${Date.now()}`,
          name: m.name.trim() || `차종 ${idx + 1}`,
          customer: m.customer.trim() || '현대자동차',
          hubName: hub,
          initialStock: isFirstForHub ? Math.max(0, Number(hubConfig.initialStock) || 0) : 0,
          safetyStock: isFirstForHub ? Math.max(0, Number(hubConfig.safetyStock) || 0) : 0,
          safetyDays: hubConfig.safetyDays || 5,
          badgeColor: m.badgeColor || 'blue',
        };
      }),
    };

    onSave(newProduct);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {productToEdit ? '품목 및 고객사 차종·출고센터 공급망 설정' : '신규 품목 및 공급망 흐름 등록'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                공장 단일 생산에서 고객사별 차종 및 지정 출고센터로 연계되는 다거점 공급망 흐름을 설정합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Basic Product Information */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>1. 공장 생산 품목 기본 마스터 정보</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  사내 품목코드 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: EV-MCU-100"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  품목명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 차량용 통합 모터제어기 (MCU)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  카테고리 <span className="text-blue-600 font-normal">(기준정보 마스터 연동)</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {(() => {
                  const catObj = availableCategories.find((c) => c.name === category);
                  return catObj?.description ? (
                    <p className="mt-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 truncate" title={catObj.description}>
                      📁 {catObj.description}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* 관리 단위 설정 */}
              <div className="md:col-span-2 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    관리 단위 (Base UoM)
                  </label>
                  <span className="text-[11px] text-slate-500">생산·입출고 기본 수량 단위</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value.trim().toUpperCase() || 'EA')}
                    placeholder="EA"
                    className="w-24 px-3 py-1.5 text-xs text-center font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {['EA', 'SET', 'ASSY', 'KIT', 'KG', 'M'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`px-2 py-1 text-[11px] rounded font-medium border transition-colors ${
                          unit === u
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  * 선택한 단위가 박스({unit}/BOX) 및 파레트({unit}/PLT) 단위명에 실시간 연동됩니다.
                </p>
              </div>

              {/* 공장 기초재고 */}
              <div className="md:col-span-2 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    공장 기초재고 ({unit})
                  </label>
                  <span className="text-[11px] text-slate-500">계획 개시 시점 기준 보유재고</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={factoryStock}
                    onChange={(e) => setFactoryStock(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-600 shrink-0">{unit}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  * 당월 개시 시점의 공장 실물 보유재고이며, PSI 매트릭스 첫날 셀에서도 직접 수정할 수 있습니다.
                </p>
              </div>
            </div>

            {/* Packaging & Pallet calculation */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-3.5 rounded-lg border border-slate-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  박스당 적입수량
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={boxQty}
                    onChange={(e) => handleBoxQtyChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono text-center bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                  <span className="text-xs text-blue-700 font-bold whitespace-nowrap bg-blue-50 px-2 py-1 rounded border border-blue-200">
                    {unit}/BOX
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1파레트당 박스수
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={boxesPerPallet}
                    onChange={(e) => handleBoxesPerPalletChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono text-center bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                  <span className="text-xs text-slate-700 font-semibold whitespace-nowrap bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    BOX/PLT
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-950 mb-1">
                  1파레트당 총 수량 (공장 출하 단위)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={palletQty}
                    onChange={(e) => handlePalletQtyChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold text-center bg-amber-50 border border-amber-300 rounded-lg text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-900 whitespace-nowrap bg-amber-100/70 px-2 py-1 rounded border border-amber-300">
                    {unit}/PLT
                  </span>
                </div>
              </div>

              <div className="md:col-span-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <span>📐 출하 적입 환산식:</span>
                  <strong className="text-slate-900 font-mono">1 PLT</strong> ={' '}
                  <strong className="text-slate-900 font-mono">{boxesPerPallet} BOX</strong> ={' '}
                  <strong className="text-blue-700 font-mono">{palletQty.toLocaleString()} {unit}</strong>
                </span>
                <span className="text-slate-500">
                  (박스수 또는 파레트수량을 변경하면 상호 자동 계산됩니다)
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: Customer Vehicle Models & DC Configurator */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6">
            {/* Step 2-1: Vehicle Models & Hub Assignment */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-600" />
                    <span>2-1. 고객사별 차종 및 배정 출고센터 매핑</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    공장에서 생산된 부품이 납품되는 고객사(현대, 기아 등) 차종과 배정 출고센터(울산, 광주 등)를 연결합니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddModel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>차종 추가</span>
                </button>
              </div>

              {/* Vehicle Models Cards */}
              <div className="space-y-3">
                {models.map((model, idx) => (
                  <div
                    key={model.id || idx}
                    className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 px-2 py-0.5 bg-slate-100 rounded">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">고객사 차종 정의</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteModel(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="차종 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* 차종명 */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          차종명 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="예: GV80, EV9, 팰리세이드"
                          value={model.name}
                          onChange={(e) => handleModelFieldChange(idx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* 고객사 (마스터 연동) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          고객사 <span className="text-indigo-600 font-normal">(마스터)</span>
                        </label>
                        <select
                          value={model.customer}
                          onChange={(e) => handleModelFieldChange(idx, 'customer', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          {availableCustomers.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const cObj = availableCustomers.find((c) => c.name === model.customer);
                          return cObj?.memo ? (
                            <p className="mt-1 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/70 rounded px-1.5 py-0.5 truncate" title={cObj.memo}>
                              <span className="font-semibold">고객사:</span> {cObj.memo}
                            </p>
                          ) : null;
                        })()}
                      </div>

                      {/* 배정 출고센터 (마스터 연동) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          배정 출고센터 <span className="text-rose-500 font-normal">*마스터</span>
                        </label>
                        <select
                          value={model.hubName}
                          onChange={(e) => handleModelFieldChange(idx, 'hubName', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          {availableHubs.map((h) => (
                            <option key={h.id} value={h.name}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const hObj = availableHubs.find((h) => h.name === model.hubName);
                          return hObj?.memo ? (
                            <p className="mt-1 text-[10px] text-rose-700 bg-rose-50 border border-rose-200/70 rounded px-1.5 py-0.5 truncate" title={hObj.memo}>
                              <span className="font-semibold">물류특이:</span> {hObj.memo}
                            </p>
                          ) : null;
                        })()}
                      </div>

                      {/* 배지 색상 */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          식별 색상 테마
                        </label>
                        <select
                          value={model.badgeColor || 'blue'}
                          onChange={(e) => handleModelFieldChange(idx, 'badgeColor', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {COLOR_OPTIONS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2-2: Regional DC Warehouse Inventory Configurator */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  <span>2-2. 배정 출고센터별 실물 통합 재고 설정 (거점 기초재고 & 안전재고)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  동일 출고센터에 배정된 복수 차종(예: GV80, 팰리세이드)은 같은 부품의 물리적 창고 재고를 공유하므로 거점 단위로 1회만 설정합니다.
                </p>
              </div>

              <div className="space-y-3">
                {uniqueHubs.map((hub) => {
                  const hubConfig = getHubStock(hub);
                  const connectedModels = models.filter((m) => (m.hubName?.trim() || '울산 출고센터') === hub);

                  return (
                    <div
                      key={hub}
                      className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded">
                            📍 {hub}
                          </span>
                          {(() => {
                            const hObj = availableHubs.find((h) => h.name === hub);
                            return hObj?.memo ? (
                              <span className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded font-medium">
                                🚚 {hObj.memo}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-xs text-slate-500">
                            연결 차종 {connectedModels.length}개:
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {connectedModels.map((m) => (
                              <span
                                key={m.id}
                                className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold"
                              >
                                [{m.customer}] {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                          거점 실물재고 단일 관리
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 거점 기초재고 */}
                        <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-slate-800">
                              [{hub}] 거점 기초재고 ({unit})
                            </label>
                            <span className="text-[11px] text-slate-500">계획 개시 시점 창고보유량</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={hubConfig.initialStock}
                              onChange={(e) =>
                                updateHubStock(hub, 'initialStock', Math.max(0, Number(e.target.value) || 0))
                              }
                              className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-600 shrink-0">{unit}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            * 소속된 {connectedModels.map((m) => m.name).join(', ')}에 대한 울산센터 내 총 실물 기초재고입니다.
                          </p>
                        </div>

                        {/* 거점 안전재고 (5일분) */}
                        <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/80">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-amber-950">
                              [{hub}] 거점 안전재고 ({unit})
                            </label>
                            <span className="text-[11px] text-amber-800">일소요량 × 5일분 권장</span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-amber-300">
                              <span className="text-[11px] text-slate-500">일수:</span>
                              <input
                                type="number"
                                min="1"
                                max="30"
                                step="1"
                                value={hubConfig.safetyDays || 5}
                                onChange={(e) =>
                                  updateHubStock(hub, 'safetyDays', Math.max(1, Number(e.target.value) || 5))
                                }
                                className="w-12 px-1 py-0.5 text-xs font-mono font-bold text-center bg-slate-50 border border-slate-300 rounded"
                              />
                              <span className="text-[10px] text-slate-500">일치</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                // Default daily demand heuristic: 1000 per model or 1200
                                const estDaily = connectedModels.length * 1000;
                                updateHubStock(hub, 'safetyStock', estDaily * (hubConfig.safetyDays || 5));
                              }}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold shadow-xs transition-colors"
                              title="소속 차종들의 추정 일소요량에 일수를 곱하여 안전재고를 자동 산출합니다"
                            >
                              ⚡ {hubConfig.safetyDays || 5}일분 자동산출
                            </button>

                            <div className="flex items-center gap-1 ml-auto">
                              <span className="text-xs font-bold text-amber-950">안전재고 =</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={hubConfig.safetyStock}
                                onChange={(e) =>
                                  updateHubStock(hub, 'safetyStock', Math.max(0, Number(e.target.value) || 0))
                                }
                                className="w-24 px-2 py-1 text-xs font-mono font-bold text-center bg-white border border-amber-400 rounded text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                              />
                              <span className="text-xs font-bold text-amber-900">{unit}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-amber-900/80 mt-1.5">
                            * PSI 매트릭스 그리드 상단에서도 [⚡ 5일분 자동계산] 버튼을 통해 일판매계획 기반으로 언제든 실시간 재계산할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Helpful tip box */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>공급망 흐름 매핑 팁:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-blue-800">
                  <li><strong>같은 제품, 다른 차종, 같은 출고센터:</strong> 현대 GV80(울산) + 현대 팰리세이드(울산) → 울산센터 내 실물 재고는 하나로 통합 관리되고 일소요량만 차종별로 분리됩니다.</li>
                  <li><strong>같은 제품, 다른 차종, 다른 출고센터:</strong> 현대 GV80(울산) + 기아 EV9(광주) → 각각의 출고센터별로 독립적인 기초재고 및 기말재고가 산출됩니다.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>설정 저장 및 공급망 적용</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
