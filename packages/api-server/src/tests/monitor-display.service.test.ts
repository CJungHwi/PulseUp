import { describe, it, expect, vi, beforeEach } from 'vitest'

import { MonitorDisplayService } from '../services/monitorDisplay.service.js'



const callProcedureMock = vi.fn()



vi.mock('../lib/database.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/database.js')>()
  return {
    ...actual,
    callProcedure: (...args: unknown[]) => callProcedureMock(...args),
    executeQuery: vi.fn(),
    executeTransaction: vi.fn()
  }
})



describe('MonitorDisplayService', () => {

  const service = new MonitorDisplayService()



  beforeEach(() => {

    callProcedureMock.mockReset()

  })



  it('resolveDisplayConfig should fallback workout → user → system per field', async () => {

    callProcedureMock.mockImplementation(async (name: string) => {

      if (name === 'sp_GetWorkoutMonitorDisplayImages') {

        return [[

          { image_kind: 'default', side: 'left', image_url: 'workout-left.jpg' },

          { image_kind: 'default', side: 'center', image_url: 'workout-center.jpg' }

        ]]

      }

      if (name === 'sp_GetWorkoutMonitorDisplayText') {

        return [[{ display_text: 'Workout Text' }]]

      }

      if (name === 'sp_GetMonitorDefaultImageProfile') {

        return [[

          { image_kind: 'default', side: 'left', image_url: 'user-left.jpg' },

          { image_kind: 'default', side: 'center', image_url: 'user-center.jpg' },

          { image_kind: 'default', side: 'right', image_url: 'user-right.jpg' }

        ]]

      }

      if (name === 'sp_GetMonitorDisplayTextProfile') {

        return [[{ display_text: 'User Text' }]]

      }

      if (name === 'sp_GetSystemDefaultImages') {

        return [[

          { image_kind: 'default', side: 'left', image_url: 'sys-left.jpg' },

          { image_kind: 'default', side: 'center', image_url: 'sys-center.jpg' },

          { image_kind: 'default', side: 'right', image_url: 'sys-right.jpg' }

        ]]

      }

      if (name === 'sp_GetSystemDisplayText') {

        return [[{ display_text: 'System Text' }]]

      }

      return [[]]

    })



    const resolved = await service.resolveDisplayConfig({

      userId: 'user-1',

      masterId: 'master-1',

      context: 'default'

    })



    expect(resolved.leftImageUrl).toBe('workout-left.jpg')

    expect(resolved.centerImageUrl).toBe('workout-center.jpg')

    expect(resolved.rightImageUrl).toBe('user-right.jpg')

    expect(resolved.displayText).toBe('Workout Text')

  })



  it('resolveDisplayConfig without master should use user profile', async () => {

    callProcedureMock.mockImplementation(async (name: string) => {

      if (name === 'sp_GetMonitorDefaultImageProfile') {

        return [[{ image_kind: 'intro', side: 'center', image_url: 'intro-center.jpg' }]]

      }

      if (name === 'sp_GetMonitorDisplayTextProfile') return [[{ display_text: '' }]]

      if (name === 'sp_GetSystemDefaultImages') return [[]]

      if (name === 'sp_GetSystemDisplayText') return [[{ display_text: 'Fallback' }]]

      return [[]]

    })



    const resolved = await service.resolveDisplayConfig({

      userId: 'user-1',

      context: 'intro'

    })



    expect(resolved.centerImageUrl).toBe('intro-center.jpg')

    expect(resolved.displayText).toBe('Fallback')

  })

})


