-- =============================================
-- Stored Procedure: sp_match_exercises_with_vimeo_video_url_only
-- Description: exercises 테이블과 vimeo_videos 테이블을 제목 기준으로 매칭하여
--              video_url이 비어있는 운동에 대해서만 video_url을 업데이트합니다.
--              다른 컬럼(썸네일, 길이 등)은 변경하지 않습니다.
--              title_normalized 사용: "Knee-up Step-up" = "Knee-upStep-up" 동일 인식
-- =============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_match_exercises_with_vimeo_video_url_only$$

CREATE PROCEDURE sp_match_exercises_with_vimeo_video_url_only()
BEGIN
    -- 제목 정규화 매칭 (공백 제거 + 소문자). v.title_normalized 사용, e.name_en은 동일 규칙 적용
    UPDATE exercises e
    INNER JOIN vimeo_videos v
      ON v.title_normalized = LOWER(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(e.name_en, '')), ' ', ''), '\t', ''), '\n', ''))
      AND e.workout_category_id = v.workout_category_id
      AND v.is_active = TRUE
    SET e.video_url = v.video_id
    WHERE v.video_id IS NOT NULL
      AND v.video_id <> ''
      AND (e.video_url IS NULL OR e.video_url = '');
      
    SELECT ROW_COUNT() AS matched_count;
END$$

DELIMITER ;
