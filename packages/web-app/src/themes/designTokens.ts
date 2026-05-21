// MUI 디자인 토큰 정의
export const designTokens = {
  mui: {
    light: {
      palette: {
        mode: "light" as const,
        common: { black: "#000000", white: "#FFFFFF" },
        primary: {
          light: "#4E95FF",
          main: "#2F7DFF",
          dark: "#1550B8",
          contrastText: "#FFFFFF"
        },
        secondary: {
          light: "#AE80FF",
          main: "#7B3BFF",
          dark: "#4C23A6",
          contrastText: "#FFFFFF"
        },
        success: {
          light: "#A1E7C0",
          main: "#22B86C",
          dark: "#117445",
          contrastText: "#121212"
        },
        warning: {
          light: "#FFD488",
          main: "#FFA31A",
          dark: "#8C5100",
          contrastText: "#121212"
        },
        error: {
          light: "#FF9BA6",
          main: "#FF3F58",
          dark: "#901322",
          contrastText: "#FFFFFF"
        },
        text: {
          primary: "#121212",
          secondary: "#545454",
          disabled: "#A8A8A8"
        },
        divider: "#E6E6E6",
        background: {
          default: "#FFFFFF",
          paper: "#FFFFFF"
        },
        grey: {
          "0": "#FFFFFF",
          "50": "#F5F5F5",
          "100": "#E6E6E6",
          "200": "#C8C8C8",
          "300": "#A8A8A8",
          "400": "#8B8B8B",
          "500": "#6E6E6E",
          "600": "#545454",
          "700": "#3B3B3B",
          "800": "#2A2A2A",
          "900": "#1D1D1D",
          "950": "#121212",
          "1000": "#000000"
        },
        action: {
          active: "#3B3B3B",
          hover: "rgba(31,102,224,0.08)",
          hoverOpacity: 0.08,
          selected: "rgba(31,102,224,0.16)",
          selectedOpacity: 0.16,
          disabled: "#A8A8A8",
          disabledOpacity: 0.38,
          disabledBackground: "#E6E6E6",
          focus: "rgba(47,125,255,0.24)",
          focusOpacity: 0.24,
          activatedOpacity: 0.24
        }
      },
      custom: {
        selectionBg: "#E7F1FF",
        scrim: "rgba(18,18,18,0.6)",
        focusRing: { color: "#2F7DFF", width: 2 }
      }
    },
    dark: {
      palette: {
        mode: "dark" as const,
        common: { black: "#000000", white: "#FFFFFF" },
        primary: {
          light: "#7AB0FF",
          main: "#4E95FF",
          dark: "#2F7DFF",
          contrastText: "#FFFFFF"
        },
        secondary: {
          light: "#C9A9FF",
          main: "#AE80FF",
          dark: "#642ED6",
          contrastText: "#121212"
        },
        success: {
          light: "#73DBA2",
          main: "#22B86C",
          dark: "#117445",
          contrastText: "#0A0A0A"
        },
        warning: {
          light: "#FFBE52",
          main: "#FFA31A",
          dark: "#8C5100",
          contrastText: "#121212"
        },
        error: {
          light: "#FF6D7E",
          main: "#FF3F58",
          dark: "#901322",
          contrastText: "#FFFFFF"
        },
        text: {
          primary: "#E6E6E6",
          secondary: "#A8A8A8",
          disabled: "#6E6E6E"
        },
        divider: "#2A2A2A",
        background: {
          default: "#121212",
          paper: "#1D1D1D"
        },
        grey: {
          "0": "#FFFFFF",
          "50": "#F5F5F5",
          "100": "#E6E6E6",
          "200": "#C8C8C8",
          "300": "#A8A8A8",
          "400": "#8B8B8B",
          "500": "#6E6E6E",
          "600": "#545454",
          "700": "#3B3B3B",
          "800": "#2A2A2A",
          "900": "#1D1D1D",
          "950": "#121212",
          "1000": "#000000"
        },
        action: {
          active: "#C8C8C8",
          hover: "rgba(255,255,255,0.06)",
          hoverOpacity: 0.06,
          selected: "rgba(14,61,144,0.40)",
          selectedOpacity: 0.4,
          disabled: "#6E6E6E",
          disabledOpacity: 0.38,
          disabledBackground: "#2A2A2A",
          focus: "rgba(78,149,255,0.24)",
          focusOpacity: 0.24,
          activatedOpacity: 0.24
        }
      },
      custom: {
        selectionBg: "rgba(14,61,144,0.40)",
        scrim: "rgba(0,0,0,0.6)",
        focusRing: { color: "#4E95FF", width: 2 },
        elevationShadow: "0 6px 16px rgba(0,0,0,0.35)",
        popoverShadow: "0 12px 32px rgba(0,0,0,0.45)"
      }
    }
  }
} as const;

export type ThemeMode = 'light' | 'dark';
export type ThemeTokens = typeof designTokens.mui[ThemeMode];

