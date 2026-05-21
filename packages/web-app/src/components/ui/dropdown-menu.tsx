import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

type DropdownMenuContextValue = {
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggle: () => void
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null)

const useDropdownMenuContext = () => useContext(DropdownMenuContext)

// 간단한 드롭다운 메뉴 구현 (트리거 클릭으로 열기/닫기, 바깥 클릭 시 닫힘)
export const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const toggle = useCallback(() => setIsOpen((o) => !o), [])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const ctx: DropdownMenuContextValue = { isOpen, setIsOpen, toggle }

  return (
    <DropdownMenuContext.Provider value={ctx}>
      <div ref={containerRef} className="relative inline-block text-left">
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            if (child.type === DropdownMenuContent) {
              return React.cloneElement(child, { isOpen })
            }
            return child
          }
          return child
        })}
      </div>
    </DropdownMenuContext.Provider>
  )
}

export interface DropdownMenuTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
}

export const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ className, children, asChild, onClick, ...props }, ref) => {
    const ctx = useDropdownMenuContext()

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      onClick?.(e as React.MouseEvent<HTMLElement>)
      ctx?.toggle()
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        className?: string
        onClick?: React.MouseEventHandler<HTMLElement>
      }>
      return React.cloneElement(child, {
        ref,
        className: cn(child.props.className, className),
        ...props,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          child.props.onClick?.(e)
          onClick?.(e as React.MouseEvent<HTMLElement>)
          ctx?.toggle()
        },
      } as any)
    }

    return (
      <button
        type="button"
        ref={ref as any}
        className={cn('inline-flex justify-center', className)}
        {...(props as any)}
        onClick={handleClick}
      >
        {children}
      </button>
    )
  }
)
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end'; isOpen?: boolean }
>(({ className, align = 'start', isOpen = false, ...props }, ref) => {
  if (!isOpen) return null

  return (
    <div
      className={cn(
        'absolute z-50 pt-2',
        align === 'end' ? 'right-0' : 'left-0'
      )}
    >
      <div
        ref={ref}
        className={cn(
          'min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg',
          className
        )}
        {...props}
      />
    </div>
  )
})
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onClick, ...props }, ref) => {
  const ctx = useDropdownMenuContext()

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e)
    ctx?.setIsOpen(false)
  }

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
})
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'