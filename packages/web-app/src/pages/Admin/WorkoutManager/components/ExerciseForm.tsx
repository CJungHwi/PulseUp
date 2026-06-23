/**
 * ExerciseForm
 * - 기능: 운동 마스터 상세/수정 폼, Vimeo 연결 정보와 썸네일 미리보기 표시
 * - API: 부모 `WorkoutManager`에서 createExercise/updateExercise dispatch
 * - 흐름: 목록 선택 → 폼 표시 → 수정 모드에서 운동구분/한글명/부가정보/양쪽운동/상태 저장
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Edit, Image as ImageIcon, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkoutCategory, WorkoutMajorCategory } from '@/types/workoutCategory'

interface ExerciseFormProps {
    formData: any
    majorCategories: WorkoutMajorCategory[]
    categories: WorkoutCategory[]
    isEditing: boolean
    onEdit: () => void
    onFormChange: (field: string, value: any) => void
    onSave: () => void
    onCancel: () => void
}

export const ExerciseForm: React.FC<ExerciseFormProps> = ({
    formData,
    majorCategories,
    categories,
    isEditing,
    onEdit,
    onFormChange,
    onSave,
    onCancel
}) => {
    const [hasThumbnailError, setHasThumbnailError] = useState(false)
    const labelClassName = "text-[11px] text-muted-foreground leading-none"
    const inputClassName = "h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card"
    const selectTriggerClassName = "h-9 text-xs border-[#343637] dark:border-[#6b7280] bg-card"
    const majorCategoryLabel = useMemo(() => {
        const categoryId = String(formData?.workout_category_id || '')
        const category = categories.find((c) => String(c.id) === categoryId)
        const majorCode = category?.major_category || String(formData?.major_category || '')

        const foundMajor = majorCategories.find((c) => c.major_category === majorCode)
        const majorName = foundMajor?.major_category_name || category?.major_category_name || ''

        if (categoryId && category) {
            return majorName
        }
        return majorName || ''
    }, [formData?.workout_category_id, formData?.major_category, categories, majorCategories])

    const selectableCategories = useMemo(() => {
        return [...categories]
            .filter(c => c.is_active)
            .sort((a, b) => {
                const sortA = a.sort_order ?? 0
                const sortB = b.sort_order ?? 0
                if (sortA !== sortB) return sortA - sortB
                const majorA = a.major_category ?? ''
                const majorB = b.major_category ?? ''
                if (majorA !== majorB) return majorA.localeCompare(majorB)
                const minorA = a.minor_category ?? ''
                const minorB = b.minor_category ?? ''
                return minorA.localeCompare(minorB)
            })
    }, [categories])

    useEffect(() => {
        setHasThumbnailError(false)
    }, [formData?.thumbnail_url])

    return (
        <Card className="h-full flex flex-col bg-card shadow-md">
            <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                        <Edit className="w-5 h-5" />
                        운동 정보 {isEditing ? '입력' : '상세'}
                    </CardTitle>
                    <div className="flex gap-2">
                        {!isEditing && (
                            <Button variant="outline" size="sm" onClick={onEdit}>
                                수정
                            </Button>
                        )}
                        {isEditing && (
                            <>
                                <Button variant="outline" size="sm" onClick={onCancel}>
                                    <X className="w-4 h-4 mr-1" /> 취소
                                </Button>
                                <Button size="sm" onClick={onSave}>
                                    <Save className="w-4 h-4 mr-1" /> 저장
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto p-3">
                <div className="flex flex-col lg:flex-row gap-3 min-h-0">
                    {/* Left: Form Fields */}
                    <div className="flex-1 min-w-0 space-y-3">
                        {/* 1row: 운동구분 / 운동명(영문) / 운동명(한글) */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="workout_category_id" className={labelClassName}>운동구분</Label>
                                <Select
                                    value={String(formData.workout_category_id || '')}
                                    onValueChange={(value) => {
                                        onFormChange('workout_category_id', value)
                                        const selected = categories.find((c) => String(c.id) === String(value))
                                        if (selected) onFormChange('major_category', selected.major_category)
                                    }}
                                    disabled={!isEditing}
                                    labels={Object.fromEntries(categories.map(c => {
                                        const foundMajor = majorCategories.find(mc => mc.major_category === c.major_category)
                                        const majorName = foundMajor?.major_category_name || c.major_category_name
                                        return [String(c.id), majorName]
                                    }))}
                                >
                                    <SelectTrigger id="workout_category_id" className={selectTriggerClassName}>
                                        <SelectValue placeholder="선택하세요" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectableCategories.map((category) => {
                                            const foundMajor = majorCategories.find(mc => mc.major_category === category.major_category)
                                            const majorName = foundMajor?.major_category_name || category.major_category_name || ''
                                            const minorName = category.minor_category ? ` / ${category.minor_category}` : ''
                                            return (
                                                <SelectItem key={String(category.id)} value={String(category.id)}>
                                                    {`${majorName}${minorName}`}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name_en" className={labelClassName}>운동명 (영문)</Label>
                                <Input
                                    id="name_en"
                                    value={formData.name_en}
                                    readOnly
                                    disabled
                                    className={cn(inputClassName, "opacity-80 cursor-not-allowed")}
                                    title="Vimeo 영상 제목과 매칭되는 필드로 수정할 수 없습니다"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name_ko" className={labelClassName}>운동명 (한글)</Label>
                                <Input
                                    id="name_ko"
                                    value={formData.name_ko}
                                    onChange={(e) => onFormChange('name_ko', e.target.value)}
                                    readOnly={!isEditing}
                                    className={inputClassName}
                                />
                            </div>
                        </div>

                        {/* 2row: 자극부위 / 필요기구 / 영상링크 / 양쪽운동 / 상태 */}
                        <div className="grid grid-cols-5 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="target_muscles" className={labelClassName}>자극부위</Label>
                                <Input
                                    id="target_muscles"
                                    value={formData.target_muscles}
                                    onChange={(e) => onFormChange('target_muscles', e.target.value)}
                                    readOnly={!isEditing}
                                    className={inputClassName}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="equipment" className={labelClassName}>필요기구</Label>
                                <Input
                                    id="equipment"
                                    value={formData.equipment}
                                    onChange={(e) => onFormChange('equipment', e.target.value)}
                                    readOnly={!isEditing}
                                    className={inputClassName}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="video_url" className={labelClassName}>영상링크</Label>
                                <Input
                                    id="video_url"
                                    value={formData.video_url}
                                    readOnly
                                    disabled
                                    placeholder="https://vimeo.com/..."
                                    className={cn(inputClassName, "opacity-80")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="is_bilateral" className={labelClassName}>양쪽운동</Label>
                                <div className="h-10 flex items-center justify-center gap-2">
                                    <Switch
                                        id="is_bilateral"
                                        checked={!!formData.is_bilateral}
                                        onCheckedChange={(checked) => onFormChange('is_bilateral', checked)}
                                        disabled={!isEditing}
                                        className="scale-90 origin-center disabled:opacity-100 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-500"
                                    />
                                    <span className="text-xs text-muted-foreground">{formData.is_bilateral ? 'Y' : 'N'}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="is_active" className={labelClassName}>상태</Label>
                                <div className="h-10 flex items-center justify-center gap-2">
                                    <Switch
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => onFormChange('is_active', checked)}
                                        disabled={!isEditing}
                                        className="scale-90 origin-center disabled:opacity-100 data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-rose-600"
                                    />
                                    <span className="text-xs text-muted-foreground">{formData.is_active ? 'ON' : 'OFF'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 3row: 특징 및 효과 */}
                        <div className="space-y-2">
                            <Label htmlFor="characteristics" className={labelClassName}>특징 및 효과</Label>
                            <Textarea
                                id="characteristics"
                                value={formData.characteristics}
                                onChange={(e) => onFormChange('characteristics', e.target.value)}
                                readOnly={!isEditing}
                                rows={1}
                                className="h-9 min-h-0 text-xs border-[#343637] dark:border-[#6b7280] bg-card resize-none"
                            />
                        </div>
                    </div>

                    {/* Right: Thumbnail Preview */}
                    <div className="w-full lg:w-[238px] shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-bold">썸네일</span>
                        </div>

                        <div className="rounded-lg border border-[#343637] dark:border-[#6b7280] overflow-hidden bg-muted/10 aspect-[5/4.2] flex items-center justify-center">
                            {formData.thumbnail_url && !hasThumbnailError ? (
                                <img
                                    key={formData.thumbnail_url}
                                    src={formData.thumbnail_url}
                                    alt="운동 썸네일"
                                    className="w-full h-full object-contain bg-black"
                                    onError={() => setHasThumbnailError(true)}
                                    loading="lazy"
                                />
                            ) : (
                                <div className="p-4 text-center text-muted-foreground text-xs">
                                    썸네일 이미지가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
