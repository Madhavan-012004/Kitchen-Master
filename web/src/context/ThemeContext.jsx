import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

/**
 * Compute whether a hex color is "light" or "dark"  
 * Returns true if the color is light (needs dark text on top)
 */
function isLightColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // W3C luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55;
}

/**
 * Darken a hex color by a given percentage (0-100)
 */
function darkenHex(hex, amount = 15) {
    const c = hex.replace('#', '');
    let r = Math.max(0, parseInt(c.substring(0, 2), 16) - Math.round(255 * amount / 100));
    let g = Math.max(0, parseInt(c.substring(2, 4), 16) - Math.round(255 * amount / 100));
    let b = Math.max(0, parseInt(c.substring(4, 6), 16) - Math.round(255 * amount / 100));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex to rgb string for use in rgba()
 */
function hexToRgb(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

/**
 * Apply ALL accent color CSS variables to the document root.
 * This ensures every single component using var(--accent*) picks up the right color.
 */
function applyAccentColor(color) {
    const root = document.documentElement;
    const rgb = hexToRgb(color);
    const light = isLightColor(color);
    const darkened = darkenHex(color, 15);

    // ── Core accent ──
    root.style.setProperty('--accent', color);
    root.style.setProperty('--accent-dark', darkened);

    // ── Text ON the accent (contrast) ──
    root.style.setProperty('--accent-text', light ? '#0B2221' : '#FFFFFF');

    // ── Transparent variants using proper rgba() ──
    root.style.setProperty('--accent-light',  `rgba(${rgb}, 0.12)`);
    root.style.setProperty('--accent-glow',   `rgba(${rgb}, 0.25)`);
    root.style.setProperty('--accent-glow-sm', `rgba(${rgb}, 0.15)`);
    root.style.setProperty('--accent-glow-lg', `rgba(${rgb}, 0.40)`);
    root.style.setProperty('--accent-border', `rgba(${rgb}, 0.30)`);
    root.style.setProperty('--accent-bg',     `rgba(${rgb}, 0.06)`);
}

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [accentColor, setAccentColor] = useState(
        localStorage.getItem('accentColor') || '#C6F53D'
    );

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const updateAccentColor = (color) => {
        setAccentColor(color);
        localStorage.setItem('accentColor', color);
    };

    // Apply theme class
    useEffect(() => {
        document.body.classList.remove('dark-mode', 'light-mode');
        document.body.classList.add(`${theme}-mode`);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Apply ALL accent CSS variables whenever color changes
    useEffect(() => {
        applyAccentColor(accentColor);
    }, [accentColor]);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, updateAccentColor }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
