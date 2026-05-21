-- 1. workout_categories 테이블에 gubun 컬럼 확인 및 추가
-- (프로시저로 감싸서 안전하게 컬럼 추가)
DROP PROCEDURE IF EXISTS sp_add_gubun_column_if_not_exists;

DELIMITER //

CREATE PROCEDURE sp_add_gubun_column_if_not_exists()
BEGIN
    DECLARE col_count INT;
    
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'workout_categories' 
    AND column_name = 'gubun'
    AND table_schema = DATABASE();
    
    IF col_count = 0 THEN
        ALTER TABLE workout_categories ADD COLUMN gubun VARCHAR(50) DEFAULT NULL;
    END IF;
END //

DELIMITER ;

CALL sp_add_gubun_column_if_not_exists();
DROP PROCEDURE IF EXISTS sp_add_gubun_column_if_not_exists;

-- 2. sp_get_workout_categories 프로시저 재정의
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_workout_categories //

CREATE PROCEDURE sp_get_workout_categories(
    IN p_major_category VARCHAR(50),
    IN p_is_active BOOLEAN
)
BEGIN
    SELECT 
        wc.id,
        wc.major_category,
        wc.minor_category,
        wc.menu_id,
        wc.is_active,
        wc.sort_order,
        wc.created_at,
        wc.updated_at,
        wc.gubun,
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
