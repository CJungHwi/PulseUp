-- 운동 실행 순서 조회 프로시저
-- workout_exercises 테이블에서 특정 마스터 ID의 운동실행순서를 조회
-- 변경 이유: exercises.name_en = vimeo_videos.title 매칭 지원
-- 적용 순서: 이 SQL을 DB에 재배포

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_GetWorkoutExercises(
    IN p_master_id CHAR(36)
)
BEGIN
    -- 운동 실행 순서 조회 (exercises 테이블과 JOIN하여 운동 정보 포함)
    SELECT 
        we.id,
        we.workout_history_master_id,
        we.sequence,
        we.round,
        we.exercise_type,
        we.exercise_id,
        we.exercise_name,
        we.duration,
        we.reps,
        COALESCE(we.is_bilateral, e.is_bilateral, 0) as is_bilateral,
        we.position,
        -- 운동 정보 (exercises 테이블과 JOIN)
        e.name_ko,
        e.name_en,
        e.target_muscles,
        e.equipment,
        e.level,
        e.characteristics,
        e.purpose,
        COALESCE(v.video_id, e.video_url) as video_url,
        e.video_start_time,
        e.video_end_time,
        COALESCE(v.thumbnail_url, e.thumbnail_url) as thumbnail_url,
        -- 카테고리 정보 (workout_categories 테이블과 JOIN)
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
    ORDER BY we.sequence;
    
END //

DELIMITER ;
