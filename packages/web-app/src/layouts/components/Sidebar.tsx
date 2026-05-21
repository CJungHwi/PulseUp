import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Store,
  MessageSquare,
  BarChart,
  FileText,
  ClipboardCheck,
  DollarSign,
  HelpCircle,
  Settings,
  LogOut,
  User,
  Dumbbell,
  BookOpen,
  PlayCircle,
  TrendingUp,
  Bell,
  Users,
  Calendar,
  Activity,
  Image,
  Music,
  Heart,
  Target,
  Award,
  Shield,
  Megaphone,
  Menu,
  MapPin,
  UserCog,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  GitBranch,
  Video,
  Zap,
  Sparkles,
  Layers,
  Flame,
  LucideIcon
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAppSelector, useAppDispatch } from '../../hooks/redux'
import { logout } from '../../store/slices/authSlice'
import { loadMenuTree, selectMenuTree, selectMenuTreeLoading, selectMenuTreeError } from '../../store/slices/menuSlice'
import { MenuTreeItem } from '../../types/menu.types'
import { useTheme } from '../../contexts/ThemeContext'

// 글로벌 타입 확장
declare global {
  interface Window {
    addLucideIcon: (iconName: string, iconComponent: LucideIcon) => void
  }
}

interface SidebarProps {
  isCollapsed: boolean
  isMobile?: boolean
  isOpen?: boolean
  onCloseMobile?: () => void
  onToggleCollapse?: () => void
}

// 글로벌 아이콘 매핑 유틸리티
const GLOBAL_ICON_REGISTRY = new Map<string, LucideIcon>()

// 초기 아이콘 등록
const initializeIconRegistry = () => {
  const iconPairs: [string, LucideIcon][] = [
    ['Dashboard', LayoutDashboard],
    ['FitnessCenter', Dumbbell],
    ['Campaign', Megaphone],
    ['Menu', Menu],
    ['Room', MapPin],
    ['ManageAccounts', UserCog],
    ['Settings', Settings],
    ['Users', Users],
    ['Package', Package],
    ['BarChart', BarChart],
    ['FileText', FileText],
    ['Bell', Bell],
    ['Activity', Activity],
    ['LogOut', LogOut],
    ['User', User],
    ['Shield', Shield],
    ['AccountTree', GitBranch],
    ['VideoLibrary', Video],
    ['RunCircle', Zap],
    ['SpaceDashboard', Sparkles],
    ['EmojiPeople', User],
    ['HdrStrong', Flame],
    ['HdrWeak', Layers],
  ]

  iconPairs.forEach(([name, component]) => {
    GLOBAL_ICON_REGISTRY.set(name, component)
    GLOBAL_ICON_REGISTRY.set(name.toLowerCase(), component)
  })
}

// 런타임에 새 아이콘 등록
window.addLucideIcon = (iconName: string, iconComponent: LucideIcon) => {
  GLOBAL_ICON_REGISTRY.set(iconName, iconComponent)
}

// 초기화
initializeIconRegistry()

// 아이콘 매핑 함수
const getIconComponent = (iconName: string | null): LucideIcon => {
  if (!iconName) return LayoutDashboard

  if (GLOBAL_ICON_REGISTRY.has(iconName)) {
    return GLOBAL_ICON_REGISTRY.get(iconName)!
  }

  const variations = [
    iconName.toLowerCase(),
    iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase(),
  ]

  for (const variation of variations) {
    if (GLOBAL_ICON_REGISTRY.has(variation)) {
      return GLOBAL_ICON_REGISTRY.get(variation)!
    }
  }

  return LayoutDashboard
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobile = false,
  isOpen = false,
  onCloseMobile,
  onToggleCollapse
}) => {
  const { mode, toggleTheme } = useTheme()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector((state) => state.auth)
  const menuTree = useAppSelector(selectMenuTree) || []
  const isMenuLoading = useAppSelector(selectMenuTreeLoading) || false
  const menuError = useAppSelector(selectMenuTreeError) || null

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isAuthenticated && user?.role && (!menuTree || menuTree.length === 0) && !isMenuLoading) {
      dispatch(loadMenuTree(user.role))
    }
  }, [dispatch, isAuthenticated, user?.role, isMenuLoading, mode])

  const handleMenuClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile()
    }
  }

  const handleLogout = () => {
    dispatch(logout())
    dispatch({ type: 'menu/resetMenuState' })
    if (isMobile && onCloseMobile) {
      onCloseMobile()
    }
  }

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  // 공통 메뉴 아이템 스타일
  const menuItemClass = cn(
    "flex items-center w-full p-2 rounded-md text-sm font-medium transition-colors h-10",
    "text-[#1d1d1d] hover:text-[#1d1d1d] hover:bg-gray-100",
    "dark:text-white dark:hover:text-white dark:hover:bg-gray-800"
  )

  const activeMenuItemClass = cn(
    "bg-gray-100 text-[#1d1d1d]",
    "dark:bg-gray-800 dark:text-white"
  )

  const renderTreeItem = (menuItem: MenuTreeItem, depth: number = 0): React.ReactNode => {
    const IconComponent = getIconComponent(menuItem.icon)
    const isExpanded = expandedItems.has(menuItem.id)
    const hasChildren = menuItem.children && menuItem.children.length > 0

    // 동적 패딩 계산 (Tailwind 클래스 대신 인라인 스타일 사용)
    const paddingLeft = isCollapsed ? undefined : `${depth * 12 + 12}px`

    if (menuItem.menu_type === 'divider') {
      return <Separator key={menuItem.id} className="my-2 bg-gray-200 dark:bg-gray-700" />
    }

    if (menuItem.menu_type === 'folder') {
      if (isCollapsed) {
        // 접힌 상태에서는 폴더를 표시하지 않음
        return menuItem.children?.map(child => renderTreeItem(child, depth))
      }

      return (
        <div key={menuItem.id}>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-white uppercase tracking-wider">
            {menuItem.name}
          </div>
          {menuItem.children?.map(child => renderTreeItem(child, depth + 1))}
        </div>
      )
    }

    // 페이지 타입 메뉴
    if (menuItem.menu_type === 'page') {
      // 접힌 상태일 때의 단순화된 렌더링
      if (isCollapsed) {
        return (
          <TooltipProvider key={menuItem.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* 하위 메뉴가 있어도 접힌 상태에서는 그냥 아이콘 버튼처럼 동작 (클릭 시 확장/이동 로직은 상황에 따라 다를 수 있음) 
                    여기서는 단순히 아이콘을 보여주는 것에 집중 */}
                {hasChildren ? (
                  <button
                    className={cn(menuItemClass, "justify-center px-2")}
                    onClick={() => toggleExpanded(menuItem.id)}
                  >
                    <div className="flex items-center justify-center w-full">
                      <IconComponent className="h-5 w-5 flex-shrink-0" />
                    </div>
                  </button>
                ) : menuItem.url || menuItem.path ? (
                  <NavLink
                    to={menuItem.url || menuItem.path}
                    onClick={handleMenuClick}
                    className={({ isActive }) =>
                      cn(
                        menuItemClass,
                        "justify-center px-2",
                        isActive && activeMenuItemClass
                      )
                    }
                  >
                    <div className="flex items-center justify-center w-full">
                      <IconComponent className="h-5 w-5 flex-shrink-0" />
                    </div>
                  </NavLink>
                ) : (
                  <button
                    disabled
                    className={cn(menuItemClass, "opacity-50 cursor-not-allowed justify-center px-2")}
                  >
                    <div className="flex items-center justify-center w-full">
                      <IconComponent className="h-5 w-5 flex-shrink-0" />
                    </div>
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent side="right">{menuItem.name}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      // 펼쳐진 상태일 때의 렌더링 (기존 로직 유지)
      if (hasChildren) {
        return (
          <Collapsible
            key={menuItem.id}
            open={isExpanded}
            onOpenChange={() => toggleExpanded(menuItem.id)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  menuItemClass,
                  "justify-between"
                )}
                style={{ paddingLeft: paddingLeft }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <IconComponent className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{menuItem.name}</span>
                </div>
                <ChevronRight className={cn("h-4 w-4 flex-shrink-0 transition-transform", isExpanded && "rotate-90")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {menuItem.children?.map(child => renderTreeItem(child, depth + 1))}
            </CollapsibleContent>
          </Collapsible>
        )
      } else if (menuItem.url || menuItem.path) {
        return (
          <NavLink
            key={menuItem.id}
            to={menuItem.url || menuItem.path}
            onClick={handleMenuClick}
            className={({ isActive }) =>
              cn(
                menuItemClass,
                isActive && activeMenuItemClass
              )
            }
            style={{ paddingLeft: paddingLeft }}
          >
            <div className="flex items-center gap-3 overflow-hidden w-full">
              <IconComponent className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{menuItem.name}</span>
            </div>
          </NavLink>
        )
      } else {
        return (
          <button
            key={menuItem.id}
            disabled
            className={cn(
              menuItemClass,
              "opacity-50 cursor-not-allowed"
            )}
            style={{ paddingLeft: paddingLeft }}
          >
            <div className="flex items-center gap-3 overflow-hidden w-full">
              <IconComponent className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{menuItem.name}</span>
            </div>
          </button>
        )
      }
    }

    return null
  }

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#f9fafb] dark:bg-[#1d1d1d] text-[#1d1d1d] dark:text-white border-r border-border">
      {/* 로고 영역 */}
      <div className={cn(
        "h-[70px] border-b border-border flex items-center transition-all flex-shrink-0",
        isCollapsed ? "justify-center px-3" : "justify-between px-4"
      )}>
        <div className={cn("flex items-center gap-2 flex-1 overflow-hidden", isCollapsed && "justify-center")}>
          {/* 로고 아이콘 */}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* 브랜드 텍스트 */}
          {!isCollapsed && (
            <img
              src="/logo.png"
              alt="LINKHIIT"
              className="max-w-[120px] h-auto object-contain"
            />
          )}
        </div>
      </div>

      {/* 메뉴 리스트 */}
      <ScrollArea className="flex-1">
        <div className={cn("px-2 flex flex-col", isCollapsed ? "gap-4 py-4" : "gap-1 py-2")}>
          {isMenuLoading ? (
            <div className="text-sm text-gray-500 dark:text-white text-center py-5">
              메뉴 로딩 중...
            </div>
          ) : menuError ? (
            <div className="text-sm text-red-500 text-center py-5">
              메뉴 로드 실패: {menuError}
            </div>
          ) : !isAuthenticated ? (
            <div className="text-sm text-gray-500 dark:text-white text-center py-5">
              로그인이 필요합니다.
            </div>
          ) : !user ? (
            <div className="text-sm text-gray-500 dark:text-white text-center py-5">
              사용자 정보 로딩 중...
            </div>
          ) : menuTree && menuTree.length > 0 ? (
            menuTree.map(menuItem => renderTreeItem(menuItem))
          ) : (
            <div className="text-sm text-gray-500 dark:text-white text-center py-5">
              메뉴가 없습니다. (역할: {user?.role})
            </div>
          )}
        </div>
      </ScrollArea>

      <div className={cn("p-2 border-t border-border flex-shrink-0 flex flex-col", isCollapsed ? "gap-4" : "gap-1")}>
        {/* 테마 토글 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className={cn(
                  menuItemClass,
                  isCollapsed && "justify-center px-2"
                )}
                style={{ paddingLeft: isCollapsed ? undefined : '12px' }}
              >
                <div className={cn("flex items-center gap-3 overflow-hidden w-full", isCollapsed && "justify-center")}>
                  {mode === 'dark' ? (
                    <Sun className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <Moon className="h-5 w-5 flex-shrink-0" />
                  )}
                  {!isCollapsed && <span className="truncate text-sm">{mode === 'dark' ? '라이트 모드' : '다크 모드'}</span>}
                </div>
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                {mode === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* MUI 라이선스 링크 */}
        {/* <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/mui-license"
                onClick={handleMenuClick}
                className={({ isActive }) =>
                  cn(
                    menuItemClass,
                    isCollapsed && "justify-center px-2",
                    isActive && activeMenuItemClass
                  )
                }
                style={{ paddingLeft: isCollapsed ? undefined : '12px' }}
              >
                <div className={cn("flex items-center gap-3 overflow-hidden w-full", isCollapsed && "justify-center")}>
                  <Shield className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span className="truncate text-sm">MUI 라이선스</span>}
                </div>
              </NavLink>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">MUI 라이선스</TooltipContent>}
          </Tooltip>
        </TooltipProvider> */}

        {/* 로그아웃 버튼 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  menuItemClass,
                  "dark:text-white",
                  "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400",
                  isCollapsed && "justify-center px-2"
                )}
                style={{ paddingLeft: isCollapsed ? undefined : '12px' }}
              >
                <div className={cn("flex items-center gap-3 overflow-hidden w-full", isCollapsed && "justify-center")}>
                  <LogOut className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span className="truncate text-sm">로그아웃</span>}
                </div>
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">로그아웃</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onCloseMobile}>
        <SheetContent side="left" className="p-0 w-[252px] bg-white dark:bg-gray-900 border-r border-border">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className={cn(
        "h-full flex-shrink-0 transition-all duration-200 overflow-hidden border-r border-border",
        isCollapsed ? "w-16" : "w-[252px]"
      )}
    >
      {sidebarContent}
    </div>
  )
}