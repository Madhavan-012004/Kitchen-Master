import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DarkColors, LightColors, DarkGradients, LightGradients, GradientSet } from '../theme';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeType;
    toggleTheme: () => void;
    isDark: boolean;
    colors: typeof DarkColors;
    gradients: GradientSet;
    accentColor: string | null;
    updateAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeType>('dark');
    const [accentColor, setAccentColor] = useState<string | null>(null);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('app_theme');
            if (savedTheme) {
                setTheme(savedTheme as ThemeType);
            }
            const savedAccent = await AsyncStorage.getItem('app_accent_color');
            if (savedAccent) {
                setAccentColor(savedAccent);
            }
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    };

    const toggleTheme = async () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        try {
            await AsyncStorage.setItem('app_theme', newTheme);
        } catch (e) {
            console.error('Failed to save theme', e);
        }
    };

    const updateAccentColor = async (color: string) => {
        setAccentColor(color);
        try {
            await AsyncStorage.setItem('app_accent_color', color);
        } catch (e) {
            console.error('Failed to save accent', e);
        }
    };

    const baseColors = theme === 'dark' ? DarkColors : LightColors;
    const colors = accentColor 
        ? { ...baseColors, primary: accentColor, accent: accentColor } 
        : baseColors;

    const gradients = theme === 'dark' ? DarkGradients : LightGradients;

    return (
        <ThemeContext.Provider value={{
            theme,
            toggleTheme,
            isDark: theme === 'dark',
            colors,
            gradients,
            accentColor,
            updateAccentColor
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
