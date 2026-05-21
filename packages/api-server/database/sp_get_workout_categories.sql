-- 운동구분 목록 조회 저장 프로시저
DELIMITER //

CREATE OR REPLACE PROCEDURE sp_get_workout_categories(
    IN p_major_category VARCHAR(100),
    IN p_is_active BOOLEAN
)
BEGIN
    SELECT 
        id,
        major_category,
        minor_category,
        menu_id,
        major_category_name,
        is_active,
        sort_order,
        created_at,
        updated_at
    FROM workout_categories
    WHERE 
        (p_major_category IS NULL OR p_major_category = '' OR major_category = p_major_category)
        AND (p_is_active IS NULL OR is_active = p_is_active)
    ORDER BY sort_order ASC, major_category ASC, minor_category ASC;
END //

DELIMITER ;

