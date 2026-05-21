import { Router } from 'express'
import { exec } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { AuthService } from '../services/auth.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// 리모컨/현장 제어용 단기 토큰 발급
// - 웹 사용자의 access token으로 인증 후, Electron이 서버 API를 호출할 때 사용할 단기 토큰을 발급
// - auth.middleware의 isSessionActive를 통과해야 하므로 user_sessions에 세션으로 등록
router.post('/control-token', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ success: false, error: '인증이 필요합니다' })
    }

    const expiresInSeconds = 6 * 60 * 60 // 6시간
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return res.status(500).json({ success: false, error: 'JWT 시크릿이 설정되지 않았습니다' })
    }

    const payload = {
      userId: user.id,
      email: user.userid,
      type: 'access' as const
    }

    const controlToken = jwt.sign(payload, secret, {
      expiresIn: `${expiresInSeconds}s`,
      issuer: 'multi-monitor-workout-system',
      audience: 'workout-app-users'
    })

    // 세션 테이블에 등록하여 authenticateToken이 통과하도록 함
    await AuthService.createUserSession(
      user.id,
      controlToken,
      req.ip,
      req.headers['user-agent'] as string | undefined,
      expiresAt
    )

    res.json({
      success: true,
      controlToken,
      expiresIn: expiresInSeconds
    })
  } catch (error) {
    console.error('control-token 발급 실패:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

// Electron 앱 실행 엔드포인트
router.post('/launch', async (req, res) => {
  try {
    console.log('🚀 Electron 실행 요청 받음')
    
    // Electron 앱 경로 (API 서버 기준 상대 경로)
    const electronPath = path.resolve(__dirname, '../../../electron-app')
    const command = `cd "${electronPath}" && npm run electron:dev`
    
    console.log('실행할 명령:', command)
    
    // 백그라운드에서 Electron 실행
    const childProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Electron 실행 오류:', error)
        return
      }
      if (stderr) {
        console.error('Electron stderr:', stderr)
        return
      }
      console.log('Electron stdout:', stdout)
    })
    
    // 프로세스가 시작되면 즉시 응답
    res.json({ 
      success: true, 
      message: 'Electron 앱 실행을 시작했습니다.',
      pid: childProcess.pid 
    })
    
    // 프로세스를 detach하여 부모 프로세스와 독립적으로 실행
    if (childProcess.pid) {
      childProcess.unref()
    }
    
  } catch (error) {
    console.error('Electron 실행 실패:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

// Electron 프로세스 상태 확인
router.get('/status', async (req, res) => {
  try {
    // 포트 3002에서 ping 테스트
    // @ts-ignore
    const fetch = (await import('node-fetch')).default
    
    try {
      const response = await fetch('http://localhost:3002/ping', { timeout: 2000 })
      if (response.ok) {
        res.json({ 
          success: true, 
          status: 'running',
          message: 'Electron HTTP 서버가 실행 중입니다.' 
        })
      } else {
        res.json({ 
          success: false, 
          status: 'not_responding',
          message: 'Electron이 실행 중이지만 HTTP 서버가 응답하지 않습니다.' 
        })
      }
    } catch (fetchError) {
      res.json({ 
        success: false, 
        status: 'not_running',
        message: 'Electron이 실행되지 않았습니다.' 
      })
    }
    
  } catch (error) {
    console.error('Electron 상태 확인 실패:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    })
  }
})

export default router
