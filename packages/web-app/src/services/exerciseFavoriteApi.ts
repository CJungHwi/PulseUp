import api from './api';

export interface ExerciseFavoriteToggleResult {
  is_favorite: number;
  action: 'added' | 'removed';
}

function unwrapProcedureRows<T>(data: unknown): T {
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) return data[0] as T;
  return data as T;
}

export const exerciseFavoriteApi = {
  getFavoriteExerciseIds: async (): Promise<string[]> => {
    const response = await api.get('/workout-categories/exercises/favorites');
    const rows = unwrapProcedureRows<Array<{ exercise_id: string }>>(response.data.data);
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => String(row.exercise_id));
  },

  toggleFavorite: async (exerciseId: string): Promise<ExerciseFavoriteToggleResult> => {
    const response = await api.post('/workout-categories/exercises/favorites/toggle', {
      exercise_id: exerciseId,
    });
    const row = unwrapProcedureRows<ExerciseFavoriteToggleResult[]>(response.data.data);
    if (Array.isArray(row) && row.length > 0) {
      return row[0];
    }
    return response.data.data as ExerciseFavoriteToggleResult;
  },
};
