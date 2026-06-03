import { useCallback, useEffect, useState } from 'react';
import { exerciseFavoriteApi } from '../../services/exerciseFavoriteApi';

interface UseExerciseFavoritesOptions {
  enabled: boolean;
}

export const useExerciseFavorites = ({ enabled }: UseExerciseFavoritesOptions) => {
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<Set<string>>(new Set());
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteToggleLoadingId, setFavoriteToggleLoadingId] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!enabled) {
      setFavoriteExerciseIds(new Set());
      return;
    }

    setFavoritesLoading(true);
    try {
      const exerciseIds = await exerciseFavoriteApi.getFavoriteExerciseIds();
      setFavoriteExerciseIds(new Set(exerciseIds.map(String)));
    } catch (error) {
      console.error('즐겨찾기 목록 로드 실패:', error);
      setFavoriteExerciseIds(new Set());
    } finally {
      setFavoritesLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorite = useCallback(
    (exerciseId: string) => favoriteExerciseIds.has(String(exerciseId)),
    [favoriteExerciseIds]
  );

  const toggleFavorite = useCallback(async (exerciseId: string) => {
    const idStr = String(exerciseId);
    setFavoriteToggleLoadingId(idStr);
    try {
      const result = await exerciseFavoriteApi.toggleFavorite(idStr);
      const nextIsFavorite = Number(result.is_favorite) === 1;
      setFavoriteExerciseIds((prev) => {
        const next = new Set(prev);
        if (nextIsFavorite) {
          next.add(idStr);
        } else {
          next.delete(idStr);
        }
        return next;
      });
    } catch (error) {
      console.error('즐겨찾기 토글 실패:', error);
    } finally {
      setFavoriteToggleLoadingId(null);
    }
  }, []);

  return {
    favoriteExerciseIds,
    favoritesLoading,
    favoriteToggleLoadingId,
    isFavorite,
    toggleFavorite,
    reloadFavorites: loadFavorites,
  };
};
