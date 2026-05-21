/**
 * 앱 라우팅 요약 (`App.tsx`)
 *
 * 기능: Redux·테마·스낵바·비활성 타임아웃 후 React Router로 전체 화면 트리를 구성한다.
 *
 * 라우트(요약):
 * - 인증 레이아웃: `/login`, `/register`, `/forgot-password`(플레이스홀더), `/` → `/home` 리다이렉트
 * - 보호 + `MainLayout`: `/home`, `/dashboard`, `/MonthProgram`, `/DynamicStretching`, `/CoolDown`, `/Totalexercises`, `/settings`, `/workout-settings`, `/announcements`, `/mui-license`, `/admin/*`
 * - 독립(레이아웃 없음): `/remote-control`
 * - 인라인 플레이스홀더: `/videos`, `/playlists`, `/workouts`, `/profile`
 * - `*` 404
 *
 * 흐름: `AuthProvider` → `ThemeWrapper` → `BrowserRouter` → `Routes` 매칭.
 */

import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Box, Card, Typography, Button } from '@mui/material'
import { useAppSelector } from './hooks/redux'
import { store } from './store/store'
import { createMuiTheme } from './themes/muiTheme'
import { AuthLayout } from './layouts/AuthLayout'
import { MainLayout } from './layouts/MainLayout'
import { ProtectedRoute } from './components/Auth/ProtectedRoute'
import { RoleBasedRedirect } from './components/Auth/RoleBasedRedirect'
import AuthProvider from './components/Auth/AuthProvider'
import { ThemeProvider as CustomThemeProvider, useTheme } from './contexts/ThemeContext'
import { useInactivityTimeout } from './hooks/useInactivityTimeout'
import { SnackbarProvider } from './contexts/SnackbarContext'

// Auth Pages
import { Login as Login } from './pages/Auth/Login'
import Register from './pages/Auth/Register' // Fixed import
import AccountSettings from './pages/Auth/AccountSettings'

// User Pages
import UserDashboard from './pages/Dashboard/UserDashboard'
import MonthProgram from './pages/MonthProgram/MonthProgram'
import DynamicStretching from './pages/exercises/DynamicStretching/DynamicStretching'
import CoolDown from './pages/exercises/CoolDown/CoolDown'
// import PowerCircuit from './pages/exercises/PowerCircuit/PowerCircuit'
import Totalexercises from './pages/exercises/Totalexercises/Totalexercises'
// import FunctionalCircuit from './pages/exercises/FunctionalCircuit/FunctionalCircuit'
// import CoreCarryFocus from './pages/exercises/CoreCarryFocus/CoreCarryFocus'
// import CircuitTraining from './pages/exercises/CircuitTraining/CircuitTraining'
import { RemoteControlPage } from './pages/RemoteControlPage'

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard/AdminDashboard'
import WorkoutManager from './pages/Admin/WorkoutManager/WorkoutManager'
import Notification from './pages/Admin/Notification/Notification'
import Branch from './pages/Admin/Branch/Branch'
import { UserManagement } from './pages/Admin/Users/UserManagement'
import LinkageManagementPage from './pages/Admin/LinkageManagement/LinkageManagementPage'
import { UserHistory } from './pages/Admin/Users/UserHistory'
import MenuManager from './pages/Admin/MenuManager/MenuManager'
import Vimeo from './pages/Admin/Vimeo/Vimeo'
import WorkoutSettings from './pages/WorkoutSettings/WorkoutSettings'

// Other Pages
import { MuiLicense } from './pages/MuiLicense/MuiLicense'
import AnnouncementsPage from './pages/Announcements/AnnouncementsPage'

// MUI 테마 래퍼 컴포넌트
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  try {
    const { mode } = useTheme()
    const theme = createMuiTheme(mode)

    // 테마 변경 디버깅
    React.useEffect(() => {
      // console.log('🎨 테마 변경됨:', {
      //   mode,
      //   primaryMain: theme.palette.primary.main,
      //   backgroundDefault: theme.palette.background.default,
      //   backgroundPaper: theme.palette.background.paper,
      //   textPrimary: theme.palette.text.primary,
      //   textSecondary: theme.palette.text.secondary,
      //   divider: theme.palette.divider
      // })

      // 강제로 body 스타일 적용
      document.body.style.backgroundColor = theme.palette.background.default
      document.body.style.color = theme.palette.text.primary
    }, [mode, theme])

    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider>{children}</SnackbarProvider>
      </ThemeProvider>
    )
  } catch (error) {
    console.error('ThemeWrapper 에러:', error)
    // 기본 테마로 폴백
    const fallbackTheme = createMuiTheme('light')
    return (
      <ThemeProvider theme={fallbackTheme}>
        <CssBaseline />
        <SnackbarProvider>{children}</SnackbarProvider>
      </ThemeProvider>
    )
  }
}

// 테마를 적용하는 내부 컴포넌트
const AppContent: React.FC = () => {
  // 90분 비활성 타임아웃 적용
  useInactivityTimeout()

  return (
    <CustomThemeProvider>
      <AuthProvider>
        <ThemeWrapper>
          <Router>
            <Routes>
              {/* 인증 라우트 */}
              <Route path="/" element={<AuthLayout />}>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="forgot-password" element={<div>비밀번호 찾기 페이지</div>} />
              </Route>

              {/* 리모컨 페이지 (레이아웃 없음, 로그인 필요) */}
              <Route path="/remote-control" element={
                <ProtectedRoute>
                  <RemoteControlPage />
                </ProtectedRoute>
              } />

              {/* 보호된 라우트 (로그인 후) */}
              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                {/* 기본 라우트 - 역할에 따른 리다이렉트 */}
                <Route path="home" element={<RoleBasedRedirect />} />

                {/* 일반 사용자 라우트 */}
                <Route path="dashboard" element={<UserDashboard />} />
                <Route path="MonthProgram" element={<MonthProgram />} />
                <Route path="DynamicStretching" element={<DynamicStretching />} />
                <Route path="CoolDown" element={<CoolDown />} />
                {/* <Route path="PowerCircuit" element={<PowerCircuit />} /> */}
                <Route path="Totalexercises" element={<Totalexercises />} />
                {/* <Route path="FunctionalCircuit" element={<FunctionalCircuit />} /> */}
                {/* <Route path="CoreCarryFocus" element={<CoreCarryFocus />} /> */}
                {/* <Route path="CircuitTraining" element={<CircuitTraining />} /> */}
                <Route path="videos" element={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, p: 2 }}>
                    <Card sx={{ textAlign: 'center', p: { xs: 3, sm: 4 }, maxWidth: 400, width: '100%' }}>
                      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        비디오 목록
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        개발 예정입니다.
                      </Typography>
                    </Card>
                  </Box>
                } />
                <Route path="playlists" element={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, p: 2 }}>
                    <Card sx={{ textAlign: 'center', p: { xs: 3, sm: 4 }, maxWidth: 400, width: '100%' }}>
                      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        플레이리스트
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        개발 예정입니다.
                      </Typography>
                    </Card>
                  </Box>
                } />
                <Route path="workouts" element={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, p: 2 }}>
                    <Card sx={{ textAlign: 'center', p: { xs: 3, sm: 4 }, maxWidth: 400, width: '100%' }}>
                      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        운동 기록
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        개발 예정입니다.
                      </Typography>
                    </Card>
                  </Box>
                } />
                <Route path="settings" element={<AccountSettings />} />
                <Route path="workout-settings" element={<WorkoutSettings />} />
                <Route path="profile" element={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400, p: 2 }}>
                    <Card sx={{ textAlign: 'center', p: { xs: 3, sm: 4 }, maxWidth: 400, width: '100%' }}>
                      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        프로필
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        개발 예정입니다.
                      </Typography>
                    </Card>
                  </Box>
                } />

                {/* MUI 라이선스 페이지 */}
                <Route path="mui-license" element={<MuiLicense />} />

                {/* 공지사항 페이지 (공통) */}
                <Route path="announcements" element={<AnnouncementsPage />} />

                {/* 테마 테스트 페이지 */}

                {/* 관리자 라우트 */}
                <Route path="admin/dashboard" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="admin/usermanager" element={
                  <ProtectedRoute requiredRole="admin">
                    <UserManagement />
                  </ProtectedRoute>
                } />
                <Route path="admin/linkage-management" element={
                  <ProtectedRoute requiredRole="admin">
                    <LinkageManagementPage />
                  </ProtectedRoute>
                } />
                <Route path="admin/workoutmanager" element={
                  <ProtectedRoute requiredRole="admin">
                    <WorkoutManager />
                  </ProtectedRoute>
                } />
                <Route path="admin/notification" element={
                  <ProtectedRoute requiredRole="admin">
                    <Notification />
                  </ProtectedRoute>
                } />
                <Route path="admin/menumanager" element={
                  <ProtectedRoute requiredRole="admin">
                    <MenuManager />
                  </ProtectedRoute>
                } />
                <Route path="admin/branch" element={
                  <ProtectedRoute requiredRole="admin">
                    <Branch />
                  </ProtectedRoute>
                } />
                <Route path="admin/userhistory" element={
                  <ProtectedRoute requiredRole="admin">
                    <UserHistory />
                  </ProtectedRoute>
                } />
                <Route path="admin/vimeo" element={
                  <ProtectedRoute requiredRole="admin">
                    <Vimeo />
                  </ProtectedRoute>
                } />
              </Route>

              {/* 404 페이지 */}
              <Route path="*" element={
                <Box
                  sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2
                  }}
                >
                  <Card sx={{ textAlign: 'center', p: { xs: 3, sm: 4 }, maxWidth: 400, width: '100%' }}>
                    <Typography variant="h2" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      404
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                      페이지를 찾을 수 없습니다
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => window.history.back()}
                      sx={{ textTransform: 'none' }}
                    >
                      이전 페이지로
                    </Button>
                  </Card>
                </Box>
              } />
            </Routes>
          </Router>
        </ThemeWrapper>
      </AuthProvider>
    </CustomThemeProvider>
  )
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

export default App