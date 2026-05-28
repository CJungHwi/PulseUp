-- sp_GetMenus / sp_GetUserMenus: folder·page 모두 target_audience strict 필터
-- (기존 OR target_audience = 'all' 자동 포함 제거)

DELIMITER //
CREATE OR REPLACE PROCEDURE sp_GetMenus(
    IN p_target_audience VARCHAR(50),
    IN p_parent_id VARCHAR(50)
)
BEGIN
    SELECT 
        id,
        parent_id,
        name,
        name_en,
        description,
        menu_type,
        url as path,
        icon,
        sort_order as order_index,
        is_active,
        is_visible,
        required_permissions,
        target_audience,
        level,
        created_at,
        updated_at
    FROM menus
    WHERE (p_target_audience IS NULL OR 
           FIND_IN_SET(target_audience, p_target_audience) > 0)
      AND (
          (p_parent_id IS NULL AND parent_id IS NULL) OR
          (p_parent_id = '0' AND (parent_id = '0' OR parent_id = 0)) OR
          (parent_id = p_parent_id)
      )
      AND is_visible = TRUE
    ORDER BY sort_order ASC, name ASC;
END //

CREATE OR REPLACE PROCEDURE sp_GetUserMenus(
    IN p_userid VARCHAR(50),
    IN p_target_audience VARCHAR(50),
    IN p_parent_id VARCHAR(50)
)
BEGIN
    SELECT 
        m.id,
        m.parent_id,
        m.name,
        m.name_en,
        m.description,
        m.menu_type,
        m.url as path,
        m.icon,
        m.sort_order as order_index,
        m.is_active,
        m.is_visible,
        m.required_permissions,
        m.target_audience,
        m.level,
        m.created_at,
        m.updated_at,
        umi.is_enabled as user_enabled
    FROM menus m
    LEFT JOIN user_menu_items umi ON m.id = umi.menu_id AND umi.user_id = p_userid
    WHERE 
      (p_target_audience IS NULL OR 
           FIND_IN_SET(m.target_audience, p_target_audience) > 0)
      AND (
          (p_parent_id IS NULL AND m.parent_id IS NULL) OR
          (p_parent_id = '0' AND (m.parent_id = '0' OR m.parent_id = 0)) OR
          (m.parent_id = p_parent_id)
      )
      AND m.is_visible = TRUE
      AND m.is_active = TRUE
      AND (
          m.menu_type = 'folder' 
          OR 
          (umi.is_enabled = TRUE)
      )
    ORDER BY m.sort_order ASC, m.name ASC;
END //
DELIMITER ;
