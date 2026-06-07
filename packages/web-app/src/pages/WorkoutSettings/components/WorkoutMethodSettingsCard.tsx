import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow
} from '@/components/ui/table'
import { Plus, Minus, Save } from 'lucide-react'
import type { MethodType, WorkoutSettingRow } from './workoutSettingsModel'

export type WorkoutMethodSettingsCardProps = {
  selectedMethod: MethodType
  onMethodChange: (method: MethodType) => void
  currentRows: WorkoutSettingRow[]
  isTimeStructured: boolean
  isWaterBreakLastRowOnly: boolean
  onCellDirectChange: (index: number, field: keyof WorkoutSettingRow, value: number) => void
  onCellAdjust: (index: number, field: keyof WorkoutSettingRow, delta: number) => void
  onAddRow: () => void
  onRemoveRow: () => void
  onSave: () => void
  isSaving: boolean
}

export const WorkoutMethodSettingsCard: React.FC<WorkoutMethodSettingsCardProps> = ({
  selectedMethod,
  onMethodChange,
  currentRows,
  isTimeStructured,
  isWaterBreakLastRowOnly,
  onCellDirectChange,
  onCellAdjust,
  onAddRow,
  onRemoveRow,
  onSave,
  isSaving
}) => {
  /** WorkoutEditor Round 패널과 동일: 빈 문자열은 0으로, parseInt로 파싱 후 반영 */
  const handleNumericInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof WorkoutSettingRow
  ) => {
    e.stopPropagation()
    const raw = e.target.value
    const val = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isNaN(val)) onCellDirectChange(index, field, val)
  }

  return (
    <Card className="flex-[2] min-h-0 border border-[#343637] dark:border-[#6b7280] shadow-md overflow-hidden">
      <CardHeader className="h-12 px-4 py-0 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <Tabs
          value={selectedMethod}
          onValueChange={(val) => onMethodChange(val as MethodType)}
          className="w-full"
        >
          <TabsList className="bg-slate-100 dark:bg-slate-800/60 p-1 h-9 rounded-lg border border-[#343637] dark:border-slate-700/50 shadow-inner">
            <TabsTrigger
              value="stress"
              className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all"
            >
              MAIN-STRESS
            </TabsTrigger>
            <TabsTrigger
              value="loop"
              className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all"
            >
              MAIN-LOOP
            </TabsTrigger>
            <TabsTrigger
              value="AMRAP"
              className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all"
            >
              AMRAP
            </TabsTrigger>
            <TabsTrigger
              value="EMOM-STRESS"
              className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all"
            >
              EMOM-STRESS
            </TabsTrigger>
            <TabsTrigger
              value="EMOM-LOOP"
              className="rounded-md px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm h-7 text-xs font-bold transition-all"
            >
              EMOM-LOOP
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 ml-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onAddRow}
            disabled={selectedMethod === 'AMRAP' && currentRows.length >= 2}
            title={
              selectedMethod === 'AMRAP' && currentRows.length >= 2
                ? 'AMRAP은 Round 최대 2개'
                : undefined
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onRemoveRow}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button className="h-8" onClick={onSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            저장
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-48px)] overflow-auto">
        <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
          <ShadcnTableHeader className="sticky top-0 z-10">
            <ShadcnTableRow className="hover:bg-transparent border-b-0">
              <ShadcnTableHead className="w-[80px] h-[45px] text-center border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800">
                Round
              </ShadcnTableHead>
              <ShadcnTableHead className="w-[140px] h-[45px] text-center border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800">
                {isTimeStructured ? '시간(분)' : '시간(초)'}
              </ShadcnTableHead>
              <ShadcnTableHead className="w-[140px] h-[45px] text-center border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800">
                {isTimeStructured ? '물보충(분)' : '휴식(초)'}
              </ShadcnTableHead>
              {!isTimeStructured ? (
                <ShadcnTableHead className="w-[140px] h-[45px] text-center border-r border-[#343637] dark:border-[#6b7280] bg-[#b9adb5] dark:bg-gray-800">
                  물보충(초)
                </ShadcnTableHead>
              ) : null}
              <ShadcnTableHead className="w-[140px] h-[45px] text-center bg-[#b9adb5] dark:bg-gray-800">
                기본 횟수
              </ShadcnTableHead>
            </ShadcnTableRow>
          </ShadcnTableHeader>
          <ShadcnTableBody>
            {currentRows.map((row, index) => {
              const isWaterBreakEditable =
                !isWaterBreakLastRowOnly || index === currentRows.length - 1
              return (
                <ShadcnTableRow key={`${selectedMethod}_${index}`} className="h-[50px]">
                  <ShadcnTableCell className="text-center border-r border-[#343637] dark:border-[#6b7280]">
                    {index + 1}
                  </ShadcnTableCell>
                  <ShadcnTableCell className="border-r border-[#343637] dark:border-[#6b7280]">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCellAdjust(index, 'time', -1)
                        }}
                        className="text-primary"
                        aria-label="시간 감소"
                      >
                        -
                      </button>
                      <Input
                        type="number"
                        min={0}
                        value={row.time}
                        onChange={(e) => handleNumericInputChange(e, index, 'time')}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          e.stopPropagation()
                          e.target.select()
                        }}
                        className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label="시간 입력"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCellAdjust(index, 'time', 1)
                        }}
                        className="text-primary"
                        aria-label="시간 증가"
                      >
                        +
                      </button>
                    </div>
                  </ShadcnTableCell>
                  <ShadcnTableCell className="border-r border-[#343637] dark:border-[#6b7280]">
                    {isTimeStructured ? (
                      isWaterBreakEditable ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onCellAdjust(index, 'waterBreak', -1)
                            }}
                            className="text-primary"
                            aria-label="물보충 감소"
                          >
                            -
                          </button>
                          <Input
                            type="number"
                            min={0}
                            value={row.waterBreak}
                            onChange={(e) => handleNumericInputChange(e, index, 'waterBreak')}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => {
                              e.stopPropagation()
                              e.target.select()
                            }}
                            className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label="물보충 입력"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onCellAdjust(index, 'waterBreak', 1)
                            }}
                            className="text-primary"
                            aria-label="물보충 증가"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground tabular-nums flex items-center justify-center">-</span>
                      )
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCellAdjust(index, 'rest', -1)
                          }}
                          className="text-primary"
                          aria-label="휴식 감소"
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          min={0}
                          value={row.rest}
                          onChange={(e) => handleNumericInputChange(e, index, 'rest')}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => {
                            e.stopPropagation()
                            e.target.select()
                          }}
                          className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label="휴식 입력"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCellAdjust(index, 'rest', 1)
                          }}
                          className="text-primary"
                          aria-label="휴식 증가"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </ShadcnTableCell>
                  {!isTimeStructured ? (
                    <ShadcnTableCell className="border-r border-[#343637] dark:border-[#6b7280]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCellAdjust(index, 'waterBreak', -1)
                          }}
                          className="text-primary disabled:opacity-40 disabled:pointer-events-none"
                          aria-label="물보충 감소"
                          disabled={!isWaterBreakEditable}
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          min={0}
                          value={row.waterBreak}
                          onChange={(e) => handleNumericInputChange(e, index, 'waterBreak')}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => {
                            e.stopPropagation()
                            e.target.select()
                          }}
                          className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60"
                          aria-label="물보충 입력"
                          disabled={!isWaterBreakEditable}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCellAdjust(index, 'waterBreak', 1)
                          }}
                          className="text-primary disabled:opacity-40 disabled:pointer-events-none"
                          aria-label="물보충 증가"
                          disabled={!isWaterBreakEditable}
                        >
                          +
                        </button>
                      </div>
                    </ShadcnTableCell>
                  ) : null}
                  <ShadcnTableCell>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCellAdjust(index, 'reps', -1)
                        }}
                        className="text-primary"
                        aria-label="횟수 감소"
                      >
                        -
                      </button>
                      <Input
                        type="number"
                        min={0}
                        value={row.reps}
                        onChange={(e) => handleNumericInputChange(e, index, 'reps')}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          e.stopPropagation()
                          e.target.select()
                        }}
                        className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label="횟수 입력"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCellAdjust(index, 'reps', 1)
                        }}
                        className="text-primary"
                        aria-label="횟수 증가"
                      >
                        +
                      </button>
                    </div>
                  </ShadcnTableCell>
                </ShadcnTableRow>
              )
            })}
          </ShadcnTableBody>
        </ShadcnTable>
      </CardContent>
    </Card>
  )
}
