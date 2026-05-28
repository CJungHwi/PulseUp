/**
 * MenuManager 탭 설정
 *
 * 기능:
 * - 사용자/지점/관리자 3개 탭의 메뉴 트리 audience, 사용자 목록 role, 라벨 정의
 * - audience: user → user,branch_admin → user,branch_admin,super_admin (누적)
 *
 * 사용처: `MenuManager.tsx`, `MenuManagerTabPanel.tsx`
 */
import { FetchUsersQuery } from '@/types/userManager';

export type MenuManagerTabId = 'user' | 'branch' | 'super_admin';

/** 메뉴 트리 조회용 target_audience (API `/menus/admin-tree` 파라미터) */
export type MenuTreeAudienceParam =
  | 'user'
  | 'user,branch_admin'
  | 'user,branch_admin,super_admin';

export interface MenuManagerTabConfig {
  tabLabel: string;
  menuTitle: string;
  userListTitle: string;
  userTypeLabel: string;
  searchPlaceholder: string;
  /** 사용자 목록 조회 role */
  role: NonNullable<FetchUsersQuery['role']>;
  /** 메뉴 트리 조회 target_audience */
  menuTreeAudience: MenuTreeAudienceParam;
}

export const MENU_MANAGER_TABS: Record<MenuManagerTabId, MenuManagerTabConfig> = {
  user: {
    tabLabel: '사용자메뉴',
    menuTitle: '사용자 메뉴',
    userListTitle: '사용자 목록',
    userTypeLabel: '사용자',
    searchPlaceholder: '사용자 검색...',
    role: 'user',
    menuTreeAudience: 'user',
  },
  branch: {
    tabLabel: '지점메뉴',
    menuTitle: '지점 메뉴',
    userListTitle: '지점관리자 목록',
    userTypeLabel: '지점관리자',
    searchPlaceholder: '지점관리자 검색...',
    role: 'branch_admin',
    menuTreeAudience: 'user,branch_admin',
  },
  super_admin: {
    tabLabel: '관리자메뉴',
    menuTitle: '관리자 메뉴',
    userListTitle: '관리자 목록',
    userTypeLabel: '관리자',
    searchPlaceholder: '관리자 검색...',
    role: 'super_admin',
    menuTreeAudience: 'user,branch_admin,super_admin',
  },
};

export const MENU_MANAGER_TAB_ORDER: MenuManagerTabId[] = ['user', 'branch', 'super_admin'];
