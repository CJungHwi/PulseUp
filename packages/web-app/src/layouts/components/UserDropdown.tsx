import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAppSelector, useAppDispatch } from '../../hooks/redux'
import { logout as logoutAction } from '../../store/slices/authSlice'
import { resetMenuState } from '../../store/slices/menuSlice'
import { authService } from '../../services/auth.service'

export const UserDropdown: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)


  const handleSettingsClick = () => {
    navigate('/settings')
  }


  const handleLogout = async () => {
    try {
      // authService의 logout 메서드도 호출 (필요시 서버에 로그아웃 요청)
      await authService.logout()
    } catch (error) {
      console.error('로그아웃 요청 실패:', error)
    }

    // Redux 상태 초기화 (localStorage 정리도 포함됨)
    dispatch(logoutAction())
    // 메뉴 상태도 초기화
    dispatch(resetMenuState())

    // 로그인 페이지로 리다이렉트
    navigate('/login')
  }

  if (!user) {
    return null
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin'

  // 사용자 이니셜 생성 (name → userid → email 순으로 대체, 안전 처리)
  const getInitials = (name?: string | null) => {
    const primary = (name || '').trim()
    const fallbackUserId = (user as any)?.userid ? String((user as any).userid).trim() : ''
    const fallbackEmail = (user as any)?.email ? String((user as any).email).trim() : ''

    const source = primary || fallbackUserId || fallbackEmail || '?'
    const firstChar = source.length > 0 ? source.charAt(0) : '?'
    return firstChar.toUpperCase()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full p-0 hover:bg-accent hover:text-accent-foreground"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-sm font-semibold border-2 border-white/20">
            {getInitials(user.name)}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-background border-border" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {user.name || user.email || '사용자'} ({isAdmin ? '관리자' : '사용자'})
            </p>
            <p className="text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-muted" />
        <DropdownMenuItem
          onClick={handleSettingsClick}
          className="cursor-pointer text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>계정 설정</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-muted" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer bg-destructive/90 text-white hover:bg-destructive hover:text-white"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}