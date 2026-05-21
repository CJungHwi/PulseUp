-- =============================================
-- Stored Procedure: sp_GetExercises (Updated)
-- Description: 운동 목록 조회 (exercises 기준, Vimeo LEFT JOIN)
-- Base Table: exercises (운동 관리 화면에서 모든 운동 표시)
-- Join: vimeo_videos (Vimeo 연결 시 video_id, thumbnail 등 제공)
-- =============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_GetExercises$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `workout_system`.`sp_GetExercises`(
    IN p_major_category VARCHAR(100),
    IN p_search_type VARCHAR(50),
    IN p_search_keyword VARCHAR(255),
    IN p_page INT,
    IN p_limit INT,
    IN p_include_inactive BOOLEAN
)
BEGIN
    DECLARE v_offset INT DEFAULT 0;
    DECLARE v_page INT DEFAULT 1;
    DECLARE v_limit INT DEFAULT 20;
    
    SET v_page = COALESCE(p_page, 1);
    SET v_limit = COALESCE(p_limit, 20);
    SET v_offset = (v_page - 1) * v_limit;
    
    -- 총 개수 조회 (exercises 기준)
    SELECT COUNT(*) as total
    FROM exercises e
    INNER JOIN workout_categories wc ON e.workout_category_id = wc.id
    WHERE (p_major_category IS NULL OR p_major_category = '' OR wc.major_category = p_major_category)
      AND (p_search_keyword IS NULL OR p_search_keyword = '' OR 
           CASE 
               WHEN p_search_type = 'name_en' THEN e.name_en LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'name_ko' THEN e.name_ko LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'target_muscles' THEN e.target_muscles LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'characteristics' THEN e.characteristics LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'equipment' THEN e.equipment LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'purpose' THEN e.purpose LIKE CONCAT('%', p_search_keyword, '%')
               ELSE (e.name_en LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.name_ko LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.target_muscles LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.characteristics LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.equipment LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.purpose LIKE CONCAT('%', p_search_keyword, '%'))
           END
      )
      AND (p_include_inactive = TRUE OR COALESCE(e.is_active, TRUE) = TRUE);
    
    -- 데이터 조회: exercises 기준, Vimeo LEFT JOIN (video_url 또는 workout_category_id+name_en 매칭)
    SELECT 
        e.id,
        e.number,
        e.workout_category_id,
        e.name_en,
        e.name_ko,
        e.level,
        e.target_muscles,
        e.characteristics,
        e.equipment,
        e.purpose,
        e.video_start_time,
        e.video_end_time,
        e.video_loop_count,
        e.is_active,
        e.created_at,
        e.updated_at,
        wc.major_category,
        wc.minor_category,
        wc.major_category_name,
        -- Vimeo 정보 (매칭 시 표시)
        COALESCE(v.video_id, e.video_url) as video_id,
        COALESCE(v.video_id, e.video_url) as video_url,
        COALESCE(v.title, e.video_title) as video_title,
        COALESCE(v.thumbnail_url, e.thumbnail_url) as thumbnail_url,
        COALESCE(v.duration, e.video_duration) as video_duration,
        v.status as vimeo_status,
        v.parent_folder,
        v.is_active as vimeo_is_active,
        v.created_at as vimeo_created_at,
        v.updated_at as vimeo_updated_at
    FROM exercises e
    INNER JOIN workout_categories wc ON e.workout_category_id = wc.id
    LEFT JOIN vimeo_videos v ON v.is_active = TRUE
        AND (
            (e.video_url IS NOT NULL AND e.video_url <> '' AND v.video_id = e.video_url)
            OR (
                LOWER(TRIM(e.name_en)) = LOWER(TRIM(v.title))
                AND (
                    (v.workout_category_id IS NOT NULL AND v.workout_category_id = e.workout_category_id)
                    OR (v.parent_folder IS NOT NULL AND LOWER(TRIM(wc.major_category_name)) = LOWER(TRIM(v.parent_folder)))
                )
            )
        )
    WHERE (p_major_category IS NULL OR p_major_category = '' OR wc.major_category = p_major_category)
      AND (p_search_keyword IS NULL OR p_search_keyword = '' OR 
           CASE 
               WHEN p_search_type = 'name_en' THEN e.name_en LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'name_ko' THEN e.name_ko LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'target_muscles' THEN e.target_muscles LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'characteristics' THEN e.characteristics LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'equipment' THEN e.equipment LIKE CONCAT('%', p_search_keyword, '%')
               WHEN p_search_type = 'purpose' THEN e.purpose LIKE CONCAT('%', p_search_keyword, '%')
               ELSE (e.name_en LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.name_ko LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.target_muscles LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.characteristics LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.equipment LIKE CONCAT('%', p_search_keyword, '%') OR
                     e.purpose LIKE CONCAT('%', p_search_keyword, '%'))
           END
      )
      AND (p_include_inactive = TRUE OR COALESCE(e.is_active, TRUE) = TRUE)
    ORDER BY wc.major_category_name ASC, e.name_en ASC
    LIMIT v_limit OFFSET v_offset;
end$$

DELIMITER ;
