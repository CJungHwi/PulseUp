import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { getDevices, getConnectedDevices, type Device } from '@/services/deviceService'
import { useSnackbar } from '@/contexts/SnackbarContext'
import { Monitor, Wifi, WifiOff, Plus, RefreshCw } from 'lucide-react'
import { DeviceRegisterDialog } from './DeviceRegisterDialog'

interface DeviceSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (deviceId: string, displayLabel: string) => void
  selectedDeviceId?: string | null
}

export const DeviceSelectDialog = ({
  open,
  onOpenChange,
  onSelect,
  selectedDeviceId
}: DeviceSelectDialogProps) => {
  const [devices, setDevices] = useState<Device[]>([])
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string>(selectedDeviceId || '')
  const [isLoading, setIsLoading] = useState(false)
  const [showRegisterDialog, setShowRegisterDialog] = useState(false)
  const { showSnackbar } = useSnackbar()

  const loadDevices = async () => {
    setIsLoading(true)
    try {
      const [deviceList, connectedList] = await Promise.all([
        getDevices(),
        getConnectedDevices()
      ])
      
      setDevices(deviceList)
      const nextConnectedDeviceIds = new Set(connectedList.map(d => d.deviceId))
      setConnectedDeviceIds(nextConnectedDeviceIds)

      // 저장된 선택값이 삭제/재등록으로 더 이상 온라인이 아니면 첫 번째 온라인 디바이스로 보정
      if ((!selected || !nextConnectedDeviceIds.has(selected)) && connectedList.length > 0) {
        setSelected(connectedList[0].deviceId)
        return
      }

      if (selected && !nextConnectedDeviceIds.has(selected)) {
        setSelected('')
      }
    } catch (error: any) {
      const message = error?.response?.data?.error || '디바이스 목록을 불러오는데 실패했습니다.'
      showSnackbar({ message, severity: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadDevices()
    }
  }, [open])

  useEffect(() => {
    if (selectedDeviceId) {
      setSelected(selectedDeviceId)
    }
  }, [selectedDeviceId])

  const handleConfirm = () => {
    const device = devices.find(d => d.deviceId === selected)
    if (device) {
      onSelect(device.deviceId, device.displayLabel)
      onOpenChange(false)
    }
  }

  const onlineDevices = devices.filter(d => connectedDeviceIds.has(d.deviceId))
  const offlineDevices = devices.filter(d => !connectedDeviceIds.has(d.deviceId))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 leading-none">
              <Monitor className="w-5 h-5" />
              운동 디바이스 선택
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadDevices}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogHeader>
          <DialogDescription className="px-4 pt-4">
            운동을 실행할 디바이스를 선택하세요.
          </DialogDescription>
          
          <div className="px-4 pb-4 space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                디바이스 목록을 불러오는 중...
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  등록된 디바이스가 없습니다.
                </p>
                <Button onClick={() => setShowRegisterDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  새 디바이스 등록
                </Button>
              </div>
            ) : (
              <RadioGroup value={selected} onValueChange={setSelected}>
                {/* 온라인 디바이스 */}
                {onlineDevices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">온라인</p>
                    {onlineDevices.map((device) => (
                      <div
                        key={device.deviceId}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected === device.deviceId
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50 border-border'
                        }`}
                        onClick={() => setSelected(device.deviceId)}
                      >
                        <RadioGroupItem value={device.deviceId} id={device.deviceId} />
                        <Label
                          htmlFor={device.deviceId}
                          className="flex-1 cursor-pointer flex items-center justify-between"
                        >
                          <span className="font-medium">{device.displayLabel}</span>
                          <Wifi className="w-4 h-4 text-green-500" />
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {/* 오프라인 디바이스 */}
                {offlineDevices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">오프라인</p>
                    {offlineDevices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="flex items-center space-x-3 p-3 rounded-lg border opacity-50 cursor-not-allowed border-border"
                      >
                        <RadioGroupItem value={device.deviceId} id={device.deviceId} disabled />
                        <Label
                          htmlFor={device.deviceId}
                          className="flex-1 flex items-center justify-between text-muted-foreground"
                        >
                          <span>{device.displayLabel}</span>
                          <WifiOff className="w-4 h-4" />
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </RadioGroup>
            )}
          </div>

          <DialogFooter className="px-4 pb-4 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setShowRegisterDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              새 디바이스
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selected || !connectedDeviceIds.has(selected)}
              >
                선택
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeviceRegisterDialog
        open={showRegisterDialog}
        onOpenChange={setShowRegisterDialog}
        onSuccess={loadDevices}
      />
    </>
  )
}

export default DeviceSelectDialog
