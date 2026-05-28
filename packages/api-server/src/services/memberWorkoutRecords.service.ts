import { pool } from '../lib/database.js'

type BookingStatus = 'reserved' | 'cancelled' | 'attended' | 'noshow'

interface BookingRow {
  id: string
  slot_id: string
  status: BookingStatus
  reserved_at: Date | string
  cancelled_at?: Date | string | null
  title: string
  start_at: Date | string
  end_at: Date | string
  major_category?: string | null
  major_category_name?: string | null
}

interface WorkoutDayRow {
  id: string
  workout_date: Date | string
  workout_time: string
  method_type: string
  method_name: string
  memo: string
  workout_categories_id: string
  category_name?: string | null
  total_seconds?: number | string | null
  exercise_count?: number | string | null
  exercise_names?: string | null
  avg_heart_rate?: number | string | null
  max_heart_rate?: number | string | null
  min_heart_rate?: number | string | null
  heart_rate_readings?: number | string | null
}

interface HeartRateRow {
  id: string
  device_id: string
  device_name?: string | null
  timestamp: Date | string
  heart_rate: number
  zone?: string | null
}

const toNumber = (value: unknown, fallback = 0) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const formatDateValue = (value: Date | string | null | undefined) => {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

const getMonthRange = (month?: string) => {
  const baseMonth = month || new Date().toISOString().slice(0, 7)
  const [year, monthNumber] = baseMonth.split('-').map(Number)
  const start = `${baseMonth}-01`
  const endDate = new Date(year, monthNumber, 1)
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`

  return { month: baseMonth, start, end }
}

const getInbodyOverview = async (userId: string) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        id,
        measured_at,
        height_cm,
        weight_kg,
        skeletal_muscle_mass,
        body_fat_percentage,
        bmi,
        memo
      FROM inbody_measurements
      WHERE user_id = ?
      ORDER BY measured_at DESC, created_at DESC
      LIMIT 1`,
      [userId]
    )
    const latest = Array.isArray(rows) ? (rows as any[])[0] : null

    if (!latest) {
      return { status: 'empty', latest: null }
    }

    return {
      status: 'ready',
      latest: {
        id: latest.id,
        measured_at: formatDateValue(latest.measured_at),
        height_cm: latest.height_cm == null ? null : toNumber(latest.height_cm),
        weight_kg: latest.weight_kg == null ? null : toNumber(latest.weight_kg),
        skeletal_muscle_mass: latest.skeletal_muscle_mass == null ? null : toNumber(latest.skeletal_muscle_mass),
        body_fat_percentage: latest.body_fat_percentage == null ? null : toNumber(latest.body_fat_percentage),
        bmi: latest.bmi == null ? null : toNumber(latest.bmi),
        memo: latest.memo || '',
      },
    }
  } catch (error: any) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return { status: 'pending_schema', latest: null }
    }
    throw error
  }
}

const buildSummary = (bookings: BookingRow[], workoutDays: WorkoutDayRow[]) => {
  const bookingCounts = bookings.reduce(
    (acc, booking) => {
      acc[booking.status] += 1
      return acc
    },
    { reserved: 0, cancelled: 0, attended: 0, noshow: 0 } satisfies Record<BookingStatus, number>
  )

  const completedClassCount = bookingCounts.attended + bookingCounts.noshow
  const attendanceRate = completedClassCount > 0
    ? Math.round((bookingCounts.attended / completedClassCount) * 100)
    : 0

  const totalWorkoutSeconds = workoutDays.reduce(
    (sum, workout) => sum + toNumber(workout.total_seconds),
    0
  )
  const heartRateTotals = workoutDays.reduce(
    (acc, workout) => {
      const readings = toNumber(workout.heart_rate_readings)
      const avg = toNumber(workout.avg_heart_rate)
      if (readings > 0 && avg > 0) {
        acc.weightedTotal += avg * readings
        acc.readings += readings
      }
      acc.max = Math.max(acc.max, toNumber(workout.max_heart_rate))
      return acc
    },
    { weightedTotal: 0, readings: 0, max: 0 }
  )

  return {
    workout_days: workoutDays.length,
    total_workout_minutes: Math.round(totalWorkoutSeconds / 60),
    booked_classes: bookings.length,
    attended_classes: bookingCounts.attended,
    noshow_classes: bookingCounts.noshow,
    cancelled_classes: bookingCounts.cancelled,
    reserved_classes: bookingCounts.reserved,
    attendance_rate: attendanceRate,
    avg_heart_rate: heartRateTotals.readings > 0
      ? Math.round(heartRateTotals.weightedTotal / heartRateTotals.readings)
      : 0,
    max_heart_rate: heartRateTotals.max,
  }
}

export class MemberWorkoutRecordsService {
  static async getOverview(userId: string, month?: string) {
    const range = getMonthRange(month)
    const [bookingRows, workoutRows, inbody] = await Promise.all([
      this.getMonthlyBookings(userId, range.start, range.end),
      this.getMonthlyWorkoutDays(userId, range.start, range.end),
      getInbodyOverview(userId),
    ])

    const bookings = bookingRows.map((booking) => ({
      id: booking.id,
      slot_id: booking.slot_id,
      status: booking.status,
      reserved_at: formatDateValue(booking.reserved_at),
      cancelled_at: formatDateValue(booking.cancelled_at),
      title: booking.title,
      start_at: formatDateValue(booking.start_at),
      end_at: formatDateValue(booking.end_at),
      major_category: booking.major_category || '',
      major_category_name: booking.major_category_name || booking.major_category || '',
    }))

    const workoutDays = workoutRows.map((workout) => ({
      id: workout.id,
      workout_date: formatDateValue(workout.workout_date).slice(0, 10),
      workout_time: workout.workout_time || '00',
      method_type: workout.method_type || '',
      method_name: workout.method_name || '',
      memo: workout.memo || '',
      workout_categories_id: workout.workout_categories_id || '',
      category_name: workout.category_name || workout.workout_categories_id || '-',
      total_seconds: toNumber(workout.total_seconds),
      total_minutes: Math.round(toNumber(workout.total_seconds) / 60),
      exercise_count: toNumber(workout.exercise_count),
      exercise_names: workout.exercise_names || '',
      avg_heart_rate: Math.round(toNumber(workout.avg_heart_rate)),
      max_heart_rate: toNumber(workout.max_heart_rate),
      min_heart_rate: toNumber(workout.min_heart_rate),
      heart_rate_readings: toNumber(workout.heart_rate_readings),
    }))

    return {
      month: range.month,
      summary: buildSummary(bookingRows, workoutRows),
      bookings,
      workoutDays,
      inbody,
    }
  }

  static async getWorkoutHeartRate(userId: string, workoutHistoryMasterId: string) {
    const [masterRows] = await pool.execute(
      `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as workout_date, method_name
      FROM workout_history_master
      WHERE id = ? AND user_id = ?
      LIMIT 1`,
      [workoutHistoryMasterId, userId]
    )
    const master = Array.isArray(masterRows) ? (masterRows as any[])[0] : null
    if (!master) return null

    const [rows] = await pool.execute(
      `SELECT
        id,
        device_id,
        device_name,
        timestamp,
        heart_rate,
        zone
      FROM heart_rate_data
      WHERE user_id = ? AND workout_history_master_id = ?
      ORDER BY timestamp ASC`,
      [userId, workoutHistoryMasterId]
    )

    const rawSeries = Array.isArray(rows) ? rows as HeartRateRow[] : []
    const firstTimestamp = rawSeries.length > 0
      ? new Date(rawSeries[0].timestamp).getTime()
      : 0
    const series = rawSeries.map((item) => {
      const currentTimestamp = new Date(item.timestamp).getTime()
      const elapsedSeconds = firstTimestamp > 0 && Number.isFinite(currentTimestamp)
        ? Math.max(0, Math.round((currentTimestamp - firstTimestamp) / 1000))
        : 0

      return {
        id: item.id,
        device_id: item.device_id,
        device_name: item.device_name || '',
        timestamp: formatDateValue(item.timestamp),
        elapsed_seconds: elapsedSeconds,
        elapsed_label: `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`,
        heart_rate: toNumber(item.heart_rate),
        zone: item.zone || 'rest',
      }
    })

    const stats = series.reduce(
      (acc, item) => {
        acc.total += item.heart_rate
        acc.max = Math.max(acc.max, item.heart_rate)
        acc.min = acc.min === 0 ? item.heart_rate : Math.min(acc.min, item.heart_rate)
        acc.zone_counts[item.zone] = (acc.zone_counts[item.zone] || 0) + 1
        return acc
      },
      { total: 0, max: 0, min: 0, zone_counts: {} as Record<string, number> }
    )

    return {
      workout: {
        id: master.id,
        workout_date: master.workout_date,
        method_name: master.method_name || '',
      },
      stats: {
        readings: series.length,
        avg_heart_rate: series.length > 0 ? Math.round(stats.total / series.length) : 0,
        max_heart_rate: stats.max,
        min_heart_rate: stats.min,
        zone_counts: stats.zone_counts,
      },
      series,
    }
  }

  private static async getMonthlyBookings(userId: string, start: string, end: string) {
    const [rows] = await pool.execute(
      `SELECT
        cb.id,
        cb.slot_id,
        cb.status,
        cb.reserved_at,
        cb.cancelled_at,
        cs.title,
        cs.start_at,
        cs.end_at,
        wc.major_category,
        wc.major_category_name
      FROM class_bookings cb
      INNER JOIN class_slots cs ON cs.id = cb.slot_id
      LEFT JOIN workout_categories wc ON wc.id = cs.workout_category_id
      WHERE cb.user_id = ?
        AND cs.start_at >= ?
        AND cs.start_at < ?
      ORDER BY cs.start_at DESC`,
      [userId, start, end]
    )
    return Array.isArray(rows) ? rows as BookingRow[] : []
  }

  private static async getMonthlyWorkoutDays(userId: string, start: string, end: string) {
    const [rows] = await pool.execute(
      `SELECT
        whm.id,
        whm.date as workout_date,
        whm.time as workout_time,
        whm.method_type,
        whm.method_name,
        whm.memo,
        whm.workout_categories_id,
        COALESCE(MAX(wc.major_category_name), whm.workout_categories_id) as category_name,
        COALESCE(MAX(workout_detail.total_seconds), 0) as total_seconds,
        COALESCE(MAX(workout_detail.exercise_count), 0) as exercise_count,
        COALESCE(MAX(workout_detail.exercise_names), '') as exercise_names,
        ROUND(AVG(hrd.heart_rate), 1) as avg_heart_rate,
        MAX(hrd.heart_rate) as max_heart_rate,
        MIN(hrd.heart_rate) as min_heart_rate,
        COUNT(hrd.id) as heart_rate_readings
      FROM workout_history_master whm
      LEFT JOIN (
        SELECT
          whd.workout_history_master_id,
          SUM(COALESCE(whd.duration, 0)) as total_seconds,
          COUNT(DISTINCT whd.exercises_id) as exercise_count,
          GROUP_CONCAT(DISTINCT e.name_ko ORDER BY e.name_ko SEPARATOR ', ') as exercise_names
        FROM workout_history_detail whd
        LEFT JOIN exercises e ON e.id = whd.exercises_id
        GROUP BY whd.workout_history_master_id
      ) workout_detail ON workout_detail.workout_history_master_id = whm.id
      LEFT JOIN workout_categories wc
        ON wc.major_category = whm.workout_categories_id
        OR wc.id = whm.workout_categories_id
      LEFT JOIN heart_rate_data hrd
        ON hrd.workout_history_master_id = whm.id
        AND hrd.user_id = whm.user_id
      WHERE whm.user_id = ?
        AND whm.date >= ?
        AND whm.date < ?
      GROUP BY
        whm.id,
        whm.date,
        whm.time,
        whm.method_type,
        whm.method_name,
        whm.memo,
        whm.workout_categories_id
      ORDER BY whm.date DESC, whm.time DESC`,
      [userId, start, end]
    )
    return Array.isArray(rows) ? rows as WorkoutDayRow[] : []
  }
}
