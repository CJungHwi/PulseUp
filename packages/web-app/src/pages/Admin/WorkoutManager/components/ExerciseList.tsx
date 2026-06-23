/**
 * ExerciseList
 * - 기능: 운동 마스터 목록 검색/필터/무한 스크롤, 선택 운동 상세 연결
 * - API: 부모 `WorkoutManager`의 getExercisesList 결과 표시
 * - 흐름: 운동구분·검색어 필터 → 목록 행 선택 → 상세 폼/영상 미리보기 갱신
 */
import React, { useMemo, useRef } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, Filter, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Exercise, WorkoutMajorCategory } from '@/types/workoutCategory'

interface ExerciseListProps {
    exercises: Exercise[]
    majorCategories: WorkoutMajorCategory[]
    selectedCategory: string
    searchType: string
    searchKeyword: string
    loading: boolean
    hasMore: boolean
    onLoadMore: () => Promise<void> | void
    onCategoryChange: (value: string) => void
    onSearchTypeChange: (value: string) => void
    onSearchKeywordChange: (value: string) => void
    onSearch: () => void
    onClearSearch: () => void
    onSelectExercise: (exercise: Exercise) => void
    onAddExercise: () => void
    selectedExerciseId?: string
}

export const ExerciseList: React.FC<ExerciseListProps> = ({
    exercises,
    majorCategories,
    selectedCategory,
    searchType,
    searchKeyword,
    loading,
    hasMore,
    onLoadMore,
    onCategoryChange,
    onSearchTypeChange,
    onSearchKeywordChange,
    onSearch,
    onClearSearch,
    onSelectExercise,
    onAddExercise,
    selectedExerciseId
}) => {
    const isFetchingMoreRef = useRef(false)
    const isInitialLoading = loading && exercises.length === 0
    const isLoadingMore = loading && exercises.length > 0

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!hasMore) return
        if (loading) return
        if (isFetchingMoreRef.current) return

        const el = e.currentTarget
        const threshold = 180
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        if (distanceToBottom > threshold) return

        isFetchingMoreRef.current = true
        const maybePromise = onLoadMore()
        if (maybePromise && typeof (maybePromise as any).finally === 'function') {
            ; (maybePromise as Promise<void>).finally(() => {
                isFetchingMoreRef.current = false
            })
            return
        }
        isFetchingMoreRef.current = false
    }

    return (
        <Card className="flex flex-col h-full shadow-md bg-card">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                    <Filter className="w-5 h-5" />
                    운동 목록 (Vimeo 기준)
                </CardTitle>
                <Button variant="default" size="sm" className="h-8 gap-1" onClick={onAddExercise}>
                    <Plus className="h-4 w-4" />
                    운동 추가
                </Button>
            </CardHeader>
            <div className="p-3 border-b">
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
                    <Select
                        value={selectedCategory}
                        onValueChange={onCategoryChange}
                        labels={{ all: '전체', ...Object.fromEntries(majorCategories.map(c => [c.major_category, c.major_category_name])) }}
                    >
                        <SelectTrigger className="w-[200px] shrink-0 border-[#343637] dark:border-[#6b7280] bg-card">
                            <SelectValue placeholder="운동구분" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {majorCategories.map((category, index) => (
                                <SelectItem key={`${category.major_category}-${index}`} value={category.major_category}>
                                    {category.major_category_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={searchType}
                        onValueChange={onSearchTypeChange}
                        labels={{
                            all: '전체',
                            name_en: '운동명 (영문)',
                            name_ko: '운동명 (한글)',
                            target_muscles: '자극 부위',
                            characteristics: '특징 및 효과',
                            equipment: '필요 기구'
                        }}
                    >
                        <SelectTrigger className="w-[140px] shrink-0 border-[#343637] dark:border-[#6b7280] bg-card">
                            <SelectValue placeholder="검색구분" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="name_en">운동명 (영문)</SelectItem>
                            <SelectItem value="name_ko">운동명 (한글)</SelectItem>
                            <SelectItem value="target_muscles">자극 부위</SelectItem>
                            <SelectItem value="characteristics">특징 및 효과</SelectItem>
                            <SelectItem value="equipment">필요 기구</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1 min-w-[220px]">
                        <Input
                            placeholder="검색어를 입력하세요"
                            value={searchKeyword}
                            onChange={(e) => onSearchKeywordChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                            className="pr-8 border-[#343637] dark:border-[#6b7280] bg-card"
                        />
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={onClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <Button variant="secondary" onClick={onSearch} disabled={loading} className="shrink-0 min-w-[72px]">
                        검색
                    </Button>
                </div>
            </div>

            <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
                <div
                    className="h-full border border-[#343637] dark:border-[#6b7280] overflow-auto relative scrollbar-hide bg-[#f9fafb] dark:bg-[#1d1d1d]"
                    onScroll={handleScroll}
                >
                    <Table className="w-full table-fixed border-separate border-spacing-0">
                        <TableHeader className="sticky top-0 z-10 shadow-sm">
                            <TableRow className="hover:bg-transparent border-b-0">
                                <TableHead className="w-[60px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">Vimeo</TableHead>
                                <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">운동구분</TableHead>
                                <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">운동명(영문)</TableHead>
                                <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">운동명(한글)</TableHead>
                                <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">자극부위</TableHead>
                                <TableHead className="w-[100px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">필요기구</TableHead>
                                <TableHead className="w-[150px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">특징 및 효과</TableHead>
                                <TableHead className="w-[70px] h-[45px] text-center font-bold px-2 border-b-0 border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">양쪽</TableHead>
                                <TableHead className="w-[80px] h-[45px] text-center font-bold px-2 border-b-0 bg-[#b9adb5] dark:bg-gray-800 text-[#27272a] dark:text-[#94a3b8]">상태</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isInitialLoading ? (
                                <TableRow className="border-b-0">
                                    <TableCell colSpan={9} className="h-24 text-center border-b-0">
                                        로딩 중...
                                    </TableCell>
                                </TableRow>
                            ) : exercises.length === 0 ? (
                                <TableRow className="border-b-0">
                                    <TableCell colSpan={9} className="h-24 text-center border-b-0 text-muted-foreground">
                                        검색 결과가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {exercises.map((exercise) => {
                                        const isSelected = String(selectedExerciseId || '') === String(exercise.id)
                                        const hasVimeo = !!(exercise.video_id || exercise.video_url)
                                        return (
                                            <TableRow
                                                key={exercise.id}
                                                className={cn(
                                                    "cursor-pointer h-[35px] border-b-0 group transition-colors bg-[#f9fafb] dark:bg-[#1d1d1d]",
                                                    "hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30",
                                                    // docs/styles.md: 선택 배경은 bg-primary/20, 텍스트 색상은 호버 시에만 변경
                                                    isSelected && "!bg-primary/20"
                                                )}
                                                onClick={() => onSelectExercise(exercise)}
                                            >
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )} title={hasVimeo ? `Vimeo: ${exercise.parent_folder || ''}` : 'Vimeo 정보 없음'}>
                                                    {hasVimeo ? (
                                                        <Badge variant="outline" className="h-5 text-[10px] px-1 bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 pointer-events-none">
                                                            ✓
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="h-5 text-[10px] px-1 bg-gray-500/10 border-gray-500 text-gray-600 dark:text-gray-400 pointer-events-none">
                                                            -
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )}>
                                                    <Badge
                                                        variant="outline"
                                                        className="h-5 text-[10px] px-1 pointer-events-none"
                                                        title={exercise.major_category}
                                                    >
                                                        {exercise.major_category_name}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors font-medium",
                                                    isSelected && "bg-primary/20"
                                                )}>{exercise.name_en}</TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )}>{exercise.name_ko}</TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )}>{exercise.target_muscles}</TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )}>{exercise.equipment}</TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors truncate max-w-[150px]",
                                                    isSelected && "bg-primary/20"
                                                )} title={exercise.characteristics}>
                                                    {exercise.characteristics}
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs text-center border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )}>
                                                    <Badge variant={exercise.is_bilateral ? "default" : "outline"} className="h-5 text-[10px] px-1 pointer-events-none">
                                                        {exercise.is_bilateral ? 'Y' : 'N'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "h-[35px] py-0 px-2 text-xs text-center group-hover:text-inherit transition-colors",
                                                    isSelected && "bg-primary/20"
                                                )}>
                                                    <Switch
                                                        checked={exercise.is_active}
                                                        disabled
                                                        className={cn(
                                                            "scale-75 origin-center pointer-events-none",
                                                            // ON/OFF 색상 구분 (disabled에서도 보이도록 opacity 고정)
                                                            "disabled:opacity-100",
                                                            "data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-rose-600"
                                                        )}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}

                                    {isLoadingMore && (
                                        <TableRow className="border-b-0 hover:bg-transparent">
                                            <TableCell colSpan={9} className="h-14 text-center border-b-0 text-muted-foreground">
                                                <span className="inline-flex items-center gap-2 text-xs">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    불러오는 중...
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
