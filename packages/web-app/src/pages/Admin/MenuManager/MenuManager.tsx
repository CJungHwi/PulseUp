/**
 * 페이지 요약 — 메뉴·권한 관리 (`/admin/menumanager`, super_admin 전용)
 *
 * 기능: 사용자/지점/관리자 메뉴 트리 편집, 역할별 사용자 메뉴 권한 할당.
 *
 * 호출/연동:
 * - `menuApi.getAdminMenuTreeByAudience`, `userManagerApi.getUsers`
 * - DB/SP: `packages/api-server` 메뉴·권한 API
 *
 * 관련 컴포넌트(`./components/`):
 *  - `MenuManagerTabPanel`, `MenuTree`, `UserListTable`, `UserPermissionPanel`
 * 설정: `./components/menuManagerConfig.ts` (탭별 role / menuTreeAudience 매핑, folder·page strict 필터)
 *
 * 흐름: 탭 선택 → 해당 role 메뉴·사용자 로드 → 노드/사용자 선택 → 권한 저장.
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { menuApi, UserMenuItem } from '@/services/menuApi';
import { MenuTreeItem } from '@/types/menu.types';
import { userManagerApi } from '@/services/userManagerApi';
import { UserInfo } from '@/types/userManager';
import { MenuManagerTabPanel } from './components/MenuManagerTabPanel';
import {
  MENU_MANAGER_TABS,
  MENU_MANAGER_TAB_ORDER,
  MenuManagerTabId,
} from './components/menuManagerConfig';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/redux';
import { clearMenuTree, loadMenuTree } from '@/store/slices/menuSlice';

interface TabState {
  menuTree: MenuTreeItem[];
  expandedNodes: string[];
  selectedMenuNode: MenuTreeItem | null;
  users: UserInfo[];
  selectedUser: UserInfo | null;
  userMenuItems: UserMenuItem[];
  total: number;
}

const createInitialTabState = (): TabState => ({
  menuTree: [],
  expandedNodes: [],
  selectedMenuNode: null,
  users: [],
  selectedUser: null,
  userMenuItems: [],
  total: 0,
});

const MenuManager: React.FC = () => {
  const { showSnackbar } = useSnackbar();
  const { user: authUser } = useAuth();
  const dispatch = useAppDispatch();

  const [currentTab, setCurrentTab] = useState<MenuManagerTabId>('user');
  const [tabStates, setTabStates] = useState<Record<MenuManagerTabId, TabState>>({
    user: createInitialTabState(),
    branch: createInitialTabState(),
    super_admin: createInitialTabState(),
  });

  const [filters, setFilters] = useState({ search: '' });
  const [pagination, setPagination] = useState({ page: 0, pageSize: 100 });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);


  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const updateTabState = (tabId: MenuManagerTabId, patch: Partial<TabState>) => {
    setTabStates((prev) => ({
      ...prev,
      [tabId]: { ...prev[tabId], ...patch },
    }));
  };

  const convertToMenuTreeItems = (menus: any[]): MenuTreeItem[] =>
    menus.map((menu) => ({
      id: String(menu.id),
      parent_id: menu.parent_id ? String(menu.parent_id) : null,
      name: menu.name,
      name_en: menu.name_en || null,
      description: menu.description || null,
      menu_type: menu.menu_type,
      url: menu.url || null,
      path: menu.path || null,
      icon: menu.icon || null,
      sort_order: menu.sort_order || menu.order_index || 0,
      order_index: menu.order_index || menu.sort_order || 0,
      is_active: menu.is_active,
      is_visible: menu.is_visible,
      required_permissions: menu.required_permissions || null,
      target_audience: menu.target_audience,
      level: menu.level,
      created_at: menu.created_at || '',
      updated_at: menu.updated_at || '',
      children: menu.children ? convertToMenuTreeItems(menu.children) : [],
    }));

  const getAllExpandableNodeIds = (items: MenuTreeItem[]): string[] => {
    const ids: string[] = [];
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        ids.push(item.id);
        ids.push(...getAllExpandableNodeIds(item.children));
      }
    });
    return ids;
  };

  const loadMenuTree = async (tabId: MenuManagerTabId) => {
    try {
      const { menuTreeAudience } = MENU_MANAGER_TABS[tabId];
      const response = await menuApi.getAdminMenuTreeByAudience(menuTreeAudience);
      if (response.success && response.data) {
        const treeData = convertToMenuTreeItems(response.data);
        updateTabState(tabId, {
          menuTree: treeData,
          expandedNodes: getAllExpandableNodeIds(treeData),
        });
      }
    } catch (error) {
      console.error(`${MENU_MANAGER_TABS[tabId].menuTitle} 트리 로드 실패:`, error);
    }
  };

  const loadUsersForTab = async (tabId: MenuManagerTabId) => {
    try {
      setLoading(true);
      const { role } = MENU_MANAGER_TABS[tabId];
      const response = await userManagerApi.getUsers({
        role,
        page: pagination.page + 1,
        limit: pagination.pageSize,
        search: filters.search,
      });
      updateTabState(tabId, {
        users: response.users,
        total: response.pagination.total,
        selectedUser: null,
        userMenuItems: [],
      });
    } catch (error) {
      console.error(`${MENU_MANAGER_TABS[tabId].userListTitle} 로드 실패:`, error);
      updateTabState(tabId, {
        users: [],
        total: 0,
        selectedUser: null,
        userMenuItems: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserMenuItems = async (tabId: MenuManagerTabId, userId: string) => {
    try {
      const response = await menuApi.getUserMenuItems(userId);
      updateTabState(tabId, {
        userMenuItems: response.success && response.data ? response.data : [],
      });
    } catch (error) {
      console.error('사용자 메뉴 권한 로드 실패:', error);
      updateTabState(tabId, { userMenuItems: [] });
    }
  };

  useEffect(() => {
    MENU_MANAGER_TAB_ORDER.forEach((tabId) => {
      loadMenuTree(tabId);
    });
  }, []);

  useEffect(() => {
    loadUsersForTab(currentTab);
  }, [currentTab, filters.search, pagination.page, pagination.pageSize]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value as MenuManagerTabId);
    setPagination((prev) => ({ ...prev, page: 0 }));
    setFilters({ search: '' });
  };

  const handleMenuTreeToggle = async (tabId: MenuManagerTabId, nodeId: string, currentActive: boolean) => {
    try {
      const newActive = !currentActive;
      await menuApi.updateMenuStatus(Number(nodeId), newActive);

      const updateTreeStatus = (items: MenuTreeItem[]): MenuTreeItem[] =>
        items.map((item) => {
          if (item.id === nodeId) {
            return { ...item, checked: newActive, is_active: newActive };
          }
          if (item.children) {
            return { ...item, children: updateTreeStatus(item.children) };
          }
          return item;
        });

      updateTabState(tabId, { menuTree: updateTreeStatus(tabStates[tabId].menuTree) });
    } catch (error) {
      console.error('메뉴 상태 업데이트 실패:', error);
      showNotification('메뉴 상태 업데이트에 실패했습니다.', 'error');
    }
  };

  const handleReorderMenu = async (tabId: MenuManagerTabId, itemId: string, direction: 'up' | 'down') => {
    const tree = tabStates[tabId].menuTree;

    const findPath = (items: MenuTreeItem[], targetId: string, path: number[] = []): number[] | null => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === targetId) return [...path, i];
        const found = items[i].children?.length
          ? findPath(items[i].children!, targetId, [...path, i])
          : null;
        if (found) return found;
      }
      return null;
    };

    const path = findPath(tree, itemId);
    if (!path || path.length === 0) return;

    const parentPath = path.slice(0, -1);
    const itemIndex = path[path.length - 1];
    const swapIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;

    const getSiblingAt = (items: MenuTreeItem[], p: number[]): MenuTreeItem[] | null => {
      if (p.length === 0) return items;
      const [first, ...rest] = p;
      if (first >= items.length || !items[first].children) return null;
      return getSiblingAt(items[first].children!, rest);
    };

    const siblings = getSiblingAt(tree, parentPath);
    if (!siblings || swapIndex < 0 || swapIndex >= siblings.length) return;

    const currentItem = siblings[itemIndex];
    const swapItem = siblings[swapIndex];

    try {
      await Promise.all([
        menuApi.updateMenu(parseInt(currentItem.id), { sort_order: swapItem.sort_order }),
        menuApi.updateMenu(parseInt(swapItem.id), { sort_order: currentItem.sort_order }),
      ]);

      const swapInTree = (items: MenuTreeItem[], p: number[], idx: number, swapIdx: number): MenuTreeItem[] => {
        if (p.length === 0) {
          const next = [...items];
          [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
          return next;
        }
        const [first, ...rest] = p;
        return items.map((item, i) =>
          i === first && item.children
            ? { ...item, children: swapInTree(item.children, rest, idx, swapIdx) }
            : item
        );
      };

      updateTabState(tabId, { menuTree: swapInTree(tree, parentPath, itemIndex, swapIndex) });
      showNotification('메뉴 순서가 변경되었습니다.');
    } catch (error) {
      console.error('메뉴 순서 변경 실패:', error);
      showNotification('메뉴 순서 변경에 실패했습니다.', 'error');
    }
  };

  const handleSaveMenuName = async (tabId: MenuManagerTabId, menuId: string, newName: string) => {
    if (!newName.trim()) {
      showNotification('메뉴명을 입력해주세요.', 'error');
      return;
    }

    try {
      await menuApi.updateMenu(parseInt(menuId), { name: newName.trim() });

      const updateTreeName = (items: MenuTreeItem[]): MenuTreeItem[] =>
        items.map((item) => {
          if (item.id === menuId) {
            return { ...item, name: newName.trim() };
          }
          if (item.children) {
            return { ...item, children: updateTreeName(item.children) };
          }
          return item;
        });

      updateTabState(tabId, { menuTree: updateTreeName(tabStates[tabId].menuTree) });
      showNotification('메뉴명이 저장되었습니다.');
    } catch (error) {
      console.error('메뉴명 저장 실패:', error);
      showNotification('메뉴명 저장에 실패했습니다.', 'error');
    }
  };

  const handleSelectAllMenus = async (tabId: MenuManagerTabId) => {
    const { selectedMenuNode, selectedUser } = tabStates[tabId];
    const { userTypeLabel } = MENU_MANAGER_TABS[tabId];

    if (!selectedMenuNode) {
      showSnackbar({ message: '먼저 메뉴를 선택해주세요.', severity: 'info' });
      return;
    }

    if (selectedMenuNode.menu_type !== 'page') {
      showSnackbar({ message: 'page 타입 메뉴만 추가할 수 있습니다.', severity: 'info' });
      return;
    }

    try {
      setLoading(true);
      const result = await menuApi.enableMenuForAllUsers(Number(selectedMenuNode.id));

      if (result.success) {
        showSnackbar({
          message: `선택한 메뉴 "${selectedMenuNode.name}"는 모든 ${userTypeLabel}가 사용 가능하게 되었습니다.`,
          severity: 'success',
        });

        const updateTreeStatus = (items: MenuTreeItem[]): MenuTreeItem[] =>
          items.map((item) => {
            if (item.id === selectedMenuNode.id) {
              return { ...item, checked: true, is_active: true };
            }
            if (item.children) {
              return { ...item, children: updateTreeStatus(item.children) };
            }
            return item;
          });

        updateTabState(tabId, { menuTree: updateTreeStatus(tabStates[tabId].menuTree) });

        if (selectedUser) {
          const userid = (selectedUser as any).userid || selectedUser.id;
          if (userid) loadUserMenuItems(tabId, userid);
        }
      } else {
        throw new Error('API 응답 실패');
      }
    } catch (error) {
      console.error('전체 사용 활성화 실패:', error);
      showSnackbar({ message: '작업에 실패했습니다.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSelectedMenuToUser = async (tabId: MenuManagerTabId) => {
    const { selectedMenuNode, selectedUser, userMenuItems } = tabStates[tabId];
    const { userTypeLabel } = MENU_MANAGER_TABS[tabId];

    if (!selectedMenuNode) {
      showNotification('먼저 메뉴를 선택해주세요.', 'info');
      return;
    }
    if (!selectedUser) {
      showNotification(`먼저 ${userTypeLabel}를 선택해주세요.`, 'info');
      return;
    }
    if (selectedMenuNode.menu_type !== 'page') {
      showNotification('page 타입 메뉴만 추가할 수 있습니다.', 'info');
      return;
    }

    const alreadyExists = userMenuItems.some((item) => item.menu_id === selectedMenuNode.id);
    if (alreadyExists) {
      showNotification('이미 추가된 메뉴입니다.', 'info');
      return;
    }

    try {
      setLoading(true);
      const userid = (selectedUser as any).userid || selectedUser.id;
      await menuApi.updateUserMenuItem(userid, parseInt(selectedMenuNode.id), true);
      showNotification('메뉴가 추가되었습니다.');
      loadUserMenuItems(tabId, userid);
    } catch (error) {
      console.error('메뉴 추가 실패:', error);
      showNotification('메뉴 추가에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshSidebarIfCurrentUser = (targetUserid: string) => {
    const currentUserid = authUser?.userid || authUser?.id;
    if (!currentUserid || currentUserid !== targetUserid || !authUser?.role) return;
    dispatch(clearMenuTree());
    dispatch(loadMenuTree(authUser.role));
  };

  const handleUserMenuItemCheck = async (tabId: MenuManagerTabId, itemId: string, checked: boolean) => {
    const { selectedUser, userMenuItems } = tabStates[tabId];
    if (!selectedUser) return;

    try {
      const menuItem = userMenuItems.find((item) => item.id === itemId);
      if (!menuItem) return;

      const userid = (selectedUser as any).userid || selectedUser.id;
      await menuApi.updateUserMenuItem(userid, parseInt(menuItem.menu_id), checked);

      updateTabState(tabId, {
        userMenuItems: userMenuItems.map((item) =>
          item.id === itemId ? { ...item, is_enabled: checked } : item
        ),
      });
      refreshSidebarIfCurrentUser(userid);
      showNotification('메뉴 권한이 저장되었습니다.');
    } catch (error) {
      console.error('권한 저장 실패:', error);
      showNotification('권한 저장에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-background">
      {notification && (
        <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="w-auto shadow-lg">
            {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{notification.type === 'success' ? '성공' : notification.type === 'error' ? '오류' : '알림'}</AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <Tabs value={currentTab} onValueChange={handleTabChange} className="flex flex-col h-full">
        <div className="h-12 px-4 border-b bg-muted/30 flex items-center border-[#343637] dark:border-[#6b7280]">
          <TabsList className="bg-transparent h-12">
            {MENU_MANAGER_TAB_ORDER.map((tabId) => (
              <TabsTrigger
                key={tabId}
                value={tabId}
                className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full"
              >
                {MENU_MANAGER_TABS[tabId].tabLabel}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {MENU_MANAGER_TAB_ORDER.map((tabId) => {
          const state = tabStates[tabId];
          const config = MENU_MANAGER_TABS[tabId];

          return (
            <TabsContent key={tabId} value={tabId} className="flex-1 p-0 m-0 overflow-hidden">
              <MenuManagerTabPanel
                config={config}
                menuTree={state.menuTree}
                expandedNodes={state.expandedNodes}
                selectedMenuNode={state.selectedMenuNode}
                onToggleExpand={(id) =>
                  updateTabState(tabId, {
                    expandedNodes: state.expandedNodes.includes(id)
                      ? state.expandedNodes.filter((nodeId) => nodeId !== id)
                      : [...state.expandedNodes, id],
                  })
                }
                onSelectMenuNode={(node) => updateTabState(tabId, { selectedMenuNode: node })}
                onToggleActive={(id, active) => handleMenuTreeToggle(tabId, id, active)}
                onUpdateName={(id, name) => handleSaveMenuName(tabId, id, name)}
                onReorder={(id, direction) => handleReorderMenu(tabId, id, direction)}
                onSelectAllMenus={() => handleSelectAllMenus(tabId)}
                users={state.users}
                total={state.total}
                loading={tabId === currentTab && loading}
                search={tabId === currentTab ? filters.search : ''}
                onSearchChange={(val) => {
                  if (tabId === currentTab) {
                    setFilters({ search: val });
                    setPagination((prev) => ({ ...prev, page: 0 }));
                  }
                }}
                onRefreshUsers={() => loadUsersForTab(tabId)}
                pagination={pagination}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
                selectedUser={state.selectedUser}
                onSelectUser={(user) => {
                  updateTabState(tabId, { selectedUser: user });
                  const userid = (user as any).userid || user.id;
                  if (userid) loadUserMenuItems(tabId, userid);
                }}
                userMenuItems={state.userMenuItems}
                onAddSelectedMenu={() => handleAddSelectedMenuToUser(tabId)}
                onSavePermissions={() => showNotification('저장되었습니다.')}
                onTogglePermission={(itemId, checked) => handleUserMenuItemCheck(tabId, itemId, checked)}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
};

export default MenuManager;
