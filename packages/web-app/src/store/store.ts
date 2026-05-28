import { configureStore } from '@reduxjs/toolkit'
import authSlice from './slices/authSlice'
import videosSlice from './slices/videosSlice'
import playlistsSlice from './slices/playlistsSlice'
import workoutSlice from './slices/workoutSlice'
import announcementSlice from './slices/announcementSlice'
import menuSlice from './slices/menuSlice'
import workoutCategorySlice from './slices/workoutCategorySlice'
import notificationSlice from './slices/notificationSlice'
import branchSlice from './slices/branchSlice'
import bookingSlice from './slices/bookingSlice'

import themeReducer from './slices/themeSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    videos: videosSlice,
    playlists: playlistsSlice,
    workout: workoutSlice,
    announcements: announcementSlice,
    menus: menuSlice,
    workoutCategories: workoutCategorySlice,
    notifications: notificationSlice,
    branches: branchSlice,
    booking: bookingSlice,

    theme: themeReducer,
  },
  preloadedState: {
    theme: { mode: 'light' }
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch