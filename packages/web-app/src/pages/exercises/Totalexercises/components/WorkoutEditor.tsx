import React from 'react'
import { DATE_FORMATS } from '@/lib/constants'
import {
    Calendar as CalendarIcon,
    Play,
    Settings,
    Plus,
    Minus,
    Trash,
    RotateCcw,
    Video as VideoIcon,
    Pause,
    Info,
    CalendarPlus,
    StickyNote,
    Repeat,
    Trash2,
    X,
    Save
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import dayjs, { Dayjs } from 'dayjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    Table as ShadcnTable,
    TableBody as ShadcnTableBody,
    TableCell as ShadcnTableCell,
    TableHead as ShadcnTableHead,
    TableHeader as ShadcnTableHeader,
    TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
    Select as ShadcnSelect,
    SelectContent as ShadcnSelectContent,
    SelectItem as ShadcnSelectItem,
    SelectTrigger as ShadcnSelectTrigger,
    SelectValue as ShadcnSelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Exercise, PanelRow, WorkoutMaster, WorkoutTimeSummary } from './types'
import { VimeoFitIframe } from '../../../../components/VimeoFitIframe/VimeoFitIframe'

interface WorkoutEditorProps {
    // Common
    rightSelectedDate: Dayjs | null
    setRightSelectedDate: (date: Dayjs | null) => void
    rightExerciseType: string
    setRightExerciseType: (type: string) => void
    workoutCategories: any[]
    majorCategory: string

    // Tabs
    activeTab: string
    setActiveTab: (tab: string) => void

    // Main Tab
    exercises: Exercise[]
    selectedExercise: Exercise | null
    setSelectedExercise: (ex: Exercise | null) => void
    onDeleteExercise: (id: string, listType: 'main' | 'dynamic' | 'cooldown') => void
    onMoveExercise: (index: number, direction: 'up' | 'down', listType: 'main' | 'dynamic' | 'cooldown') => void
    onReorderExercise: (fromIndex: number, toIndex: number, listType: 'main' | 'dynamic' | 'cooldown') => void
    onDurationChange: (id: string, duration: number, listType: 'main' | 'dynamic' | 'cooldown') => void
    onRepsChange: (id: string, reps: number) => void

    // Panels
    panelRows: PanelRow[]
    selectedPanelRowId: string | null
    setSelectedPanelRowId: (id: string | null) => void
    circuitType: string
    onCircuitTypeChange: (type: string) => void
    onAddPanelRow: () => void
    onRemovePanelRow: () => void
    onPanelTimeChange: (rowId: string, field: 'time' | 'rest' | 'waterBreak', increment: boolean) => void
    onPanelTimeDirectChange: (rowId: string, field: 'time' | 'rest' | 'waterBreak', value: number) => void
    onPanelExerciseSelect: (rowId: string) => void
    panelWidth: number
    onDraggingPanel: (e: React.MouseEvent) => void

    // Dynamic Stretching Tab
    dynamicExercises: Exercise[]
    appliedDynamic: WorkoutMaster | null
    onClearAppliedDynamic: () => void

    // Cool Down Tab
    coolDownExercises: Exercise[]
    appliedCoolDown: WorkoutMaster | null
    onClearAppliedCoolDown: () => void

    // Dashboard
    totalWorkoutTime: number
    savedWorkoutTimeSummary: WorkoutTimeSummary | null
    formatDashboardTime: (s: number) => string

    // Memo
    memo: string
    setMemo: (memo: string) => void

    // Video
    isPlaying: boolean
    onTogglePlay: () => void
    onResetVideo: () => void
    vimeoIframeRef: React.RefObject<HTMLIFrameElement | null>

    // Actions
    onExerciseSelection: () => void
    onSave: () => void
    onDeleteRecord: () => void
    handleCancel: () => void
    handleReset: () => void
    isAdmin: boolean
    setIsAdmin: (val: boolean) => void
    currentEditingMasterId: string | null
    /** 불러온 기록의 서킷 타입 — stress↔loop 전환 시 저장된 totalSeconds 대신 라이브 합계 사용 */
    originalCircuitType: string | null
}

export const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
    rightSelectedDate,
    setRightSelectedDate,
    rightExerciseType,
    setRightExerciseType,
    workoutCategories,
    majorCategory,
    activeTab,
    setActiveTab,
    exercises,
    selectedExercise,
    setSelectedExercise,
    onDeleteExercise,
    onMoveExercise,
    onReorderExercise,
    onDurationChange,
    onRepsChange,
    panelRows,
    selectedPanelRowId,
    setSelectedPanelRowId,
    circuitType,
    onCircuitTypeChange,
    onAddPanelRow,
    onRemovePanelRow,
    onPanelTimeChange,
    onPanelTimeDirectChange,
    onPanelExerciseSelect,
    panelWidth,
    onDraggingPanel,
    dynamicExercises,
    appliedDynamic,
    onClearAppliedDynamic,
    coolDownExercises,
    appliedCoolDown,
    onClearAppliedCoolDown,
    totalWorkoutTime,
    savedWorkoutTimeSummary,
    formatDashboardTime,
    memo,
    setMemo,
    isPlaying,
    onTogglePlay,
    onResetVideo,
    vimeoIframeRef,
    onExerciseSelection,
    onSave,
    onDeleteRecord,
    handleCancel,
    handleReset,
    isAdmin,
    setIsAdmin,
    currentEditingMasterId,
    originalCircuitType
}) => {
    const { isAdmin: isUserAdmin } = useAuth()
    const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
    const [draggedRowIndex, setDraggedRowIndex] = React.useState<number | null>(null)
    const [dragOverRowIndex, setDragOverRowIndex] = React.useState<number | null>(null)
    /** DS/CD 시간(초): 키보드로 여러 자리 입력 시 중간 값(예: 3)이 min 조건에 막히지 않도록 포커스 중만 로컬 문자열로 편집 */
    const [dsCdDurationDraft, setDsCdDurationDraft] = React.useState<{ exerciseId: string; text: string } | null>(null)

    const DEFAULT_COL_WIDTHS: Record<string, number> = {
        position: 60,
        value: 80,
        nameEn: 180,
        nameKo: 180,
        targetMuscles: 120,
        characteristics: 300,
        equipment: 120,
        delete: 60,
    }
    const [colWidths, setColWidths] = React.useState<Record<string, number>>(DEFAULT_COL_WIDTHS)
    const resizingRef = React.useRef<{ col: string; startX: number; startWidth: number } | null>(null)

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return
            const diff = e.clientX - resizingRef.current.startX
            const newWidth = Math.max(40, resizingRef.current.startWidth + diff)
            setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: newWidth }))
        }
        const handleMouseUp = () => {
            resizingRef.current = null
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    const handleColResizeStart = (col: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        resizingRef.current = { col, startX: e.clientX, startWidth: colWidths[col] }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    const mainTabLabel = React.useMemo(() => {
        if (!rightExerciseType || rightExerciseType === '운동선택') return 'Main'
        const matchedCategory = workoutCategories.find((cat) =>
            cat.major_category === rightExerciseType ||
            cat.major_category_name === rightExerciseType ||
            cat.id?.toString() === rightExerciseType
        )
        return matchedCategory?.major_category_name || matchedCategory?.major_category || rightExerciseType
    }, [rightExerciseType, workoutCategories])

    // 운동선택 Select box에 미리 라벨을 제공 (Popover 열기 전에도 올바른 표시를 위해)
    const exerciseTypeLabels = React.useMemo(() => {
        const labels: Record<string, string> = { '운동선택': '운동선택' }
        workoutCategories.forEach(cat => {
            if (cat.major_category) {
                labels[cat.major_category] = cat.major_category_name || cat.major_category
            }
        })
        return labels
    }, [workoutCategories])

    function getTabExercises(tab: string): Exercise[] {
        switch (tab) {
            case 'dynamic': return dynamicExercises
            case 'cooldown': return coolDownExercises
            case 'all': return [...dynamicExercises, ...exercises, ...coolDownExercises]
            default: return exercises
        }
    }

    function getListTypeForExercise(ex: Exercise): 'main' | 'dynamic' | 'cooldown' {
        if (ex.major_category === 'DS') return 'dynamic'
        if (ex.major_category === 'CD') return 'cooldown'
        return 'main'
    }


    function renderTimeSummary() {
        const dsSeconds = dynamicExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
        const cdSeconds = coolDownExercises.reduce((acc, ex) => acc + (ex.duration || 0), 0)
        const mainSeconds = Math.max(0, totalWorkoutTime - dsSeconds - cdSeconds)
        const totalSeconds = totalWorkoutTime

        const rows = [
            { label: 'DS', value: formatDashboardTime(dsSeconds) },
            { label: 'MAIN', value: formatDashboardTime(mainSeconds) },
            { label: 'CD', value: formatDashboardTime(cdSeconds) },
            { label: 'Total', value: formatDashboardTime(totalSeconds) },
        ]

        return (
            <div className="grid h-full grid-cols-2 auto-rows-fr gap-2">
                {rows.map(r => (
                    <div
                        key={r.label}
                        className={cn(
                            "flex h-full flex-col items-center justify-center gap-1 rounded border border-[#343637] dark:border-[#6b7280] bg-card p-2 text-center",
                            r.label === 'Total' && "bg-primary/10 border-primary"
                        )}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                                {r.label}
                            </Badge>
                            <span className="text-[10px] font-bold">{r.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    const majorUpper = (majorCategory || '').toUpperCase()
    const rightUpper = (rightExerciseType || '').toUpperCase()
    /** MAIN 서킷(stress/loop): 물보충은 마지막 Round 행에만 의미 있음(계산·저장 로직과 동일) */
    const isMainStressOrLoop =
        majorCategory === 'MAIN' &&
        (circuitType === 'stress' || circuitType === 'loop')
    const isAMRAPorEMOM = majorUpper === 'AMRAP' || majorUpper === 'EMOM' || rightUpper === 'AMRAP' || rightUpper === 'EMOM'
    const isAMRAPOnly = majorUpper === 'AMRAP' || rightUpper === 'AMRAP'
    const isMainSaveBlocked =
        majorUpper === 'MAIN' &&
        exercises.length !== 6 &&
        exercises.length !== 12

    function renderValueEditor(ex: Exercise, listType: 'main' | 'dynamic' | 'cooldown') {
        const isMain = listType === 'main'

        if (activeTab === 'all' && (listType === 'dynamic' || listType === 'cooldown')) {
            return null
        }

        if (isMain && isAMRAPorEMOM) {
            const repsVal = ex.reps ?? 10
            if (activeTab === 'all') {
                return <span className="text-xs font-medium">{repsVal}</span>
            }
            return (
                <div className="flex items-center justify-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRepsChange(ex.id, Math.max(1, repsVal - 1));
                        }}
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                        type="number"
                        min={1}
                        value={repsVal}
                        onChange={(e) => {
                            e.stopPropagation();
                            const raw = e.target.value;
                            const val = raw === '' ? 10 : parseInt(raw, 10);
                            if (!Number.isNaN(val) && val >= 1) onRepsChange(ex.id, val);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => { e.stopPropagation(); e.target.select(); }}
                        className="h-7 w-12 text-xs text-center p-1 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label="횟수 입력"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRepsChange(ex.id, repsVal + 1);
                        }}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
            )
        }

        const isDsOrCd = listType === 'dynamic' || listType === 'cooldown'
        const durationInputValue =
            isDsOrCd && dsCdDurationDraft?.exerciseId === ex.id
                ? dsCdDurationDraft.text
                : String(ex.duration ?? 0)

        const handleDsCdDurationCommit = (raw: string) => {
            const trimmed = raw.trim()
            const n = trimmed === '' ? NaN : parseInt(trimmed, 10)
            const fallback = ex.duration ?? 5
            const finalSec = Number.isNaN(n) ? fallback : Math.max(5, n)
            onDurationChange(ex.id, finalSec, listType)
            setDsCdDurationDraft(null)
        }

        return (
            <div className="flex items-center justify-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                        e.stopPropagation();
                        const next = Math.max(5, (ex.duration || 0) - 5)
                        onDurationChange(ex.id, next, listType)
                        if (isDsOrCd && dsCdDurationDraft?.exerciseId === ex.id) {
                            setDsCdDurationDraft({ exerciseId: ex.id, text: String(next) })
                        }
                    }}
                    aria-label="시간 감소"
                >
                    <Minus className="h-3 w-3" />
                </Button>
                <Input
                    type={isDsOrCd ? 'text' : 'number'}
                    inputMode={isDsOrCd ? 'numeric' : undefined}
                    min={isDsOrCd ? undefined : 5}
                    value={durationInputValue}
                    onChange={(e) => {
                        e.stopPropagation();
                        const raw = e.target.value
                        if (isDsOrCd) {
                            setDsCdDurationDraft({ exerciseId: ex.id, text: raw.replace(/\D/g, '') })
                            return
                        }
                        const val = raw === '' ? 5 : parseInt(raw, 10)
                        if (!Number.isNaN(val) && val >= 5) onDurationChange(ex.id, val, listType)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => {
                        e.stopPropagation()
                        if (isDsOrCd) {
                            setDsCdDurationDraft({ exerciseId: ex.id, text: String(ex.duration ?? 0) })
                        }
                        e.target.select()
                    }}
                    onBlur={(e) => {
                        e.stopPropagation()
                        if (!isDsOrCd) return
                        handleDsCdDurationCommit(e.target.value)
                    }}
                    onKeyDown={(e) => {
                        if (!isDsOrCd) return
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            e.stopPropagation()
                            ;(e.target as HTMLInputElement).blur()
                        }
                    }}
                    className={cn(
                        'h-7 text-xs text-center p-1 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                        isDsOrCd ? 'w-14' : 'w-12'
                    )}
                    aria-label="시간(초) 입력"
                />
                <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                        e.stopPropagation();
                        const next = (ex.duration || 0) + 5
                        onDurationChange(ex.id, next, listType)
                        if (isDsOrCd && dsCdDurationDraft?.exerciseId === ex.id) {
                            setDsCdDurationDraft({ exerciseId: ex.id, text: String(next) })
                        }
                    }}
                    aria-label="시간 증가"
                >
                    <Plus className="h-3 w-3" />
                </Button>
            </div>
        )
    }

    function renderExerciseTable() {
        const list = getTabExercises(activeTab)
        const showValueColumn = activeTab !== 'main' || isAMRAPorEMOM
        /** EMOM/AMRAP일 때 '전체' 탭에서도 횟수 컬럼 표시 */
        const effectiveShowValueColumn =
            (activeTab !== 'all' && showValueColumn) ||
            (activeTab === 'all' && isAMRAPorEMOM)
        const emptyColSpan = effectiveShowValueColumn ? 8 : 7

        const handleDragStart = (event: React.DragEvent<HTMLTableRowElement>, index: number) => {
            if (activeTab === 'all') return
            setDraggedRowIndex(index)
            setDragOverRowIndex(index)
            event.dataTransfer.effectAllowed = 'move'
        }

        const handleDragOver = (event: React.DragEvent<HTMLTableRowElement>, index: number) => {
            if (activeTab === 'all') return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDragOverRowIndex(index)
        }

        const handleDrop = (
            event: React.DragEvent<HTMLTableRowElement>,
            dropIndex: number,
            listType: 'main' | 'dynamic' | 'cooldown'
        ) => {
            if (activeTab === 'all') return
            event.preventDefault()
            if (draggedRowIndex === null || draggedRowIndex === dropIndex) {
                setDraggedRowIndex(null)
                setDragOverRowIndex(null)
                return
            }
            onReorderExercise(draggedRowIndex, dropIndex, listType)
            setDraggedRowIndex(null)
            setDragOverRowIndex(null)
        }

        const handleDragEnd = () => {
            setDraggedRowIndex(null)
            setDragOverRowIndex(null)
        }

        const headCellClass = "h-[45px] px-2 text-xs font-bold text-center border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] relative"

        const ResizeHandle: React.FC<{ col: string }> = ({ col }) => (
            <div
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
                onMouseDown={(e) => handleColResizeStart(col, e)}
                role="separator"
                aria-label={`${col} 컬럼 크기 조절`}
                tabIndex={0}
            />
        )

        return (
            <ShadcnTable className="w-max min-w-full table-fixed border-separate border-spacing-0">
                <ShadcnTableHeader className="sticky top-0 z-20">
                    <ShadcnTableRow className="hover:bg-transparent border-b-0">
                        <ShadcnTableHead className={headCellClass} style={{ width: colWidths.position }}>
                            위치
                            <ResizeHandle col="position" />
                        </ShadcnTableHead>
                        {effectiveShowValueColumn && (
                            <ShadcnTableHead className={headCellClass} style={{ width: colWidths.value }}>
                                {isAMRAPorEMOM && (activeTab === 'main' || activeTab === 'all') ? '횟수' : '시간(초)'}
                                <ResizeHandle col="value" />
                            </ShadcnTableHead>
                        )}
                        <ShadcnTableHead className={headCellClass} style={{ width: colWidths.nameEn }}>
                            운동명(영문)
                            <ResizeHandle col="nameEn" />
                        </ShadcnTableHead>
                        <ShadcnTableHead className={headCellClass} style={{ width: colWidths.nameKo }}>
                            운동명(한글)
                            <ResizeHandle col="nameKo" />
                        </ShadcnTableHead>
                        <ShadcnTableHead className={headCellClass} style={{ width: colWidths.targetMuscles }}>
                            자극부위
                            <ResizeHandle col="targetMuscles" />
                        </ShadcnTableHead>
                        <ShadcnTableHead className={headCellClass} style={{ width: colWidths.characteristics }}>
                            특징 및 효과
                            <ResizeHandle col="characteristics" />
                        </ShadcnTableHead>
                        <ShadcnTableHead className={headCellClass} style={{ width: colWidths.equipment }}>
                            필요기구
                            <ResizeHandle col="equipment" />
                        </ShadcnTableHead>

                        <ShadcnTableHead className="h-[45px] px-2 text-xs font-bold text-center border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8] sticky right-0 z-30 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]" style={{ width: colWidths.delete }}>삭제</ShadcnTableHead>
                    </ShadcnTableRow>
                </ShadcnTableHeader>
                <ShadcnTableBody>
                    {list.length === 0 ? (
                        <ShadcnTableRow className="border-b-0">
                            <ShadcnTableCell colSpan={emptyColSpan} className="h-24 text-center border-b-0 text-muted-foreground">
                                등록된 메인 트레이닝이 없습니다
                            </ShadcnTableCell>
                        </ShadcnTableRow>
                    ) : (
                        list.map((ex, idx) => {
                            const listType = activeTab === 'all' ? getListTypeForExercise(ex) : (activeTab as any as 'main' | 'dynamic' | 'cooldown')
                            const isReorderDisabled = activeTab === 'all'

                            return (
                                <ShadcnTableRow
                                    key={`${activeTab}_${ex.id}_${idx}`}
                                    className={cn(
                                        "cursor-pointer h-[35px] border-b-0 group transition-colors",
                                        "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                        selectedExercise?.id === ex.id && "bg-primary/20",
                                        draggedRowIndex === idx && "opacity-50",
                                        dragOverRowIndex === idx && draggedRowIndex !== idx && "ring-1 ring-primary"
                                    )}
                                    onClick={() => setSelectedExercise(ex)}
                                    draggable={!isReorderDisabled}
                                    onDragStart={(event) => handleDragStart(event, idx)}
                                    onDragOver={(event) => handleDragOver(event, idx)}
                                    onDrop={(event) => handleDrop(event, idx, listType)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                        {ex.position || `${idx + 1}`}
                                    </ShadcnTableCell>
                                    {effectiveShowValueColumn && (
                                        <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                            {renderValueEditor(ex, listType)}
                                        </ShadcnTableCell>
                                    )}
                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate group-hover:text-inherit transition-colors">
                                        {ex.name_en || '-'}
                                    </ShadcnTableCell>
                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate font-medium group-hover:text-inherit transition-colors">
                                        {ex.name_ko || '-'}
                                    </ShadcnTableCell>
                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                                        {ex.target_muscles || '-'}
                                    </ShadcnTableCell>
                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-left border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                                        {ex.characteristics || '-'}
                                    </ShadcnTableCell>
                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] truncate text-muted-foreground group-hover:text-inherit transition-colors">
                                        {ex.equipment || '-'}
                                    </ShadcnTableCell>

                                    <ShadcnTableCell className="h-[35px] py-0 px-2 text-xs text-center sticky right-0 z-10 bg-[#f9fafb] dark:bg-[#1d1d1d] group-hover:bg-muted/30 shadow-[-4px_0_8px_rgba(0,0,0,0.05)] dark:shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                            onClick={(e) => { e.stopPropagation(); onDeleteExercise(ex.id, listType); }}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </ShadcnTableCell>
                                </ShadcnTableRow>
                            )
                        })
                    )}
                </ShadcnTableBody>
            </ShadcnTable>
        )
    }

    return (
        <Card className="flex flex-col flex-1 min-w-0 border border-[#343637] dark:border-[#6b7280] shadow-md overflow-hidden bg-card">
            <CardHeader className="h-12 px-4 py-0 border-b bg-[#f9fafb] dark:bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none text-[#1d1d1d] dark:text-white">
                    <CalendarPlus className="h-5 w-5 text-primary" />
                    일자별 트레이닝 등록
                </CardTitle>
            </CardHeader>
            {/* Toolbar (상단 고정) */}
            <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-[#f9fafb]/50 dark:bg-muted/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                        <Label className="text-[11px] text-muted-foreground leading-none">운동일자</Label>
                        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="min-w-[150px] justify-between text-left border-[#343637] dark:border-[#6b7280] h-9 text-xs">
                                    {rightSelectedDate ? rightSelectedDate.format(DATE_FORMATS.DAYJS_DISPLAY) : '날짜 선택'}
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={rightSelectedDate?.toDate()}
                                    onSelect={(d) => {
                                        setRightSelectedDate(d ? dayjs(d) : null)
                                        if (d) setIsDatePickerOpen(false)
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                        <Label className="text-[11px] text-muted-foreground leading-none">운동선택</Label>
                        <ShadcnSelect 
                            key={`exercise-select-${rightExerciseType}-${workoutCategories.length}`}
                            value={rightExerciseType} 
                            onValueChange={setRightExerciseType}
                            labels={exerciseTypeLabels}
                        >
                            <ShadcnSelectTrigger className="w-[150px] border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs">
                                <ShadcnSelectValue placeholder="운동선택" />
                            </ShadcnSelectTrigger>
                            <ShadcnSelectContent>
                                <ShadcnSelectItem value="운동선택">운동선택</ShadcnSelectItem>
                                {(() => {
                                    const filtered = workoutCategories.filter(cat => {
                                        const majorCat = cat.major_category?.toUpperCase()
                                        const isStretching = majorCat === 'DS' || majorCat === 'CD' ||
                                            majorCat === 'DYNAMIC_STRETCHING' || majorCat === 'STATIC_STRETCHING' ||
                                            majorCat === 'DYNAMIC_STRETCH' || majorCat === 'STATIC_STRETCH'
                                        const isActive = cat.is_active === 1 || cat.is_active === '1' || cat.is_active === true
                                        return !isStretching && isActive
                                    })
                                    console.log('🔍 [WorkoutEditor] Filtered categories for SelectBox:', filtered)
                                    return filtered.map(cat => (
                                        <ShadcnSelectItem key={cat.id} value={cat.major_category}>
                                            {cat.major_category_name}
                                        </ShadcnSelectItem>
                                    ))
                                })()}
                            </ShadcnSelectContent>
                        </ShadcnSelect>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={onExerciseSelection} className="h-9">
                        <Plus className="h-4 w-4 mr-2" /> 운동선택
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onDeleteRecord}
                        className="h-9"
                        disabled={!currentEditingMasterId}
                    >
                        <Trash2 className="h-4 w-4 mr-2" /> 삭제
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        className="h-9"
                        disabled={exercises.length === 0 && dynamicExercises.length === 0 && coolDownExercises.length === 0}
                    >
                        <X className="h-4 w-4 mr-2" /> 취소
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        className="h-9"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" /> 초기화
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            console.log('🔴🔴🔴 [WorkoutEditor] 저장 버튼 클릭!!!')
                            onSave()
                        }}
                        className="h-9"
                        disabled={
                            (exercises.length === 0 && dynamicExercises.length === 0 && coolDownExercises.length === 0) ||
                            isMainSaveBlocked
                        }
                        title={
                            isMainSaveBlocked
                                ? 'MAIN 저장 시 메인 운동은 6개 또는 12개여야 합니다'
                                : undefined
                        }
                    >
                        <Save className="h-4 w-4 mr-2" /> 저장
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 min-h-0 min-w-0 gap-[3px] p-0" data-panel-container>
                {/* Left Sidebar (첨부 이미지 좌측 영역) */}
                <div
                    className="flex flex-col min-h-0 min-w-0 gap-[3px]"
                    style={{ width: `${panelWidth}%` }}
                >
                    {/* Round/Panel Card */}
                    <Card className="flex flex-[3.3] min-h-0 flex-col overflow-hidden border border-[#343637] dark:border-[#6b7280] shadow-md">
                        <CardHeader className="h-10 shrink-0 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                            {rightExerciseType === 'MAIN' ? (
                                <RadioGroup value={circuitType} onValueChange={onCircuitTypeChange} className="flex flex-row gap-2">
                                    <div className="flex items-center space-x-1">
                                        <RadioGroupItem value="stress" id="stress" className="h-3 w-3" />
                                        <Label htmlFor="stress" className="text-[10px]">스트레스</Label>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <RadioGroupItem value="loop" id="loop" className="h-3 w-3" />
                                        <Label htmlFor="loop" className="text-[10px]">루프</Label>
                                    </div>
                                </RadioGroup>
                            ) : (
                                <CardTitle className="text-xs font-bold flex items-center gap-1">
                                    <Repeat className="h-4 w-4 text-primary" />
                                    Round
                                </CardTitle>
                            )}

                            <div className="flex gap-1">
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6 border-primary text-primary"
                                    onClick={onAddPanelRow}
                                    disabled={isAMRAPOnly && panelRows.length >= 2}
                                    aria-label="Round 행 추가"
                                    title={isAMRAPOnly && panelRows.length >= 2 ? 'AMRAP은 운동설계를 최대 2개까지 지정할 수 있습니다' : undefined}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-6 w-6 border-primary text-primary" onClick={onRemovePanelRow}><Minus className="h-3 w-3" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 p-0">
                            <div className="h-full overflow-auto scrollbar-hide">
                                <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                                    <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                                        <ShadcnTableRow className="h-[45px] hover:bg-transparent border-b-0">
                                            <ShadcnTableHead className="w-10 text-center text-xs p-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">{circuitType === 'stress' ? 'Set' : 'Rnd'}</ShadcnTableHead>
                                            <ShadcnTableHead className="w-20 text-center text-xs p-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                                                {(majorCategory === 'AMRAP' || majorCategory === 'EMOM') ? '시간(분)' : '시간(초)'}
                                            </ShadcnTableHead>
                                            <ShadcnTableHead className="w-20 text-center text-xs p-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                                                {(majorCategory === 'AMRAP' || majorCategory === 'EMOM') ? '물보충(분)' : '휴식(초)'}
                                            </ShadcnTableHead>
                                            {majorCategory !== 'AMRAP' && majorCategory !== 'EMOM' && (
                                                <ShadcnTableHead className="w-20 text-center text-xs p-0 text-[#27272a] dark:text-[#94a3b8]">물보충</ShadcnTableHead>
                                            )}
                                        </ShadcnTableRow>
                                    </ShadcnTableHeader>
                                    <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                                        {panelRows.map((row, rowIndex) => {
                                            const isLastPanelRow = rowIndex === panelRows.length - 1
                                            const waterBreakEditable =
                                                !isMainStressOrLoop || isLastPanelRow
                                            return (
                                            <ShadcnTableRow
                                                key={row.id}
                                                className={cn(
                                                    "h-[35px] cursor-pointer border-b-0 group transition-colors",
                                                    "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                                    selectedPanelRowId === row.id && "bg-primary/20"
                                                )}
                                                onClick={() => setSelectedPanelRowId(row.id)}
                                            >
                                                <ShadcnTableCell className="p-0 h-[35px] text-center text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">{row.round}</ShadcnTableCell>
                                                <ShadcnTableCell className="p-0 h-[35px] border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'time', false); }} className="text-primary" aria-label="시간 감소">-</button>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={row.time}
                                                            onChange={(e) => {
                                                                e.stopPropagation()
                                                                const raw = e.target.value
                                                                const val = raw === '' ? 0 : parseInt(raw, 10)
                                                                if (!Number.isNaN(val)) onPanelTimeDirectChange(row.id, 'time', val)
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onFocus={(e) => { e.stopPropagation(); e.target.select(); }}
                                                            className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            aria-label="시간 입력"
                                                        />
                                                        <button onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'time', true); }} className="text-primary" aria-label="시간 증가">+</button>
                                                    </div>
                                                </ShadcnTableCell>
                                                <ShadcnTableCell className="p-0 h-[35px] border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                                                    {(majorCategory === 'AMRAP' || majorCategory === 'EMOM') ? (
                                                        majorCategory === 'EMOM' && !isLastPanelRow ? (
                                                            <span className="text-xs text-muted-foreground tabular-nums flex items-center justify-center" aria-label="물보충 — EMOM에서는 마지막 행만 설정">—</span>
                                                        ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'waterBreak', false); }} className="text-primary" aria-label="물보충 감소">-</button>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={row.waterBreak}
                                                                onChange={(e) => {
                                                                    e.stopPropagation()
                                                                    const raw = e.target.value
                                                                    const val = raw === '' ? 0 : parseInt(raw, 10)
                                                                    if (!Number.isNaN(val)) onPanelTimeDirectChange(row.id, 'waterBreak', val)
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onFocus={(e) => { e.stopPropagation(); e.target.select(); }}
                                                                className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                aria-label="물보충 입력"
                                                            />
                                                            <button onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'waterBreak', true); }} className="text-primary" aria-label="물보충 증가">+</button>
                                                        </div>
                                                        )
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'rest', false); }} className="text-primary" aria-label="휴식 감소">-</button>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={row.rest}
                                                                onChange={(e) => {
                                                                    e.stopPropagation()
                                                                    const raw = e.target.value
                                                                    const val = raw === '' ? 0 : parseInt(raw, 10)
                                                                    if (!Number.isNaN(val)) onPanelTimeDirectChange(row.id, 'rest', val)
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onFocus={(e) => { e.stopPropagation(); e.target.select(); }}
                                                                className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                aria-label="휴식 입력"
                                                            />
                                                            <button onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'rest', true); }} className="text-primary" aria-label="휴식 증가">+</button>
                                                        </div>
                                                    )}
                                                </ShadcnTableCell>
                                                {majorCategory !== 'AMRAP' && majorCategory !== 'EMOM' && (
                                                    <ShadcnTableCell className="p-0 h-[35px] text-center group-hover:text-inherit transition-colors">
                                                        {waterBreakEditable ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'waterBreak', false); }} className="text-primary" aria-label="물보충 감소">-</button>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    value={row.waterBreak}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation()
                                                                        const raw = e.target.value
                                                                        const val = raw === '' ? 0 : parseInt(raw, 10)
                                                                        if (!Number.isNaN(val)) onPanelTimeDirectChange(row.id, 'waterBreak', val)
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={(e) => { e.stopPropagation(); e.target.select(); }}
                                                                    className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    aria-label="물보충 입력"
                                                                />
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); onPanelTimeChange(row.id, 'waterBreak', true); }} className="text-primary" aria-label="물보충 증가">+</button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="text-xs text-muted-foreground tabular-nums"
                                                                aria-label="물보충 — 스트레스·루프에서는 마지막 행만 설정"
                                                            >
                                                                —
                                                            </span>
                                                        )}
                                                    </ShadcnTableCell>
                                                )}
                                            </ShadcnTableRow>
                                            )
                                        })}
                                    </ShadcnTableBody>
                                </ShadcnTable>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Memo Card */}
                    <Card className="flex flex-[1.7] min-h-0 flex-col overflow-hidden border border-[#343637] dark:border-[#6b7280] shadow-md">
                        <CardHeader className="h-10 shrink-0 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                            <CardTitle className="text-xs font-bold flex items-center gap-1">
                                <StickyNote className="h-4 w-4 text-primary" />
                                메모
                            </CardTitle>
                            {isUserAdmin && (
                                <div className="flex items-center gap-2">
                                    <Checkbox id="admin-check" checked={isAdmin} onCheckedChange={(val) => setIsAdmin(!!val)} />
                                    <Label htmlFor="admin-check" className="text-xs font-bold whitespace-nowrap">관리자체크</Label>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 p-2">
                            <div className="relative h-full">
                                <Textarea
                                    placeholder="운동에 대한 메모를 입력하세요..."
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    className="h-full min-h-0 text-xs bg-card border-[#343637] dark:border-[#6b7280] resize-none pr-8"
                                />
                                {memo && (
                                    <button
                                        type="button"
                                        onClick={() => setMemo('')}
                                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="메모 지우기"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Video Card */}
                    <Card className="flex flex-[3.2] min-h-0 flex-col overflow-hidden border border-[#343637] dark:border-[#6b7280] shadow-md">
                        <CardHeader className="h-10 shrink-0 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                            <CardTitle className="text-xs font-bold flex items-center gap-1">
                                <VideoIcon className="h-4 w-4 text-primary" />
                                영상 미리보기
                            </CardTitle>
                            <div className="flex items-center gap-1">
                                {selectedExercise?.video_url ? (
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePlay}>
                                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onResetVideo}>
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : <div />}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 p-1">
                            <div className="h-full w-[90%] mx-auto aspect-video rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-hidden relative bg-black">
                                {selectedExercise?.video_url ? (
                                    <div className="absolute inset-0">
                                        <VimeoFitIframe videoId={selectedExercise.video_url} iframeRef={vimeoIframeRef} />
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                        <div className="flex flex-col items-center">
                                            <VideoIcon className="h-10 w-10 mb-2 opacity-30" />
                                            <p className="text-[10px]">운동을 선택하면 영상이 표시됩니다</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Time Summary Card */}
                    <Card className="flex flex-[2.46] min-h-0 flex-col overflow-hidden border border-[#343637] dark:border-[#6b7280] shadow-md">
                        <CardHeader className="h-10 shrink-0 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                            <CardTitle className="text-xs font-bold flex items-center gap-1">
                                <Info className="h-4 w-4 text-primary" />
                                운동 시간 요약
                            </CardTitle>
                            {/* <div className="text-[10px] font-bold text-muted-foreground">
                                Total: {formatDashboardTime(totalWorkoutTime)}
                            </div> */}
                        </CardHeader>
                        <CardContent className="flex flex-1 min-h-0 flex-col overflow-auto p-2">
                            <div className="flex-1 min-h-0">
                                {renderTimeSummary()}
                            </div>
                            {(appliedDynamic || appliedCoolDown) && (
                                <div className="mt-2 text-[10px] text-muted-foreground">
                                    <div className="flex items-center justify-between gap-2">
                                        <span>Dynamic:</span>
                                        <span className="truncate">{appliedDynamic ? `${appliedDynamic.date} (${appliedDynamic.workoutTime})` : '없음'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span>CoolDown:</span>
                                        <span className="truncate">{appliedCoolDown ? `${appliedCoolDown.date} (${appliedCoolDown.workoutTime})` : '없음'}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Splitter */}
                <div onMouseDown={onDraggingPanel} className="w-2 cursor-col-resize hover:bg-primary flex items-center justify-center shrink-0">
                    <div className="h-8 w-0.5 bg-muted-foreground/30 rounded-full" />
                </div>

                {/* Right Main (첨부 이미지 우측 영역) */}
                <Card className="flex-1 flex flex-col min-w-0 min-h-0 border border-[#343637] dark:border-[#6b7280] shadow-md overflow-hidden">
                    <CardHeader className="h-10 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="flex items-center justify-between">
                                <TabsList className="bg-slate-100 dark:bg-slate-800/60 p-1 h-9 rounded-lg border border-[#343637] dark:border-slate-700/50 shadow-inner">
                                    <TabsTrigger value="main" className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all">{mainTabLabel}</TabsTrigger>
                                    <TabsTrigger value="dynamic" className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all">DYNAMIC STRETCHING</TabsTrigger>
                                    <TabsTrigger value="cooldown" className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all">COOL DOWN</TabsTrigger>
                                    <TabsTrigger value="all" className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all">전체</TabsTrigger>
                                </TabsList>
                                {savedWorkoutTimeSummary && (
                                    <span className="text-[10px] font-bold text-primary">저장됨: {formatDashboardTime(savedWorkoutTimeSummary.totalSeconds)}</span>
                                )}
                            </div>
                        </Tabs>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-0">
                        <div className="h-full overflow-auto scrollbar-hide">
                            {renderExerciseTable()}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Card>
    )


}
