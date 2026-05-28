import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { bookingApi, type ClassBooking, type ClassSlot } from '../../services/bookingApi'

interface BookingState {
  slots: ClassSlot[]
  myBookings: ClassBooking[]
  loading: boolean
  error: string | null
}

const initialState: BookingState = {
  slots: [],
  myBookings: [],
  loading: false,
  error: null,
}

export const fetchClassSlots = createAsyncThunk('booking/fetchClassSlots', bookingApi.getSlots)
export const fetchMyBookings = createAsyncThunk('booking/fetchMyBookings', bookingApi.getMyBookings)

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchClassSlots.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchClassSlots.fulfilled, (state, action) => {
        state.loading = false
        state.slots = action.payload
      })
      .addCase(fetchClassSlots.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '수업 목록 조회 실패'
      })
      .addCase(fetchMyBookings.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.loading = false
        state.myBookings = action.payload
      })
      .addCase(fetchMyBookings.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message || '내 예약 조회 실패'
      })
  },
})

export default bookingSlice.reducer
