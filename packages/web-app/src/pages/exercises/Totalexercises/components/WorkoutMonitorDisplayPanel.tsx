/**
 * WorkoutMonitorDisplayPanel — 일자별 운동 기록 모니터 표시 (운동설정과 동일 탭 UI, 저장은 상단 저장과 함께)
 */
import React from 'react'
import { MonitorDisplayTabs } from '@/pages/WorkoutSettings/components/MonitorDisplayTabs'
import type { MonitorDisplayProfileState } from '@/pages/WorkoutSettings/components/MonitorDisplayTabs'
import { useWorkoutMonitorDisplayEditor } from './useWorkoutMonitorDisplayEditor'

export type WorkoutMonitorDisplayPanelProps = {
  profile: MonitorDisplayProfileState
  onProfileChange: (next: MonitorDisplayProfileState) => void
}

export const WorkoutMonitorDisplayPanel: React.FC<WorkoutMonitorDisplayPanelProps> = ({
  profile,
  onProfileChange
}) => {
  const editor = useWorkoutMonitorDisplayEditor(profile, onProfileChange)

  return (
    <div className="min-h-full p-3">
      <p className="text-[11px] text-muted-foreground mb-3 px-1">
        기본/인트로 이미지와 영상앱 표시 문구는 이 운동 기록에만 저장됩니다. 비어 있으면 운동설정 →
        시스템 기본값이 사용됩니다. 변경 후 상단 <span className="font-semibold">저장</span>을
        눌러주세요.
      </p>
      <MonitorDisplayTabs
        variant="embedded"
        showSaveButtons={false}
        isAdmin={false}
        userProfile={profile}
        onUserDefaultChange={editor.onDefaultChange}
        onUserIntroChange={editor.onIntroChange}
        onUserDisplayTextChange={editor.onDisplayTextChange}
        userFileInputRefs={editor.fileInputRefs}
        onUserFileChange={editor.onFileChange}
        onUserDelete={editor.onDelete}
        userUploadState={editor.uploadState}
        onSaveUser={() => undefined}
        isSavingUser={false}
      />
    </div>
  )
}
