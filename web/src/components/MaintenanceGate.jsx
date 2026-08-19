import React, { useEffect } from 'react'
import { useMaintenance } from '../context/MaintenanceContext.jsx'
import MaintenancePage from '../pages/MaintenancePage.jsx'

/**
 * MaintenanceGate — highest priority application gate.
 *
 * RULES:
 * 1. If maintenance is ACTIVE and user is NOT performing HQ Admin override (hq=override):
 *    - Immediately lock the location hash to '#/maintenance' so there's zero route flicker between /#/login and /#/maintenance.
 *    - Render MaintenancePage exclusively.
 * 2. If user requested HQ Admin Access (hq=override in URL):
 *    - Render children (allows login page / admin routes to function).
 * 3. Before first check finishes:
 *    - If localStorage says active → render MaintenancePage immediately (zero flash).
 *    - Otherwise → render neutral splash screen until initial check completes.
 */
export default function MaintenanceGate({ children }) {
    const { isMaintenance, initialized } = useMaintenance()

    // Check both search and hash for hq=override (HashRouter puts query params in window.location.hash)
    const isHqOverride = window.location.href.includes('hq=override')

    useEffect(() => {
        if (isMaintenance && !isHqOverride) {
            if (window.location.hash !== '#/maintenance') {
                console.info('[MaintenanceGate] Maintenance active — locking route hash to #/maintenance')
                window.location.hash = '#/maintenance'
            }
        }
    }, [isMaintenance, isHqOverride])

    // Admin override: allow access to login / HQ routes during maintenance
    if (isHqOverride) {
        return children
    }

    // Maintenance active: render MaintenancePage exclusively
    if (isMaintenance) {
        return <MaintenancePage />
    }

    // Initial check pending: neutral splash screen
    if (!initialized) {
        return (
            <div style={{
                minHeight: '100vh',
                width: '100vw',
                background: 'linear-gradient(145deg, #f8faff 0%, #eef2ff 40%, #f0f9ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Inter', -apple-system, sans-serif"
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 44, height: 44,
                        border: '3px solid #e0e7ff',
                        borderTopColor: '#6366f1',
                        borderRadius: '50%',
                        margin: '0 auto 16px',
                        animation: 'mgate-spin 0.8s linear infinite'
                    }} />
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
                        Checking system status…
                    </div>
                </div>
                <style>{`
                    @keyframes mgate-spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        )
    }

    // Normal application mode
    return children
}
