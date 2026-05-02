// ─── Color Palettes — Dark Teal + Neon Lime ─────────────────────────────────

export const DarkColors = {
    // ── Primary brand: Neon Lime ──
    primary: '#C6F53D',
    primaryDark: '#a8d42e',
    primaryLight: '#d8f76a',

    // ── Backgrounds: Deep Dark Teal ──
    background: '#081312',
    surface: '#0F1D1B',
    surfaceElevated: '#1A2F2D',
    card: '#132221',

    // ── Text ──
    textPrimary: '#FFFFFF',
    textSecondary: '#B0BFBD',
    textMuted: '#6B8A87',
    textInverse: '#0B2221',

    // ── Accent: Neon Lime for highlights ──
    accent: '#C6F53D',
    accentGreen: '#2DD479',
    accentYellow: '#F59E0B',
    accentBlue: '#4C8EFF',
    accentPurple: '#9B59B6',
    accentTeal: '#1A8F7E',

    // ── Status ──
    success: '#2DD479',
    warning: '#F59E0B',
    error: '#F87171',
    info: '#4C8EFF',

    // ── Borders ──
    border: 'rgba(198, 245, 61, 0.1)',
    borderLight: 'rgba(198, 245, 61, 0.2)',

    // ── Glass ──
    glass: 'rgba(198, 245, 61, 0.05)',
    glassStrong: 'rgba(198, 245, 61, 0.08)',
    glassBorder: 'rgba(198, 245, 61, 0.12)',

    // ── Overlay ──
    overlay: 'rgba(0, 0, 0, 0.8)',

    // ── Grays ──
    white: '#FFFFFF',
    gray100: '#E8F0EF',
    gray200: '#D0E0DE',
    gray300: '#B0BFBD',
    gray400: '#8A9E9B',
    gray500: '#6B8A87',
    gray600: '#4F6E6B',
    gray700: '#2D5250',
    gray800: '#1A2F2D',
    gray900: '#0F1D1B',
};

export const LightColors = {
    // ── Primary brand: Neon Lime ──
    primary: '#C6F53D',
    primaryDark: '#a8d42e',
    primaryLight: '#d8f76a',

    // ── Backgrounds: Light Teal-tinted ──
    background: '#F0F6F5',
    surface: '#E4EDEC',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',

    // ── Text ──
    textPrimary: '#0B2221',
    textSecondary: '#2B4E4A',
    textMuted: '#507572',
    textInverse: '#FFFFFF',

    // ── Accent ──
    accent: '#C6F53D',
    accentGreen: '#16A34A',
    accentYellow: '#F59E0B',
    accentBlue: '#2563EB',
    accentPurple: '#7C3AED',
    accentTeal: '#064843',

    // ── Status ──
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
    info: '#2563EB',

    // ── Borders ──
    border: 'rgba(6, 72, 67, 0.1)',
    borderLight: 'rgba(6, 72, 67, 0.2)',

    // ── Glass ──
    glass: 'rgba(6, 72, 67, 0.03)',
    glassStrong: 'rgba(6, 72, 67, 0.06)',
    glassBorder: 'rgba(6, 72, 67, 0.1)',

    // ── Overlay ──
    overlay: 'rgba(0, 0, 0, 0.4)',

    // ── Grays / Teal-tinted ──
    white: '#FFFFFF',
    gray100: '#F0F6F5',
    gray200: '#E4EDEC',
    gray300: '#D0E0DE',
    gray400: '#B0BFBD',
    gray500: '#8A9E9B',
    gray600: '#507572',
    gray700: '#2B4E4A',
    gray800: '#0F2E2C',
    gray900: '#081312',
};

// ─── Gradient Sets ────────────────────────────────────────────────────────────
export interface GradientSet {
    background: readonly [string, string, ...string[]];
    header: readonly [string, string, ...string[]];
    primary: readonly [string, string, ...string[]];
    card: readonly [string, string, ...string[]];
    success: readonly [string, string, ...string[]];
    error: readonly [string, string, ...string[]];
    info: readonly [string, string, ...string[]];
    purpleCard: readonly [string, string, ...string[]];
    goldCard: readonly [string, string, ...string[]];
}

export const DarkGradients: GradientSet = {
    background: ['#081312', '#0F1D1B'],
    header: ['#0F1D1B', '#132221'],
    primary: ['#d8f76a', '#C6F53D', '#a8d42e'],
    card: ['#132221', '#1A2F2D'],
    success: ['#2DD479', '#16A34A'],
    error: ['#F87171', '#DC2626'],
    info: ['#4C8EFF', '#2563EB'],
    purpleCard: ['#9B59B6', '#6C3483'],
    goldCard: ['#F59E0B', '#D97706'],
};

export const LightGradients: GradientSet = {
    background: ['#F0F6F5', '#E4EDEC'],
    header: ['#064843', '#0A6B60'],
    primary: ['#d8f76a', '#C6F53D', '#a8d42e'],
    card: ['#FFFFFF', '#F0F6F5'],
    success: ['#16A34A', '#15803D'],
    error: ['#DC2626', '#B91C1C'],
    info: ['#2563EB', '#1D4ED8'],
    purpleCard: ['#7C3AED', '#6D28D9'],
    goldCard: ['#F59E0B', '#D97706'],
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const Typography = {
    h1: { fontSize: 34, fontWeight: '800' as const, lineHeight: 42, letterSpacing: -0.5 },
    h2: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.3 },
    h3: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30, letterSpacing: -0.2 },
    h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
    h5: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
    body1: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
    body2: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
    overline: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2, lineHeight: 16, textTransform: 'uppercase' as const },
    button: { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0.3 },
    buttonSm: { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0.2 },
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
    massive: 64,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    round: 999,
};

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const Shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 3,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 16,
    },
    primary: {
        shadowColor: '#C6F53D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 10,
    },
    glow: {
        shadowColor: '#C6F53D',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
        elevation: 12,
    },
    teal: {
        shadowColor: '#064843',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    // alias for backward-compatibility
    blue: {
        shadowColor: '#064843',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    green: {
        shadowColor: '#2DD479',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
};

// ─── Dynamic Theme Hook ───────────────────────────────────────────────────────
import { useTheme } from '../context/ThemeContext';
export const useAppTheme = () => {
    const { colors, gradients, isDark, theme, toggleTheme } = useTheme();
    return { colors, gradients, isDark, theme, toggleTheme };
};

// Default export for compatibility (deprecated — use useAppTheme instead)
export const Colors = DarkColors;
export const Gradients = DarkGradients;

// ─── Paper Themes ──────────────────────────────────────────────────────────────
export const getPaperTheme = (isDark: boolean, baseColors?: typeof DarkColors) => {
    const themeColors = baseColors || (isDark ? DarkColors : LightColors);
    return {
        dark: isDark,
        colors: {
            primary: themeColors.primary,
            onPrimary: themeColors.textInverse,
            primaryContainer: themeColors.primaryDark,
            secondary: themeColors.accentGreen,
            background: themeColors.background,
            surface: themeColors.surface,
            onSurface: themeColors.textPrimary,
            onBackground: themeColors.textPrimary,
            error: themeColors.error,
            outline: themeColors.border,
            surfaceVariant: themeColors.card,
            onSurfaceVariant: themeColors.textSecondary,
            elevation: {
                level0: themeColors.background,
                level1: themeColors.surface,
                level2: themeColors.card,
                level3: themeColors.surfaceElevated,
                level4: themeColors.surfaceElevated,
                level5: themeColors.surfaceElevated,
            },
        },
    };
};

export const PaperTheme = getPaperTheme(true);
