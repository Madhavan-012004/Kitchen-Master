import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => localStorage.getItem('cous_theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('cous_theme', theme);
    }, [theme]);

    const toggle = (event) => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';

        if (!document.startViewTransition) {
            setTheme(nextTheme);
            return;
        }

        const x = event?.clientX ?? window.innerWidth / 2;
        const y = event?.clientY ?? window.innerHeight / 2;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
            setTheme(nextTheme);
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('cous_theme', nextTheme);
        });

        transition.ready.then(() => {
            const clipPath = [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
            ];

            document.documentElement.animate(
                {
                    clipPath: theme === 'dark' ? clipPath : [...clipPath].reverse(),
                },
                {
                    duration: 500,
                    easing: 'ease-out',
                    pseudoElement: theme === 'dark' ? '::view-transition-new(root)' : '::view-transition-old(root)',
                }
            );
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
