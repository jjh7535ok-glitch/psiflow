/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HubMasterItem {
  id: string;
  name: string;           // 센터명 (필수, e.g. "울산 출고센터")
  address?: string;       // 소재지 주소 (선택)
  contactName?: string;   // 담당자 성명 (선택)
  contactPhone?: string;  // 연락처 (선택)
  contactEmail?: string;  // 이메일 (선택)
  memo?: string;          // 비고
  createdAt?: string;
}

export interface CustomerMasterItem {
  id: string;
  name: string;           // 고객사명 (필수, e.g. "현대자동차")
  address?: string;       // 사업장 주소 (선택)
  contactName?: string;   // SCM/조달 담당자 성명 (선택)
  contactPhone?: string;  // 연락처 (선택)
  contactEmail?: string;  // 이메일 (선택)
  memo?: string;          // 비고
  createdAt?: string;
}

export interface CategoryMasterItem {
  id: string;
  name: string;           // 카테고리명 (필수, e.g. "구동 전장")
  description?: string;   // 분류 설명 (선택)
  createdAt?: string;
}
