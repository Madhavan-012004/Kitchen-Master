// ─── Color Palettes — Dark Navy + Amber ─────────────────────────────────

export const DarkColors = {
    // ── Primary brand: Amber ──
    primary: '#F59E0B',
    primaryDark: '#D97706',
    primaryLight: '#FBBF24',

    // ── Backgrounds: Deep Dark Navy ──
    background: '#0B0F19',
    surface: '#111827',
    surfaceElevated: '#1F2937',
    card: '#111827',

    // ── Text ──
    textPrimary: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
    textInverse: '#0B0F19',

    // ── Accent: Amber for highlights ──
    accent: '#F59E0B',
    accentGreen: '#10B981',
    accentYellow: '#FBBF24',
    accentBlue: '#3B82F6',
    accentPurple: '#8B5CF6',
    accentTeal: '#14B8A6',

    // ── Status ──
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // ── Borders ──
    border: 'rgba(245, 158, 11, 0.15)',
    borderLight: 'rgba(245, 158, 11, 0.3)',

    // ── Glass ──
    glass: 'rgba(245, 158, 11, 0.05)',
    glassStrong: 'rgba(245, 158, 11, 0.1)',
    glassBorder: 'rgba(245, 158, 11, 0.15)',

    // ── Overlay ──
    overlay: 'rgba(0, 0, 0, 0.8)',

    // ── Grays ──
    white: '#FFFFFF',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
};

export const LightColors = {
    // ── Primary brand: Amber ──
    primary: '#F59E0B',
    primaryDark: '#D97706',
    primaryLight: '#FBBF24',

    // ── Backgrounds: Light Gray ──
    background: '#F3F4F6',
    surface: '#E5E7EB',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',

    // ── Text ──
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#6B7280',
    textInverse: '#111827',

    // ── Accent ──
    accent: '#F59E0B',
    accentGreen: '#10B981',
    accentYellow: '#FBBF24',
    accentBlue: '#3B82F6',
    accentPurple: '#8B5CF6',
    accentTeal: '#14B8A6',

    // ── Status ──
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // ── Borders ──
    border: 'rgba(17, 24, 39, 0.1)',
    borderLight: 'rgba(17, 24, 39, 0.2)',

    // ── Glass ──
    glass: 'rgba(17, 24, 39, 0.03)',
    glassStrong: 'rgba(17, 24, 39, 0.06)',
    glassBorder: 'rgba(17, 24, 39, 0.1)',

    // ── Overlay ──
    overlay: 'rgba(0, 0, 0, 0.4)',

    // ── Grays ──
    white: '#FFFFFF',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
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
    background: ['#0B0F19', '#111827'],
    header: ['#111827', '#1F2937'],
    primary: ['#FBBF24', '#F59E0B', '#D97706'],
    card: ['#111827', '#1F2937'],
    success: ['#34D399', '#10B981'],
    error: ['#F87171', '#EF4444'],
    info: ['#60A5FA', '#3B82F6'],
    purpleCard: ['#A78BFA', '#8B5CF6'],
    goldCard: ['#FBBF24', '#F59E0B'],
};

export const LightGradients: GradientSet = {
    background: ['#F3F4F6', '#E5E7EB'],
    header: ['#FFFFFF', '#F3F4F6'],
    primary: ['#FBBF24', '#F59E0B', '#D97706'],
    card: ['#FFFFFF', '#F3F4F6'],
    success: ['#34D399', '#10B981'],
    error: ['#F87171', '#EF4444'],
    info: ['#60A5FA', '#3B82F6'],
    purpleCard: ['#A78BFA', '#8B5CF6'],
    goldCard: ['#FBBF24', '#F59E0B'],
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
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 10,
    },
    glow: {
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
        elevation: 12,
    },
    teal: {
        shadowColor: '#1F2937',
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
