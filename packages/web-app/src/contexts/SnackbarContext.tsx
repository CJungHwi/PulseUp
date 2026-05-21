import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Alert, Snackbar } from '@mui/material'

export interface SnackbarOptions {
  message: string
  severity?: 'success' | 'info' | 'warning' | 'error'
  autoHideDuration?: number
}

interface SnackbarContextValue {
  showSnackbar: (options: SnackbarOptions) => void
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null)

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<NonNullable<SnackbarOptions['severity']>>('info')
  const [autoHideDuration, setAutoHideDuration] = useState<number>(2500)

  const showSnackbar = useCallback((options: SnackbarOptions) => {
    setMessage(options.message)
    setSeverity(options.severity ?? 'info')
    setAutoHideDuration(options.autoHideDuration ?? (options.severity === 'error' ? 4500 : 2500))
    setOpen(true)
  }, [])

  const value = useMemo<SnackbarContextValue>(() => ({ showSnackbar }), [showSnackbar])

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={autoHideDuration}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return
          setOpen(false)
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          position: 'fixed !important',
          top: '24px !important',
          left: '50% !important',
          transform: 'translateX(-50%) !important',
          right: 'auto !important',
          bottom: 'auto !important',
          zIndex: 9999,
          '&.MuiSnackbar-root': {
            top: '24px !important',
            left: '50% !important',
            transform: 'translateX(-50%) !important',
            right: 'auto !important',
            bottom: 'auto !important'
          }
        }}
      >
        <Alert
          severity={severity}
          variant="filled"
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
          onClose={() => setOpen(false)}
        >
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  )
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider')
  return ctx
}


