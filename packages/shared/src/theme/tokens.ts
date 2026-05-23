// ─── Primitive palette ───────────────────────────────────────────────────────
// These are raw color values. Components MUST NOT import from this object.
// Use SemanticColors instead.
const palette = {
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    150: '#ebebed',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    850: '#1a2230',
    900: '#111827',
    950: '#0a0f1a',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    900: '#14532d',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    900: '#7f1d1d',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    900: '#78350f',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    900: '#4c1d95',
  },
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
  },
};

// ─── Semantic color tokens ────────────────────────────────────────────────────
// ONLY these should be imported by components.
export const SemanticColors = {
  bg: {
    canvas: palette.gray[50],
    surface: '#ffffff',
    sunken: palette.gray[100],
    raised: palette.gray[150],
    overlay: 'rgba(17,24,39,0.45)',
  },

  border: {
    default: palette.gray[300],
    muted: palette.gray[200],
    strong: palette.purple[500],
    danger: palette.red[500],
  },

  text: {
    primary: palette.gray[900],
    secondary: palette.gray[500],
    disabled: palette.gray[400],
    inverse: palette.gray[50],
    link: palette.purple[600],
    danger: palette.red[600],
    success: palette.green[600],
  },

  interactive: {
    primary: palette.purple[600],
    primaryHover: palette.purple[500],
    primaryText: '#ffffff',
    secondary: palette.gray[200],
    secondaryHover: palette.gray[300],
    secondaryText: palette.gray[900],
    ghost: 'transparent',
    ghostHover: palette.gray[100],
    ghostText: palette.gray[900],
    destructive: palette.red[600],
    destructiveHover: palette.red[500],
    destructiveText: '#ffffff',
    // Outlined / "ghost" destructive — for contextual delete actions where a
    // solid red would be too loud (e.g. a Delete button sitting next to Save).
    destructiveGhost: 'transparent',
    destructiveGhostHover: palette.red[50],
    destructiveGhostBorder: palette.red[200],
    destructiveGhostText: palette.red[600],
  },

  status: {
    prospectBg: palette.amber[100],
    prospectText: palette.amber[700],
    customerBg: palette.green[100],
    customerText: palette.green[700],
    cancelledBg: palette.gray[100],
    cancelledText: palette.gray[400],
    saleBg: palette.teal[100],
    saleText: palette.teal[700],
    todayBg: palette.purple[100],
    todayText: palette.purple[700],
  },

  form: {
    inputBg: '#ffffff',
    inputBorder: palette.gray[300],
    inputFocusBorder: palette.purple[500],
    inputPlaceholder: palette.gray[400],
    inputText: palette.gray[900],
    labelText: palette.gray[600],
    errorText: palette.red[600],
    errorBorder: palette.red[500],
    helperText: palette.gray[500],
  },

  tab: {
    activeBg: 'transparent',
    activeText: palette.purple[600],
    inactiveText: palette.gray[400],
    border: palette.gray[200],
    indicator: palette.purple[500],
  },

  calendar: {
    cellBg: '#ffffff',
    cellBorder: palette.gray[200],
    dotColor: palette.purple[500],
    headerText: palette.gray[600],
    weekendCellBg: palette.gray[100],
    outOfMonthText: palette.gray[300],
    todayCellBorder: palette.purple[500],
  },

  sidebar: {
    bg: '#ffffff',
    activeItemBg: palette.gray[100],
    activeItemText: palette.purple[600],
    inactiveItemText: palette.gray[500],
    hoverItemBg: palette.gray[100],
    border: palette.gray[200],
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 36,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.3,
    normal: 0,
    wide: 0.8,
  },
  family: {
    sans: undefined as string | undefined, // uses platform default
    mono: 'monospace' as const,
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// 4 px base grid with half-steps where finer control is needed (e.g. compact
// pill paddings). Components MUST NOT add literal numbers — use a token.
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ─── Shadows (React Native shadow props) ─────────────────────────────────────
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 10,
  },
} as const;
