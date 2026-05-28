/**
 * MenuManagerTabPanel — 메뉴 트리 + 사용자 목록 + 권한 패널 레이아웃
 *
 * 구성:
 * - 좌: `MenuTree`
 * - 우상: `UserListTable` (드래그로 높이 조절)
 * - 중앙: 상하 패널 크기 조절 핸들
 * - 우하: `UserPermissionPanel` (드래그로 높이 조절)
 *
 * 사용처: `MenuManager.tsx`
 */
import React, { useCallback, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { MenuTreeItem } from '@/types/menu.types';
import { UserInfo } from '@/types/userManager';
import { UserMenuItem } from '@/services/menuApi';
import { MenuTree } from './MenuTree';
import { UserListTable } from './UserListTable';
import { UserPermissionPanel } from './UserPermissionPanel';
import { MenuManagerTabConfig } from './menuManagerConfig';

const DEFAULT_USER_LIST_HEIGHT = 40;
const MIN_PANEL_HEIGHT = 25;
const MAX_PANEL_HEIGHT = 75;
const RESIZE_KEY_STEP = 5;

interface MenuManagerTabPanelProps {
  config: MenuManagerTabConfig;
  menuTree: MenuTreeItem[];
  expandedNodes: string[];
  selectedMenuNode: MenuTreeItem | null;
  onToggleExpand: (id: string) => void;
  onSelectMenuNode: (node: MenuTreeItem) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onUpdateName: (id: string, name: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onSelectAllMenus: () => void;
  users: UserInfo[];
  total: number;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onRefreshUsers: () => void;
  pagination: { page: number; pageSize: number };
  onPageChange: (page: number) => void;
  selectedUser: UserInfo | null;
  onSelectUser: (user: UserInfo) => void;
  userMenuItems: UserMenuItem[];
  onAddSelectedMenu: () => void;
  onSavePermissions: () => void;
  onTogglePermission: (itemId: string, checked: boolean) => void;
}

const clampPanelHeight = (value: number) =>
  Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, value));

export const MenuManagerTabPanel: React.FC<MenuManagerTabPanelProps> = ({
  config,
  menuTree,
  expandedNodes,
  selectedMenuNode,
  onToggleExpand,
  onSelectMenuNode,
  onToggleActive,
  onUpdateName,
  onReorder,
  onSelectAllMenus,
  users,
  total,
  loading,
  search,
  onSearchChange,
  onRefreshUsers,
  pagination,
  onPageChange,
  selectedUser,
  onSelectUser,
  userMenuItems,
  onAddSelectedMenu,
  onSavePermissions,
  onTogglePermission,
}) => {
  const [userListHeight, setUserListHeight] = useState(DEFAULT_USER_LIST_HEIGHT);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const updateUserListHeight = useCallback((clientY: number) => {
    const container = splitContainerRef.current;
    if (!container) return;

    const { top, height } = container.getBoundingClientRect();
    if (height <= 0) return;

    const nextHeight = ((clientY - top) / height) * 100;
    setUserListHeight(clampPanelHeight(nextHeight));
  }, []);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateUserListHeight(event.clientY);
  };

  const handleResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateUserListHeight(event.clientY);
  };

  const handleResizePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? -RESIZE_KEY_STEP : RESIZE_KEY_STEP;
    setUserListHeight((prev) => clampPanelHeight(prev + direction));
  };

  return (
    <div className="flex gap-[3px] h-full p-0 bg-background">
      <Card className="flex-[0.6] flex flex-col min-w-0 shadow-md border border-[#343637] dark:border-[#6b7280] bg-card overflow-hidden">
        <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">{config.menuTitle}</CardTitle>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs border-[#343637] dark:border-[#6b7280]"
              onClick={onSelectAllMenus}
              disabled={!selectedMenuNode}
            >
              선택 전체사용
            </Button>
            <Button size="sm" className="h-9 text-xs">
              <Save className="h-4 w-4 mr-1.5" />
              저장
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-2">
          <MenuTree
            items={menuTree}
            selectedId={selectedMenuNode?.id || null}
            expandedIds={expandedNodes}
            onToggleExpand={onToggleExpand}
            onSelect={onSelectMenuNode}
            onToggleActive={onToggleActive}
            onUpdateName={onUpdateName}
            onReorder={onReorder}
          />
        </CardContent>
      </Card>

      <div ref={splitContainerRef} className="flex-[1.4] flex flex-col min-w-0 min-h-0">
        <div className="min-h-0" style={{ flexBasis: `${userListHeight}%` }}>
          <UserListTable
            title={config.userListTitle}
            searchPlaceholder={config.searchPlaceholder}
            users={users}
            total={total}
            loading={loading}
            search={search}
            onSearchChange={onSearchChange}
            onRefresh={onRefreshUsers}
            pagination={pagination}
            onPageChange={onPageChange}
            selectedUserId={selectedUser?.id || null}
            onSelectUser={onSelectUser}
          />
        </div>

        <button
          type="button"
          role="separator"
          aria-label="사용자 목록과 메뉴 권한 영역 높이 조절"
          aria-orientation="horizontal"
          aria-valuemin={MIN_PANEL_HEIGHT}
          aria-valuemax={MAX_PANEL_HEIGHT}
          aria-valuenow={Math.round(userListHeight)}
          className="group h-[11px] shrink-0 cursor-row-resize bg-background flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={handleResizeKeyDown}
        >
          <span className="h-[3px] w-16 rounded-full bg-[#343637]/40 transition-colors group-hover:bg-primary group-focus-visible:bg-primary dark:bg-[#6b7280]" />
        </button>

        <div className="min-h-0 flex-1">
          <UserPermissionPanel
            userTypeLabel={config.userTypeLabel}
            selectedUser={selectedUser}
            userMenuItems={userMenuItems}
            onAddSelectedMenu={onAddSelectedMenu}
            onSave={onSavePermissions}
            onTogglePermission={onTogglePermission}
            selectedMenuNodeId={selectedMenuNode?.id || null}
          />
        </div>
      </div>
    </div>
  );
};
