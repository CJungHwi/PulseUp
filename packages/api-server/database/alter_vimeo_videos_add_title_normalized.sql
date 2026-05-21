-- =============================================
-- Migration: Add title_normalized column to vimeo_videos
-- Description: 제목 정규화(공백 제거, 소문자)로 중복 감지 및 매칭 개선
--              - "Knee-up Step-up" = "Knee-upStep-up" (동일로 인식)
--              - parent_folder 변경 등으로 생긴 동일 영상 중복 방지
-- 적용 순서: 1) 본 스크립트 실행 → 2) sp_insert_vimeo_video, sp_match_* 프로시저 재적용
-- =============================================

ALTER TABLE vimeo_videos
ADD COLUMN title_normalized VARCHAR(255) NULL COMMENT '제목 정규화: LOWER(REPLACE(TRIM(title), " ", ""))';

-- 기존 데이터 채우기
UPDATE vimeo_videos
SET title_normalized = LOWER(REPLACE(REPLACE(REPLACE(TRIM(title), ' ', ''), '\t', ''), '\n', ''))
WHERE title_normalized IS NULL;

-- 인덱스 추가 (중복 검색용)
ALTER TABLE vimeo_videos
ADD INDEX idx_title_normalized (title_normalized);
