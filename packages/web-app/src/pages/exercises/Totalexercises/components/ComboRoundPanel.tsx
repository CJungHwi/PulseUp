/**
 * ComboRoundPanel — COMBO 운동 Round 패널 (고정 3행)
 * 운동1~3 반복횟수, 마지막 행에 시간(초)·휴식(초)
 */
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table as ShadcnTable,
  TableBody as ShadcnTableBody,
  TableCell as ShadcnTableCell,
  TableHead as ShadcnTableHead,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table'
import { COMBO_ROW_COUNT } from '@/pages/WorkoutSettings/components/workoutSettingsModel'
import type { PanelRow } from './types'

export type ComboRoundPanelProps = {
  panelRows: PanelRow[]
  selectedPanelRowId: string | null
  circuitType: string
  onCircuitTypeChange: (type: string) => void
  onSelectRow: (rowId: string) => void
  onPanelTimeChange: (rowId: string, field: 'time' | 'rest' | 'reps', increment: boolean) => void
  onPanelTimeDirectChange: (rowId: string, field: 'time' | 'rest' | 'reps', value: number) => void
}

export const ComboRoundPanel: React.FC<ComboRoundPanelProps> = ({
  panelRows,
  selectedPanelRowId,
  circuitType,
  onCircuitTypeChange,
  onSelectRow,
  onPanelTimeChange,
  onPanelTimeDirectChange,
}) => {
  const displayRows = panelRows.slice(0, COMBO_ROW_COUNT)
  const lastRowIndex = COMBO_ROW_COUNT - 1

  const handleNumericChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    rowId: string,
    field: 'time' | 'rest' | 'reps',
  ) => {
    e.stopPropagation()
    const raw = e.target.value
    const val = raw === '' ? 0 : parseInt(raw, 10)
    if (!Number.isNaN(val)) onPanelTimeDirectChange(rowId, field, val)
  }

  return (
    <Card className="flex flex-[3.3] min-h-0 flex-col overflow-hidden border border-[#343637] dark:border-[#6b7280] shadow-md">
      <CardHeader className="h-10 shrink-0 px-3 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 border-[#343637] dark:border-[#6b7280]">
        <RadioGroup value={circuitType} onValueChange={onCircuitTypeChange} className="flex flex-row gap-2">
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="stress" id="combo-stress" className="h-3 w-3" />
            <Label htmlFor="combo-stress" className="text-[10px]">
              스트레스
            </Label>
          </div>
          <div className="flex items-center space-x-1">
            <RadioGroupItem value="loop" id="combo-loop" className="h-3 w-3" />
            <Label htmlFor="combo-loop" className="text-[10px]">
              루프
            </Label>
          </div>
        </RadioGroup>
        <CardTitle className="text-xs font-bold flex items-center gap-1">
          <Repeat className="h-4 w-4 text-primary" />
          COMBO (3운동)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <div className="h-full overflow-auto scrollbar-hide">
          <ShadcnTable className="w-full table-fixed border-separate border-spacing-0">
            <ShadcnTableHeader className="sticky top-0 z-10 bg-[#b9adb5] dark:bg-gray-800">
              <ShadcnTableRow className="h-[45px] hover:bg-transparent border-b-0">
                <ShadcnTableHead className="w-12 text-center text-xs p-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                  운동
                </ShadcnTableHead>
                <ShadcnTableHead className="w-20 text-center text-xs p-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                  시간(초)
                </ShadcnTableHead>
                <ShadcnTableHead className="w-20 text-center text-xs p-0 border-r border-[#343637] dark:border-[#6b7280] text-[#27272a] dark:text-[#94a3b8]">
                  휴식(초)
                </ShadcnTableHead>
                <ShadcnTableHead className="w-20 text-center text-xs p-0 text-[#27272a] dark:text-[#94a3b8]">
                  반복 횟수
                </ShadcnTableHead>
              </ShadcnTableRow>
            </ShadcnTableHeader>
            <ShadcnTableBody className="bg-[#f9fafb] dark:bg-[#1d1d1d]">
              {displayRows.map((row, rowIndex) => {
                const isLastRow = rowIndex === lastRowIndex
                return (
                  <ShadcnTableRow
                    key={row.id}
                    className={cn(
                      'h-[35px] cursor-pointer border-b-0 group transition-colors',
                      'hover:text-blue-600 dark:hover:text-yellow-400 hover:bg-muted/30',
                      selectedPanelRowId === row.id && 'bg-primary/20',
                    )}
                    onClick={() => onSelectRow(row.id)}
                  >
                    <ShadcnTableCell className="p-0 h-[35px] text-center text-xs border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      {row.round}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="p-0 h-[35px] border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      {isLastRow ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPanelTimeChange(row.id, 'time', false)
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
                            onChange={(e) => handleNumericChange(e, row.id, 'time')}
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
                              onPanelTimeChange(row.id, 'time', true)
                            }}
                            className="text-primary"
                            aria-label="시간 증가"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center justify-center">-</span>
                      )}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="p-0 h-[35px] border-r border-[#343637] dark:border-[#6b7280] group-hover:text-inherit transition-colors">
                      {isLastRow ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPanelTimeChange(row.id, 'rest', false)
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
                            onChange={(e) => handleNumericChange(e, row.id, 'rest')}
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
                              onPanelTimeChange(row.id, 'rest', true)
                            }}
                            className="text-primary"
                            aria-label="휴식 증가"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center justify-center">-</span>
                      )}
                    </ShadcnTableCell>
                    <ShadcnTableCell className="p-0 h-[35px] text-center group-hover:text-inherit transition-colors">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPanelTimeChange(row.id, 'reps', false)
                          }}
                          className="text-primary"
                          aria-label="횟수 감소"
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          min={1}
                          value={row.reps ?? 10}
                          onChange={(e) => handleNumericChange(e, row.id, 'reps')}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => {
                            e.stopPropagation()
                            e.target.select()
                          }}
                          className="h-7 w-12 text-xs text-center p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label="반복 횟수 입력"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPanelTimeChange(row.id, 'reps', true)
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
        </div>
      </CardContent>
    </Card>
  )
}
