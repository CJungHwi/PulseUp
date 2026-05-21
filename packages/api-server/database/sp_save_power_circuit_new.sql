-- PowerCircuit/FunctionalCircuit 저장 프로시저 (새로운 구조)
-- 저장 순서: 1. workout_history_master 2. workout_history_plan (설계영역) 3. workout_history_detail (Dynamic + Main + Cool Down)

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_SaveWorkout(
    IN p_user_id CHAR(36),
    IN p_date DATE,
    IN p_time VARCHAR(10),
    IN p_memo TEXT,
    IN p_workout_category VARCHAR(50), -- 운동 카테고리 (Power_Circuit 또는 Functional_Circuit)
    IN p_plans JSON,        -- 설계영역의 서킷 계획 정보
    IN p_exercises JSON,    -- 운동 상세 정보 (Dynamic + Main + Cool Down 순서)
    IN p_workout_exercises JSON, -- 운동 실행 순서 정보 (NEW)
    IN p_master_id CHAR(36), -- 수정 모드인 경우 기존 master ID (NULL이면 신규)
    IN p_admin BOOLEAN -- 관리자 체크박스 값
)
BEGIN
    DECLARE v_master_id CHAR(36);
    DECLARE v_plan_count INT DEFAULT 0;
    DECLARE v_exercise_count INT DEFAULT 0;
    DECLARE v_workout_exercise_count INT DEFAULT 0;
    DECLARE v_current_plan JSON;
    DECLARE v_current_exercise JSON;
    DECLARE v_current_workout_exercise JSON;
    DECLARE v_exercise_id VARCHAR(255);
    DECLARE v_duration INT;
    DECLARE v_position VARCHAR(10);
    DECLARE v_exercise_type VARCHAR(20);
    DECLARE v_sequence INT DEFAULT 1;
    DECLARE v_plan_sequence INT DEFAULT 1;
    DECLARE v_workout_exercise_sequence INT DEFAULT 1;
    DECLARE v_circuit_type VARCHAR(10);
    DECLARE v_round INT;
    DECLARE v_time INT;
    DECLARE v_rest INT;
    DECLARE v_hydration INT;
    -- workout_exercises 관련 변수
    DECLARE v_we_sequence INT;
    DECLARE v_we_round INT;
    DECLARE v_we_exercise_type VARCHAR(20);
    DECLARE v_we_exercise_id VARCHAR(255);
    DECLARE v_we_exercise_name VARCHAR(255);
    DECLARE v_we_duration INT;
    DECLARE v_we_position VARCHAR(10);
    DECLARE v_final_sequence INT DEFAULT 1;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- 수정 모드인지 확인
    IF p_master_id IS NOT NULL AND p_master_id != '' THEN
        -- 수정 모드: 기존 데이터 삭제 후 재생성
        SET v_master_id = p_master_id;
        
        -- 기존 상세 데이터 삭제
        DELETE FROM workout_history_detail WHERE workout_history_master_id = v_master_id;
        DELETE FROM workout_history_plan WHERE workout_history_master_id = v_master_id;
        DELETE FROM workout_exercises WHERE workout_history_master_id = v_master_id;
        
        -- 첫 번째 계획에서 서킷 타입 추출 (plans가 있는 경우)
        -- Dynamic/Cool Down Stretching의 경우 plans가 비어있으므로 기본값 사용
        IF JSON_LENGTH(p_plans) > 0 THEN
            SET v_current_plan = JSON_EXTRACT(p_plans, '$[0]');
            SET v_circuit_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.circuit_type'));
        ELSE
            -- plans가 비어있으면 기본값으로 'none' 사용 (Dynamic/Cool Down 등)
            SET v_circuit_type = 'none';
        END IF;
        
        -- 마스터 정보 업데이트
        UPDATE workout_history_master SET
            date = p_date,
            time = p_time,
            method_name = v_circuit_type,
            memo = IFNULL(p_memo, ''),
            admin = IFNULL(p_admin, FALSE), -- 관리자 체크박스 값
            dynamic_master_id = NULL, -- ID 대신 실제 운동 데이터 사용
            static_master_id = NULL, -- ID 대신 실제 운동 데이터 사용
            updated_at = NOW()
        WHERE id = v_master_id;
    ELSE
        -- 신규 모드: 새로운 master 생성
        SET v_master_id = UUID();
        
        -- 첫 번째 계획에서 서킷 타입 추출 (plans가 있는 경우)
        -- Dynamic/Cool Down Stretching의 경우 plans가 비어있으므로 기본값 사용
        IF JSON_LENGTH(p_plans) > 0 THEN
            SET v_current_plan = JSON_EXTRACT(p_plans, '$[0]');
            SET v_circuit_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.circuit_type'));
        ELSE
            -- plans가 비어있으면 기본값으로 'none' 사용 (Dynamic/Cool Down 등)
            SET v_circuit_type = 'none';
        END IF;
        
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
            dynamic_master_id,
            static_master_id,
            admin,
            created_at,
            updated_at
        ) VALUES (
            v_master_id,
            p_user_id,
            p_date,
            p_time,
            p_workout_category,
            1,
            p_workout_category,
            v_circuit_type,
            IFNULL(p_memo, ''),
            NULL, -- dynamic_master_id
            NULL, -- static_master_id
            IFNULL(p_admin, FALSE), -- 관리자 체크박스 값
            NOW(),
            NOW()
        );
    END IF;
    
    -- 2. 설계영역의 서킷 계획 정보 저장 (workout_history_plan)
    SET v_plan_count = JSON_LENGTH(p_plans);
    
    WHILE v_plan_sequence <= v_plan_count DO
        SET v_current_plan = JSON_EXTRACT(p_plans, CONCAT('$[', v_plan_sequence - 1, ']'));
        
        -- 계획 정보 추출
        SET v_circuit_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.circuit_type'));
        SET v_round = JSON_EXTRACT(v_current_plan, '$.round');
        SET v_time = JSON_EXTRACT(v_current_plan, '$.time');
        SET v_rest = JSON_EXTRACT(v_current_plan, '$.rest');
        SET v_hydration = JSON_EXTRACT(v_current_plan, '$.hydration');
        
        -- workout_history_plan 테이블에 저장
        INSERT INTO workout_history_plan (
            workout_history_master_id,
            circuit_type,
            round,
            time,
            rest,
            hydration,
            created_at,
            updated_at
        ) VALUES (
            v_master_id,
            v_circuit_type,
            v_round,
            v_time,
            v_rest,
            v_hydration,
            NOW(),
            NOW()
        );
        
        SET v_plan_sequence = v_plan_sequence + 1;
    END WHILE;
    
    -- 3. 운동 상세 정보 저장 (Dynamic + Main + Cool Down 순서)
    SET v_exercise_count = JSON_LENGTH(p_exercises);
    
    WHILE v_sequence <= v_exercise_count DO
        SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', v_sequence - 1, ']'));
        
        -- 운동 정보 추출
        SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
        SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
        SET v_round = COALESCE(JSON_EXTRACT(v_current_exercise, '$.round'), 1); -- NULL이면 1로 기본값 설정
        SET v_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position'));
        SET v_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.exercise_type'));
        
        -- workout_history_detail 테이블에 저장
        INSERT INTO workout_history_detail (
            workout_history_master_id,
            seq,
            exercises_id,
            method_round,
            duration,
            position,
            exercise_type,
            created_at,
            updated_at
        ) VALUES (
            v_master_id,
            v_sequence,
            v_exercise_id,
            CONCAT(v_round, 'Round'), -- 문자열로 변환 (예: "1Round", "2Round")
            v_duration,
            NULLIF(v_position, ''),
            v_exercise_type,
            NOW(),
            NOW()
        );
        
        SET v_sequence = v_sequence + 1;
    END WHILE;
    
    -- 4. 운동 실행 순서 정보 저장 (workout_exercises) - 스트레스 서킷인 경우에만
    IF p_workout_exercises IS NOT NULL AND JSON_LENGTH(p_workout_exercises) > 0 THEN
        SET v_final_sequence = 1;
        
        -- 4-1. Dynamic Stretching 운동들을 맨 앞에 추가
        SET v_sequence = 1;
        SET v_exercise_count = JSON_LENGTH(p_exercises);
        
        WHILE v_sequence <= v_exercise_count DO
            SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', v_sequence - 1, ']'));
            SET v_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.exercise_type'));
            
            -- Dynamic Stretching 운동만 처리
            IF v_exercise_type = 'dynamic' THEN
                SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
                SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
                SET v_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position'));
                
                -- workout_exercises 테이블에 Dynamic Stretching 저장
                INSERT INTO workout_exercises (
                    workout_history_master_id,
                    sequence,
                    round,
                    exercise_type,
                    exercise_id,
                    exercise_name,
                    duration,
                    position,
                    created_at,
                    updated_at
                ) VALUES (
                    v_master_id,
                    v_final_sequence,
                    0, -- Dynamic은 Round 0
                    'exercise',
                    v_exercise_id,
                    'Dynamic Stretching',
                    v_duration,
                    NULLIF(v_position, ''),
                    NOW(),
                    NOW()
                );
                
                SET v_final_sequence = v_final_sequence + 1;
            END IF;
            
            SET v_sequence = v_sequence + 1;
        END WHILE;
        
        -- 4-2. 스트레스 서킷 운동실행순서 추가 (기존 로직)
        SET v_workout_exercise_count = JSON_LENGTH(p_workout_exercises);
        SET v_workout_exercise_sequence = 1;
        
        WHILE v_workout_exercise_sequence <= v_workout_exercise_count DO
            SET v_current_workout_exercise = JSON_EXTRACT(p_workout_exercises, CONCAT('$[', v_workout_exercise_sequence - 1, ']'));
            
            -- 운동 실행 순서 정보 추출
            SET v_we_round = JSON_EXTRACT(v_current_workout_exercise, '$.round');
            SET v_we_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.exercise_type'));
            SET v_we_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.exercise_id'));
            SET v_we_exercise_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.name'));
            SET v_we_duration = JSON_EXTRACT(v_current_workout_exercise, '$.duration');
            SET v_we_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.position'));
            
            -- workout_exercises 테이블에 저장
            INSERT INTO workout_exercises (
                workout_history_master_id,
                sequence,
                round,
                exercise_type,
                exercise_id,
                exercise_name,
                duration,
                position,
                created_at,
                updated_at
            ) VALUES (
                v_master_id,
                v_final_sequence,
                v_we_round,
                v_we_exercise_type,
                NULLIF(v_we_exercise_id, ''),
                v_we_exercise_name,
                v_we_duration,
                NULLIF(v_we_position, ''),
                NOW(),
                NOW()
            );
            
            SET v_final_sequence = v_final_sequence + 1;
            SET v_workout_exercise_sequence = v_workout_exercise_sequence + 1;
        END WHILE;
        
        -- 4-3. Cool Down (Static Stretching) 운동들을 맨 끝에 추가
        SET v_sequence = 1;
        
        WHILE v_sequence <= v_exercise_count DO
            SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', v_sequence - 1, ']'));
            SET v_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.exercise_type'));
            
            -- Cool Down 운동만 처리 (exercise_type이 'cooldown' 또는 'static')
            IF v_exercise_type = 'cooldown' OR v_exercise_type = 'static' THEN
                SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
                SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
                SET v_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position'));
                
                -- workout_exercises 테이블에 Cool Down 저장
                INSERT INTO workout_exercises (
                    workout_history_master_id,
                    sequence,
                    round,
                    exercise_type,
                    exercise_id,
                    exercise_name,
                    duration,
                    position,
                    created_at,
                    updated_at
                ) VALUES (
                    v_master_id,
                    v_final_sequence,
                    99, -- Cool Down은 Round 99
                    'exercise',
                    v_exercise_id,
                    'Cool Down',
                    v_duration,
                    NULLIF(v_position, ''),
                    NOW(),
                    NOW()
                );
                
                SET v_final_sequence = v_final_sequence + 1;
            END IF;
            
            SET v_sequence = v_sequence + 1;
        END WHILE;
    END IF;
    
    COMMIT;
    
    -- 저장된 마스터 ID와 통계 정보 반환
    SELECT 
        v_master_id as master_id,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id) as total_exercise_count,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id AND exercise_type = 'dynamic') as dynamic_count,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id AND exercise_type = 'main') as main_count,
        (SELECT COUNT(*) FROM workout_history_detail WHERE workout_history_master_id = v_master_id AND exercise_type = 'cooldown') as cooldown_count,
        (SELECT COUNT(*) FROM workout_history_plan WHERE workout_history_master_id = v_master_id) as plan_count,
        (SELECT COUNT(*) FROM workout_exercises WHERE workout_history_master_id = v_master_id) as workout_exercise_count;
    
END //

DELIMITER ;
