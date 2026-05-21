import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { announcementApi } from '../../services/announcementApi';
import { 
  Announcement, 
  CreateAnnouncementRequest, 
  UpdateAnnouncementRequest, 
  GetAnnouncementsQuery 
} from '../../types/announcement';

interface AnnouncementState {
  announcements: Announcement[];
  currentAnnouncement: Announcement | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const initialState: AnnouncementState = {
  announcements: [],
  currentAnnouncement: null,
  unreadCount: 0,
  loading: false,
  error: null,
  pagination: {
    limit: 20,
    offset: 0,
    hasMore: true
  }
};

// 공지사항 목록 조회
export const fetchAnnouncements = createAsyncThunk(
  'announcements/fetchAnnouncements',
  async (params?: GetAnnouncementsQuery) => {
    return await announcementApi.getAnnouncements(params);
  }
);

// 공지사항 상세 조회
export const fetchAnnouncementDetail = createAsyncThunk(
  'announcements/fetchAnnouncementDetail',
  async (id: string) => {
    return await announcementApi.getAnnouncementDetail(id);
  }
);

// 읽지 않은 공지사항 개수 조회
export const fetchUnreadCount = createAsyncThunk(
  'announcements/fetchUnreadCount',
  async () => {
    const result = await announcementApi.getUnreadCount();
    return result.unread_count;
  }
);

// 공지사항 읽음 처리
export const markAnnouncementAsRead = createAsyncThunk(
  'announcements/markAsRead',
  async (id: string) => {
    await announcementApi.markAsRead(id);
    return id;
  }
);

// 관리자용 전체 공지사항 목록 조회
export const fetchAllAnnouncementsAdmin = createAsyncThunk(
  'announcements/fetchAllAnnouncementsAdmin',
  async (params?: GetAnnouncementsQuery) => {
    return await announcementApi.getAllAnnouncementsAdmin(params);
  }
);

// 공지사항 생성
export const createAnnouncement = createAsyncThunk(
  'announcements/createAnnouncement',
  async (data: CreateAnnouncementRequest) => {
    await announcementApi.createAnnouncement(data);
    return data;
  }
);

// 공지사항 수정
export const updateAnnouncement = createAsyncThunk(
  'announcements/updateAnnouncement',
  async ({ id, data }: { id: string; data: UpdateAnnouncementRequest }) => {
    await announcementApi.updateAnnouncement(id, data);
    return { id, data };
  }
);

// 공지사항 삭제
export const deleteAnnouncement = createAsyncThunk(
  'announcements/deleteAnnouncement',
  async (id: string) => {
    await announcementApi.deleteAnnouncement(id);
    return id;
  }
);

const announcementSlice = createSlice({
  name: 'announcements',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentAnnouncement: (state) => {
      state.currentAnnouncement = null;
    },
    setPagination: (state, action: PayloadAction<{ limit?: number; offset?: number }>) => {
      if (action.payload.limit !== undefined) {
        state.pagination.limit = action.payload.limit;
      }
      if (action.payload.offset !== undefined) {
        state.pagination.offset = action.payload.offset;
      }
    },
    resetPagination: (state) => {
      state.pagination.offset = 0;
      state.pagination.hasMore = true;
    }
  },
  extraReducers: (builder) => {
    builder
      // 공지사항 목록 조회
      .addCase(fetchAnnouncements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncements.fulfilled, (state, action) => {
        state.loading = false;
        if (state.pagination.offset === 0) {
          state.announcements = action.payload;
        } else {
          state.announcements.push(...action.payload);
        }
        state.pagination.hasMore = action.payload.length === state.pagination.limit;
      })
      .addCase(fetchAnnouncements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '공지사항 목록 조회에 실패했습니다';
      })

      // 공지사항 상세 조회
      .addCase(fetchAnnouncementDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncementDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.currentAnnouncement = action.payload;
      })
      .addCase(fetchAnnouncementDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '공지사항 상세 조회에 실패했습니다';
      })

      // 읽지 않은 공지사항 개수 조회
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })

      // 공지사항 읽음 처리
      .addCase(markAnnouncementAsRead.fulfilled, (state, action) => {
        const announcementId = action.payload;
        
        // 목록에서 읽음 상태 업데이트
        const announcement = state.announcements.find(a => a.id === announcementId);
        if (announcement) {
          announcement.is_read = true;
        }
        
        // 현재 공지사항 읽음 상태 업데이트
        if (state.currentAnnouncement?.id === announcementId) {
          state.currentAnnouncement.is_read = true;
        }
        
        // 읽지 않은 개수 감소
        if (state.unreadCount > 0) {
          state.unreadCount -= 1;
        }
      })

      // 관리자용 전체 공지사항 목록 조회
      .addCase(fetchAllAnnouncementsAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllAnnouncementsAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.announcements = action.payload;
      })
      .addCase(fetchAllAnnouncementsAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '관리자 공지사항 목록 조회에 실패했습니다';
      })

      // 공지사항 생성
      .addCase(createAnnouncement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAnnouncement.fulfilled, (state) => {
        state.loading = false;
        // 목록 새로고침이 필요함을 표시하거나 새 공지사항을 목록에 추가
      })
      .addCase(createAnnouncement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '공지사항 생성에 실패했습니다';
      })

      // 공지사항 수정
      .addCase(updateAnnouncement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAnnouncement.fulfilled, (state, action) => {
        state.loading = false;
        const { id, data } = action.payload;
        
        // 목록에서 해당 공지사항 업데이트
        const index = state.announcements.findIndex(a => a.id === id);
        if (index !== -1) {
          state.announcements[index] = { ...state.announcements[index], ...data };
        }
        
        // 현재 공지사항 업데이트
        if (state.currentAnnouncement?.id === id) {
          state.currentAnnouncement = { ...state.currentAnnouncement, ...data };
        }
      })
      .addCase(updateAnnouncement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '공지사항 수정에 실패했습니다';
      })

      // 공지사항 삭제
      .addCase(deleteAnnouncement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteAnnouncement.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = action.payload;
        
        // 목록에서 해당 공지사항 제거
        state.announcements = state.announcements.filter(a => a.id !== deletedId);
        
        // 현재 공지사항이 삭제된 경우 초기화
        if (state.currentAnnouncement?.id === deletedId) {
          state.currentAnnouncement = null;
        }
      })
      .addCase(deleteAnnouncement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '공지사항 삭제에 실패했습니다';
      });
  }
});

export const { 
  clearError, 
  clearCurrentAnnouncement, 
  setPagination, 
  resetPagination 
} = announcementSlice.actions;

export default announcementSlice.reducer;