-- =============================================
-- Migration: Add is_active column to vimeo_videos
-- Description: Vimeo에서 삭제된 영상을 soft delete 방식으로 처리
-- =============================================

-- 기존 vimeo_videos 테이블에 is_active 컬럼 추가
ALTER TABLE vimeo_videos 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '활성 상태 (TRUE: 사용가능, FALSE: Vimeo에서 삭제됨)';

-- 인덱스 추가
ALTER TABLE vimeo_videos 
ADD INDEX idx_is_active (is_active);

-- 기존 데이터는 모두 활성 상태로 설정
UPDATE vimeo_videos SET is_active = TRUE WHERE is_active IS NULL;
