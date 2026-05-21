import { pool as db } from '../lib/database.js'

interface RegisterDeviceParams {
  branch_id: number
  device_id: string
  device_name: string
  device_type?: string
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export class BluetoothService {
  async registerDevice(params: RegisterDeviceParams) {
    const { branch_id, device_id, device_name, device_type, manufacturer, model, notes } = params

    const [result] = await db.execute(
      'CALL sp_RegisterBluetoothDevice(?, ?, ?, ?, ?, ?, ?)',
      [
        branch_id,
        device_id,
        device_name,
        device_type || 'heart_rate',
        manufacturer || null,
        model || null,
        notes || null
      ]
    )

    return (result as any)[0][0]
  }

  async getDevices(branch_id: number | null, is_active: boolean | null) {
    const [result] = await db.execute(
      'CALL sp_GetBluetoothDevices(?, ?)',
      [branch_id, is_active]
    )

    return (result as any)[0]
  }

  async deleteDevices(device_ids: string[]) {
    const deviceIdsStr = device_ids.join(',')

    const [result] = await db.execute(
      'CALL sp_DeleteBluetoothDevices(?)',
      [deviceIdsStr]
    )

    return (result as any)[0][0]
  }

  async updateDeviceConnection(device_id: string, user_id: string) {
    const [result] = await db.execute(
      'CALL sp_UpdateBluetoothDeviceConnection(?, ?)',
      [device_id, user_id]
    )

    return (result as any)[0][0]
  }
}

