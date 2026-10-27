/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ProductItem, MonthlyInitialStockRecord } from '../types/psi';
import { HubMasterItem, CustomerMasterItem, CategoryMasterItem } from '../types/masterData';
import {
  checkHubUsage,
  checkCustomerUsage,
  checkCategoryUsage,
} from '../utils/masterDataEngine';
import { ensureProductModels } from '../utils/psiEngine';
import { loadProductionLines } from '../utils/capaEngine';
import { MonthlyInventoryModal } from './MonthlyInventoryModal';
import { HubMasterModal } from './HubMasterModal';
import { CustomerMasterModal } from './CustomerMasterModal';
import { CategoryMasterModal } from './CategoryMasterModal';
import {
  Package,
  MapPin,
  Building2,
  Tag,
  Plus,
  Search,
  Settings,
  Trash2,
  Edit2,
  Calendar,
  Factory,
  AlertTriangle,
  Phone,
  Mail,
  ShieldAlert,
  Info,
  Cloud,
  CloudUpload,
} from 'lucide-react';

interface MasterDataViewProps {
  products: ProductItem[];
  hubs: HubMasterItem[];
  customers: CustomerMasterItem[];
  categories: CategoryMasterItem[];
  currentDateMonth?: string;
  onOpenNewProductModal: () => void;
  onEditProduct: (product: ProductItem) => void;
  onDeleteProduct: (productId: string) => void;
  onSaveMonthlyInventory?: (
    month: string,
    updatedData: Record<string, MonthlyInitialStockRecord>
  ) => void;
  // Hubs Master Actions
  onSaveHub: (hub: HubMasterItem) => void;
  onDeleteHub: (hubId: string) => void;
  // Customers Master Actions
  onSaveCustomer: (customer: CustomerMasterItem) => void;
  onDeleteCustomer: (customerId: string) => void;
  // Categories Master Actions
  onSaveCategory: (category: CategoryMasterItem) => void;
  onDeleteCategory: (categoryId: string) => void;
  onManualSave?: () => void;
  isReadOnly?: boolean;
}

export type MasterSubTab = 'products' | 'hubs' | 'customers' | 'categories';

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  products,
  hubs,
  customers,
  categories,
  currentDateMonth = '2026-10',
  onOpenNewProductModal,
  onEditProduct,
  onDeleteProduct,
  onSaveMonthlyInventory,
  onSaveHub,
  onDeleteHub,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveCategory,
  onDeleteCategory,
  onManualSave,
  isReadOnly = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<MasterSubTab>('products');
  const [search, setSearch] = useState('');

  // Modals state
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);

  // Hub Modal state
  const [isHubModalOpen, setIsHubModalOpen] = useState(false);
  const [hubToEdit, setHubToEdit] = useState<HubMasterItem | null>(null);

  // Customer Modal state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerMasterItem | null>(null);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<CategoryMasterItem | null>(null);

  // Referential Integrity Block Dialog State
  const [integrityBlockInfo, setIntegrityBlockInfo] = useState<{
    title: string;
    targetName: string;
    usingProducts: string[];
  } | null>(null);

  // Master Item Delete Confirmation State (replaces window.confirm which is blocked in iframes)
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'hub' | 'customer' | 'category';
    id: string;
    name: string;
    label: string;
  } | null>(null);

  const productionLines = useMemo(() => loadProductionLines(products), [products]);
  const sanitizedProducts = useMemo(() => products.map((p, idx) => ensureProductModels(p, idx)), [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();
    return sanitizedProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.models.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.customer.toLowerCase().includes(q) ||
            m.hubName.toLowerCase().includes(q)
        )
    );
  }, [sanitizedProducts, search]);

  // Filtered Hubs
  const filteredHubs = useMemo(() => {
    const q = search.toLowerCase();
    return hubs.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.address && h.address.toLowerCase().includes(q)) ||
        (h.contactName && h.contactName.toLowerCase().includes(q)) ||
        (h.contactPhone && h.contactPhone.toLowerCase().includes(q))
    );
  }, [hubs, search]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.contactName && c.contactName.toLowerCase().includes(q)) ||
        (c.contactPhone && c.contactPhone.toLowerCase().includes(q))
    );
  }, [customers, search]);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    const q = search.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q))
    );
  }, [categories, search]);

  // Delete Handlers with Referential Integrity checks
  const handleRequestDeleteHub = (hub: HubMasterItem) => {
    const using = checkHubUsage(hub.name, products);
    if (using.length > 0) {
      setIntegrityBlockInfo({
        title: '출고센터 삭제 차단 (참조 무결성 보호)',
        targetName: hub.name,
        usingProducts: using,
      });
      return;
    }
    setItemToDelete({
      type: 'hub',
      id: hub.id,
      name: hub.name,
      label: '출고센터',
    });
  };

  const handleRequestDeleteCustomer = (customer: CustomerMasterItem) => {
    const using = checkCustomerUsage(customer.name, products);
    if (using.length > 0) {
      setIntegrityBlockInfo({
        title: '고객사 삭제 차단 (참조 무결성 보호)',
        targetName: customer.name,
        usingProducts: using,
      });
      return;
    }
    setItemToDelete({
      type: 'customer',
      id: customer.id,
      name: customer.name,
      label: '고객사',
    });
  };

  const handleRequestDeleteCategory = (category: CategoryMasterItem) => {
    const using = checkCategoryUsage(category.name, products);
    if (using.length > 0) {
      setIntegrityBlockInfo({
        title: '카테고리 삭제 차단 (참조 무결성 보호)',
        targetName: category.name,
        usingProducts: using,
      });
      return;
    }
    setItemToDelete({
      type: 'category',
      id: category.id,
      name: category.name,
      label: '카테고리',
    });
  };

  return (
    <div className="flex-1 w-full overflow-y-auto bg-slate-100 p-6 space-y-4">
      {/* Cloud Cross-Device Synchronization Info Card */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-white border border-blue-200/80 rounded-lg p-3 px-4 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                기기 간 실시간 클라우드 영구 동기화 (Cloud Firestore & Server)
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                동기화 활성화
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              PC와 노트북에서 등록·수정한 품목 마스터, 차종, 출고센터 기준정보는 구글 계정 기반으로 클라우드에 자동 보존되어 다른 기기에서 로그인 시 즉시 동일하게 유지됩니다.
            </p>
          </div>
        </div>
        {onManualSave && !isReadOnly && (
          <button
            type="button"
            onClick={onManualSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-xs transition-colors whitespace-nowrap cursor-pointer active:scale-95 shrink-0"
            title="현재 기준정보를 클라우드에 즉시 영구 저장합니다"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>클라우드 즉시 저장</span>
          </button>
        )}
      </div>

      {/* 1. Master Data Management Top Sub-navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('products');
              setSearch('');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeSubTab === 'products'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>부품/품목 마스터</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-mono">
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('hubs');
              setSearch('');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeSubTab === 'hubs'
                ? 'bg-white text-rose-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>출고센터(거점) 마스터</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-mono">
              {hubs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('customers');
              setSearch('');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeSubTab === 'customers'
                ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>고객사 마스터</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-mono">
              {customers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('categories');
              setSearch('');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeSubTab === 'categories'
                ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
            <span>카테고리 마스터</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono">
              {categories.length}
            </span>
          </button>
        </div>

        {/* Search input on the right */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeSubTab === 'products'
                ? '부품명, 품목코드, 차종 검색...'
                : activeSubTab === 'hubs'
                ? '출고센터명, 주소, 담당자 검색...'
                : activeSubTab === 'customers'
                ? '고객사명, 주소, 조달담당자 검색...'
                : '카테고리명, 설명 검색...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 w-64 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* 2. Sub-Tab Content Views */}

      {/* VIEW A: PRODUCTS MASTER */}
      {activeSubTab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>차량 부품 품목 마스터 및 차종·출고센터 공급망 관리</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                공장 생산 품목별 고객사 차종, 지정 출고센터, 적입/파레트 기준 및 거점별 안전재고를 통합 관리합니다.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMonthlyModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>월별 기초재고 장부 관리</span>
              </button>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={onOpenNewProductModal}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>신규 부품 등록</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">품목코드</th>
                  <th className="px-4 py-2.5">품목명</th>
                  <th className="px-4 py-2.5">카테고리</th>
                  <th className="px-3 py-2.5 text-center">단위</th>
                  <th className="px-4 py-2.5 text-right font-mono">1파레트당 수량</th>
                  <th className="px-4 py-2.5 text-right font-mono text-blue-900">
                    [{currentDateMonth ? `${parseInt(currentDateMonth.split('-')[1] || '10', 10)}월` : '당월'}] 공장 기초재고
                  </th>
                  <th className="px-4 py-2.5">연결된 고객사 차종 및 출고센터 공급망 (거점 기초재고 / 안전재고)</th>
                  <th className="px-4 py-2.5 text-center w-24">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      검색 결과와 일치하는 부품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const activeMonth = currentDateMonth || '2026-10';
                    const activeFactoryStock =
                      prod.monthlyInitialStocks?.[activeMonth]?.factory ?? prod.factoryInitialStock;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {prod.code}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div>{prod.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-normal">
                            <span>박스당 {prod.boxQty} {prod.unit}</span>
                            {(() => {
                              const matchedLine = productionLines.find((l) =>
                                l.productConfigs.some((c) => c.productId === prod.id)
                              );
                              if (!matchedLine) {
                                return (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>라인 미배정</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Factory className="w-2.5 h-2.5" />
                                  <span>{matchedLine.name.split('(')[0].trim()}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700">
                            {prod.category}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500 font-medium whitespace-nowrap">
                          {prod.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-900 bg-amber-50/30 whitespace-nowrap">
                          {prod.palletQty.toLocaleString()} {prod.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-blue-700 bg-blue-50/40 whitespace-nowrap">
                          {activeFactoryStock.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {Array.from(new Set(prod.models.map((m) => m.hubName || '울산 출고센터'))).map((hub) => {
                              const ms = prod.models.filter((m) => (m.hubName || '울산 출고센터') === hub);
                              const hubStock =
                                prod.monthlyInitialStocks?.[activeMonth]?.hubs?.[hub] ??
                                prod.hubs?.[hub]?.initialStock ??
                                ms.reduce((s, m) => s + (Number(m.initialStock) || 0), 0);
                              const hubSafety =
                                prod.hubs?.[hub]?.safetyStock ??
                                ms.reduce((s, m) => s + (Number(m.safetyStock) || 0), 0);
                              return (
                                <div
                                  key={hub}
                                  className="inline-flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200 rounded text-[11px] shadow-2xs flex-wrap"
                                >
                                  <span className="font-bold text-slate-800">📍 {hub}</span>
                                  <span className="text-slate-300">|</span>
                                  <div className="flex items-center gap-1">
                                    {ms.map((m) => (
                                      <span
                                        key={m.id}
                                        className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                                      >
                                        [{m.customer}] {m.name}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-slate-700 font-mono font-medium ml-auto">
                                    기초재고 <strong className="text-indigo-700">{hubStock.toLocaleString()}</strong> / 안전재고 <strong className="text-emerald-700">{hubSafety.toLocaleString()}</strong> {prod.unit}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {!isReadOnly ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditProduct(prod)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="부품 정보 및 차종 공급망 설정"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setProductToDelete(prod)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="부품 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">읽기 전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW B: HUBS (DISTRIBUTION CENTERS) MASTER */}
      {activeSubTab === 'hubs' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                <span>출고센터(거점) 기준정보 및 SCM 비상 연락망 관리</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                완성차 공장 인근 출고센터의 소재지 주소, 센터장 및 물류 담당자 연락처를 관리합니다. (부품 등록 시 드롭다운 선택)
              </p>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setHubToEdit(null);
                  setIsHubModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>신규 출고센터 등록</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">출고센터(거점)명</th>
                  <th className="px-4 py-2.5">소재지 위치 / 주소</th>
                  <th className="px-4 py-2.5">담당자 성명</th>
                  <th className="px-4 py-2.5">전화번호</th>
                  <th className="px-4 py-2.5">이메일</th>
                  <th className="px-4 py-2.5 text-center">공급 연결 부품 수</th>
                  <th className="px-4 py-2.5">특이사항/메모</th>
                  <th className="px-4 py-2.5 text-center w-24">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredHubs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      등록된 출고센터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredHubs.map((hub) => {
                    const usingProducts = checkHubUsage(hub.name, products);

                    return (
                      <tr key={hub.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span>{hub.name}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {hub.address || <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {hub.contactName || <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {hub.contactPhone ? (
                            <a
                              href={`tel:${hub.contactPhone}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{hub.contactPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {hub.contactEmail ? (
                            <a
                              href={`mailto:${hub.contactEmail}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{hub.contactEmail}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {usingProducts.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {usingProducts.length}개 부품 공급 중
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">미배정</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {hub.memo || '-'}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {!isReadOnly ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setHubToEdit(hub);
                                  setIsHubModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="출고센터 수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteHub(hub)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="출고센터 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">읽기 전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW C: CUSTOMERS MASTER */}
      {activeSubTab === 'customers' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>완성차 고객사 기준정보 및 구매/조달 연락망 관리</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                현대자동차, 기아 등 고객사 정보와 구매/SCM 조달 담당자 연락처를 통합 관리합니다. (부품 등록 시 드롭다운 선택)
              </p>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setCustomerToEdit(null);
                  setIsCustomerModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>신규 고객사 등록</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">고객사명</th>
                  <th className="px-4 py-2.5">사업장 소재지 주소</th>
                  <th className="px-4 py-2.5">조달/구매 담당자</th>
                  <th className="px-4 py-2.5">전화번호</th>
                  <th className="px-4 py-2.5">이메일</th>
                  <th className="px-4 py-2.5 text-center">납품 부품 수</th>
                  <th className="px-4 py-2.5">비고/특이사항</th>
                  <th className="px-4 py-2.5 text-center w-24">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                      등록된 고객사가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => {
                    const usingProducts = checkCustomerUsage(customer.name, products);

                    return (
                      <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{customer.name}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {customer.address || <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {customer.contactName || <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {customer.contactPhone ? (
                            <a
                              href={`tel:${customer.contactPhone}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{customer.contactPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono whitespace-nowrap">
                          {customer.contactEmail ? (
                            <a
                              href={`mailto:${customer.contactEmail}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{customer.contactEmail}</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {usingProducts.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {usingProducts.length}개 부품 납품
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">미배정</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {customer.memo || '-'}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {!isReadOnly ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomerToEdit(customer);
                                  setIsCustomerModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="고객사 수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteCustomer(customer)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="고객사 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">읽기 전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW D: CATEGORIES MASTER */}
      {activeSubTab === 'categories' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>부품 제품군 카테고리 기준정보 관리</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                사내 표준 부품 카테고리 분류 체계를 관리합니다. (부품 등록 시 드롭다운 선택)
              </p>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setCategoryToEdit(null);
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>신규 카테고리 등록</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">카테고리 분류명</th>
                  <th className="px-4 py-2.5">분류 설명 및 대표 부품군 예시</th>
                  <th className="px-4 py-2.5 text-center">등록 부품 수</th>
                  <th className="px-4 py-2.5 text-center w-24">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500 text-xs">
                      등록된 카테고리가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => {
                    const usingProducts = checkCategoryUsage(cat.name, products);

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {cat.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {cat.description || <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {usingProducts.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {usingProducts.length}개 부품 등록
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">미사용</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {!isReadOnly ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryToEdit(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="카테고리 수정"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteCategory(cat)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="카테고리 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">읽기 전용</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Products */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">부품 품목 삭제 확인</h3>
            </div>
            <p className="text-xs text-slate-600">
              정말로 <strong>[{productToDelete.code}] {productToDelete.name}</strong> 품목과 연결된 모든 차종 공급망 데이터를 삭제하시겠습니까?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(productToDelete.id);
                  setProductToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs cursor-pointer"
              >
                삭제 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Item Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {itemToDelete.label} 삭제 확인
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              정말로 <strong>[{itemToDelete.name}]</strong> {itemToDelete.label} 항목을 삭제하시겠습니까?
              <br />
              <span className="text-slate-400 text-[11px]">
                (현재 등록된 부품에서 사용되지 않는 안전한 항목입니다.)
              </span>
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (itemToDelete.type === 'hub') onDeleteHub(itemToDelete.id);
                  else if (itemToDelete.type === 'customer') onDeleteCustomer(itemToDelete.id);
                  else if (itemToDelete.type === 'category') onDeleteCategory(itemToDelete.id);
                  setItemToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded shadow-xs cursor-pointer"
              >
                삭제 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referential Integrity Block Dialog Popup */}
      {integrityBlockInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-full shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {integrityBlockInfo.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    선택하신 <strong>[{integrityBlockInfo.targetName}]</strong> 항목은 현재 등록된{' '}
                    <strong className="text-rose-700">{integrityBlockInfo.usingProducts.length}개 부품</strong>에서 실제 공급망으로 사용 중이므로 삭제할 수 없습니다.
                  </p>
                </div>
              </div>

              {/* List of affected products */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1 text-xs">
                <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                  참조 중인 부품 목록:
                </span>
                {integrityBlockInfo.usingProducts.map((pName, idx) => (
                  <div key={idx} className="font-mono text-slate-700 flex items-center gap-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{pName}</span>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 flex items-start gap-1.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  안전한 데이터 관리를 위해, 먼저 위 부품들의 설정을 다른 항목으로 변경하신 후 삭제를 진행해 주세요.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIntegrityBlockInfo(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Inventory Modal */}
      {isMonthlyModalOpen && (
        <MonthlyInventoryModal
          isOpen={isMonthlyModalOpen}
          onClose={() => setIsMonthlyModalOpen(false)}
          products={products}
          currentDateMonth={currentDateMonth}
          onSaveMonthlyInventory={(month, updatedData) => {
            onSaveMonthlyInventory?.(month, updatedData);
            setIsMonthlyModalOpen(false);
          }}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Hub Master Modal */}
      <HubMasterModal
        isOpen={isHubModalOpen}
        onClose={() => setIsHubModalOpen(false)}
        onSave={onSaveHub}
        hubToEdit={hubToEdit}
      />

      {/* Customer Master Modal */}
      <CustomerMasterModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSave={onSaveCustomer}
        customerToEdit={customerToEdit}
      />

      {/* Category Master Modal */}
      <CategoryMasterModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={onSaveCategory}
        categoryToEdit={categoryToEdit}
      />
    </div>
  );
};
