/**
 * MenuTree — 재귀 메뉴 트리 컴포넌트
 *
 * 기능: 메뉴 노드 확장/축소, 선택, 이름 편집, 순서 이동(↑/↓), 활성/비활성 토글 표시
 *
 * Props:
 * - items, selectedId, expandedIds
 * - onSelect, onToggleExpand, onUpdateName, onToggleActive, onReorder
 *
 * 사용처: `MenuManagerTabPanel.tsx`
 */
import React, { useState } from 'react'
import {
    ChevronRight,
    ChevronDown,
    Folder,
    FileText,
    Edit2,
    ArrowUp,
    ArrowDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuTreeItem } from '@/types/menu.types'

interface MenuTreeProps {
    items: MenuTreeItem[]
    selectedId: string | null
    onSelect: (node: MenuTreeItem) => void
    onToggleExpand: (id: string) => void
    expandedIds: string[]
    onUpdateName: (id: string, newName: string) => void
    onToggleActive?: (id: string, currentActive: boolean) => void
    onReorder?: (itemId: string, direction: 'up' | 'down') => void
    level?: number
}

export const MenuTree: React.FC<MenuTreeProps> = ({
    items,
    selectedId,
    onSelect,
    onToggleExpand,
    expandedIds,
    onUpdateName,
    onToggleActive,
    onReorder,
    level = 0
}) => {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')

    const handleStartEdit = (e: React.MouseEvent, node: MenuTreeItem) => {
        e.stopPropagation()
        setEditingId(node.id)
        setEditingName(node.name)
    }

    const handleSaveEdit = (id: string) => {
        if (editingName.trim()) {
            onUpdateName(id, editingName.trim())
        }
        setEditingId(null)
    }

    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') handleSaveEdit(id)
        if (e.key === 'Escape') setEditingId(null)
    }

    return (
        <ul className="space-y-0.5">
            {items.map((item, index) => {
                const isExpanded = expandedIds.includes(item.id)
                const isSelected = selectedId === item.id
                const hasChildren = item.children && item.children.length > 0

                return (
                    <li key={item.id}>
                        <div
                            className={cn(
                                "flex items-center py-1.5 px-2 rounded-md cursor-pointer transition-all duration-200 group border border-transparent mb-0.5",
                                isSelected ? "bg-primary/10 text-primary border-primary/20" : "hover:bg-muted/50 hover:border-[#343637] dark:hover:border-[#6b7280]",
                                level > 0 && "ml-2"
                            )}
                            onClick={() => onSelect(item)}
                            style={{ paddingLeft: `${level * 16 + 8}px` }}
                        >
                            {hasChildren ? (
                                <div
                                    className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors mr-1"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleExpand(item.id)
                                    }}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4" />
                                    )}
                                </div>
                            ) : (
                                <div className="w-5" />
                            )}

                            {item.menu_type === 'folder' ? (
                                <Folder className={cn("h-4 w-4 mr-2", isSelected ? "text-primary" : "text-amber-500")} />
                            ) : (
                                <FileText className={cn("h-4 w-4 mr-2", isSelected ? "text-primary" : "text-blue-500")} />
                            )}

                            <div className="flex-1 min-w-0">
                                {editingId === item.id ? (
                                    <Input
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => handleSaveEdit(item.id)}
                                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                                        className="h-7 text-xs py-0 px-2 border-primary/30 bg-background focus-visible:ring-1"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex items-center justify-between group/item">
                                        <span className={cn(
                                            "truncate text-xs font-medium transition-colors",
                                            isSelected ? "text-primary font-semibold" : "text-foreground group-hover:text-blue-600 dark:group-hover:text-yellow-400 group-hover:font-bold"
                                        )}>
                                            {item.name}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                            {onReorder && index > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-all hover:bg-primary/10 rounded-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onReorder(item.id, 'up')
                                                    }}
                                                    aria-label="위로 이동"
                                                >
                                                    <ArrowUp className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            )}
                                            {onReorder && index < items.length - 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-all hover:bg-primary/10 rounded-md"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onReorder(item.id, 'down')
                                                    }}
                                                    aria-label="아래로 이동"
                                                >
                                                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover/item:opacity-100 transition-all hover:bg-primary/10 rounded-md"
                                                onClick={(e) => handleStartEdit(e, item)}
                                            >
                                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {onToggleActive && (
                                <div
                                    className={cn(
                                        "ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors border",
                                        item.is_active
                                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                                            : "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20"
                                    )}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleActive(item.id, !!item.is_active)
                                    }}
                                >
                                    {item.is_active ? '활성' : '비활성'}
                                </div>
                            )}
                        </div>

                        {hasChildren && isExpanded && (
                            <MenuTree
                                items={item.children!}
                                selectedId={selectedId}
                                onSelect={onSelect}
                                onToggleExpand={onToggleExpand}
                                expandedIds={expandedIds}
                                onUpdateName={onUpdateName}
                                onToggleActive={onToggleActive}
                                onReorder={onReorder}
                                level={level + 1}
                            />
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
