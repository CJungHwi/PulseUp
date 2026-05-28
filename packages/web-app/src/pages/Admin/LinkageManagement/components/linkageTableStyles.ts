/**
 * LinkageManagement 테이블 공통 스타일/유틸
 *
 * - 셀(헤더/바디) 클래스 상수
 * - 날짜 포맷터
 *
 * 사용처: `LinkageTable.tsx`, `LinkageManagementPage.tsx`
 */

export const HEADER_CELL =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-gray-200 dark:border-gray-500 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'

export const HEADER_CELL_LAST =
  'h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]'

export const BODY_CELL =
  'h-[35px] py-0 px-2 text-xs border-r border-gray-200 dark:border-gray-500 group-hover:text-inherit group-hover:font-inherit transition-colors'

export const BODY_CELL_LAST =
  'h-[35px] py-0 px-2 text-xs group-hover:text-inherit group-hover:font-inherit transition-colors'

export const formatDate = (v: string | null): string => {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString('ko-KR')
  } catch {
    return '—'
  }
}
