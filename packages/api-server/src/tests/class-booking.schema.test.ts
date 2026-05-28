import { describe, expect, it } from 'vitest'
import {
  createClassBookingSchema,
  createClassSlotSchema,
  updateAttendanceSchema,
  updateClassBookingSchema,
  updateClassSlotSchema,
} from '../schemas/classBooking.schema.js'

describe('Class Booking Schemas', () => {
  it('validates class slot creation input', () => {
    const result = createClassSlotSchema.safeParse({
      workoutCategoryId: '11111111-1111-1111-1111-111111111111',
      title: '오전 수업',
      startAt: '2026-06-01T09:00:00.000Z',
      endAt: '2026-06-01T10:00:00.000Z',
      capacity: 10,
    })

    expect(result.success).toBe(true)
  })

  it('rejects class slot creation when end time is before start time', () => {
    const result = createClassSlotSchema.safeParse({
      workoutCategoryId: '11111111-1111-1111-1111-111111111111',
      title: '오전 수업',
      startAt: '2026-06-01T10:00:00.000Z',
      endAt: '2026-06-01T09:00:00.000Z',
      capacity: 10,
    })

    expect(result.success).toBe(false)
  })

  it('rejects slot update without editable fields', () => {
    const result = updateClassSlotSchema.safeParse({
      branchId: '1',
    })

    expect(result.success).toBe(false)
  })

  it('validates booking creation and change input', () => {
    const payload = { slotId: '11111111-1111-1111-1111-111111111111' }

    expect(createClassBookingSchema.safeParse(payload).success).toBe(true)
    expect(updateClassBookingSchema.safeParse(payload).success).toBe(true)
  })

  it('accepts attendance status values for update', () => {
    expect(updateAttendanceSchema.safeParse({ status: 'reserved' }).success).toBe(true)
    expect(updateAttendanceSchema.safeParse({ status: 'attended' }).success).toBe(true)
    expect(updateAttendanceSchema.safeParse({ status: 'noshow' }).success).toBe(true)
  })

  it('rejects invalid attendance status values', () => {
    expect(updateAttendanceSchema.safeParse({ status: 'cancelled' }).success).toBe(false)
    expect(updateAttendanceSchema.safeParse({ status: 'unknown' }).success).toBe(false)
    expect(updateAttendanceSchema.safeParse({}).success).toBe(false)
  })
})
