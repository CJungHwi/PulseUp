-- =============================================
-- Stored Procedure: sp_get_exercises_with_category (Updated)
-- Description: Vimeo 영상 정보를 기준으로 운동 목록 조회 (카테고리 포함)
-- Base Table: vimeo_videos (Vimeo가 기준)
-- Join: exercises (추가 정보 제공용)
-- =============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_get_exercises_with_category$$

CREATE PROCEDURE sp_get_exercises_with_category(
    IN p_workout_category_id CHAR(36),
    IN p_major_category VARCHAR(100),
    IN p_minor_category VARCHAR(100),
    IN p_level ENUM('beginner', 'intermediate', 'advanced'),
    IN p_is_active BOOLEAN,
    IN p_search VARCHAR(255),
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    DECLARE v_limit INT DEFAULT 20;
    DECLARE v_offset INT DEFAULT 0;
    
    -- 매개변수 기본값 설정
    SET v_limit = IFNULL(p_limit, 20);
    SET v_offset = IFNULL(p_offset, 0);
    
    SELECT 
        -- Vimeo 기본 정보 (필수)
        v.video_id,
        v.video_id as video_url,
        v.title as name_en,
        v.title as video_title,
        v.thumbnail_url,
        v.duration as video_duration,
        v.status as vimeo_status,
        v.parent_folder,
        v.is_active as vimeo_is_active,
        
        -- exercises 추가 정보 (있으면)
        e.id,
        e.number,
        e.workout_category_id,
        e.name_ko,
        e.level,
        e.target_muscles,
        e.characteristics,
        e.equipment,
        e.purpose,
        e.video_start_time,
        e.video_end_time,
        e.video_loop_count,
        e.is_bilateral,
        e.is_active,
        e.created_at,
        e.updated_at,
        
        -- workout_categories 정보
        wc.major_category,
        wc.minor_category,
        wc.major_category_name
    FROM vimeo_videos v
    LEFT JOIN exercises e ON v.video_id = e.video_url 
        OR (
            v.workout_category_id = e.workout_category_id
            AND LOWER(TRIM(v.title)) = LOWER(TRIM(e.name_en))
        )
    LEFT JOIN workout_categories wc ON COALESCE(e.workout_category_id, v.workout_category_id) = wc.id
    WHERE v.is_active = TRUE
        AND (p_workout_category_id IS NULL OR e.workout_category_id = p_workout_category_id)
        AND (p_major_category IS NULL OR wc.major_category = p_major_category)
        AND (p_minor_category IS NULL OR wc.minor_category = p_minor_category)
        AND (p_level IS NULL OR e.level = p_level)
        AND (p_is_active IS NULL OR COALESCE(e.is_active, TRUE) = p_is_active)
        AND (p_search IS NULL OR 
             v.title LIKE CONCAT('%', p_search, '%') OR
             e.name_en LIKE CONCAT('%', p_search, '%') OR 
             e.name_ko LIKE CONCAT('%', p_search, '%') OR
             e.target_muscles LIKE CONCAT('%', p_search, '%'))
    ORDER BY v.parent_folder ASC, v.title ASC
    LIMIT v_limit OFFSET v_offset;
END$$

DELIMITER ;
