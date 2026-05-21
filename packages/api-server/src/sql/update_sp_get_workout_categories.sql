-- workout_categories 테이블에 gubun 컬럼이 없다면 추가 (필요시 주석 해제하여 사용)
-- ALTER TABLE workout_categories ADD COLUMN gubun VARCHAR(50) DEFAULT NULL;

-- sp_get_workout_categories 프로시저 수정
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_workout_categories //

CREATE or replace PROCEDURE sp_get_workout_categories(
    IN p_major_category VARCHAR(50),
    IN p_is_active BOOLEAN
)
BEGIN
    SELECT 
        wc.id,
        wc.major_category,
        wc.minor_category,
        wc.menu_id,
        wc.description,
        wc.is_active,
        wc.sort_order,
        wc.created_at,
        wc.updated_at,
        wc.gubun, -- gubun 컬럼 추가
        m.name as menu_name,
        m.url as menu_url,
        (SELECT COUNT(*) FROM exercises e WHERE e.workout_category_id = wc.id AND e.is_active = TRUE) as exercise_count
    FROM 
        workout_categories wc
    LEFT JOIN 
        menus m ON wc.menu_id = m.id
    WHERE 
        (p_major_category IS NULL OR wc.major_category = p_major_category)
        AND (p_is_active IS NULL OR wc.is_active = p_is_active)
    ORDER BY 
        wc.sort_order ASC;
END //

DELIMITER ;
