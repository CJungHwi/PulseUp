-- sp_GetWorkoutHistoryDetail 프로시저 수정 (reps 필드 추가)
-- AMRAP 운동의 횟수 정보를 조회하기 위한 수정
-- 변경 이유: exercises.name_en = vimeo_videos.title 매칭 지원
-- 적용 순서: 이 SQL을 DB에 재배포

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_GetWorkoutHistoryDetail(
    IN p_master_id CHAR(36)
)
BEGIN
    -- 마스터 정보 조회
    SELECT 
        whm.id,
        whm.user_id,
        whm.date,
        whm.time,
        whm.workout_categories_id,
        whm.method_type,
        whm.method_name,
        whm.memo,
        whm.created_at,
        whm.updated_at
    FROM workout_history_master whm
    WHERE whm.id = p_master_id;
    
    -- 상세 정보 조회 (reps 필드 포함)
    SELECT 
        whd.workout_history_master_id,
        whd.seq,
        whd.exercises_id,
        whd.method_round,
        whd.duration,
        COALESCE(whd.reps, 0) as reps, -- reps 필드 추가 (NULL이면 0)
        whd.position,
        whd.exercise_type,
        e.workout_category_id,
        wc.major_category,
        e.name_ko as exercise_name,
        e.name_en, -- 운동명(영문) 추가
        e.target_muscles,
        e.equipment,
        e.characteristics,
        e.purpose,
        e.level,
        COALESCE(v.video_id, e.video_url) as video_url,
        COALESCE(v.thumbnail_url, e.thumbnail_url) as thumbnail_url,
        COALESCE(v.title, e.video_title) as video_title,
        COALESCE(v.duration, e.video_duration) as video_duration,
        e.video_start_time,
        e.video_end_time,
        e.video_loop_count
    FROM workout_history_detail whd
    LEFT JOIN exercises e ON whd.exercises_id = e.id
    LEFT JOIN vimeo_videos v ON (
        v.is_active = TRUE
        AND (
          e.video_url = v.video_id
          OR (
            e.video_url IS NULL
            AND e.name_en IS NOT NULL
            AND e.workout_category_id = v.workout_category_id
            AND e.name_en = v.title
          )
        )
    )
    LEFT JOIN workout_categories wc ON e.workout_category_id = wc.id
    WHERE whd.workout_history_master_id = p_master_id
    ORDER BY whd.seq;
    
    -- 계획 정보 조회
    SELECT 
        whp.workout_history_master_id,
        whp.circuit_type,
        whp.round,
        whp.time,
        whp.rest,
        whp.hydration,
        whp.created_at,
        whp.updated_at
    FROM workout_history_plan whp
    WHERE whp.workout_history_master_id = p_master_id
    ORDER BY whp.round;
END //

DELIMITER ;
