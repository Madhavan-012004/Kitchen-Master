// ─── Color Palettes ─────────────────────────────────────────────────
export const DarkColors = {
    // Primary brand
    primary: '#FF6B35',
    primaryDark: '#E55A24',
    primaryLight: '#FF8A5C',

    // Background - Now Gray based as requested
    background: '#121212',
    surface: '#1E1E1E',
    surfaceElevated: '#252525',
    card: '#252525',

    // Text - Brighter for better visibility
    textPrimary: '#FFFFFF',
    textSecondary: '#E0E0E0',
    textMuted: '#B0B0B0',
    textInverse: '#121212',

    // Accent
    accent: '#E94560',
    accentGreen: '#00D68F',
    accentYellow: '#FFCA28',
    accentBlue: '#4C8EFF',
    accentPurple: '#9B59B6',

    // Status
    success: '#00D68F',
    warning: '#FFCA28',
    error: '#FF5C7C',
    info: '#4C8EFF',

    // Borders
    border: 'rgba(255,255,255,0.12)',
    borderLight: 'rgba(255,255,255,0.2)',

    // Glass
    glass: 'rgba(255,255,255,0.06)',
    glassStrong: 'rgba(255,255,255,0.1)',
    glassBorder: 'rgba(255,255,255,0.12)',

    // Overlay
    overlay: 'rgba(0,0,0,0.8)',

    // Whites/Grays
    white: '#FFFFFF',
    gray100: '#F7FAFC',
    gray200: '#EDF2F7',
    gray300: '#E2E8F0',
    gray400: '#CBD5E0',
    gray500: '#A0AEC0',
    gray600: '#718096',
    gray700: '#4A5568',
    gray800: '#2D3748',
    gray900: '#1A202C',
};

export const LightColors = {
    // Primary brand
    primary: '#FF6B35',
    primaryDark: '#E55A24',
    primaryLight: '#FF8A5C',

    // Background
    background: '#F8FAFC',
    surface: '#F1F5F9',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',

    // Text
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textInverse: '#FFFFFF',

    // Accent
    accent: '#E94560',
    accentGreen: '#16A34A',
    accentYellow: '#F59E0B',
    accentBlue: '#2563EB',
    accentPurple: '#7C3AED',

    // Status
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
    info: '#2563EB',

    // Borders
    border: 'rgba(0,0,0,0.08)',
    borderLight: 'rgba(0,0,0,0.15)',

    // Glass
    glass: 'rgba(0,0,0,0.04)',
    glassStrong: 'rgba(0,0,0,0.08)',
    glassBorder: 'rgba(0,0,0,0.1)',

    // Overlay
    overlay: 'rgba(0,0,0,0.4)',

    // Whites/Grays
    white: '#FFFFFF',
    gray100: '#F7FAFC',
    gray200: '#EDF2F7',
    gray300: '#E2E8F0',
    gray400: '#CBD5E0',
    gray500: '#A0AEC0',
    gray600: '#718096',
    gray700: '#4A5568',
    gray800: '#2D3748',
    gray900: '#1A202C',
};

// Default export for compatibility (starts as dark)
export const Colors = DarkColors;

// ─── Gradients ────────────────────────────────────────────────────────
// ─── Gradients ────────────────────────────────────────────────────────
export const DarkGradients = {
    background: ['#121212', '#1E1E1E'] as const,
    header: ['#252525', '#121212'] as const,
    primary: ['#FF8A5C', '#FF6B35', '#E55A24'] as const,
    card: ['#252525', '#1E1E1E'] as const,
    success: ['#00D68F', '#00B377'] as const,
    error: ['#FF5C7C', '#E94560'] as const,
    info: ['#4C8EFF', '#2563EB'] as const,
    purpleCard: ['#9B59B6', '#6C3483'] as const,
    goldCard: ['#FFCA28', '#F59E0B'] as const,
};

export const LightGradients = {
    background: ['#F8FAFC', '#F1F5F9'] as const,
    header: ['#FFFFFF', '#F1F5F9'] as const,
    primary: ['#FF8A5C', '#FF6B35', '#E55A24'] as const,
    card: ['#FFFFFF', '#F1F5F9'] as const,
    success: ['#16A34A', '#15803D'] as const,
    error: ['#DC2626', '#B91C1C'] as const,
    info: ['#2563EB', '#1D4ED8'] as const,
    purpleCard: ['#7C3AED', '#6D28D9'] as const,
    goldCard: ['#F59E0B', '#D97706'] as const,
};

export const Gradients = DarkGradients;

// ─── Typography ──────────────────────────────────────────────────────
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

// ─── Spacing ─────────────────────────────────────────────────────────
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

// ─── Border Radius ────────────────────────────────────────────────────
export const Radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    round: 999,
};

// ─── Shadows ──────────────────────────────────────────────────────────
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
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    glow: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 12,
    },
    blue: {
        shadowColor: '#4C8EFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    green: {
        shadowColor: '#00D68F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
};

// ─── React Native Paper Theme ────────────────────────────────────────
// ─── Paper Themes ───────────────────────────────────────────
export const getPaperTheme = (isDark: boolean) => {
    const themeColors = isDark ? DarkColors : LightColors;
    return {
        dark: isDark,
        colors: {
            primary: themeColors.primary,
            onPrimary: themeColors.white,
            primaryContainer: themeColors.primaryDark,
            secondary: themeColors.accent,
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
