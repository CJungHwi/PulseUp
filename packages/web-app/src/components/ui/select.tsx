import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface SelectContextValue {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  registerItem: (value: string, label: string) => void
  unregisterItem: (value: string) => void
  getLabel: (value: string) => string | undefined
  labels?: Record<string, string>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext(componentName: string) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error(`${componentName}는 <Select> 내부에서만 사용할 수 있습니다.`)
  return ctx
}

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T) => {
    refs.forEach(ref => {
      if (!ref) return
      if (typeof ref === "function") ref(node)
      else (ref as React.MutableRefObject<T | null>).current = node
    })
  }
}

export const Select: React.FC<{
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  labels?: Record<string, string>
  children: React.ReactNode
}> = ({ value, onValueChange, disabled, labels, children }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [itemsByValue, setItemsByValue] = React.useState<Record<string, string>>({})

  const registerItem = React.useCallback((nextValue: string, label: string) => {
    setItemsByValue(prev => (prev[nextValue] === label ? prev : { ...prev, [nextValue]: label }))
  }, [])

  const unregisterItem = React.useCallback((nextValue: string) => {
    setItemsByValue(prev => {
      if (!(nextValue in prev)) return prev
      const { [nextValue]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const getLabel = React.useCallback(
    (nextValue: string) => itemsByValue[nextValue],
    [itemsByValue]
  )

  const ctxValue = React.useMemo<SelectContextValue>(
    () => ({
      value,
      onValueChange,
      disabled,
      isOpen,
      setIsOpen,
      registerItem,
      unregisterItem,
      getLabel,
      labels,
    }),
    [value, onValueChange, disabled, isOpen, registerItem, unregisterItem, getLabel, labels]
  )

  return (
    <SelectContext.Provider value={ctxValue}>
      <Popover
        open={isOpen}
        onOpenChange={nextOpen => {
          if (disabled) return
          setIsOpen(nextOpen)
        }}
      >
        {children}
      </Popover>
    </SelectContext.Provider>
  )
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, disabled, ...props }, ref) => {
  const { disabled: isSelectDisabled } = useSelectContext("SelectTrigger")

  return (
    <PopoverTrigger asChild>
      <button
        ref={ref}
        type="button"
        disabled={Boolean(disabled ?? isSelectDisabled)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="min-w-0 flex-1 text-left">{children}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
      </button>
    </PopoverTrigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

export const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
  const { value, getLabel, labels } = useSelectContext("SelectValue")
  const displayText = value ? (labels?.[value] ?? getLabel(value) ?? value) : placeholder

  return (
    <span ref={ref} className={cn("block truncate", className)} {...props}>
      {displayText}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PopoverContent>
>(({ className, children, align = "start", sideOffset = 6, ...props }, ref) => {
  const { disabled } = useSelectContext("SelectContent")

  if (disabled) return null

  return (
    <PopoverContent
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-[var(--radix-popover-trigger-width)] min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
        "max-h-[280px] overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </PopoverContent>
  )
})
SelectContent.displayName = "SelectContent"

export const SelectItem = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> & { value: string }
>(({ className, children, value, onClick, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLButtonElement>(null)
  const { value: selectedValue, onValueChange, setIsOpen, registerItem } =
    useSelectContext("SelectItem")

  React.useLayoutEffect(() => {
    const label = innerRef.current?.textContent?.trim()
    if (label) registerItem(value, label)
  }, [value, registerItem])

  const isSelected = selectedValue === value

  return (
    <button
      ref={composeRefs(forwardedRef, innerRef)}
      type="button"
      role="option"
      aria-selected={isSelected}
      className={cn(
        "relative flex w-full select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className
      )}
      onClick={e => {
        onClick?.(e)
        if (e.defaultPrevented) return
        onValueChange?.(value)
        setIsOpen(false)
      }}
      {...props}
    >
      {children}
    </button>
  )
})
SelectItem.displayName = "SelectItem"