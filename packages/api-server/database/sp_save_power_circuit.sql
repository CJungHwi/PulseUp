-- PowerCircuit 저장 프로시저
-- 저장 순서: 1. Dynamic Stretching (Round 0) 2. PowerCircuit 운동들 3. Static Stretching (Round 99)

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_SavePowerCircuit(
    IN p_user_id CHAR(36),
    IN p_date DATE,
    IN p_time VARCHAR(10),
    IN p_memo TEXT,
    IN p_dynamic_master_id CHAR(36),  -- 적용된 Dynamic Stretching 마스터 ID
    IN p_static_master_id CHAR(36),   -- 적용된 Static Stretching 마스터 ID
    IN p_exercises JSON               -- PowerCircuit 운동 목록 (Round 정보 포함)
)
BEGIN
    DECLARE v_master_id CHAR(36);
    DECLARE v_exercise_count INT DEFAULT 0;
    DECLARE v_current_exercise JSON;
    DECLARE v_exercise_id VARCHAR(255);
    DECLARE v_duration INT;
    DECLARE v_round INT;
    DECLARE v_position VARCHAR(10);
    DECLARE v_sequence INT DEFAULT 1;
    DECLARE v_dynamic_count INT DEFAULT 0;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- UUID 생성
    SET v_master_id = UUID();
    
    -- workout_history_master에 PowerCircuit 마스터 데이터 삽입
    INSERT INTO workout_history_master (
        id,
        user_id,
        date,
        time,
        workout_categories_id,
        revision_number,
        method_type,
        method_name,
        memo,
        admin,
        created_at,
        updated_at
    ) VALUES (
        v_master_id,
        p_user_id,
        p_date,
        p_time,
        'Power_Circuit',
        1,
        'Power_Circuit',
        'Power Circuit',
        IFNULL(p_memo, ''),
        FALSE,
        NOW(),
        NOW()
    );
    
    -- 1. Dynamic Stretching 운동들 삽입 (Round 0)
    IF p_dynamic_master_id IS NOT NULL AND p_dynamic_master_id != '' THEN
        INSERT INTO workout_history_detail (
            workout_history_master_id,
            seq,
            exercises_id,
            method_round,
            duration,
            position,
            created_at,
            updated_at
        )
        SELECT 
            v_master_id,
            ROW_NUMBER() OVER (ORDER BY seq),
            exercises_id,
            0,  -- Dynamic Stretching은 Round 0
            duration,
            'ALL',  -- Dynamic Stretching은 position ALL
            NOW(),
            NOW()
        FROM workout_history_detail 
        WHERE workout_history_master_id = p_dynamic_master_id
        ORDER BY seq;
        
        -- Dynamic 운동 개수 저장
        SET v_dynamic_count = ROW_COUNT();
        SET v_sequence = v_dynamic_count + 1;
    END IF;
    
    -- 2. PowerCircuit 운동들 삽입 (실제 Round 번호 사용)
    SET v_exercise_count = JSON_LENGTH(p_exercises);
    SET @power_circuit_index = 0;
    
    WHILE @power_circuit_index < v_exercise_count DO
        SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', @power_circuit_index, ']'));
        SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
        SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
        SET v_round = IFNULL(JSON_EXTRACT(v_current_exercise, '$.round'), 1);
        SET v_position = IFNULL(JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position')), 'A1');
        
        INSERT INTO workout_history_detail (
            workout_history_master_id,
            seq,
            exercises_id,
            method_round,
            duration,
            position,
            created_at,
            updated_at
        ) VALUES (
            v_master_id,
            v_sequence,
            v_exercise_id,
            v_round,
            v_duration,
            v_position,
            NOW(),
            NOW()
        );
        
        SET v_sequence = v_sequence + 1;
        SET @power_circuit_index = @power_circuit_index + 1;
    END WHILE;
    
    -- 3. Static Stretching 운동들 삽입 (Round 99)
    IF p_static_master_id IS NOT NULL AND p_static_master_id != '' THEN
        INSERT INTO workout_history_detail (
            workout_history_master_id,
            seq,
            exercises_id,
            method_round,
            duration,
            position,
            created_at,
            updated_at
        )
        SELECT 
            v_master_id,
            v_sequence + ROW_NUMBER() OVER (ORDER BY seq) - 1,
            exercises_id,
            99,  -- Static Stretching은 Round 99
            duration,
            'ALL',  -- Static Stretching은 position ALL
            NOW(),
            NOW()
        FROM workout_history_detail 
        WHERE workout_history_master_id = p_static_master_id
        ORDER BY seq;
    END IF;
    
    COMMIT;
    
    -- 저장된 마스터 ID와 총 운동 개수 반환
    SELECT 
        v_master_id as master_id, 
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id) as total_exercise_count,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id AND method_round = 0) as dynamic_count,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id AND method_round BETWEEN 1 AND 98) as power_circuit_count,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id AND method_round = 99) as static_count;
    
END //

DELIMITER ;