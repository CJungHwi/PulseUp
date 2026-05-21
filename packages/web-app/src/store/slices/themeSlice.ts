import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ThemeMode } from '../../themes/designTokens'

interface ThemeState {
  mode: ThemeMode
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme') as ThemeMode
    return savedTheme || 'light'
  }
  return 'light'
}

const initialState: ThemeState = {
  mode: getInitialTheme()
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light'
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.mode)
      }
    },
    cycleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light'
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.mode)
      }
    },
    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.mode = action.payload
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.mode)
      }
    }
  }
})

export const { toggleTheme, cycleTheme, setTheme } = themeSlice.actions
export default themeSlice.reducer

