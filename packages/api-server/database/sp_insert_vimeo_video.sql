-- =============================================
-- Stored Procedure: sp_insert_vimeo_video
-- Description: Vimeo 영상 정보를 저장하거나 업데이트
--              vimeo_videos insert/update 시 exercises 테이블 자동 동기화
--              - number = video_id, name_en = title
--              - description 4필드: 신규는 "$" 구분, 기존 "/" 데이터는 "/"로 자동 분기
--              - status = 'available' → is_active = 1
-- =============================================

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_insert_vimeo_video$$

CREATE PROCEDURE sp_insert_vimeo_video(
    IN p_video_id VARCHAR(20),
    IN p_parent_folder VARCHAR(255),
    IN p_title VARCHAR(255),
    IN p_description TEXT,
    IN p_thumbnail_url VARCHAR(500),
    IN p_duration INT,
    IN p_status VARCHAR(50),
    IN p_privacy_view VARCHAR(50)
)
BEGIN
    DECLARE v_video_num INT UNSIGNED DEFAULT 0;
    DECLARE v_workout_cat_id CHAR(36);
    DECLARE v_name_ko VARCHAR(255) DEFAULT '';
    DECLARE v_target_muscles TEXT DEFAULT '';
    DECLARE v_characteristics TEXT DEFAULT '';
    DECLARE v_equipment VARCHAR(255) DEFAULT '';
    DECLARE v_is_active TINYINT(1) DEFAULT 1;
    DECLARE v_desc_padded TEXT;
    DECLARE v_sep VARCHAR(1) DEFAULT '$';
    
    -- title_normalized: 공백 제거 + 소문자 (중복 감지 및 매칭용)
    SET @v_title_normalized = LOWER(REPLACE(REPLACE(REPLACE(TRIM(p_title), ' ', ''), '\t', ''), '\n', ''));
    SET @v_workout_category_id = (
        SELECT wc.id
        FROM workout_categories wc
        WHERE p_parent_folder IS NOT NULL
          AND TRIM(p_parent_folder) <> ''
          AND LOWER(TRIM(wc.major_category_name)) = LOWER(TRIM(p_parent_folder))
        LIMIT 1
    );
    
    -- workout_category_id: NULL이면 기본 카테고리 사용 (없으면 exercises 동기화 생략)
    SET v_workout_cat_id = COALESCE(@v_workout_category_id, (SELECT id FROM workout_categories LIMIT 1));
    
    -- description 파싱: 문자열에 '$'가 있으면 $ 구분, 아니면 기존 '/' 구분 (혼합 시 $ 우선)
    IF LOCATE('$', COALESCE(p_description, '')) > 0 THEN
        SET v_sep = '$';
        SET v_desc_padded = CONCAT(COALESCE(p_description, ''), '$$$');
    ELSE
        SET v_sep = '/';
        SET v_desc_padded = CONCAT(COALESCE(p_description, ''), '///');
    END IF;
    SET v_name_ko = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(v_desc_padded, v_sep, 1), v_sep, -1));
    SET v_target_muscles = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(v_desc_padded, v_sep, 2), v_sep, -1));
    SET v_characteristics = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(v_desc_padded, v_sep, 3), v_sep, -1));
    SET v_equipment = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(v_desc_padded, v_sep, 4), v_sep, -1));
    
    -- number = video_id (숫자형 변환)
    SET v_video_num = CAST(p_video_id AS UNSIGNED);
    
    -- status = 'available' → is_active = 1
    SET v_is_active = IF(p_status = 'available', 1, 0);

    -- 영상 정보를 저장하거나 업데이트 (UPSERT)
    INSERT INTO vimeo_videos (
        video_id,
        parent_folder,
        workout_category_id,
        title,
        title_normalized,
        description,
        thumbnail_url,
        duration,
        status,
        privacy_view,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        p_video_id,
        p_parent_folder,
        @v_workout_category_id,
        p_title,
        @v_title_normalized,
        p_description,
        p_thumbnail_url,
        p_duration,
        p_status,
        p_privacy_view,
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON DUPLICATE KEY UPDATE
        parent_folder = p_parent_folder,
        workout_category_id = @v_workout_category_id,
        title = p_title,
        title_normalized = @v_title_normalized,
        description = p_description,
        thumbnail_url = p_thumbnail_url,
        duration = p_duration,
        status = p_status,
        privacy_view = p_privacy_view,
        created_at = IF(is_active = FALSE, CURRENT_TIMESTAMP, created_at),
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
    
    -- exercises 테이블 동기화: number = video_id 기준 INSERT 또는 UPDATE (workout_category_id 있을 때만)
    IF v_workout_cat_id IS NOT NULL AND v_video_num > 0 THEN
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
        ) VALUES (
            v_video_num,
            v_workout_cat_id,
            'beginner',
            p_title,
            v_name_ko,
            v_target_muscles,
            v_characteristics,
            v_equipment,
            '',
            p_video_id,
            p_thumbnail_url,
            p_title,
            p_duration,
            v_is_active
        )
        ON DUPLICATE KEY UPDATE
            workout_category_id = v_workout_cat_id,
            name_en = p_title,
            name_ko = v_name_ko,
            target_muscles = v_target_muscles,
            characteristics = v_characteristics,
            equipment = v_equipment,
            video_url = p_video_id,
            thumbnail_url = p_thumbnail_url,
            video_title = p_title,
            video_duration = p_duration,
            is_active = v_is_active,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- 결과 반환
    SELECT 
        video_id,
        title,
        'success' AS result
    FROM vimeo_videos
    WHERE video_id = p_video_id;
END$$

DELIMITER ;
