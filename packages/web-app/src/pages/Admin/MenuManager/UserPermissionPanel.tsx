import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserInfo } from '../../../types/userManager'
import { UserMenuItem } from '../../../services/menuApi'
import { cn } from '@/lib/utils'
import { Save, Plus } from 'lucide-react'

interface UserPermissionPanelProps {
    selectedUser: UserInfo | null
    userMenuItems: UserMenuItem[]
    onAddSelectedMenu: () => void
    onSave: () => void
    onTogglePermission: (itemId: string, checked: boolean) => void
    selectedMenuNodeId: string | null
    isAdminPanel?: boolean
}

export const UserPermissionPanel: React.FC<UserPermissionPanelProps> = ({
    selectedUser,
    userMenuItems,
    onAddSelectedMenu,
    onSave,
    onTogglePermission,
    selectedMenuNodeId,
    isAdminPanel = false
}) => {
    const userTypeLabel = isAdminPanel ? '관리자' : '사용자'

    if (!selectedUser) {
        return (
            <div className="flex-1 flex items-center justify-center border border-[#343637] dark:border-[#6b7280] rounded-lg bg-muted/10 text-muted-foreground h-full shadow-md">
                {userTypeLabel}를 선택해주세요
            </div>
        )
    }

    return (
        <div className="flex gap-[3px] h-full">
            {/* 좌측: 사용자 정보 */}
            <Card className="flex-1 flex flex-col min-w-0 shadow-md border-[#343637] dark:border-[#6b7280] bg-card overflow-hidden">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                        {userTypeLabel} 정보
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4 overflow-auto">
                    <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">아이디</Label>
                        <Input
                            value={(selectedUser as any).userid || selectedUser.id || ''}
                            readOnly
                            className="h-9 bg-muted/30 border-[#343637] dark:border-[#6b7280] text-xs"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">이름</Label>
                            <Input
                                value={selectedUser.name}
                                readOnly
                                className="h-9 bg-muted/30 border-[#343637] dark:border-[#6b7280] text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">이메일</Label>
                            <Input
                                value={selectedUser.email || ''}
                                readOnly
                                className="h-9 bg-muted/30 border-[#343637] dark:border-[#6b7280] text-xs"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">역할</Label>
                            <Select value={selectedUser.role} disabled>
                                <SelectTrigger className="h-9 bg-muted/30 border-[#343637] dark:border-[#6b7280] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">일반 사용자</SelectItem>
                                    <SelectItem value="admin">관리자</SelectItem>
                                    <SelectItem value="super_admin">슈퍼 관리자</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">지점</Label>
                            <Input
                                value={(selectedUser as any).branch_name || (selectedUser as any).branchName || ''}
                                readOnly
                                className="h-9 bg-muted/30 border-[#343637] dark:border-[#6b7280] text-xs"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 우측: 메뉴 권한 */}
            <Card className="flex-1 flex flex-col min-w-0 shadow-md border-[#343637] dark:border-[#6b7280] bg-card overflow-hidden">
                <CardHeader className="h-12 px-4 py-0 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 leading-none">
                        메뉴 권한
                    </CardTitle>
                    <div className="flex gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs border-[#343637] dark:border-[#6b7280]"
                            onClick={onAddSelectedMenu}
                            disabled={!selectedMenuNodeId}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            선택 추가
                        </Button>
                        <Button
                            size="sm"
                            className="h-9 text-xs"
                            onClick={onSave}
                        >
                            <Save className="h-4 w-4 mr-1" />
                            저장
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    {userMenuItems.length > 0 ? (
                        <div className="h-full overflow-y-auto p-2 space-y-1">
                            {userMenuItems
                                .filter(item => item.menu_path) // page 타입만 필터링
                                .map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "flex items-center p-2 rounded-md border border-[#343637] dark:border-[#6b7280] cursor-pointer transition-all duration-200 shadow-sm",
                                            "hover:bg-muted/50 hover:border-primary/50 group",
                                            item.is_enabled ? "bg-card" : "bg-muted/20 opacity-70"
                                        )}
                                        onClick={() => onTogglePermission(item.id, !item.is_enabled)}
                                    >
                                        <Badge
                                            variant={item.is_enabled ? "default" : "secondary"}
                                            className={cn(
                                                "mr-3 w-14 justify-center text-[10px] h-5",
                                                !item.is_enabled && "text-muted-foreground"
                                            )}
                                        >
                                            {item.is_enabled ? '활성' : '비활성'}
                                        </Badge>
                                        <span className="text-sm font-medium flex-1">{item.menu_name}</span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                            <p className="text-sm mb-1">할당된 메뉴가 없습니다.</p>
                            <p className="text-xs opacity-70">사용자 등록 시 기본 메뉴가 자동으로 할당됩니다.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
