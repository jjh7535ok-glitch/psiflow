/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CategoryMasterItem } from '../types/masterData';
import { X, Check, Tag, FileText } from 'lucide-react';

interface CategoryMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: CategoryMasterItem) => void;
  categoryToEdit?: CategoryMasterItem | null;
}

export const CategoryMasterModal: React.FC<CategoryMasterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categoryToEdit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name || '');
      setDescription(categoryToEdit.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('카테고리명을 입력해 주세요.');
      return;
    }

    const item: CategoryMasterItem = {
      id: categoryToEdit ? categoryToEdit.id : `cat-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      createdAt: categoryToEdit?.createdAt || new Date().toISOString(),
    };

    onSave(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {categoryToEdit ? '부품 카테고리 수정' : '신규 부품 카테고리 등록'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                사내 표준 부품 제품군 분류 체계를 등록합니다.
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
          {/* 카테고리명 (필수) */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              카테고리명 <span className="text-rose-500">*필수</span>
            </label>
            <input
              type="text"
              required
              placeholder="예: 구동 전장, 배터리 시스템, 조향/샤시"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* 분류 설명 (선택) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>분류 세부 설명 및 해당 부품 예시</span>
            </label>
            <textarea
              rows={3}
              placeholder="예: 모터제어기(MCU), 인버터 등 구동 제어 핵심 전장품군"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
              <span>{categoryToEdit ? '수정사항 저장' : '카테고리 등록'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
