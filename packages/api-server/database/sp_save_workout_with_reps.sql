-- sp_SaveWorkout 프로시저 수정 (reps 필드 추가)
-- AMRAP 운동의 횟수 정보를 저장하기 위한 수정

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_SaveWorkout(
    IN p_user_id CHAR(36),
    IN p_date DATE,
    IN p_time VARCHAR(10),
    IN p_memo TEXT,
    IN p_workout_category VARCHAR(50), -- 운동 카테고리 (Power_Circuit, Functional_Circuit, AMRAP 등)
    IN p_method_type VARCHAR(50), -- method_type 추가
    IN p_plans JSON,        -- 설계영역의 서킷 계획 정보
    IN p_exercises JSON,    -- 운동 상세 정보 (Dynamic + Main + Static 순서)
    IN p_workout_exercises JSON, -- 운동 실행 순서 정보
    IN p_master_id CHAR(36), -- 수정 모드인 경우 기존 master ID (NULL이면 신규)
    IN p_dynamic_master_id CHAR(36), -- Dynamic Stretching master ID
    IN p_static_master_id CHAR(36), -- Static Stretching master ID
    IN p_admin BOOLEAN, -- 관리자 체크박스 값
    IN p_ds_seconds INT, -- Dynamic Stretching 시간 (초)
    IN p_main_seconds INT, -- Main 운동 시간 (초)
    IN p_cd_seconds INT, -- Cool Down 시간 (초)
    IN p_total_seconds INT, -- 총 운동 시간 (초)
    IN p_rest_seconds INT -- 휴식 시간 (초)
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
    DECLARE v_reps INT; -- 횟수 변수 추가
    DECLARE v_position VARCHAR(10);
    DECLARE v_exercise_type VARCHAR(255);
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
    DECLARE v_we_exercise_type VARCHAR(255);
    DECLARE v_we_exercise_id VARCHAR(255);
    DECLARE v_we_exercise_name VARCHAR(255);
    DECLARE v_we_duration INT;
    DECLARE v_we_reps INT; -- 횟수 변수 추가
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
        
        -- 첫 번째 계획에서 서킷 타입과 method_name 추출
        SET v_current_plan = JSON_EXTRACT(p_plans, '$[0]');
        SET v_circuit_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.circuit_type'));
        
        -- 마스터 정보 업데이트
        UPDATE workout_history_master SET
            date = p_date,
            time = p_time,
            method_name = COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.method_name')), ''),
            memo = IFNULL(p_memo, ''),
            admin = IFNULL(p_admin, FALSE), -- 관리자 체크박스 값 업데이트
            dynamic_master_id = p_dynamic_master_id,
            static_master_id = p_static_master_id,
            ds_seconds = IFNULL(p_ds_seconds, 0),
            main_seconds = IFNULL(p_main_seconds, 0),
            cd_seconds = IFNULL(p_cd_seconds, 0),
            total_seconds = IFNULL(p_total_seconds, 0),
            rest_seconds = IFNULL(p_rest_seconds, 0),
            updated_at = NOW()
        WHERE id = v_master_id;
    ELSE
        -- 신규 모드: 새로운 master 생성
        SET v_master_id = UUID();
        
        -- 첫 번째 계획에서 서킷 타입과 method_name 추출
        SET v_current_plan = JSON_EXTRACT(p_plans, '$[0]');
        SET v_circuit_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.circuit_type'));
        
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
            dynamic_master_id,
            static_master_id,
            ds_seconds,
            main_seconds,
            cd_seconds,
            total_seconds,
            rest_seconds,
            created_at,
            updated_at
        ) VALUES (
            v_master_id,
            p_user_id,
            p_date,
            p_time,
            p_workout_category,
            1,
            COALESCE(p_method_type, v_circuit_type),
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(v_current_plan, '$.method_name')), ''),
            IFNULL(p_memo, ''),
            IFNULL(p_admin, FALSE), -- p_admin 파라미터 사용
            p_dynamic_master_id,
            p_static_master_id,
            IFNULL(p_ds_seconds, 0),
            IFNULL(p_main_seconds, 0),
            IFNULL(p_cd_seconds, 0),
            IFNULL(p_total_seconds, 0),
            IFNULL(p_rest_seconds, 0),
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
    
    -- 3. 운동 상세 정보 저장 (Dynamic + Main + Static 순서) - reps 필드 추가
    SET v_exercise_count = JSON_LENGTH(p_exercises);
    
    WHILE v_sequence <= v_exercise_count DO
        SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', v_sequence - 1, ']'));
        
        -- 운동 정보 추출
        SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
        SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
        SET v_reps = COALESCE(JSON_EXTRACT(v_current_exercise, '$.reps'), 0); -- reps 추출 (기본값 0)
        SET v_round = COALESCE(JSON_EXTRACT(v_current_exercise, '$.round'), 1);
        SET v_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position'));
        SET v_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.exercise_type'));
        
        -- workout_history_detail 테이블에 저장 (reps 필드 포함)
        INSERT INTO workout_history_detail (
            workout_history_master_id,
            seq,
            exercises_id,
            method_round,
            duration,
            reps, -- reps 필드 추가
            position,
            exercise_type,
            created_at,
            updated_at
        ) VALUES (
            v_master_id,
            v_sequence,
            v_exercise_id,
            CONCAT(v_round, 'Round'),
            v_duration,
            v_reps, -- reps 값 저장
            NULLIF(v_position, ''),
            v_exercise_type,
            NOW(),
            NOW()
        );
        
        SET v_sequence = v_sequence + 1;
    END WHILE;
    
    -- 4. 운동 실행 순서 정보 저장 (workout_exercises) - reps 필드 추가
    IF p_workout_exercises IS NOT NULL AND JSON_LENGTH(p_workout_exercises) > 0 THEN
        SET v_final_sequence = 1;
        
        -- 4-1. Dynamic Stretching 운동들을 맨 앞에 추가
        SET v_sequence = 1;
        SET v_exercise_count = JSON_LENGTH(p_exercises);
        
        WHILE v_sequence <= v_exercise_count DO
            SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', v_sequence - 1, ']'));
            SET v_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.exercise_type'));
            
            -- Dynamic Stretching 운동만 처리
            IF v_exercise_type = 'DS' THEN
                SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
                SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
                SET v_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position'));
                
                -- exercises 테이블에서 실제 운동명 가져오기
                SET v_we_exercise_name = (SELECT name_ko FROM exercises WHERE id = v_exercise_id LIMIT 1);
                
                -- workout_exercises 테이블에 Dynamic Stretching 저장
                INSERT INTO workout_exercises (
                    workout_history_master_id,
                    sequence,
                    round,
                    exercise_type,
                    exercise_id,
                    exercise_name,
                    duration,
                    reps, -- reps 필드 추가 (Dynamic은 0)
                    position,
                    created_at,
                    updated_at
                ) VALUES (
                    v_master_id,
                    v_final_sequence,
                    0,
                    'exercise',
                    v_exercise_id,
                    COALESCE(v_we_exercise_name, 'Dynamic Stretching'), -- 실제 운동명 사용, 없으면 기본값
                    v_duration,
                    0, -- Dynamic은 횟수 없음
                    v_position, -- 실제 위치 값 사용 (DS1~DS6)
                    NOW(),
                    NOW()
                );
                
                SET v_final_sequence = v_final_sequence + 1;
            END IF;
            
            SET v_sequence = v_sequence + 1;
        END WHILE;
        
        -- 4-2. 운동실행순서 추가 (reps 포함)
        SET v_workout_exercise_count = JSON_LENGTH(p_workout_exercises);
        SET v_workout_exercise_sequence = 1;
        
        WHILE v_workout_exercise_sequence <= v_workout_exercise_count DO
            SET v_current_workout_exercise = JSON_EXTRACT(p_workout_exercises, CONCAT('$[', v_workout_exercise_sequence - 1, ']'));
            
            -- 운동 실행 순서 정보 추출
            SET v_we_sequence = JSON_EXTRACT(v_current_workout_exercise, '$.sequence'); -- 프론트엔드에서 보낸 sequence 사용
            SET v_we_round = JSON_EXTRACT(v_current_workout_exercise, '$.round');
            SET v_we_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.exercise_type'));
            SET v_we_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.exercise_id'));
            SET v_we_exercise_name = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.name'));
            SET v_we_duration = JSON_EXTRACT(v_current_workout_exercise, '$.duration');
            SET v_we_reps = COALESCE(JSON_EXTRACT(v_current_workout_exercise, '$.reps'), 0); -- reps 추출
            SET v_we_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_workout_exercise, '$.position'));
            
            -- workout_exercises 테이블에 저장 (reps 필드 포함)
            INSERT INTO workout_exercises (
                workout_history_master_id,
                sequence,
                round,
                exercise_type,
                exercise_id,
                exercise_name,
                duration,
                reps, -- reps 필드 추가
                position,
                created_at,
                updated_at
            ) VALUES (
                v_master_id,
                v_we_sequence, -- 프론트엔드에서 보낸 sequence 사용 (동시 실행 지원)
                v_we_round,
                v_we_exercise_type,
                NULLIF(v_we_exercise_id, ''),
                v_we_exercise_name,
                v_we_duration,
                v_we_reps, -- reps 값 저장
                NULLIF(v_we_position, ''),
                NOW(),
                NOW()
            );
            
            SET v_final_sequence = v_final_sequence + 1; -- Dynamic/Static 순서 관리용
            SET v_workout_exercise_sequence = v_workout_exercise_sequence + 1;
        END WHILE;
        
        -- 4-3. Static Stretching 운동들을 맨 뒤에 추가
        SET v_sequence = 1;
        SET v_exercise_count = JSON_LENGTH(p_exercises);
        
        WHILE v_sequence <= v_exercise_count DO
            SET v_current_exercise = JSON_EXTRACT(p_exercises, CONCAT('$[', v_sequence - 1, ']'));
            SET v_exercise_type = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.exercise_type'));
            
            -- Static Stretching / Cool Down 운동만 처리 (exercise_type이 'CD', 'static' 또는 'cooldown')
            IF v_exercise_type = 'CD' THEN
                SET v_exercise_id = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.originalExerciseId'));
                SET v_duration = JSON_EXTRACT(v_current_exercise, '$.duration');
                SET v_position = JSON_UNQUOTE(JSON_EXTRACT(v_current_exercise, '$.position'));
                
                -- exercises 테이블에서 실제 운동명 가져오기
                SET v_we_exercise_name = (SELECT name_ko FROM exercises WHERE id = v_exercise_id LIMIT 1);
                
                -- workout_exercises 테이블에 Cool Down 저장
                INSERT INTO workout_exercises (
                    workout_history_master_id,
                    sequence,
                    round,
                    exercise_type,
                    exercise_id,
                    exercise_name,
                    duration,
                    reps, -- reps 필드 추가 (Cool Down은 0)
                    position,
                    created_at,
                    updated_at
                ) VALUES (
                    v_master_id,
                    v_final_sequence,
                    99,
                    'exercise',
                    v_exercise_id,
                    COALESCE(v_we_exercise_name, 'Cool Down'), -- 실제 운동명 사용, 없으면 기본값
                    v_duration,
                    0, -- Cool Down은 횟수 없음
                    v_position, -- 실제 위치 값 사용 (CD1~CD6)
                    NOW(),
                    NOW()
                );
                
                SET v_final_sequence = v_final_sequence + 1;
            END IF;
            
            SET v_sequence = v_sequence + 1;
        END WHILE;
    END IF;
    
    COMMIT;
    
    -- 결과 반환
    SELECT 
        v_master_id as id,
        'success' as status,
        '운동이 성공적으로 저장되었습니다' as message;
END //

DELIMITER ;
