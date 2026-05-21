// 컴파일된 TypeScript 파일을 로드
// 실제 프로덕션에서는 TypeScript가 컴파일된 JavaScript 파일이 사용됩니다.
// 개발 중에는 이 파일이 임시로 사용됩니다.

// 현재 디스플레이 타입
let currentDisplay = 'workout'
let isWorkoutActive = false
let currentHeartRate = 0
let workoutTimer = 0
let timerInterval = null
let currentPlaylist = null

// URL 해시를 기반으로 디스플레이 타입 결정
function getDisplayTypeFromHash() {
  const hash = window.location.hash.replace('#/', '')
  switch (hash) {
    case 'workout-display':
      return 'workout'
    case 'timer-display':
      return 'timer'
    case 'background-display':
      return 'background'
    case 'control':
      return 'control'
    default:
      return 'workout'
  }
}

// 시간 포맷팅
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
}

// 운동 타이머 시작
function startWorkoutTimer() {
  workoutTimer = 0
  timerInterval = setInterval(() => {
    workoutTimer++
    updateTimerDisplay()
  }, 1000)
}

// 운동 타이머 정지
function stopWorkoutTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  workoutTimer = 0
  updateTimerDisplay()
}

// 타이머 디스플레이 업데이트
function updateTimerDisplay() {
  const timerElement = document.getElementById('timer-value')
  if (timerElement) {
    timerElement.textContent = formatTime(workoutTimer)
  }
}

// 심박수 디스플레이 업데이트
function updateHeartRateDisplay() {
  const heartRateElement = document.getElementById('heart-rate-value')
  if (heartRateElement) {
    heartRateElement.textContent = currentHeartRate.toString()
  }
}

// 디스플레이 렌더링
function renderDisplay() {
  const app = document.getElementById('app')
  if (!app) return

  switch (currentDisplay) {
    case 'workout':
      renderWorkoutDisplay(app)
      break
    case 'timer':
      renderTimerDisplay(app)
      break
    case 'background':
      renderBackgroundDisplay(app)
      break
    case 'control':
      renderControlDisplay(app)
      break
  }
}

function renderWorkoutDisplay(container) {
  container.className = 'display-container workout-display'
  container.innerHTML = `
    <div id="workout-video-container" class="video-container"></div>
    <div class="overlay" id="workout-overlay">
      <div class="display-title">운동 비디오</div>
      <div class="display-subtitle">
        ${isWorkoutActive ? '운동이 진행 중입니다' : '운동을 시작하려면 제어판을 사용하세요'}
      </div>
    </div>
    <div class="workout-info" id="workout-info" style="display: none;">
      <div class="workout-title" id="workout-title">운동 제목</div>
      <div class="workout-description" id="workout-description">운동 설명</div>
    </div>
  `
}

function renderTimerDisplay(container) {
  container.className = 'display-container timer-display'
  container.innerHTML = `
    <div class="timer-display-content">
      <div class="timer-value" id="timer-value">${formatTime(workoutTimer)}</div>
      <div class="display-subtitle">운동 시간</div>
    </div>
    <div class="heart-rate-display">
      <div class="heart-rate-value" id="heart-rate-value">${currentHeartRate}</div>
      <div class="heart-rate-label">BPM</div>
    </div>
  `
}

function renderBackgroundDisplay(container) {
  container.className = 'display-container background-display'
  container.innerHTML = `
    <video id="background-video" class="video-player" loop muted autoplay style="display: none;">
      비디오를 지원하지 않는 브라우저입니다.
    </video>
    <div class="overlay">
      <div class="display-title">배경 비디오</div>
      <div class="display-subtitle">운동 분위기를 위한 배경 영상</div>
    </div>
  `
}

function renderControlDisplay(container) {
  container.className = 'display-container control-display'
  container.innerHTML = `
    <div class="control-panel">
      <div class="control-section">
        <div class="control-title">
          <span class="status-indicator ${isWorkoutActive ? 'status-active' : 'status-inactive'}"></span>
          운동 상태
        </div>
        <button class="control-button" id="start-workout-btn" ${isWorkoutActive ? 'disabled' : ''}>
          운동 시작
        </button>
        <button class="control-button danger" id="stop-workout-btn" ${!isWorkoutActive ? 'disabled' : ''}>
          운동 종료
        </button>
      </div>
      
      <div class="control-section">
        <div class="control-title">플레이리스트</div>
        <div id="playlist-info">
          ${currentPlaylist ? currentPlaylist.name : '플레이리스트가 선택되지 않았습니다'}
        </div>
        <button class="control-button" id="load-playlist-btn">플레이리스트 로드</button>
      </div>
      
      <div class="control-section">
        <div class="control-title">디스플레이 관리</div>
        <button class="control-button" id="reposition-windows-btn">창 위치 재조정</button>
        <button class="control-button" id="get-displays-btn">디스플레이 정보</button>
      </div>
      
      <div class="control-section">
        <div class="control-title">시스템</div>
        <button class="control-button danger" id="quit-app-btn">앱 종료</button>
      </div>
    </div>
  `

  setupControlEventListeners()
}

// 제어 버튼 이벤트 리스너 설정
function setupControlEventListeners() {
  console.log('🎮 [DEBUG] 제어 버튼 이벤트 리스너 설정 시작')
  
  const startBtn = document.getElementById('start-workout-btn')
  const stopBtn = document.getElementById('stop-workout-btn')
  const loadPlaylistBtn = document.getElementById('load-playlist-btn')
  const repositionBtn = document.getElementById('reposition-windows-btn')
  const getDisplaysBtn = document.getElementById('get-displays-btn')
  const quitBtn = document.getElementById('quit-app-btn')

  console.log('🎮 [DEBUG] 버튼 요소들:', {
    startBtn: !!startBtn,
    stopBtn: !!stopBtn,
    loadPlaylistBtn: !!loadPlaylistBtn,
    repositionBtn: !!repositionBtn,
    getDisplaysBtn: !!getDisplaysBtn,
    quitBtn: !!quitBtn
  })

  if (startBtn) {
    startBtn.addEventListener('click', startWorkout)
    console.log('✅ [DEBUG] 운동 시작 버튼 이벤트 리스너 등록')
  }
  if (stopBtn) {
    stopBtn.addEventListener('click', stopWorkout)
    console.log('✅ [DEBUG] 운동 종료 버튼 이벤트 리스너 등록')
  }
  if (loadPlaylistBtn) {
    loadPlaylistBtn.addEventListener('click', loadPlaylist)
    console.log('✅ [DEBUG] 플레이리스트 로드 버튼 이벤트 리스너 등록')
  }
  if (repositionBtn) repositionBtn.addEventListener('click', repositionWindows)
  if (getDisplaysBtn) getDisplaysBtn.addEventListener('click', getDisplays)
  if (quitBtn) quitBtn.addEventListener('click', quitApp)
  
  console.log('🎮 [DEBUG] 제어 버튼 이벤트 리스너 설정 완료')
}

// 운동 시작
async function startWorkout() {
  try {
    console.log('🚀 [DEBUG] 운동 시작 버튼 클릭됨')
    
    // 운동 상태 업데이트
    isWorkoutActive = true
    console.log('🚀 [DEBUG] 운동 상태 업데이트:', isWorkoutActive)
    
    // MultiMonitorManager 인스턴스가 있으면 운동 시작
    if (window.multiMonitorManager) {
      console.log('🚀 [DEBUG] MultiMonitorManager를 통해 운동 시작')
      window.multiMonitorManager.startWorkout()
    } else {
      console.error('❌ [DEBUG] MultiMonitorManager가 없습니다')
    }
    
    // 제어판 UI 업데이트
    updateControlPanel()
    
    console.log('✅ [DEBUG] 운동 시작 완료')
  } catch (error) {
    console.error('❌ [DEBUG] 운동 시작 실패:', error)
  }
}

// 운동 종료
async function stopWorkout() {
  try {
    console.log('운동 종료')
    
    // 운동 상태 업데이트
    isWorkoutActive = false
    
    // MultiMonitorManager 인스턴스가 있으면 운동 종료
    if (window.multiMonitorManager) {
      console.log('MultiMonitorManager를 통해 운동 종료')
      window.multiMonitorManager.stopWorkout()
    }
    
    // 제어판 UI 업데이트
    updateControlPanel()
    
    console.log('운동 종료 완료')
  } catch (error) {
    console.error('운동 종료 실패:', error)
  }
}

// 플레이리스트 로드
async function loadPlaylist() {
  try {
    console.log('🎵 [DEBUG] 플레이리스트 로드 시작')

    // Vimeo 비디오가 포함된 플레이리스트
    const vimeoPlaylist = {
      id: 'vimeo-playlist-1',
      name: 'Vimeo 운동 플레이리스트',
      videos: [
        {
          id: 'vimeo-video-1',
          title: 'Sample Workout Video',
          url: 'https://vimeo.com/76979871',
          duration: 240
        }
      ]
    }

    console.log('🎵 [DEBUG] Vimeo 플레이리스트 생성:', vimeoPlaylist)

    // 플레이리스트 설정
    currentPlaylist = vimeoPlaylist
    
    // MultiMonitorManager에 플레이리스트 로드
    if (window.multiMonitorManager) {
      console.log('🎵 [DEBUG] MultiMonitorManager에 플레이리스트 로드')
      window.multiMonitorManager.loadWorkoutPlaylist(vimeoPlaylist)
    } else {
      console.error('❌ [DEBUG] MultiMonitorManager가 없어서 플레이리스트 로드 불가')
    }
    
    // 제어판 UI 업데이트
    updateControlPanel()
    
    console.log('✅ [DEBUG] 플레이리스트 로드 완료:', vimeoPlaylist.name)
  } catch (error) {
    console.error('❌ [DEBUG] 플레이리스트 로드 실패:', error)
  }
}

// 창 위치 재조정
async function repositionWindows() {
  if (!window.electronAPI) {
    console.error('Electron API를 사용할 수 없습니다')
    return
  }

  try {
    const result = await window.electronAPI.repositionWindows()
    
    if (result.success) {
      console.log('창 위치 재조정 성공')
    }
  } catch (error) {
    console.error('창 위치 재조정 실패:', error)
  }
}

// 디스플레이 정보 조회
async function getDisplays() {
  if (!window.electronAPI) {
    console.error('Electron API를 사용할 수 없습니다')
    return
  }

  try {
    const displays = await window.electronAPI.getDisplays()
    console.log('디스플레이 정보:', displays)
    
    alert(`감지된 디스플레이: ${displays.length}개\\n${displays.map(d => `모니터 ${d.index + 1}: ${d.bounds.width}x${d.bounds.height} (${d.type})`).join('\\n')}`)
  } catch (error) {
    console.error('디스플레이 정보 조회 실패:', error)
  }
}

// 앱 종료
async function quitApp() {
  if (!window.electronAPI) {
    console.error('Electron API를 사용할 수 없습니다')
    return
  }

  if (confirm('앱을 종료하시겠습니까?')) {
    try {
      await window.electronAPI.quitApp()
    } catch (error) {
      console.error('앱 종료 실패:', error)
    }
  }
}

// 디스플레이 업데이트
function updateDisplay() {
  if (currentDisplay === 'control') {
    renderControlDisplay(document.getElementById('app'))
  } else if (currentDisplay === 'workout') {
    const overlay = document.getElementById('workout-overlay')
    if (overlay) {
      overlay.innerHTML = `
        <div class="display-title">운동 비디오</div>
        <div class="display-subtitle">
          ${isWorkoutActive ? '운동이 진행 중입니다' : '운동을 시작하려면 제어판을 사용하세요'}
        </div>
      `
    }
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  if (!window.electronAPI) {
    console.warn('Electron API를 사용할 수 없습니다. 웹 브라우저에서 실행 중일 수 있습니다.')
    return
  }

  // 메인 프로세스로부터의 이벤트 리스너
  window.electronAPI.onWorkoutStarted((data) => {
    console.log('운동 시작됨:', data)
    isWorkoutActive = true
    startWorkoutTimer()
    updateDisplay()
  })

  window.electronAPI.onWorkoutStopped(() => {
    console.log('운동 종료됨')
    isWorkoutActive = false
    stopWorkoutTimer()
    updateDisplay()
  })

  window.electronAPI.onPlaylistLoaded((data) => {
    console.log('플레이리스트 로드됨:', data)
    currentPlaylist = data
    updateDisplay()
  })

  window.electronAPI.onHeartRateUpdated((data) => {
    console.log('심박수 업데이트:', data)
    currentHeartRate = data.heartRate
    updateHeartRateDisplay()
  })

  window.electronAPI.onMenuStartWorkout(() => {
    if (currentDisplay === 'control') {
      startWorkout()
    }
  })

  window.electronAPI.onMenuStopWorkout(() => {
    if (currentDisplay === 'control') {
      stopWorkout()
    }
  })

  // 키보드 단축키
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 's':
          event.preventDefault()
          if (currentDisplay === 'control') {
            startWorkout()
          }
          break
        case 'e':
          event.preventDefault()
          if (currentDisplay === 'control') {
            stopWorkout()
          }
          break
        case 'q':
          event.preventDefault()
          quitApp()
          break
      }
    }
  })
}

// 디스플레이 정보 로드
async function loadDisplayInfo() {
  if (!window.electronAPI) return

  try {
    const displays = await window.electronAPI.getDisplays()
    console.log(`현재 디스플레이 타입: ${currentDisplay}`)
    console.log('사용 가능한 디스플레이:', displays)
  } catch (error) {
    console.error('디스플레이 정보 로드 실패:', error)
  }
}

// 초기화
async function init() {
  currentDisplay = getDisplayTypeFromHash()
  setupEventListeners()
  renderDisplay()
  await loadDisplayInfo()
  
  // DOM이 완전히 렌더링된 후 MultiMonitorManager 초기화
  setTimeout(async () => {
    try {
      console.log('🔧 [DEBUG] MultiMonitorManager 초기화 시작, currentDisplay:', currentDisplay)
      
      // workout 디스플레이인 경우 컨테이너 확인
      if (currentDisplay === 'workout') {
        const container = document.getElementById('workout-video-container')
        console.log('🔧 [DEBUG] workout-video-container 존재:', !!container)
      }
      
      // MultiMonitorManager 클래스를 동적으로 로드
      const { MultiMonitorManager } = await import('./components/MultiMonitorManager.js')
      window.multiMonitorManager = new MultiMonitorManager(currentDisplay)
      console.log('✅ [DEBUG] MultiMonitorManager 초기화 완료')
      
      // workout 디스플레이인 경우 자동으로 Vimeo 비디오 로드
      if (currentDisplay === 'workout') {
        console.log('🎬 [DEBUG] workout 디스플레이 감지, 추가로 Vimeo 플레이리스트 자동 로드')
        setTimeout(() => {
          console.log('🎬 [DEBUG] 추가 타이머 완료, 플레이리스트 로드 시작')
          loadPlaylist() // Vimeo 플레이리스트 자동 로드
        }, 2000) // 추가 2초 후 로드
      } else {
        console.log('🔧 [DEBUG] 현재 디스플레이가 workout이 아님:', currentDisplay)
      }
    } catch (error) {
      console.error('❌ [DEBUG] MultiMonitorManager 초기화 실패:', error)
    }
  }, 500) // DOM 렌더링 완료 대기
}

// 제어판 UI 업데이트
function updateControlPanel() {
  // 현재 페이지가 제어판인지 확인
  if (currentDisplay !== 'control') return
  
  // 운동 상태 버튼 업데이트
  const startBtn = document.getElementById('start-workout-btn')
  const stopBtn = document.getElementById('stop-workout-btn')
  const statusIndicator = document.querySelector('.status-indicator')
  
  if (startBtn) startBtn.disabled = isWorkoutActive
  if (stopBtn) stopBtn.disabled = !isWorkoutActive
  
  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${isWorkoutActive ? 'status-active' : 'status-inactive'}`
  }
  
  // 플레이리스트 정보 업데이트
  const playlistInfo = document.getElementById('playlist-info')
  if (playlistInfo) {
    playlistInfo.textContent = currentPlaylist ? currentPlaylist.name : '플레이리스트가 선택되지 않았습니다'
  }
  
  console.log('제어판 UI 업데이트 완료')
}

// DOM이 로드되면 초기화
document.addEventListener('DOMContentLoaded', init)

// 심박수 시뮬레이션 (개발/테스트용)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  setInterval(() => {
    const mockHeartRate = 60 + Math.floor(Math.random() * 40) // 60-100 BPM
    if (window.electronAPI) {
      window.electronAPI.updateHeartRate({ heartRate: mockHeartRate })
    }
  }, 5000)
}