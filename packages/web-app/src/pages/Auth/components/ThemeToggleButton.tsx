/**
 * ThemeToggleButton — 인증 페이지 테마 전환 버튼
 *
 * 기능: 현재 라이트/다크 모드에 맞는 아이콘을 표시하고 테마 전환 이벤트를 전달한다.
 *
 * 사용처: `Login.tsx`
 */
import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ThemeToggleButtonProps {
  mode: 'light' | 'dark' | string
  onToggle: () => void
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({ mode, onToggle }) => (
  <Button
    variant="ghost"
    size="icon"
    onClick={onToggle}
    className="rounded-full size-10"
    aria-label="테마 전환"
  >
    {mode === 'dark' ? (
      <Sun className="size-5 text-yellow-400" />
    ) : (
      <Moon className="size-5 text-slate-700" />
    )}
  </Button>
)
