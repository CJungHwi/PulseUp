-- =============================================================================
-- COMBO 운동 카테고리 + 지점 라이선스 추가
-- =============================================================================
-- 목적:
-- - Totalexercises 운동선택 드롭다운에 COMBO 노출
-- - GET /workout-categories 는 super_admin 외 사용자에게 branch_licenses 가 있는
--   workout_category_id 만 반환하므로, COMBO 라이선스도 함께 부여해야 합니다.
-- 적용:
--   mysql -u USER -p DBNAME < packages/api-server/database/_v2_combo_workout_category.sql
-- =============================================================================

INSERT INTO workout_categories (
    major_category,
    minor_category,
    major_category_name,
    sort_order,
    is_active,
    gubun,
    vimeo
)
SELECT
    'COMBO',
    'COMBO',
    '콤보운동',
    25,
    TRUE,
    'MAIN',
    '2.MAIN-TRAINING'
WHERE NOT EXISTS (
    SELECT 1 FROM workout_categories WHERE major_category = 'COMBO'
);

-- MAIN 라이선스가 있는 지점에 COMBO 라이선스 자동 부여 (없을 때만)
INSERT INTO branch_licenses (
    branch_id,
    workout_category_id,
    valid_from,
    valid_to,
    granted_by,
    status,
    notes
)
SELECT
    bl.branch_id,
    combo_wc.id,
    bl.valid_from,
    bl.valid_to,
    bl.granted_by,
    'active',
    'COMBO category migration (copied from MAIN license)'
FROM branch_licenses bl
INNER JOIN workout_categories main_wc
    ON main_wc.id = bl.workout_category_id
    AND main_wc.major_category = 'MAIN'
INNER JOIN workout_categories combo_wc
    ON combo_wc.major_category = 'COMBO'
WHERE bl.status = 'active'
  AND bl.valid_from <= CURDATE()
  AND (bl.valid_to IS NULL OR bl.valid_to >= CURDATE())
  AND NOT EXISTS (
      SELECT 1
      FROM branch_licenses bl2
      WHERE bl2.branch_id = bl.branch_id
        AND bl2.workout_category_id = combo_wc.id
        AND bl2.status = 'active'
  );
