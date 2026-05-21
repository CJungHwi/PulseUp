/**
 * 기존 메뉴 구조를 MUI DashboardLayout Navigation 형식으로 변환하는 유틸리티
 */

import React from 'react'
import { MenuTreeItem } from '../types/menu.types'
import type { Navigation } from '@toolpad/core'
import {
  Dashboard,
  FitnessCenter,
  Campaign,
  Menu,
  Room,
  ManageAccounts,
  Settings,
  People as Users,
  Inventory as Package,
  BarChart,
  Description as FileText,
  VideoLibrary as Video,
  Notifications as Bell,
  Timeline as Activity,
  Person as User,
  Security as Shield,
} from '@mui/icons-material'

// 아이콘 매핑
const iconMapping: Record<string, React.ComponentType> = {
  Dashboard,
  FitnessCenter,
  Campaign,
  Menu,
  Room,
  ManageAccounts,
  Settings,
  Users,
  Package,
  BarChart,
  FileText,
  Video,
  Bell,
  Activity,
  User,
  Shield,
}

// 아이콘 이름으로 JSX 엘리먼트 가져오기
const getIconElement = (iconName: string | null): React.ReactElement | undefined => {
  if (!iconName) return undefined
  
  // 정확한 매칭
  if (iconMapping[iconName]) {
    const IconComponent = iconMapping[iconName]
    return React.createElement(IconComponent)
  }
  
  // 케이스 변환 시도
  const variations = [
    iconName.toLowerCase(),
    iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase(),
  ]
  
  for (const variation of variations) {
    if (iconMapping[variation]) {
      const IconComponent = iconMapping[variation]
      return React.createElement(IconComponent)
    }
  }
  
  return React.createElement(Dashboard) // 기본값
}

/**
 * MenuTreeItem을 MUI DashboardLayout Navigation 형식으로 변환
 */
export const convertMenuToNavigation = (menuItems: MenuTreeItem[]): Navigation => {
  const convertMenuItem = (item: MenuTreeItem): any => {
    // divider 타입
    if (item.menu_type === 'divider') {
      return { kind: 'divider' }
    }
    
    // folder 타입 (헤더)
    if (item.menu_type === 'folder') {
      return {
        kind: 'header',
        title: item.name,
      }
    }
    
    // page 타입 (실제 네비게이션 링크)
    if (item.menu_type === 'page') {
      const iconElement = getIconElement(item.icon)
      
      const navItem: any = {
        segment: item.url?.startsWith('/') ? item.url.substring(1) : item.url || item.id, // URL에서 앞의 '/' 제거
        title: item.name,
      }
      
      if (iconElement) {
        navItem.icon = iconElement
      }
      
      // 자식이 있는 경우 중첩 구조
      if (item.children && item.children.length > 0) {
        navItem.children = item.children.map(convertMenuItem)
      }
      
      return navItem
    }
    
    // link 타입도 page와 동일하게 처리
    if (item.menu_type === 'link') {
      const iconElement = getIconElement(item.icon)
      
      const navItem: any = {
        segment: item.url?.startsWith('/') ? item.url.substring(1) : item.url || item.id,
        title: item.name,
      }
      
      if (iconElement) {
        navItem.icon = iconElement
      }
      
      return navItem
    }
    
    return null
  }
  
  return menuItems
    .map(convertMenuItem)
    .filter(Boolean) // null 값 제거
}

/**
 * 플랫한 메뉴 배열을 트리 구조로 변환 (필요한 경우)
 */
export const buildMenuTree = (flatMenus: MenuTreeItem[]): MenuTreeItem[] => {
  const menuMap = new Map<string, MenuTreeItem>()
  const rootMenus: MenuTreeItem[] = []
  
  // 모든 메뉴를 맵에 저장하고 children 배열 초기화
  flatMenus.forEach(menu => {
    menuMap.set(menu.id, { ...menu, children: [] })
  })
  
  // 부모-자식 관계 설정
  flatMenus.forEach(menu => {
    const menuItem = menuMap.get(menu.id)!
    
    if (menu.parent_id && menuMap.has(menu.parent_id)) {
      // 부모가 있는 경우 부모의 children에 추가
      const parent = menuMap.get(menu.parent_id)!
      parent.children.push(menuItem)
    } else {
      // 루트 메뉴인 경우
      rootMenus.push(menuItem)
    }
  })
  
  // sort_order에 따라 정렬
  const sortMenus = (menus: MenuTreeItem[]): MenuTreeItem[] => {
    return menus
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(menu => ({
        ...menu,
        children: sortMenus(menu.children)
      }))
  }
  
  return sortMenus(rootMenus)
}
