/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CustomerMasterItem } from '../types/masterData';
import { X, Check, Building2, Phone, Mail, User, FileText } from 'lucide-react';

interface CustomerMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: CustomerMasterItem) => void;
  customerToEdit?: CustomerMasterItem | null;
}

export const CustomerMasterModal: React.FC<CustomerMasterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customerToEdit,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setAddress(customerToEdit.address || '');
      setContactName(customerToEdit.contactName || '');
      setContactPhone(customerToEdit.contactPhone || '');
      setContactEmail(customerToEdit.contactEmail || '');
      setMemo(customerToEdit.memo || '');
    } else {
      setName('');
      setAddress('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setMemo('');
    }
  }, [customerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('고객사명을 입력해 주세요.');
      return;
    }

    const item: CustomerMasterItem = {
      id: customerToEdit ? customerToEdit.id : `cust-${Date.now()}`,
      name: name.trim(),
      address: address.trim() || undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      memo: memo.trim() || undefined,
      createdAt: customerToEdit?.createdAt || new Date().toISOString(),
    };

    onSave(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {customerToEdit ? '고객사 기준정보 수정' : '신규 고객사 등록'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                완성차 고객사 정보와 구매/조달 담당자 비상 연락망을 등록합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* 고객사명 (필수) */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              고객사명 <span className="text-rose-500">*필수</span>
            </label>
            <input
              type="text"
              required
              placeholder="예: 현대자동차, 기아, KG모빌리티"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* 사업장 주소 (선택) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>사업장 소재지 주소</span>
              <span className="text-[11px] text-slate-400 font-normal">선택 입력</span>
            </label>
            <input
              type="text"
              placeholder="예: 서울특별시 서초구 헌릉로 12"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* 조달 담당자 성명 & 연락처 (선택) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>조달/구매 담당자 성명</span>
              </label>
              <input
                type="text"
                placeholder="예: 강동현 책임매니저"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>담당자 전화번호</span>
              </label>
              <input
                type="text"
                placeholder="예: 02-3464-1114"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* 담당자 이메일 (선택) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>담당자 이메일</span>
            </label>
            <input
              type="email"
              placeholder="예: dh.kang@hyundai.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* 비고 (선택) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>특이사항 및 납품 조건 메모</span>
            </label>
            <input
              type="text"
              placeholder="예: D+1 익일 오전 착 / 주말 입고 불가 / 표준 팔레트 규격 준수"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{customerToEdit ? '수정사항 저장' : '고객사 등록'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
