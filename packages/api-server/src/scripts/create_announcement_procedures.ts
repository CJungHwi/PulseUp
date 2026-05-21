import { executeQuery } from '../lib/database.js';

async function createProcedures() {
    const sql = `
    CREATE OR REPLACE PROCEDURE sp_mark_announcement_as_read(
        IN p_announcement_id BIGINT,
        IN p_user_id CHAR(36)
    )
    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK;
            RESIGNAL;
        END;

        START TRANSACTION;

        -- 읽음 기록 추가 (이미 있으면 무시)
        INSERT IGNORE INTO announcement_reads (announcement_id, user_id, read_at)
        VALUES (p_announcement_id, p_user_id, CURRENT_TIMESTAMP);

        -- 조회수 증가
        UPDATE announcements 
        SET view_count = view_count + 1 
        WHERE id = p_announcement_id;

        SELECT 'success' as status;

        COMMIT;
    END;
  `;

    try {
        //console.log('🚀 공지사항 조회수 증가 프로시저 생성 중...');
        await executeQuery(sql);
        //console.log('✅ 프로시저 생성 완료: sp_mark_announcement_as_read');
        process.exit(0);
    } catch (error) {
        console.error('❌ 프로시저 생성 실패:', error);
        process.exit(1);
    }
}

createProcedures();
