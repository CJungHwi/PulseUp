-- =============================================
-- Migration: Add vimeo column to workout_categories
-- Description: Vimeo parent_folder와 매칭하기 위한 컬럼 추가
-- =============================================

-- workout_categories 테이블에 vimeo 컬럼 추가
ALTER TABLE workout_categories 
ADD COLUMN vimeo VARCHAR(255) NULL COMMENT 'Vimeo parent_folder 매칭용 (예: Dynamic Stretching)';

-- 인덱스 추가
ALTER TABLE workout_categories 
ADD INDEX idx_vimeo (vimeo);

-- 기존 데이터 업데이트 (예시 - 실제 값에 맞게 수정 필요)
-- UPDATE workout_categories SET vimeo = 'Dynamic Stretching' WHERE major_category = 'dynamic_stretching';
-- UPDATE workout_categories SET vimeo = 'Cool Down' WHERE major_category = 'cool_down';
