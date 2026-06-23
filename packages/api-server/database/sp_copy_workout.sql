-- 운동 기록 복사 프로시저
-- 원본 master_id를 기준으로 모든 관련 데이터를 새로운 master_id로 복사
-- user_id는 접속한 사용자로, admin은 접속한 사용자가 관리자면 1, date는 새 날짜로 변경

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_CopyWorkout(
    IN p_original_master_id VARCHAR(36),
    IN p_new_date DATE,
    IN p_new_time VARCHAR(10),
    IN p_user_id VARCHAR(36),
    IN p_exercise_sequences JSON,  -- 파라미터는 유지하되 사용하지 않음 (호환성)
    IN p_admin BOOLEAN
)
BEGIN
    DECLARE v_new_master_id VARCHAR(36);
    
    -- 에러 핸들러
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 1. 새로운 마스터 ID 생성
    SET v_new_master_id = UUID();
    
    -- 2. workout_history_master 복사
    -- user_id는 접속한 사용자로, admin은 파라미터로 받은 값으로, date는 새 날짜로 변경
    INSERT INTO workout_history_master (
        id, user_id, date, time, workout_categories_id, 
        memo, method_type, method_name, admin, created_at, updated_at
    )
    SELECT 
        v_new_master_id,
        p_user_id,  -- 접속한 사용자로 변경
        p_new_date,  -- 새 날짜로 변경
        p_new_time,  -- 새 시간으로 변경
        workout_categories_id,
        memo,
        method_type,
        method_name,
        p_admin,  -- 접속한 사용자의 admin 여부 값 사용
        NOW(),
        NOW()
    FROM workout_history_master 
    WHERE id = p_original_master_id;
    
    -- 3. workout_history_plan 복사 (master_id만 새로 변경)
    INSERT INTO workout_history_plan (
        id, workout_history_master_id, circuit_type, round, 
        time, rest, hydration, created_at, updated_at
    )
    SELECT 
        UUID(),
        v_new_master_id,  -- 새 master_id로 변경
        circuit_type,
        round,
        time,
        rest,
        hydration,
        NOW(),
        NOW()
    FROM workout_history_plan 
    WHERE workout_history_master_id = p_original_master_id;
    
    -- 4. workout_history_detail 복사 (master_id만 새로 변경)
    INSERT INTO workout_history_detail (
        workout_history_master_id, 
        seq,
        exercises_id, 
        method_round, 
        method_rest,
        method_hydration_time,
        duration,
        calories_burned,
        average_heart_rate,
        max_heart_rate,
        is_bilateral,
        notes,
        created_at, 
        updated_at
    )
    SELECT 
        v_new_master_id,  -- 새 master_id로 변경
        seq,
        exercises_id,
        method_round,
        method_rest,
        method_hydration_time,
        duration,
        calories_burned,
        average_heart_rate,
        max_heart_rate,
        COALESCE(is_bilateral, 0),
        notes,
        NOW(),
        NOW()
    FROM workout_history_detail 
    WHERE workout_history_master_id = p_original_master_id;
    
    -- 5. workout_exercises 복사 (master_id만 새로 변경)
    -- reps 필드가 있는 경우를 대비하여 동적으로 처리
    INSERT INTO workout_exercises (
        id,
        workout_history_master_id,
        sequence,
        round,
        exercise_type,
        exercise_id,
        exercise_name,
        duration,
        reps,
        is_bilateral,
        position,
        created_at,
        updated_at
    )
    SELECT 
        UUID(),
        v_new_master_id,  -- 새 master_id로 변경
        sequence,
        round,
        exercise_type,
        exercise_id,
        exercise_name,
        duration,
        COALESCE(reps, NULL),  -- reps 필드가 있으면 복사, 없으면 NULL
        COALESCE(is_bilateral, 0),
        position,
        NOW(),
        NOW()
    FROM workout_exercises 
    WHERE workout_history_master_id = p_original_master_id;
    
    COMMIT;
    
    -- 결과 반환
    SELECT 
        'success' as status,
        v_new_master_id as new_master_id,
        CONCAT('운동 기록이 ', p_new_date, ' ', p_new_time, '으로 성공적으로 복사되었습니다.') as message;
        
END //

DELIMITER ;
