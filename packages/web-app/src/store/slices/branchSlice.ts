import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { branchApi } from '../../services/branchApi'
import { Branch, CreateBranchRequest, UpdateBranchRequest } from '../../types/branch'

// 지점 목록 조회
export const fetchBranches = createAsyncThunk(
  'branches/fetchBranches',
  async (params: {
    page?: number
    limit?: number
    status?: string
    search?: string
  } = {}, { rejectWithValue }) => {
    try {
      const response = await branchApi.getBranches(params)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '지점 조회에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Branches fetch error:', error)
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '지점 조회에 실패했습니다.'
      )
    }
  }
)

// 지점 생성
export const createBranch = createAsyncThunk(
  'branches/createBranch',
  async (data: CreateBranchRequest, { rejectWithValue }) => {
    try {
      const response = await branchApi.createBranch(data)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '지점 등록에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Branch create error:', error)
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '지점 등록에 실패했습니다.'
      )
    }
  }
)

// 지점 수정
export const updateBranch = createAsyncThunk(
  'branches/updateBranch',
  async ({ id, data }: { id: string; data: UpdateBranchRequest }, { rejectWithValue }) => {
    try {
      const response = await branchApi.updateBranch(id, data)
      if (response.success) {
        return response.data
      } else {
        return rejectWithValue(response.message || '지점 수정에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Branch update error:', error)
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '지점 수정에 실패했습니다.'
      )
    }
  }
)

// 지점 삭제
export const deleteBranch = createAsyncThunk(
  'branches/deleteBranch',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await branchApi.deleteBranch(id)
      if (response.success) {
        return id
      } else {
        return rejectWithValue(response.message || '지점 삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Branch delete error:', error)
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        '지점 삭제에 실패했습니다.'
      )
    }
  }
)



interface BranchState {
  branches: Branch[]
  currentBranch: Branch | null
  loading: boolean
  error: string | null
  total: number
  page: number
  limit: number
}

const initialState: BranchState = {
  branches: [],
  currentBranch: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10
}

const branchSlice = createSlice({
  name: 'branches',
  initialState,
  reducers: {
    setCurrentBranch: (state, action: PayloadAction<Branch | null>) => {
      state.currentBranch = action.payload
    },
    clearCurrentBranch: (state) => {
      state.currentBranch = null
    },
    clearError: (state) => {
      state.error = null
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.limit = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      // 지점 목록 조회
      .addCase(fetchBranches.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBranches.fulfilled, (state, action) => {
        state.loading = false
        state.branches = action.payload.items
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchBranches.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 지점 생성
      .addCase(createBranch.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createBranch.fulfilled, (state, action) => {
        state.loading = false
        state.branches.unshift(action.payload)
        state.total += 1
        state.currentBranch = action.payload
      })
      .addCase(createBranch.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 지점 수정
      .addCase(updateBranch.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateBranch.fulfilled, (state, action) => {
        state.loading = false
        const index = state.branches.findIndex(b => b.id === action.payload.id)
        if (index !== -1) {
          state.branches[index] = action.payload
        }
        state.currentBranch = action.payload
      })
      .addCase(updateBranch.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 지점 삭제
      .addCase(deleteBranch.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteBranch.fulfilled, (state, action) => {
        state.loading = false
        state.branches = state.branches.filter(b => b.id !== action.payload)
        state.total -= 1
        if (state.currentBranch?.id === action.payload) {
          state.currentBranch = null
        }
      })
      .addCase(deleteBranch.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  }
})

export const {
  setCurrentBranch,
  clearCurrentBranch,
  clearError,
  setPage,
  setLimit
} = branchSlice.actions

export default branchSlice.reducer


