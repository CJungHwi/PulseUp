/**
 * MonitorDisplayTextField — 영상앱 표시 문자 입력
 */
import React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type MonitorDisplayTextFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const MonitorDisplayTextField: React.FC<MonitorDisplayTextFieldProps> = ({
  value,
  onChange,
  placeholder = 'electron-app 화면에 표시할 문자를 입력하세요'
}) => (
  <div className="space-y-2">
    <Label>영상앱 표시 문자</Label>
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="resize-y min-h-[100px]"
    />
    <p className="text-xs text-muted-foreground">
      좌·중·우 모니터에 동일한 문자가 표시됩니다.
    </p>
  </div>
)
