-- 사용자 운동 즐겨찾기
-- 작성일: 2026-05-30
--
-- 목적:
-- 1) 사용자별 운동 즐겨찾기(user_id + exercise_id) 저장
-- 2) 운동 선택 모달에서 즐겨찾기 등록/해제 및 필터링 지원
--
-- 적용 순서:
-- - users, exercises 테이블 생성 후 실행
-- - 재실행 가능(idempotent)

CREATE TABLE IF NOT EXISTS user_exercise_favorites (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT '즐겨찾기 고유 ID',
  user_id CHAR(36) NOT NULL COMMENT '사용자 ID (users.id 참조)',
  exercise_id CHAR(36) NOT NULL COMMENT '운동 ID (exercises.id 참조)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
  UNIQUE KEY uk_user_exercise_favorite (user_id, exercise_id),
  INDEX idx_user_exercise_favorites_user_id (user_id),
  INDEX idx_user_exercise_favorites_exercise_id (exercise_id),
  CONSTRAINT fk_user_exercise_favorites_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_exercise_favorites_exercise
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 운동 즐겨찾기';

DROP PROCEDURE IF EXISTS sp_GetUserExerciseFavorites;
DELIMITER //
CREATE PROCEDURE sp_GetUserExerciseFavorites(
  IN p_user_id CHAR(36)
)
BEGIN
  SELECT exercise_id
  FROM user_exercise_favorites
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_ToggleUserExerciseFavorite;
DELIMITER //
CREATE PROCEDURE sp_ToggleUserExerciseFavorite(
  IN p_user_id CHAR(36),
  IN p_exercise_id CHAR(36)
)
BEGIN
  DECLARE v_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_exists
  FROM user_exercise_favorites
  WHERE user_id = p_user_id
    AND exercise_id = p_exercise_id;

  IF v_exists > 0 THEN
    DELETE FROM user_exercise_favorites
    WHERE user_id = p_user_id
      AND exercise_id = p_exercise_id;

    SELECT 0 AS is_favorite, 'removed' AS action;
  ELSE
    INSERT INTO user_exercise_favorites (id, user_id, exercise_id)
    VALUES (UUID(), p_user_id, p_exercise_id);

    SELECT 1 AS is_favorite, 'added' AS action;
  END IF;
END //
DELIMITER ;
