import { createTheme, Theme } from '@mui/material/styles';
import { designTokens, ThemeMode } from './designTokens';

// Custom 속성을 MUI 테마에 추가하기 위한 타입 확장
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      selectionBg: string;
      scrim: string;
      focusRing: {
        color: string;
        width: number;
      };
      elevationShadow?: string;
      popoverShadow?: string;
    };
  }

  interface ThemeOptions {
    custom?: {
      selectionBg?: string;
      scrim?: string;
      focusRing?: {
        color?: string;
        width?: number;
      };
      elevationShadow?: string;
      popoverShadow?: string;
    };
  }
}

/**
 * 디자인 토큰을 기반으로 MUI 테마를 생성하는 함수
 */
export const createMuiTheme = (mode: ThemeMode): Theme => {
  // 안전한 모드 확인
  const safeMode = (mode === 'light' || mode === 'dark') ? mode : 'light';
  const tokens = designTokens.mui[safeMode];

  // console.log('🔧 createMuiTheme 호출:', {
  //   mode,
  //   safeMode,
  //   tokensExists: !!tokens,
  //   paletteExists: !!tokens?.palette,
  //   backgroundColors: tokens?.palette?.background,
  //   textColors: tokens?.palette?.text
  // });

  if (!tokens || !tokens.palette) {
    console.error('테마 토큰을 찾을 수 없습니다:', { mode, safeMode, tokens });
    // 기본 테마 반환
    return createTheme({
      palette: {
        mode: 'light',
      }
    });
  }

  const theme = createTheme({
    palette: tokens.palette,
    custom: tokens.custom,
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        lineHeight: 1.2,
      },
      h2: {
        fontWeight: 700,
        fontSize: '2rem',
        lineHeight: 1.3,
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem',
        lineHeight: 1.3,
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem',
        lineHeight: 1.4,
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.25rem',
        lineHeight: 1.4,
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.43,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.66,
      },
      overline: {
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 2.66,
        textTransform: 'uppercase',
      },
    },
    shape: {
      borderRadius: 8,
    },
    shadows: safeMode === 'light' ? [
      'none',
      '0px 1px 3px 0px rgba(0,0,0,0.12), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 2px 1px -1px rgba(0,0,0,0.20)',
      '0px 1px 5px 0px rgba(0,0,0,0.12), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 3px 1px -2px rgba(0,0,0,0.20)',
      '0px 1px 8px 0px rgba(0,0,0,0.12), 0px 3px 4px 0px rgba(0,0,0,0.14), 0px 3px 3px -2px rgba(0,0,0,0.20)',
      '0px 2px 4px -1px rgba(0,0,0,0.20), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
      '0px 3px 5px -1px rgba(0,0,0,0.20), 0px 5px 8px 0px rgba(0,0,0,0.14), 0px 1px 14px 0px rgba(0,0,0,0.12)',
      '0px 3px 5px -1px rgba(0,0,0,0.20), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
      '0px 4px 5px -2px rgba(0,0,0,0.20), 0px 7px 10px 1px rgba(0,0,0,0.14), 0px 2px 16px 1px rgba(0,0,0,0.12)',
      '0px 5px 5px -3px rgba(0,0,0,0.20), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
      '0px 5px 6px -3px rgba(0,0,0,0.20), 0px 9px 12px 1px rgba(0,0,0,0.14), 0px 3px 16px 2px rgba(0,0,0,0.12)',
      '0px 6px 6px -3px rgba(0,0,0,0.20), 0px 10px 14px 1px rgba(0,0,0,0.14), 0px 4px 18px 3px rgba(0,0,0,0.12)',
      '0px 6px 7px -4px rgba(0,0,0,0.20), 0px 11px 15px 1px rgba(0,0,0,0.14), 0px 4px 20px 3px rgba(0,0,0,0.12)',
      '0px 7px 8px -4px rgba(0,0,0,0.20), 0px 12px 17px 2px rgba(0,0,0,0.14), 0px 5px 22px 4px rgba(0,0,0,0.12)',
      '0px 7px 8px -4px rgba(0,0,0,0.20), 0px 13px 19px 2px rgba(0,0,0,0.14), 0px 5px 24px 4px rgba(0,0,0,0.12)',
      '0px 7px 9px -4px rgba(0,0,0,0.20), 0px 14px 21px 2px rgba(0,0,0,0.14), 0px 5px 26px 4px rgba(0,0,0,0.12)',
      '0px 8px 9px -5px rgba(0,0,0,0.20), 0px 15px 22px 2px rgba(0,0,0,0.14), 0px 6px 28px 5px rgba(0,0,0,0.12)',
      '0px 8px 10px -5px rgba(0,0,0,0.20), 0px 16px 24px 2px rgba(0,0,0,0.14), 0px 6px 30px 5px rgba(0,0,0,0.12)',
      '0px 8px 11px -5px rgba(0,0,0,0.20), 0px 17px 26px 2px rgba(0,0,0,0.14), 0px 6px 32px 5px rgba(0,0,0,0.12)',
      '0px 9px 11px -5px rgba(0,0,0,0.20), 0px 18px 28px 2px rgba(0,0,0,0.14), 0px 7px 34px 6px rgba(0,0,0,0.12)',
      '0px 9px 12px -6px rgba(0,0,0,0.20), 0px 19px 29px 2px rgba(0,0,0,0.14), 0px 7px 36px 6px rgba(0,0,0,0.12)',
      '0px 10px 13px -6px rgba(0,0,0,0.20), 0px 20px 31px 3px rgba(0,0,0,0.14), 0px 8px 38px 7px rgba(0,0,0,0.12)',
      '0px 10px 13px -6px rgba(0,0,0,0.20), 0px 21px 33px 3px rgba(0,0,0,0.14), 0px 8px 40px 7px rgba(0,0,0,0.12)',
      '0px 10px 14px -6px rgba(0,0,0,0.20), 0px 22px 35px 3px rgba(0,0,0,0.14), 0px 8px 42px 7px rgba(0,0,0,0.12)',
      '0px 11px 14px -7px rgba(0,0,0,0.20), 0px 23px 36px 3px rgba(0,0,0,0.14), 0px 9px 44px 8px rgba(0,0,0,0.12)',
      '0px 11px 15px -7px rgba(0,0,0,0.20), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)',
    ] : [
      'none',
      '0px 1px 3px 0px rgba(0,0,0,0.20), 0px 1px 1px 0px rgba(0,0,0,0.24), 0px 2px 1px -1px rgba(0,0,0,0.32)',
      '0px 1px 5px 0px rgba(0,0,0,0.20), 0px 2px 2px 0px rgba(0,0,0,0.24), 0px 3px 1px -2px rgba(0,0,0,0.32)',
      '0px 1px 8px 0px rgba(0,0,0,0.20), 0px 3px 4px 0px rgba(0,0,0,0.24), 0px 3px 3px -2px rgba(0,0,0,0.32)',
      '0px 2px 4px -1px rgba(0,0,0,0.32), 0px 4px 5px 0px rgba(0,0,0,0.24), 0px 1px 10px 0px rgba(0,0,0,0.20)',
      '0px 3px 5px -1px rgba(0,0,0,0.32), 0px 5px 8px 0px rgba(0,0,0,0.24), 0px 1px 14px 0px rgba(0,0,0,0.20)',
      '0px 3px 5px -1px rgba(0,0,0,0.32), 0px 6px 10px 0px rgba(0,0,0,0.24), 0px 1px 18px 0px rgba(0,0,0,0.20)',
      '0px 4px 5px -2px rgba(0,0,0,0.32), 0px 7px 10px 1px rgba(0,0,0,0.24), 0px 2px 16px 1px rgba(0,0,0,0.20)',
      '0px 5px 5px -3px rgba(0,0,0,0.32), 0px 8px 10px 1px rgba(0,0,0,0.24), 0px 3px 14px 2px rgba(0,0,0,0.20)',
      '0px 5px 6px -3px rgba(0,0,0,0.32), 0px 9px 12px 1px rgba(0,0,0,0.24), 0px 3px 16px 2px rgba(0,0,0,0.20)',
      '0px 6px 6px -3px rgba(0,0,0,0.32), 0px 10px 14px 1px rgba(0,0,0,0.24), 0px 4px 18px 3px rgba(0,0,0,0.20)',
      '0px 6px 7px -4px rgba(0,0,0,0.32), 0px 11px 15px 1px rgba(0,0,0,0.24), 0px 4px 20px 3px rgba(0,0,0,0.20)',
      '0px 7px 8px -4px rgba(0,0,0,0.32), 0px 12px 17px 2px rgba(0,0,0,0.24), 0px 5px 22px 4px rgba(0,0,0,0.20)',
      '0px 7px 8px -4px rgba(0,0,0,0.32), 0px 13px 19px 2px rgba(0,0,0,0.24), 0px 5px 24px 4px rgba(0,0,0,0.20)',
      '0px 7px 9px -4px rgba(0,0,0,0.32), 0px 14px 21px 2px rgba(0,0,0,0.24), 0px 5px 26px 4px rgba(0,0,0,0.20)',
      '0px 8px 9px -5px rgba(0,0,0,0.32), 0px 15px 22px 2px rgba(0,0,0,0.24), 0px 6px 28px 5px rgba(0,0,0,0.20)',
      '0px 8px 10px -5px rgba(0,0,0,0.32), 0px 16px 24px 2px rgba(0,0,0,0.24), 0px 6px 30px 5px rgba(0,0,0,0.20)',
      '0px 8px 11px -5px rgba(0,0,0,0.32), 0px 17px 26px 2px rgba(0,0,0,0.24), 0px 6px 32px 5px rgba(0,0,0,0.20)',
      '0px 9px 11px -5px rgba(0,0,0,0.32), 0px 18px 28px 2px rgba(0,0,0,0.24), 0px 7px 34px 6px rgba(0,0,0,0.20)',
      '0px 9px 12px -6px rgba(0,0,0,0.32), 0px 19px 29px 2px rgba(0,0,0,0.24), 0px 7px 36px 6px rgba(0,0,0,0.20)',
      '0px 10px 13px -6px rgba(0,0,0,0.32), 0px 20px 31px 3px rgba(0,0,0,0.24), 0px 8px 38px 7px rgba(0,0,0,0.20)',
      '0px 10px 13px -6px rgba(0,0,0,0.32), 0px 21px 33px 3px rgba(0,0,0,0.24), 0px 8px 40px 7px rgba(0,0,0,0.20)',
      '0px 10px 14px -6px rgba(0,0,0,0.32), 0px 22px 35px 3px rgba(0,0,0,0.24), 0px 8px 42px 7px rgba(0,0,0,0.20)',
      '0px 11px 14px -7px rgba(0,0,0,0.32), 0px 23px 36px 3px rgba(0,0,0,0.24), 0px 9px 44px 8px rgba(0,0,0,0.20)',
      '0px 11px 15px -7px rgba(0,0,0,0.32), 0px 24px 38px 3px rgba(0,0,0,0.24), 0px 9px 46px 8px rgba(0,0,0,0.20)',
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: safeMode === 'light' ? '#6E6E6E #E6E6E6' : '#6E6E6E #2A2A2A',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              backgroundColor: safeMode === 'light' ? '#E6E6E6' : '#2A2A2A',
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: '#6E6E6E',
              minHeight: 24,
              border: `2px solid ${safeMode === 'light' ? '#E6E6E6' : '#2A2A2A'}`,
            },
            '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
              backgroundColor: '#545454',
            },
            '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
              backgroundColor: '#545454',
            },
            '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
              backgroundColor: '#545454',
            },
            '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
              backgroundColor: safeMode === 'light' ? '#E6E6E6' : '#2A2A2A',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 500,
            '&:focus-visible': {
              outline: `${tokens.custom.focusRing.width}px solid ${tokens.custom.focusRing.color}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: safeMode === 'dark' ? 'none' : undefined,
            border: safeMode === 'dark' ? `1px solid ${tokens.palette.divider}` : undefined,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '&:focus-within': {
                outline: 'none',
              },
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '1px',
                },
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            '&:focus-within': {
              outline: 'none',
            },
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '1px',
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '&:focus-within': {
              outline: 'none',
            },
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '1px',
              },
            },
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            '&:focus-within': {
              outline: 'none',
            },
          },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          // Menu/Popover(Modal 기반)에서 생성되는 Backdrop 포함
          root: {
            outline: 'none',
          },
          // MuiBackdrop-invisible: 시각적으로 완전 투명하게 유지
          invisible: {
            backgroundColor: 'transparent',
            // 브라우저/플랫폼별로 미세한 페이드가 남는 경우가 있어 제거
            transition: 'none',
          },
        },
      },
    },
  });

  // console.log('✅ 생성된 테마 확인:', {
  //   mode: safeMode,
  //   background: {
  //     default: theme.palette.background.default,
  //     paper: theme.palette.background.paper
  //   },
  //   text: {
  //     primary: theme.palette.text.primary,
  //     secondary: theme.palette.text.secondary
  //   },
  //   primary: theme.palette.primary.main,
  //   divider: theme.palette.divider
  // });

  return theme;
};

/**
 * 현재 테마 모드에 따른 MUI 테마를 반환하는 훅
 */
export const getTheme = (mode: ThemeMode = 'light'): Theme => {
  return createMuiTheme(mode);
};


