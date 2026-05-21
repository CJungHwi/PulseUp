import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { playlistsAPI } from '../../services/api'
import { Video } from './videosSlice'

export interface PlaylistVideo {
  id: string
  playlistId: string
  videoId: string
  order: number
  video: Video
}

export interface Playlist {
  id: string
  name: string
  userId: string
  createdAt: string
  updatedAt: string
  videos?: PlaylistVideo[]
  _count?: {
    videos: number
  }
}

export interface PlaylistsState {
  playlists: Playlist[]
  currentPlaylist: Playlist | null
  isLoading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    search: string
    sortBy: 'createdAt' | 'name' | 'updatedAt'
    sortOrder: 'asc' | 'desc'
  }
}

const initialState: PlaylistsState = {
  playlists: [],
  currentPlaylist: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
}

// 플레이리스트 목록 조회
export const fetchPlaylists = createAsyncThunk(
  'playlists/fetchPlaylists',
  async (params: {
    page?: number
    limit?: number
    search?: string
    sortBy?: string
    sortOrder?: string
  } = {}, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.getPlaylists(params)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '플레이리스트 목록 조회에 실패했습니다')
    }
  }
)

// 플레이리스트 상세 조회
export const fetchPlaylistById = createAsyncThunk(
  'playlists/fetchPlaylistById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.getPlaylistById(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '플레이리스트 조회에 실패했습니다')
    }
  }
)

// 플레이리스트 생성
export const createPlaylist = createAsyncThunk(
  'playlists/createPlaylist',
  async (data: { name: string }, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.createPlaylist(data)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '플레이리스트 생성에 실패했습니다')
    }
  }
)

// 플레이리스트에 비디오 추가
export const addVideoToPlaylist = createAsyncThunk(
  'playlists/addVideo',
  async (data: { playlistId: string; videoId: string; order: number }, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.addVideoToPlaylist(data.playlistId, {
        videoId: data.videoId,
        order: data.order,
      })
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '비디오 추가에 실패했습니다')
    }
  }
)

// 플레이리스트 순서 변경
export const reorderPlaylistVideos = createAsyncThunk(
  'playlists/reorderVideos',
  async (data: { playlistId: string; videoOrders: Array<{ videoId: string; order: number }> }, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.reorderVideos(data.playlistId, {
        videoOrders: data.videoOrders,
      })
      return { playlistId: data.playlistId, videoOrders: data.videoOrders }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '순서 변경에 실패했습니다')
    }
  }
)

// 플레이리스트 수정
export const updatePlaylist = createAsyncThunk(
  'playlists/updatePlaylist',
  async (data: { id: string; name: string }, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.updatePlaylist(data.id, { name: data.name })
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '플레이리스트 수정에 실패했습니다')
    }
  }
)

// 플레이리스트 삭제
export const deletePlaylist = createAsyncThunk(
  'playlists/deletePlaylist',
  async (id: string, { rejectWithValue }) => {
    try {
      await playlistsAPI.deletePlaylist(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '플레이리스트 삭제에 실패했습니다')
    }
  }
)

// 플레이리스트 복제
export const duplicatePlaylist = createAsyncThunk(
  'playlists/duplicatePlaylist',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await playlistsAPI.duplicatePlaylist(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '플레이리스트 복제에 실패했습니다')
    }
  }
)

const playlistsSlice = createSlice({
  name: 'playlists',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<PlaylistsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearError: (state) => {
      state.error = null
    },
    setCurrentPlaylist: (state, action: PayloadAction<Playlist | null>) => {
      state.currentPlaylist = action.payload
    },
    updatePlaylistVideosOrder: (state, action: PayloadAction<{ playlistId: string; videoOrders: Array<{ videoId: string; order: number }> }>) => {
      if (state.currentPlaylist && state.currentPlaylist.id === action.payload.playlistId && state.currentPlaylist.videos) {
        // 순서 업데이트
        const { videoOrders } = action.payload
        state.currentPlaylist.videos.forEach(pv => {
          const newOrder = videoOrders.find(vo => vo.videoId === pv.videoId)
          if (newOrder) {
            pv.order = newOrder.order
          }
        })
        // 순서대로 정렬
        state.currentPlaylist.videos.sort((a, b) => a.order - b.order)
      }
    },
  },
  extraReducers: (builder) => {
    // 플레이리스트 목록 조회
    builder
      .addCase(fetchPlaylists.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchPlaylists.fulfilled, (state, action) => {
        state.isLoading = false
        state.playlists = action.payload.data || action.payload
        if (action.payload.pagination) {
          state.pagination = action.payload.pagination
        }
      })
      .addCase(fetchPlaylists.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 플레이리스트 상세 조회
    builder
      .addCase(fetchPlaylistById.fulfilled, (state, action) => {
        state.currentPlaylist = action.payload
      })

    // 플레이리스트 생성
    builder
      .addCase(createPlaylist.fulfilled, (state, action) => {
        state.playlists.unshift(action.payload)
      })

    // 순서 변경
    builder
      .addCase(reorderPlaylistVideos.fulfilled, (state, action) => {
        // 이미 reducer에서 처리됨
      })

    // 플레이리스트 수정
    builder
      .addCase(updatePlaylist.fulfilled, (state, action) => {
        const index = state.playlists.findIndex(p => p.id === action.payload.id)
        if (index !== -1) {
          state.playlists[index] = action.payload
        }
        if (state.currentPlaylist && state.currentPlaylist.id === action.payload.id) {
          state.currentPlaylist = action.payload
        }
      })

    // 플레이리스트 삭제
    builder
      .addCase(deletePlaylist.fulfilled, (state, action) => {
        state.playlists = state.playlists.filter(p => p.id !== action.payload)
        if (state.currentPlaylist && state.currentPlaylist.id === action.payload) {
          state.currentPlaylist = null
        }
      })

    // 플레이리스트 복제
    builder
      .addCase(duplicatePlaylist.fulfilled, (state, action) => {
        state.playlists.unshift(action.payload)
      })
  },
})

export const { setFilters, clearError, setCurrentPlaylist, updatePlaylistVideosOrder } = playlistsSlice.actions
export default playlistsSlice.reducer