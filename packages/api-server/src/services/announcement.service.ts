import { callProcedure } from '../lib/database.js';

function parseBoolean(val: any): boolean | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true' || val === '1') return true;
    if (val.toLowerCase() === 'false' || val === '0') return false;
  }
  return !!val;
}
import {
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  GetAnnouncementsQuery,
  AnnouncementResponse
} from '../schemas/announcement.schema.js';

export class AnnouncementService {
  constructor() { }

  /**
   * 공지사항 생성
   */
  async createAnnouncement(
    data: CreateAnnouncementRequest,
    authorId: string
  ): Promise<{ announcement_id: string; status: string }> {
    try {
      const result = await callProcedure('sp_create_announcement', [
        data.title,
        data.content,
        data.type,
        data.priority,
        data.target_audience,
        data.branch_id || null,
        authorId,
        data.is_pinned,
        data.start_date || null,
        data.end_date || null
      ]);

      const announcementResult = result[0] as { announcement_id: string; status: string };

      // 특정 사용자 대상인 경우 대상 사용자 추가
      if (data.target_audience === 'specific_users' && data.target_user_ids?.length) {
        await callProcedure('sp_add_announcement_targets', [
          announcementResult.announcement_id,
          JSON.stringify(data.target_user_ids)
        ]);
      }

      return announcementResult;
    } catch (error) {
      console.error('공지사항 생성 중 오류:', error);
      throw new Error('공지사항 생성에 실패했습니다');
    }
  }

  /**
   * 사용자별 공지사항 목록 조회
   */
  async getAnnouncementsForUser(
    userId: string,
    branchId: string | null,
    query: GetAnnouncementsQuery
  ): Promise<AnnouncementResponse[]> {
    try {
      const result = await callProcedure('sp_get_announcements_for_user', [
        userId,
        branchId,
        query.type || null,
        query.limit,
        query.offset
      ]);

      return result as AnnouncementResponse[];
    } catch (error) {
      console.error('공지사항 목록 조회 중 오류:', error);
      throw new Error('공지사항 목록 조회에 실패했습니다');
    }
  }

  /**
   * 공지사항 상세 조회
   */
  async getAnnouncementDetail(
    announcementId: string,
    userId: string
  ): Promise<AnnouncementResponse | null> {
    try {
      const result = await callProcedure('sp_get_announcement_detail', [
        announcementId,
        userId
      ]);

      return result.length > 0 ? result[0] as AnnouncementResponse : null;
    } catch (error) {
      console.error('공지사항 상세 조회 중 오류:', error);
      throw new Error('공지사항 상세 조회에 실패했습니다');
    }
  }

  /**
   * 공지사항 읽음 처리
   */
  async markAnnouncementAsRead(
    announcementId: string,
    userId: string
  ): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_mark_announcement_as_read', [
        announcementId,
        userId
      ]);

      // 프로시저 결과 처리: callProcedure는 배열을 반환하며, SELECT 결과가 있으면 첫 번째 요소에 배열로 들어있음
      const resultSet = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
      const statusRow = Array.isArray(resultSet) ? resultSet[0] : resultSet;

      if (!statusRow || !statusRow.status) {
        console.warn('프로시저 결과가 예상과 다릅니다:', result);
        return { status: 'success' };
      }

      return statusRow as { status: string };
    } catch (error) {
      console.error('공지사항 읽음 처리 중 오류:', error);
      throw new Error('공지사항 읽음 처리에 실패했습니다');
    }
  }

  /**
   * 공지사항 수정
   */
  async updateAnnouncement(
    announcementId: string,
    data: UpdateAnnouncementRequest
  ): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_update_announcement', [
        announcementId,
        data.title,
        data.content,
        data.type,
        data.priority,
        data.target_audience,
        data.branch_id || null,
        data.is_pinned,
        data.start_date || null,
        data.end_date || null
      ]);

      // 특정 사용자 대상인 경우 대상 사용자 업데이트
      if (data.target_audience === 'specific_users' && data.target_user_ids?.length) {
        await callProcedure('sp_add_announcement_targets', [
          announcementId,
          JSON.stringify(data.target_user_ids)
        ]);
      }

      return result[0] as { status: string };
    } catch (error) {
      console.error('공지사항 수정 중 오류:', error);
      throw new Error('공지사항 수정에 실패했습니다');
    }
  }

  /**
   * 공지사항 삭제 (비활성화)
   */
  async deleteAnnouncement(announcementId: string): Promise<{ status: string }> {
    try {
      const result = await callProcedure('sp_delete_announcement', [
        announcementId
      ]);

      return result[0] as { status: string };
    } catch (error) {
      console.error('공지사항 삭제 중 오류:', error);
      throw new Error('공지사항 삭제에 실패했습니다');
    }
  }

  /**
   * 읽지 않은 공지사항 개수 조회
   */
  async getUnreadAnnouncementCount(
    userId: string,
    branchId: string | null
  ): Promise<{ unread_count: number }> {
    try {
      const result = await callProcedure('sp_get_unread_announcement_count', [
        userId,
        branchId
      ]);

      return result[0] as { unread_count: number };
    } catch (error) {
      console.error('읽지 않은 공지사항 개수 조회 중 오류:', error);
      throw new Error('읽지 않은 공지사항 개수 조회에 실패했습니다');
    }
  }

  /**
   * 관리자용 전체 공지사항 목록 조회
   */
  async getAllAnnouncementsAdmin(
    query: GetAnnouncementsQuery
  ): Promise<AnnouncementResponse[]> {
    try {
      const result = await callProcedure('sp_get_all_announcements_admin', [
        query.type || null,
        parseBoolean(query.is_active),
        query.limit,
        query.offset
      ]);

      return result as AnnouncementResponse[];
    } catch (error) {
      console.error('관리자 공지사항 목록 조회 중 오류:', error);
      throw new Error('관리자 공지사항 목록 조회에 실패했습니다');
    }
  }
}