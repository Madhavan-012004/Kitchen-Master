import React, { createContext, useContext, useState, useEffect } from 'react';

const MobileViewContext = createContext();

export function MobileViewProvider({ children }) {
    // Mode options: 'auto' (detect screen width), 'mobile' (force mobile), 'web' (force web)
    const [mobileViewMode, setMobileViewMode] = useState(() => {
        return localStorage.getItem('appMobileViewMode') || 'auto';
    });

    const [isScreenMobile, setIsScreenMobile] = useState(() => {
        return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    });

    useEffect(() => {
        const handleResize = () => {
            setIsScreenMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Effective mobile view determination:
    // If set to 'mobile' -> true
    // If set to 'web' -> false
    // If set to 'auto' -> depends on screen width (<= 768px)
    const isMobileView = mobileViewMode === 'mobile' ? true : mobileViewMode === 'web' ? false : isScreenMobile;

    const updateMobileViewMode = (mode) => {
        setMobileViewMode(mode);
        localStorage.setItem('appMobileViewMode', mode);
    };

    const toggleMobileView = () => {
        const nextMode = isMobileView ? 'web' : 'mobile';
        updateMobileViewMode(nextMode);
    };

    useEffect(() => {
        if (isMobileView) {
            document.documentElement.classList.add('global-mobile-mode');
            document.body.classList.add('global-mobile-mode');
        } else {
            document.documentElement.classList.remove('global-mobile-mode');
            document.body.classList.remove('global-mobile-mode');
        }
    }, [isMobileView]);

    return (
        <MobileViewContext.Provider
            value={{
                mobileViewMode,
                setMobileViewMode: updateMobileViewMode,
                isMobileView,
                isScreenMobile,
                toggleMobileView
            }}
        >
            {children}
        </MobileViewContext.Provider>
    );
}

export function useMobileView() {
    const context = useContext(MobileViewContext);
    if (!context) {
        throw new Error('useMobileView must be used within a MobileViewProvider');
    }
    return context;
}
