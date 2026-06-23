-- sp_GetWorkoutExercises 프로시저 수정 (reps 필드 추가)
-- AMRAP 운동 실행 순서의 횟수 정보를 조회하기 위한 수정
-- 변경 이유: exercises.name_en = vimeo_videos.title 매칭 지원
-- 적용 순서: 이 SQL을 DB에 재배포

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_GetWorkoutExercises(
    IN p_master_id CHAR(36)
)
BEGIN
    SELECT 
        we.workout_history_master_id,
        we.sequence,
        we.round,
        we.exercise_type,
        we.exercise_id,
        we.exercise_name,
        we.duration,
        COALESCE(we.reps, 0) as reps, -- reps 필드 추가 (NULL이면 0)
        COALESCE(we.is_bilateral, e.is_bilateral, 0) as is_bilateral,
        we.position,
        e.name_ko,
        e.name_en,
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
        e.video_loop_count,
        -- major_category는 기본적으로 운동(exercises)의 카테고리를 따르지만,
        -- AMRAP/EMOM 저장 데이터는 '메서드(운동 타입)' 구분이 필요하므로 MAIN 구간(DS/CD 제외)은 마스터 기준으로 오버라이드
        CASE
          WHEN whm.workout_categories_id IN ('AMRAP', 'EMOM', 'COMBO') AND we.round NOT IN (0, 99) THEN whm.workout_categories_id
          ELSE wc.major_category
        END AS major_category,
        CASE
          WHEN whm.workout_categories_id IN ('AMRAP', 'EMOM', 'COMBO') AND we.round NOT IN (0, 99) THEN whm.workout_categories_id
          ELSE wc.major_category_name
        END AS major_category_name,
        we.created_at,
        we.updated_at
    FROM workout_exercises we
    LEFT JOIN workout_history_master whm ON whm.id = we.workout_history_master_id
    LEFT JOIN exercises e ON we.exercise_id = e.id
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
    WHERE we.workout_history_master_id = p_master_id
      AND (e.number IS NULL OR e.number NOT IN (999997, 999998, 999999))
    ORDER BY we.sequence;
END //

DELIMITER ;
