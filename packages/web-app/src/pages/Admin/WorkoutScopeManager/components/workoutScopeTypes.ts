export interface WorkoutScopeItem {
  id: string
  scopeCode: string
  scopeName: string
  sortOrder: number
  isActive: boolean
}

export interface WorkoutScopeFormValues {
  scopeCode: string
  scopeName: string
  sortOrder: number
  isActive: boolean
}

export const createEmptyWorkoutScopeForm = (): WorkoutScopeFormValues => ({
  scopeCode: '',
  scopeName: '',
  sortOrder: 0,
  isActive: true,
})
