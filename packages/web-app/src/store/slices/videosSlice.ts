import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { videosAPI } from '../../services/api'

export interface Video {
  id: string
  title: string
  description?: string
  category: string
  youtubeUrl: string
  duration: number
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
}

export interface VideosState {
  videos: Video[]
  currentVideo: Video | null
  categories: string[]
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
    category: string
    sortBy: 'createdAt' | 'title' | 'duration'
    sortOrder: 'asc' | 'desc'
  }
}

const initialState: VideosState = {
  videos: [],
  currentVideo: null,
  categories: [],
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
    category: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
}

// 비디오 목록 조회
export const fetchVideos = createAsyncThunk(
  'videos/fetchVideos',
  async (params: {
    page?: number
    limit?: number
    search?: string
    category?: string
    sortBy?: string
    sortOrder?: string
  } = {}, { rejectWithValue }) => {
    try {
      const response = await videosAPI.getVideos(params)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '비디오 목록 조회에 실패했습니다')
    }
  }
)

// 비디오 상세 조회
export const fetchVideoById = createAsyncThunk(
  'videos/fetchVideoById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await videosAPI.getVideoById(id)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '비디오 조회에 실패했습니다')
    }
  }
)

// 카테고리 목록 조회
export const fetchCategories = createAsyncThunk(
  'videos/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await videosAPI.getCategories()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '카테고리 조회에 실패했습니다')
    }
  }
)

// YouTube에서 비디오 검색
export const searchYouTubeVideos = createAsyncThunk(
  'videos/searchYouTube',
  async (params: { query: string; maxResults?: number; categoryId?: string }, { rejectWithValue }) => {
    try {
      const response = await videosAPI.searchYouTube(params)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'YouTube 검색에 실패했습니다')
    }
  }
)

const videosSlice = createSlice({
  name: 'videos',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<VideosState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearError: (state) => {
      state.error = null
    },
    setCurrentVideo: (state, action: PayloadAction<Video | null>) => {
      state.currentVideo = action.payload
    },
  },
  extraReducers: (builder) => {
    // 비디오 목록 조회
    builder
      .addCase(fetchVideos.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchVideos.fulfilled, (state, action) => {
        state.isLoading = false
        state.videos = action.payload.videos
        state.pagination = action.payload.pagination
      })
      .addCase(fetchVideos.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 비디오 상세 조회
    builder
      .addCase(fetchVideoById.fulfilled, (state, action) => {
        state.currentVideo = action.payload
      })

    // 카테고리 목록 조회
    builder
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload
      })
  },
})

export const { setFilters, clearError, setCurrentVideo } = videosSlice.actions
export default videosSlice.reducer