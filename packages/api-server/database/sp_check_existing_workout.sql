-- 기존 운동 기록 확인 프로시저
-- 특정 사용자의 특정 날짜/시간에 운동 기록이 있는지 확인

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_CheckExistingWorkout(
    IN p_user_id VARCHAR(36),
    IN p_date DATE,
    IN p_time VARCHAR(10)
)
BEGIN
    -- 기존 운동 기록 조회
    SELECT 
        whm.id,
        whm.date,
        whm.time,
        whm.memo,
        whm.method_type,
        whm.method_name,
        wc.major_category as workout_category_name
    FROM workout_history_master whm
    LEFT JOIN workout_categories wc ON whm.workout_categories_id = wc.id
    WHERE whm.user_id = p_user_id 
      AND whm.date = p_date 
      AND whm.time = p_time
    LIMIT 1;
    
END //

DELIMITER ;
