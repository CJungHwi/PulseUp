import type { HeartRateReading } from './heart-rate-modules'

export type { HeartRateReading } from './heart-rate-modules'

export interface PersistedElectronConfig {
  webAppUrl?: string
  authToken?: string
  displayLabel?: string
}

export interface WorkoutSessionData {
  id: string
  playlistId: string
  playlistName: string
  startTime: Date
  endTime?: Date
  duration: number
  heartRateData: HeartRateReading[]
  caloriesBurned?: number
  averageHeartRate?: number
  maxHeartRate?: number
  status: 'active' | 'completed' | 'cancelled'
}

export interface PlaylistSyncData {
  id: string
  name: string
  videos: Array<{
    id: string
    title: string
    url: string
    duration: number
    thumbnail?: string
  }>
}

export interface ExerciseSequence {
  id: string
  workout_history_master_id: string
  sequence: number
  round: number
  exercise_type: 'exercise' | 'rest' | 'water' | 'countdown'
  exercise_id?: string
  exercise_name: string
  duration: number
  reps?: number
  position?: string
  video_url?: string
  video_start_time?: number
  video_end_time?: number
  name_ko?: string
  target_muscles?: string
  equipment?: string
  level?: string
  characteristics?: string
  major_category?: string
  major_category_name?: string
  // countdown 시퀀스 전용 (DS→Main, Main→CD 전환 시 삽입)
  preview_sequences?: ExerciseSequence[]
  is_stretching_preview?: boolean
  position_groups?: { [key: string]: ExerciseSequence[] } | null
}

export interface WorkoutPlaySession {
  masterId: string
  userId: string
  sequences: ExerciseSequence[]
  currentSequenceIndex: number
  currentRound: number
  totalRounds: number
  startTime: Date
  elapsedTime: number
  status: 'ready' | 'playing' | 'paused' | 'completed'
  metadata?: {
    workoutCategory?: string
    circuitType?: string
    date?: string
    time?: string
    totalSets?: number
  }
}

export interface ActiveSet {
  left: 'set1' | 'set2'
  right: 'set1' | 'set2'
}
