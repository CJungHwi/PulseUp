/**
 * 컴포넌트 요약 — 트레이닝 기록 조회 (Totalexercises 좌측 패널)
 *
 * 기능: 년월·운동구분·서킷·메모 필터, 사용자/관리자 탭, 기록 더블클릭 적용.
 * API: `GET /workout-categories/workout-history-master` (필터는 부모 Totalexercises에서 호출)
 *
 * MonthProgram과 동일하게 사용자/관리자 탭을 항상 노출하고, 목록은 API 결과를 그대로 표시한다.
 */

import React, { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MonthInput } from '@/components/ui/month-input'
import {
    Table as ShadcnTable,
    TableBody as ShadcnTableBody,
    TableCell as ShadcnTableCell,
    TableHead as ShadcnTableHead,
    TableHeader as ShadcnTableHeader,
    TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import {
    Select as ShadcnSelect,
    SelectContent as ShadcnSelectContent,
    SelectItem as ShadcnSelectItem,
    SelectTrigger as ShadcnSelectTrigger,
    SelectValue as ShadcnSelectValue,
} from '@/components/ui/select'
import {
    Tabs as ShadcnTabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAppSelector } from '@/hooks/redux'
import { WorkoutMaster } from './types'

interface WorkoutHistoryProps {
    selectedDate: Dayjs | null
    setSelectedDate: (date: Dayjs | null) => void
    memoFilter: string
    setMemoFilter: (val: string) => void
    exerciseType: string
    setExerciseType: (val: string) => void
    searchCircuitType: string
    setSearchCircuitType: (val: string) => void
    workoutMasters: WorkoutMaster[]
    adminWorkoutMasters?: WorkoutMaster[]
    categories: any[]
    selectedMasterId: string | null
    onSearch: () => void
    onApply: (master: WorkoutMaster) => void
    isLoading: boolean
    isLoadingAdmin?: boolean
    width: number
}

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({
    selectedDate,
    setSelectedDate,
    memoFilter,
    setMemoFilter,
    exerciseType,
    setExerciseType,
    searchCircuitType,
    setSearchCircuitType,
    workoutMasters,
    adminWorkoutMasters = [],
    categories,
    selectedMasterId,
    onSearch,
    onApply,
    isLoading,
    isLoadingAdmin = false,
    width
}) => {
    const { user } = useAppSelector((state) => state.auth)
    const [recordTabValue, setRecordTabValue] = useState(0)

    const normalizeMajor = (value?: string) => value?.toString().trim().toUpperCase() || ''

    const isStretchingMajor = (major: string) => {
        if (!major) return false
        return (
            major === 'DS' ||
            major === 'CD' ||
            major === 'DYNAMIC_STRETCHING' ||
            major === 'STATIC_STRETCHING' ||
            major === 'DYNAMIC_STRETCH' ||
            major === 'STATIC_STRETCH'
        )
    }

    // DS/CD 계열은 운동구분 선택 목록에서만 제외 (MonthProgram과 동일하게 목록 자체는 API 결과 그대로)
    const filteredCategories = useMemo(() => {
        return (categories || []).filter((cat) => {
            if (!cat) return false
            const majorCat = normalizeMajor(cat.major_category)
            const isActive = cat.is_active === 1 || cat.is_active === '1' || cat.is_active === true
            if (!majorCat) return true
            return !isStretchingMajor(majorCat) && isActive
        })
    }, [categories])

    const renderMasterTable = (masters: WorkoutMaster[], loading: boolean) => (
        <div className="flex-1 min-h-0 overflow-auto relative bg-[#f9fafb] dark:bg-[#1d1d1d] border border-[#343637] dark:border-[#6b7280] border-t-0 overscroll-behavior-contain touch-pan-y">
            <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
                <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
                    <ShadcnTableRow className="h-[45px] hover:bg-transparent border-b-0">
                        <ShadcnTableHead className="text-center font-bold border-r border-[#343637] dark:border-[#6b7280] w-20 text-xs text-[#27272a] dark:text-[#94a3b8]">날짜</ShadcnTableHead>
                        <ShadcnTableHead className="text-center font-bold border-r border-[#343637] dark:border-[#6b7280] w-20 text-xs text-[#27272a] dark:text-[#94a3b8]">운동구분</ShadcnTableHead>
                        <ShadcnTableHead className="text-center font-bold border-r border-[#343637] dark:border-[#6b7280] w-20 text-xs text-[#27272a] dark:text-[#94a3b8]">서킷구분</ShadcnTableHead>
                        <ShadcnTableHead className="text-center font-bold border-r border-[#343637] dark:border-[#6b7280] w-20 text-xs text-[#27272a] dark:text-[#94a3b8]">운동시간</ShadcnTableHead>
                        <ShadcnTableHead className="text-center font-bold text-xs text-[#27272a] dark:text-[#94a3b8]">메모</ShadcnTableHead>
                    </ShadcnTableRow>
                </ShadcnTableHeader>
                <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
                    {loading ? (
                        <ShadcnTableRow className="h-[35px]">
                            <ShadcnTableCell className="p-2 text-center text-xs text-muted-foreground" colSpan={5}>
                                로딩 중...
                            </ShadcnTableCell>
                        </ShadcnTableRow>
                    ) : masters.length === 0 ? (
                        <ShadcnTableRow className="h-[35px]">
                            <ShadcnTableCell className="p-2 text-center text-xs text-muted-foreground" colSpan={5}>
                                조회된 기록이 없습니다.
                            </ShadcnTableCell>
                        </ShadcnTableRow>
                    ) : (
                        masters.map((m) => (
                            <ShadcnTableRow
                                key={m.id}
                                className={cn(
                                    "group cursor-pointer h-[35px] border-b-0 transition-colors",
                                    "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                    selectedMasterId === m.id && "bg-primary/20"
                                )}
                                onDoubleClick={() => {
                                    console.log('[WorkoutHistory] 더블클릭 - 기록 적용:', { id: m.id, date: m.date, workoutTime: m.workoutTime })
                                    onApply(m)
                                }}
                            >
                                <ShadcnTableCell className="p-1 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                                    {dayjs(m.date).format('YYYY-MM-DD')}
                                </ShadcnTableCell>
                                <ShadcnTableCell className="p-1 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs truncate max-w-[80px] group-hover:text-inherit transition-colors">
                                    {m.workoutCategoriesName || '-'}
                                </ShadcnTableCell>
                                <ShadcnTableCell className="p-1 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                                    {!m.circuitType || m.circuitType === 'none' ? '-' : m.circuitType === 'stress' ? '스트레스' : '루프'}
                                </ShadcnTableCell>
                                <ShadcnTableCell className="p-1 text-center border-r border-[#343637] dark:border-[#6b7280] text-xs group-hover:text-inherit transition-colors">
                                    {m.workoutTime}
                                </ShadcnTableCell>
                                <ShadcnTableCell className="p-1 text-left text-xs truncate group-hover:text-inherit transition-colors">
                                    {m.memo || '-'}
                                </ShadcnTableCell>
                            </ShadcnTableRow>
                        ))
                    )}
                </ShadcnTableBody>
            </ShadcnTable>
        </div>
    )

    return (
        <Card
            className="left-panel h-full flex flex-col bg-card shadow-md overflow-hidden border border-[#343637] dark:border-[#6b7280]"
            style={{ width: `${width}%` }}
        >
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
                <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    트레이닝 기록 조회
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 flex flex-col gap-0 p-0">
                {/* Filters */}
                <div className="p-4 border-b border-[#343637] dark:border-[#6b7280] bg-muted/30">
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                            <Label className="text-[11px] text-muted-foreground leading-none">운동구분</Label>
                            <ShadcnSelect value={exerciseType} onValueChange={setExerciseType}>
                                <ShadcnSelectTrigger className="w-full border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs">
                                    <ShadcnSelectValue placeholder="운동구분" />
                                </ShadcnSelectTrigger>
                                <ShadcnSelectContent className="min-w-[200px]">
                                    <ShadcnSelectItem value="전체" className="whitespace-nowrap">전체</ShadcnSelectItem>
                                    {filteredCategories.map((cat) => (
                                        <ShadcnSelectItem
                                            key={cat.major_category}
                                            value={cat.major_category}
                                            className="whitespace-nowrap"
                                        >
                                            {cat.major_category_name}
                                        </ShadcnSelectItem>
                                    ))}
                                </ShadcnSelectContent>
                            </ShadcnSelect>
                        </div>

                        <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                            <Label className="text-[11px] text-muted-foreground leading-none">서킷구분</Label>
                            <ShadcnSelect value={searchCircuitType} onValueChange={setSearchCircuitType}>
                                <ShadcnSelectTrigger className="w-full border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs">
                                    <ShadcnSelectValue placeholder="서킷구분" />
                                </ShadcnSelectTrigger>
                                <ShadcnSelectContent className="min-w-[150px]">
                                    <ShadcnSelectItem value="전체" className="whitespace-nowrap">전체</ShadcnSelectItem>
                                    <ShadcnSelectItem value="stress" className="whitespace-nowrap">스트레스</ShadcnSelectItem>
                                    <ShadcnSelectItem value="loop" className="whitespace-nowrap">루프</ShadcnSelectItem>
                                </ShadcnSelectContent>
                            </ShadcnSelect>
                        </div>

                        <div className="flex flex-col gap-1 flex-1 min-w-[130px]">
                            <Label className="text-[11px] text-muted-foreground leading-none">년월</Label>
                            <MonthInput
                                value={selectedDate ? selectedDate.format('YYYY-MM') : ''}
                                onChange={(e) => {
                                    const value = e.target.value
                                    setSelectedDate(value ? dayjs(`${value}-01`) : null)
                                }}
                                className="w-full border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
                            />
                        </div>

                        <div className="flex flex-col gap-1 flex-[2] min-w-[180px]">
                            <Label className="text-[11px] text-muted-foreground leading-none">메모</Label>
                            <div className="relative w-full min-w-0">
                                <Input
                                    placeholder="메모 검색..."
                                    className="w-full border-[#343637] dark:border-[#6b7280] bg-card h-9 text-xs"
                                    value={memoFilter}
                                    onChange={(e) => setMemoFilter(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 사용자 / 관리자 탭 — MonthProgram과 동일하게 항상 노출 */}
                <div className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
                    <ShadcnTabs
                        value={recordTabValue.toString()}
                        onValueChange={(val) => setRecordTabValue(parseInt(val))}
                        className="flex flex-col h-full"
                    >
                        <TabsList className="grid grid-cols-2 h-9 bg-muted/40 dark:bg-gray-800/60 border border-[#343637] dark:border-[#6b7280] p-1 mx-0 my-0">
                            <TabsTrigger
                                value="0"
                                className="text-xs font-bold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none hover:bg-muted/60 dark:hover:bg-gray-700/60"
                            >
                                {user?.name || '사용자'}
                            </TabsTrigger>
                            <TabsTrigger
                                value="1"
                                className="text-xs font-bold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none hover:bg-muted/60 dark:hover:bg-gray-700/60"
                            >
                                관리자
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="0" className="flex-1 min-h-0 !m-0 !p-0 overflow-hidden flex flex-col">
                            {renderMasterTable(workoutMasters, isLoading)}
                        </TabsContent>

                        <TabsContent value="1" className="flex-1 min-h-0 !m-0 !p-0 overflow-hidden flex flex-col">
                            {renderMasterTable(adminWorkoutMasters, isLoadingAdmin)}
                        </TabsContent>
                    </ShadcnTabs>
                </div>
            </CardContent>
        </Card>
    )
}
