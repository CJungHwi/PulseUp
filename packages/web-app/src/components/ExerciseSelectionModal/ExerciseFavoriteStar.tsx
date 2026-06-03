import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseFavoriteStarProps {
  isFavorite: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * 운동 즐겨찾기 토글 아이콘
 * - 등록: 노란색 채워진 별
 * - 미등록: 빈 별
 */
export const ExerciseFavoriteStar: React.FC<ExerciseFavoriteStarProps> = ({
  isFavorite,
  disabled = false,
  onToggle,
}) => {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    onToggle();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;
      onToggle();
    }
  };

  return (
    <button
      type="button"
      aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
      aria-pressed={isFavorite}
      disabled={disabled}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex items-center justify-center rounded-sm p-0.5 transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/60'
      )}
    >
      <Star
        className={cn(
          'h-4 w-4',
          isFavorite ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-muted-foreground'
        )}
      />
    </button>
  );
};
