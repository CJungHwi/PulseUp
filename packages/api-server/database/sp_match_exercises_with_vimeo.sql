-- =============================================
-- Stored Procedure: sp_match_exercises_with_vimeo
-- Description: vimeo_videos와 exercises 테이블 동기화
--              - video_url 기반 매칭 (제목 변경에도 동일한 영상으로 인식)
--              - 있으면 UPDATE, 없으면 INSERT
--              - parent_folder로 workout_category_id 자동 설정
--              - title_normalized 매칭: 제목 중복/변경 시 video_url 보정 및 중복 INSERT 방지
-- =============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_match_exercises_with_vimeo$$


CREATE PROCEDURE sp_match_exercises_with_vimeo()
BEGIN
    DECLARE v_update_count INT DEFAULT 0;
    DECLARE v_insert_count INT DEFAULT 0;
    
    -- 0단계: 기존 Vimeo 관련 운동 전체 비활성화
    UPDATE exercises 
    SET is_active = FALSE 
    WHERE video_url IS NOT NULL AND video_url <> '';
    
    -- 1단계: 기존 exercise 업데이트 및 활성화 (video_url로 매칭)
    UPDATE exercises e
    INNER JOIN vimeo_videos v ON e.video_url = v.video_id AND v.is_active = TRUE
    SET 
        e.name_en = v.title,
        e.video_title = v.title,
        e.thumbnail_url = v.thumbnail_url,
        e.video_duration = v.duration,
        e.workout_category_id = COALESCE(v.workout_category_id, e.workout_category_id),
        e.is_active = TRUE, -- vimeo_videos에 존재하므로 활성화
        e.updated_at = CURRENT_TIMESTAMP
    WHERE v.video_id IS NOT NULL
        AND v.video_id <> '';
    
    SET v_update_count = ROW_COUNT();
    
    -- 1.5단계: 고아 exercise 보정 (video_url이 vimeo_videos에 없지만, title_normalized로 매칭되는 경우)
    -- 중복 제거 등으로 video_id가 바뀐 경우 video_url 업데이트
    UPDATE exercises e
    INNER JOIN vimeo_videos v ON v.title_normalized = LOWER(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(e.name_en, '')), ' ', ''), '\t', ''), '\n', ''))
        AND v.is_active = TRUE
        AND e.workout_category_id = v.workout_category_id
    LEFT JOIN vimeo_videos v2 ON e.video_url = v2.video_id
    SET 
        e.video_url = v.video_id,
        e.name_en = v.title,
        e.video_title = v.title,
        e.thumbnail_url = v.thumbnail_url,
        e.video_duration = v.duration,
        e.workout_category_id = COALESCE(v.workout_category_id, e.workout_category_id),
        e.is_active = TRUE,
        e.updated_at = CURRENT_TIMESTAMP
    WHERE (v2.video_id IS NULL OR v2.video_id = '')
      AND e.video_url IS NOT NULL
      AND e.video_url <> ''
      AND v.title_normalized IS NOT NULL
      AND v.title_normalized <> '';
    
    SET v_update_count = v_update_count + ROW_COUNT();
    
    -- 2단계: 새로운 exercise 생성 (vimeo_videos에만 있는 영상, title_normalized로 기존 exercise와 중복 없을 때만)
    INSERT INTO exercises (
        number,
        workout_category_id,
        level,
        name_en,
        name_ko,
        target_muscles,
        characteristics,
        equipment,
        purpose,
        video_url,
        thumbnail_url,
        video_title,
        video_duration,
        is_active
    )
    SELECT 
        (SELECT COALESCE(MAX(number), 0) + 1 FROM exercises) + (@row_num := @row_num + 1) - 1 AS number,
        COALESCE(v.workout_category_id, (SELECT id FROM workout_categories LIMIT 1)) AS workout_category_id,
        'beginner' AS level,
        v.title AS name_en,
        v.title AS name_ko,
        '' AS target_muscles,
        v.description AS characteristics,
        '' AS equipment,
        '' AS purpose,
        v.video_id AS video_url,
        v.thumbnail_url,
        v.title AS video_title,
        v.duration AS video_duration,
        TRUE AS is_active -- 신규 생성 시 활성화
    FROM vimeo_videos v
    CROSS JOIN (SELECT @row_num := 0) r
    LEFT JOIN exercises e ON e.video_url = v.video_id
    WHERE v.is_active = TRUE
        AND e.id IS NULL
        AND v.workout_category_id IS NOT NULL
        AND v.video_id IS NOT NULL
        AND v.video_id <> ''
        -- title_normalized로 이미 같은 운동이 있으면 INSERT 스킵 (중복 방지)
        AND NOT EXISTS (
            SELECT 1 FROM exercises e2
            WHERE LOWER(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(e2.name_en, '')), ' ', ''), '\t', ''), '\n', '')) = v.title_normalized
              AND e2.workout_category_id = v.workout_category_id
        )
    ORDER BY v.video_id;
    
    SET v_insert_count = ROW_COUNT();
    
    -- 결과 반환
    SELECT 
        v_update_count AS updated_count,
        v_insert_count AS inserted_count,
        (v_update_count + v_insert_count) AS total_matched_count;
END$$

DELIMITER ;
