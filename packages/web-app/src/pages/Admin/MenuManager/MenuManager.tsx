/**
 * 페이지 요약 — 메뉴·권한 관리 (`/admin/menumanager`)
 *
 * 기능: 사용자/관리자 메뉴 트리 편집, 사용자별 메뉴 권한 할당.
 *
 * 호출/연동:
 * - `menuApi`, `userManagerApi` (`services/menuApi.ts`, `userManagerApi.ts`)
 * - DB/SP는 `packages/api-server` 메뉴·권한 API 참조.
 *
 * 관련 컴포넌트: `MenuTree`, `UserListTable`, `UserPermissionPanel`.
 *
 * 흐름: 트리·사용자 목록 로드 → 노드/사용자 선택 → 권한 저장.
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { menuApi, UserMenuItem } from '../../../services/menuApi';
import { MenuTreeItem } from '../../../types/menu.types';
import { userManagerApi } from '../../../services/userManagerApi';
import { UserInfo } from '../../../types/userManager';
import { MenuTree } from './MenuTree';
import { UserListTable } from './UserListTable';
import { UserPermissionPanel } from './UserPermissionPanel';
import { useSnackbar } from '@/contexts/SnackbarContext';

const MenuManager: React.FC = () => {
  const { showSnackbar } = useSnackbar();
  
  // 탭 상태
  const [currentTab, setCurrentTab] = useState("user");

  // 사용자 메뉴 트리 상태
  const [userMenuTree, setUserMenuTree] = useState<MenuTreeItem[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [selectedMenuNode, setSelectedMenuNode] = useState<MenuTreeItem | null>(null);

  // 사용자 목록 상태
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [userMenuItems, setUserMenuItems] = useState<UserMenuItem[]>([]);

  // 관리자 메뉴 트리 상태
  const [adminMenuTree, setAdminMenuTree] = useState<MenuTreeItem[]>([]);
  const [adminExpandedNodes, setAdminExpandedNodes] = useState<string[]>([]);
  const [adminSelectedMenuNode, setAdminSelectedMenuNode] = useState<MenuTreeItem | null>(null);

  // 관리자 사용자 목록 상태
  const [adminUsers, setAdminUsers] = useState<UserInfo[]>([]);
  const [adminSelectedUser, setAdminSelectedUser] = useState<UserInfo | null>(null);
  const [adminUserMenuItems, setAdminUserMenuItems] = useState<UserMenuItem[]>([]);

  // 필터 및 검색 상태
  const [filters, setFilters] = useState({
    search: '',
  });

  // 페이지네이션 상태
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: 10,
  });

  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // 알림 상태
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 초기 데이터 로드
  useEffect(() => {
    loadUserMenuTree();
    loadUsers();
    loadAdminMenuTree();
    loadAdminUsers();
  }, []);

  // 검색어나 페이지네이션 변경 시 사용자 목록 다시 로드
  useEffect(() => {
    loadUsers();
  }, [filters.search, pagination.page, pagination.pageSize]);

  // 관리자 사용자 목록 검색 변경 시 다시 로드
  useEffect(() => {
    if (currentTab === "admin") {
      loadAdminUsers();
    }
  }, [filters.search, currentTab]);

  // --- 데이터 로드 함수들 ---

  const convertToMenuTreeItems = (menus: any[]): MenuTreeItem[] => {
    return menus.map(menu => ({
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
      children: menu.children ? convertToMenuTreeItems(menu.children) : []
    }));
  };

  const getAllExpandableNodeIds = (items: MenuTreeItem[]): string[] => {
    const ids: string[] = [];
    items.forEach(item => {
      if (item.children && item.children.length > 0) {
        ids.push(item.id);
        ids.push(...getAllExpandableNodeIds(item.children));
      }
    });
    return ids;
  };

  const loadUserMenuTree = async () => {
    try {
      const response = await menuApi.getAdminUserMenuTree();
      if (response.success && response.data) {
        const treeData = convertToMenuTreeItems(response.data);
        setUserMenuTree(treeData);
        setExpandedNodes(getAllExpandableNodeIds(treeData));
      }
    } catch (error) {
      console.error('사용자 메뉴 트리 로드 실패:', error);
    }
  };

  const loadAdminMenuTree = async () => {
    try {
      const response = await menuApi.getAdminAdminMenuTree();
      if (response.success && response.data) {
        const treeData = convertToMenuTreeItems(response.data);
        setAdminMenuTree(treeData);
        setAdminExpandedNodes(getAllExpandableNodeIds(treeData));
      }
    } catch (error) {
      console.error('관리자 메뉴 트리 로드 실패:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userManagerApi.getUsers({
        role: 'user',
        page: pagination.page + 1,
        limit: pagination.pageSize,
        search: filters.search
      });
      setUsers(response.users);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      setLoading(true);
      const response = await userManagerApi.getUsers({
        role: 'admin' as any,
        page: pagination.page + 1,
        limit: pagination.pageSize,
        search: filters.search
      });
      setAdminUsers(response.users || []);
    } catch (error) {
      console.error('관리자 사용자 목록 로드 실패:', error);
      setAdminUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserMenuItems = async (userId: string) => {
    try {
      const response = await menuApi.getUserMenuItems(userId);
      if (response.success && response.data) {
        setUserMenuItems(response.data);
      } else {
        setUserMenuItems([]);
      }
    } catch (error) {
      console.error('사용자 메뉴 권한 로드 실패:', error);
      setUserMenuItems([]);
    }
  };

  const loadAdminUserMenuItems = async (userId: string) => {
    try {
      const response = await menuApi.getUserMenuItems(userId);
      if (response.success && response.data) {
        setAdminUserMenuItems(response.data);
      } else {
        setAdminUserMenuItems([]);
      }
    } catch (error) {
      console.error('관리자 메뉴 권한 로드 실패:', error);
      setAdminUserMenuItems([]);
    }
  };

  // --- 이벤트 핸들러 ---

  const handleMenuTreeToggle = async (nodeId: string, currentActive: boolean, isAdmin: boolean) => {
    try {
      const newActive = !currentActive;
      await menuApi.updateMenuStatus(Number(nodeId), newActive);

      const updateTreeStatus = (items: MenuTreeItem[]): MenuTreeItem[] => {
        return items.map(item => {
          if (item.id === nodeId) {
            return { ...item, checked: newActive, is_active: newActive };
          }
          if (item.children) {
            return { ...item, children: updateTreeStatus(item.children) };
          }
          return item;
        });
      };

      if (isAdmin) {
        setAdminMenuTree(updateTreeStatus(adminMenuTree));
      } else {
        setUserMenuTree(updateTreeStatus(userMenuTree));
      }
    } catch (error) {
      console.error('메뉴 상태 업데이트 실패:', error);
      showNotification('메뉴 상태 업데이트에 실패했습니다.', 'error');
    }
  };

  /** 같은 레벨 내 메뉴 순서 변경 (위/아래 이동) */
  const handleReorderMenu = async (itemId: string, direction: 'up' | 'down', isAdmin: boolean) => {
    const tree = isAdmin ? adminMenuTree : userMenuTree

    const findPath = (items: MenuTreeItem[], targetId: string, path: number[] = []): number[] | null => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === targetId) return [...path, i]
        const found = items[i].children?.length
          ? findPath(items[i].children!, targetId, [...path, i])
          : null
        if (found) return found
      }
      return null
    }

    const path = findPath(tree, itemId)
    if (!path || path.length === 0) return

    const parentPath = path.slice(0, -1)
    const itemIndex = path[path.length - 1]
    const swapIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1

    const getSiblingAt = (items: MenuTreeItem[], p: number[]): MenuTreeItem[] | null => {
      if (p.length === 0) return items
      const [first, ...rest] = p
      if (first >= items.length || !items[first].children) return null
      return getSiblingAt(items[first].children!, rest)
    }

    const siblings = getSiblingAt(tree, parentPath)
    if (!siblings || swapIndex < 0 || swapIndex >= siblings.length) return

    const currentItem = siblings[itemIndex]
    const swapItem = siblings[swapIndex]

    try {
      await Promise.all([
        menuApi.updateMenu(parseInt(currentItem.id), { sort_order: swapItem.sort_order }),
        menuApi.updateMenu(parseInt(swapItem.id), { sort_order: currentItem.sort_order })
      ])

      const swapInTree = (items: MenuTreeItem[], p: number[], idx: number, swapIdx: number): MenuTreeItem[] => {
        if (p.length === 0) {
          const next = [...items]
          ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
          return next
        }
        const [first, ...rest] = p
        return items.map((item, i) =>
          i === first && item.children
            ? { ...item, children: swapInTree(item.children, rest, idx, swapIdx) }
            : item
        )
      }

      const newTree = swapInTree(tree, parentPath, itemIndex, swapIndex)
      if (isAdmin) setAdminMenuTree(newTree)
      else setUserMenuTree(newTree)
      showNotification('메뉴 순서가 변경되었습니다.')
    } catch (error) {
      console.error('메뉴 순서 변경 실패:', error)
      showNotification('메뉴 순서 변경에 실패했습니다.', 'error')
    }
  }

  const handleSaveMenuName = async (menuId: string, newName: string, isAdmin: boolean) => {
    if (!newName.trim()) {
      showNotification('메뉴명을 입력해주세요.', 'error');
      return;
    }

    try {
      await menuApi.updateMenu(parseInt(menuId), { name: newName.trim() });

      const updateTreeName = (items: MenuTreeItem[]): MenuTreeItem[] => {
        return items.map(item => {
          if (item.id === menuId) {
            return { ...item, name: newName.trim() };
          }
          if (item.children) {
            return { ...item, children: updateTreeName(item.children) };
          }
          return item;
        });
      };

      if (isAdmin) {
        setAdminMenuTree(prev => updateTreeName(prev));
      } else {
        setUserMenuTree(prev => updateTreeName(prev));
      }
      showNotification('메뉴명이 저장되었습니다.');
    } catch (error) {
      console.error('메뉴명 저장 실패:', error);
      showNotification('메뉴명 저장에 실패했습니다.', 'error');
    }
  };

  const handleSelectAllMenus = async (isAdmin: boolean) => {
    const selectedNode = isAdmin ? adminSelectedMenuNode : selectedMenuNode;
    const selectedUserObj = isAdmin ? adminSelectedUser : selectedUser;

    if (!selectedNode) {
      showSnackbar({ message: '먼저 메뉴를 선택해주세요.', severity: 'info' });
      return;
    }

    if (selectedNode.menu_type !== 'page') {
      showSnackbar({ message: 'page 타입 메뉴만 추가할 수 있습니다.', severity: 'info' });
      return;
    }

    try {
      setLoading(true);
      const result = await menuApi.enableMenuForAllUsers(Number(selectedNode.id));

      if (result.success) {
        showSnackbar({ 
          message: `선택한 메뉴 "${selectedNode.name}"는 모든 ${isAdmin ? '관리자' : '사용자'}가 사용 가능하게 되었습니다.`, 
          severity: 'success' 
        });

        // UI에서도 즉시 "활성화" 상태로 반영 (메뉴 토글과 동일한 방식)
        const updateTreeStatus = (items: MenuTreeItem[]): MenuTreeItem[] => {
          return items.map(item => {
            if (item.id === selectedNode.id) {
              return { ...item, checked: true, is_active: true };
            }
            if (item.children) {
              return { ...item, children: updateTreeStatus(item.children) };
            }
            return item;
          });
        };

        if (isAdmin) {
          setAdminMenuTree(prev => updateTreeStatus(prev));
        } else {
          setUserMenuTree(prev => updateTreeStatus(prev));
        }

        if (selectedUserObj) {
          const userid = (selectedUserObj as any).userid || selectedUserObj.id;
          if (isAdmin) loadAdminUserMenuItems(userid);
          else loadUserMenuItems(userid);
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

  const handleAddSelectedMenuToUser = async (isAdmin: boolean) => {
    const selectedNode = isAdmin ? adminSelectedMenuNode : selectedMenuNode;
    const selectedUserObj = isAdmin ? adminSelectedUser : selectedUser;
    const menuItems = isAdmin ? adminUserMenuItems : userMenuItems;

    if (!selectedNode) {
      showNotification('먼저 메뉴를 선택해주세요.', 'info');
      return;
    }
    if (!selectedUserObj) {
      showNotification(`먼저 ${isAdmin ? '관리자' : '사용자'}를 선택해주세요.`, 'info');
      return;
    }
    if (selectedNode.menu_type !== 'page') {
      showNotification('page 타입 메뉴만 추가할 수 있습니다.', 'info');
      return;
    }

    const alreadyExists = menuItems.some(item => item.menu_id === selectedNode.id);
    if (alreadyExists) {
      showNotification('이미 추가된 메뉴입니다.', 'info');
      return;
    }

    try {
      setLoading(true);
      await menuApi.updateUserMenuItem(
        (selectedUserObj as any).userid || selectedUserObj.id,
        parseInt(selectedNode.id),
        true
      );
      showNotification('메뉴가 추가되었습니다.');

      const userid = (selectedUserObj as any).userid || selectedUserObj.id;
      if (isAdmin) loadAdminUserMenuItems(userid);
      else loadUserMenuItems(userid);
    } catch (error) {
      console.error('메뉴 추가 실패:', error);
      showNotification('메뉴 추가에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUserMenuItemCheck = async (itemId: string, checked: boolean, isAdmin: boolean) => {
    const selectedUserObj = isAdmin ? adminSelectedUser : selectedUser;
    const menuItems = isAdmin ? adminUserMenuItems : userMenuItems;

    if (!selectedUserObj) return;

    try {
      const menuItem = menuItems.find(item => item.id === itemId);
      if (!menuItem) return;

      await menuApi.updateUserMenuItem(
        (selectedUserObj as any).userid || selectedUserObj.id,
        parseInt(menuItem.menu_id),
        checked
      );

      const updateItems = (items: UserMenuItem[]) =>
        items.map(item => item.id === itemId ? { ...item, is_enabled: checked } : item);

      if (isAdmin) setAdminUserMenuItems(prev => updateItems(prev));
      else setUserMenuItems(prev => updateItems(prev));

      showNotification('메뉴 권한이 저장되었습니다.');
    } catch (error) {
      console.error('권한 저장 실패:', error);
      showNotification('권한 저장에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="p-0 h-[calc(100vh-140px)] overflow-hidden flex flex-col bg-background">
      {/* 알림 메시지 */}
      {notification && (
        <div className="absolute top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Alert variant={notification.type === 'error' ? 'destructive' : 'default'} className="w-auto shadow-lg">
            {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{notification.type === 'success' ? '성공' : notification.type === 'error' ? '오류' : '알림'}</AlertTitle>
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex flex-col h-full">
        <div className="h-12 px-4 border-b bg-muted/30 flex items-center border-[#343637] dark:border-[#6b7280]">
          <TabsList className="bg-transparent h-12">
            <TabsTrigger
              value="user"
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full"
            >
              사용자메뉴
            </TabsTrigger>
            <TabsTrigger
              value="admin"
              className="px-6 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-full"
            >
              관리자메뉴
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 사용자 메뉴 탭 */}
        <TabsContent value="user" className="flex-1 p-0 m-0 overflow-hidden">
          <div className="flex gap-[3px] h-full p-0 bg-background">
            {/* 좌측: 메뉴 트리 */}
            <Card className="flex-[0.6] flex flex-col min-w-0 shadow-md border border-[#343637] dark:border-[#6b7280] bg-card overflow-hidden">
              <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-semibold">사용자 메뉴</CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-[#343637] dark:border-[#6b7280]"
                    onClick={() => handleSelectAllMenus(false)}
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
                  items={userMenuTree}
                  selectedId={selectedMenuNode?.id || null}
                  expandedIds={expandedNodes}
                  onToggleExpand={(id) => {
                    setExpandedNodes(prev =>
                      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
                    )
                  }}
                  onSelect={setSelectedMenuNode}
                  onToggleActive={(id, active) => handleMenuTreeToggle(id, active, false)}
                  onUpdateName={(id, name) => handleSaveMenuName(id, name, false)}
                  onReorder={(id, direction) => handleReorderMenu(id, direction, false)}
                />
              </CardContent>
            </Card>

            {/* 우측: 사용자 관리 */}
            <div className="flex-[1.4] flex flex-col gap-[3px] min-w-0">
              {/* 상단: 사용자 목록 */}
              <div className="flex-1 min-h-0">
                <UserListTable
                  title="사용자 목록"
                  users={users}
                  total={total}
                  loading={loading}
                  search={filters.search}
                  onSearchChange={(val) => setFilters(prev => ({ ...prev, search: val }))}
                  onRefresh={loadUsers}
                  pagination={pagination}
                  onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  selectedUserId={selectedUser?.id || null}
                  onSelectUser={(user) => {
                    setSelectedUser(user);
                    const userid = (user as any).userid || user.id;
                    if (userid) loadUserMenuItems(userid);
                  }}
                />
              </div>

              {/* 하단: 사용자 정보 및 권한 */}
              <div className="flex-1 min-h-0">
                <UserPermissionPanel
                  selectedUser={selectedUser}
                  userMenuItems={userMenuItems}
                  onAddSelectedMenu={() => handleAddSelectedMenuToUser(false)}
                  onSave={() => showNotification('저장되었습니다.')}
                  onTogglePermission={(itemId, checked) => handleUserMenuItemCheck(itemId, checked, false)}
                  selectedMenuNodeId={selectedMenuNode?.id || null}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 관리자 메뉴 탭 */}
        <TabsContent value="admin" className="flex-1 p-0 m-0 overflow-hidden">
          <div className="flex gap-[3px] h-full p-0 bg-background">
            {/* 좌측: 관리자 메뉴 트리 */}
            <Card className="flex-[0.6] flex flex-col min-w-0 shadow-md border border-[#343637] dark:border-[#6b7280] bg-card overflow-hidden">
              <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-semibold">관리자 메뉴</CardTitle>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-[#343637] dark:border-[#6b7280]"
                    onClick={() => handleSelectAllMenus(true)}
                    disabled={!adminSelectedMenuNode}
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
                  items={adminMenuTree}
                  selectedId={adminSelectedMenuNode?.id || null}
                  expandedIds={adminExpandedNodes}
                  onToggleExpand={(id) => {
                    setAdminExpandedNodes(prev =>
                      prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
                    )
                  }}
                  onSelect={setAdminSelectedMenuNode}
                  onToggleActive={(id, active) => handleMenuTreeToggle(id, active, true)}
                  onUpdateName={(id, name) => handleSaveMenuName(id, name, true)}
                  onReorder={(id, direction) => handleReorderMenu(id, direction, true)}
                />
              </CardContent>
            </Card>

            {/* 우측: 관리자 관리 */}
            <div className="flex-[1.4] flex flex-col gap-[3px] min-w-0">
              {/* 상단: 관리자 목록 */}
              <div className="flex-1 min-h-0">
                <UserListTable
                  title="관리자 목록"
                  isAdminTable={true}
                  users={adminUsers}
                  total={adminUsers.length}
                  loading={loading}
                  search={filters.search}
                  onSearchChange={(val) => setFilters(prev => ({ ...prev, search: val }))}
                  onRefresh={loadAdminUsers}
                  pagination={pagination}
                  onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  selectedUserId={adminSelectedUser?.id || null}
                  onSelectUser={(user) => {
                    setAdminSelectedUser(user);
                    const userid = (user as any).userid || user.id;
                    if (userid) loadAdminUserMenuItems(userid);
                  }}
                />
              </div>

              {/* 하단: 관리자 정보 및 권한 */}
              <div className="flex-1 min-h-0">
                <UserPermissionPanel
                  isAdminPanel={true}
                  selectedUser={adminSelectedUser}
                  userMenuItems={adminUserMenuItems}
                  onAddSelectedMenu={() => handleAddSelectedMenuToUser(true)}
                  onSave={() => showNotification('저장되었습니다.')}
                  onTogglePermission={(itemId, checked) => handleUserMenuItemCheck(itemId, checked, true)}
                  selectedMenuNodeId={adminSelectedMenuNode?.id || null}
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MenuManager;
