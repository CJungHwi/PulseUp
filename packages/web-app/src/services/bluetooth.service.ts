import api from './api'

export interface BluetoothDevice {
  id: string
  branch_id: number
  branch_name: string
  device_id: string
  device_name: string
  device_type: string
  manufacturer?: string
  model?: string
  is_active: boolean
  last_connected_at?: string
  last_connected_user_id?: string
  last_connected_user_name?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface RegisterDeviceParams {
  branch_id: number
  device_id: string
  device_name: string
  device_type?: string
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

class BluetoothService {
  async registerDevice(params: RegisterDeviceParams): Promise<BluetoothDevice> {
    const response = await api.post('/bluetooth/devices', params)
    return response.data
  }

  async getDevices(is_active?: boolean): Promise<BluetoothDevice[]> {
    const params = is_active !== undefined ? { is_active } : {}
    const response = await api.get('/bluetooth/devices', { params })
    return response.data
  }

  async deleteDevices(device_ids: string[]): Promise<{ deleted_count: number; status: string }> {
    const response = await api.delete('/bluetooth/devices', { data: { device_ids } })
    return response.data
  }

  async updateDeviceConnection(device_id: string): Promise<{ affected_rows: number; status: string }> {
    const response = await api.patch(`/bluetooth/devices/${device_id}/connection`)
    return response.data
  }
}

export default new BluetoothService()

