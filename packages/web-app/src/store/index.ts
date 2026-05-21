import { configureStore } from '@reduxjs/toolkit'
import authSlice from './slices/authSlice'
import menuSlice from './slices/menuSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    menu: menuSlice,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch