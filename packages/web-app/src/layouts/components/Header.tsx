import React from 'react'
import { Sun, Moon, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserDropdown } from './UserDropdown'
import { useAppSelector } from '../../hooks/redux'
import { useTheme } from '../../contexts/ThemeContext'

interface HeaderProps {
  onToggleSidebar: () => void
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user } = useAppSelector((state) => state.auth)
  const { mode, cycleTheme } = useTheme()

  const handleDownloadApp = () => {
    // exe 파일 다운로드 처리
    const fileUrl = '/downloads/LINKHIIT Workout System Setup.exe'
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = 'LINKHIIT Workout System Setup.exe'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <header className="h-[70px] bg-[#f9fafb] dark:bg-[#1d1d1d] border-b border-border shadow-sm flex items-center justify-between px-6 relative z-[1000] flex-shrink-0 w-full transition-colors duration-300">
      {/* 왼쪽: 인사말 */}
      <div className="flex items-center">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#1d1d1d] dark:text-white m-0 leading-tight">
          안녕하세요, {user?.name || user?.email || '사용자'}님 👋
        </h1>
      </div>

      {/* 오른쪽: 사용자 영역 */}
      <div className="flex items-center gap-6">
        {/* LINKHIIT App 다운로드 버튼 */}
        <Button
          onClick={handleDownloadApp}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2"
        >
          <Download className="w-4 h-4 mr-2" />
          LINKHIIT App
        </Button>

        {/* 다크 테마 토글 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          className="text-[#1d1d1d] dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
          title={`${mode === 'light' ? 'Light' : 'Dark'} 모드 (클릭하여 변경)`}
        >
          {mode === 'light' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {/* 사용자 정보 표시 영역 */}
        <div className="flex flex-col items-end mr-2">
          <span className="text-xs text-[#1d1d1d] dark:text-white leading-tight font-medium">
            user
          </span>
          <span className="text-sm text-[#1d1d1d] dark:text-white leading-tight font-semibold">
            {user?.email || 'test@test.com'}
          </span>
        </div>

        {/* 사용자 드롭다운 */}
        <UserDropdown />
      </div>
    </header>
  )
}