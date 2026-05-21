-- PowerCircuit 삭제 프로시저 (간단 버전)
-- 관련된 모든 테이블의 데이터를 삭제

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_Deleteworkout_exercises(
    IN p_master_id VARCHAR(36),
    IN p_user_id VARCHAR(36)
)
BEGIN
    -- 에러 핸들러 제거하고 단순하게 처리
    
    -- 직접 삭제 (순서 중요: 자식 테이블부터)
    DELETE FROM workout_exercises WHERE workout_history_master_id = p_master_id;
    DELETE FROM workout_history_detail WHERE workout_history_master_id = p_master_id;
    DELETE FROM workout_history_plan WHERE workout_history_master_id = p_master_id;
    DELETE FROM workout_history_master WHERE id = p_master_id AND user_id = p_user_id;
    
    -- 삭제된 행 수 반환
    SELECT 
        'success' as status,
        CONCAT('삭제 완료 - master_id: ', p_master_id) as message,
        ROW_COUNT() as affected_rows;
    
END //

DELIMITER ;
