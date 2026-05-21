-- =============================================
-- Migration: Add workout_category_id column to vimeo_videos
-- Description: Vimeo parent_folder를 workout_categories.major_category_name과 매핑한 결과를 저장
-- 적용 순서: 1) 본 스크립트 실행 → 2) sp_insert_vimeo_video 등 관련 프로시저 재적용
-- =============================================

ALTER TABLE vimeo_videos
ADD COLUMN workout_category_id CHAR(36) NULL COMMENT '상위 폴더와 매칭된 workout_categories.id';

ALTER TABLE vimeo_videos
ADD INDEX idx_workout_category_id (workout_category_id);

UPDATE vimeo_videos v
LEFT JOIN workout_categories wc
  ON LOWER(TRIM(v.parent_folder)) = LOWER(TRIM(wc.major_category_name))
SET v.workout_category_id = wc.id
WHERE v.parent_folder IS NOT NULL
  AND TRIM(v.parent_folder) <> '';
