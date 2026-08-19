import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/client.js'

const MaintenanceContext = createContext(null)
const POLL_INTERVAL_MS = 15_000

/**
 * Robust date parser for server/local dates (ISO string, array, timestamp, or datetime-local).
 */
export function parseServerDate(dateVal) {
    if (!dateVal) return null
    if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal
    if (typeof dateVal === 'number') return new Date(dateVal)
    if (Array.isArray(dateVal)) {
        const [year, month, day, hour = 0, min = 0, sec = 0] = dateVal
        return new Date(year, month - 1, day, hour, min, sec)
    }
    if (typeof dateVal === 'string') {
        let str = dateVal.trim()
        let d = new Date(str)
        if (!isNaN(d.getTime())) return d
        // Replace space with T for ISO format
        d = new Date(str.replace(' ', 'T'))
        if (!isNaN(d.getTime())) return d
    }
    return null
}

function readMaintenanceFlag() {
    return localStorage.getItem('km_maintenance_active') === 'true'
}

function writeMaintenanceFlag(active) {
    localStorage.setItem('km_maintenance_active', active ? 'true' : 'false')
}

export function MaintenanceProvider({ children }) {
    const [isMaintenance, setIsMaintenance] = useState(readMaintenanceFlag)
    const [maintenanceEndsAt, setMaintenanceEndsAt] = useState(null)
    const [activeBanner, setActiveBanner] = useState(null)
    const [upcomingBanner, setUpcomingBanner] = useState(null)
    const [initialized, setInitialized] = useState(false)

    const prevActiveRef = useRef(readMaintenanceFlag())

    const checkMaintenance = useCallback(async () => {
        let activeFound = null
        let upcomingFound = null

        // 1. Try server API first
        try {
            console.debug('[Maintenance] Checking /master/banners/active...')
            const res = await api.get('/master/banners/active', { timeout: 8000 })
            if (res.data?.data) {
                const b = res.data.data
                const now = new Date()
                const from = parseServerDate(b.fromTime)

                if (from && from > now) {
                    upcomingFound = b
                } else {
                    activeFound = b
                }
            }
        } catch (err) {
            console.warn('[Maintenance] Server check failed, using local cache:', err.message)
        }

        // 2. Check local cache fallback
        if (!activeFound) {
            try {
                const localBanners = JSON.parse(localStorage.getItem('master_maintenance_banners') || '[]')
                const now = new Date()

                for (const b of localBanners) {
                    if (!b.isActive) continue
                    const from = parseServerDate(b.fromTime)
                    const to = parseServerDate(b.toTime)

                    // Skip expired banners
                    if (to && to <= now) continue

                    // Upcoming banner
                    if (from && from > now) {
                        if (!upcomingFound || from < parseServerDate(upcomingFound.fromTime)) {
                            upcomingFound = b
                        }
                    } else {
                        // Currently active banner
                        activeFound = b
                        break
                    }
                }
            } catch (e) { }
        }

        // 3. Process result
        if (activeFound) {
            const endsAt = parseServerDate(activeFound.toTime)
            console.info('[Maintenance] ACTIVE — banner:', activeFound.title || 'Scheduled Maintenance')
            writeMaintenanceFlag(true)
            setActiveBanner(activeFound)
            setUpcomingBanner(null)
            setMaintenanceEndsAt(endsAt || new Date(Date.now() + 60 * 60 * 1000))
            setIsMaintenance(true)
            setInitialized(true)
            return
        }

        // Not currently active — check if upcoming banner is scheduled
        writeMaintenanceFlag(false)
        setIsMaintenance(false)
        setActiveBanner(null)
        setMaintenanceEndsAt(null)

        if (upcomingFound) {
            console.info('[Maintenance] UPCOMING — banner scheduled at:', upcomingFound.fromTime)
            setUpcomingBanner(upcomingFound)
        } else {
            setUpcomingBanner(null)
        }
        setInitialized(true)
    }, [])

    useEffect(() => {
        checkMaintenance()
        const interval = setInterval(checkMaintenance, POLL_INTERVAL_MS)
        const handleSync = () => checkMaintenance()

        window.addEventListener('storage', handleSync)
        window.addEventListener('maintenance-updated', handleSync)
        return () => {
            clearInterval(interval)
            window.removeEventListener('storage', handleSync)
            window.removeEventListener('maintenance-updated', handleSync)
        }
    }, [checkMaintenance])

    useEffect(() => {
        const wasActive = prevActiveRef.current
        prevActiveRef.current = isMaintenance

        if (!initialized) return

        if (wasActive && !isMaintenance) {
            console.info('[Maintenance] Maintenance ended. Resuming normal application flow.')
            const token = localStorage.getItem('km_token')
            const user = (() => {
                try { return JSON.parse(localStorage.getItem('km_user')) } catch { return null }
            })()

            if (token && user) {
                window.location.hash = '#/pos'
            } else {
                window.location.hash = '#/login'
            }
        }
    }, [isMaintenance, initialized])

    return (
        <MaintenanceContext.Provider value={{
            isMaintenance,
            maintenanceEndsAt,
            activeBanner,
            upcomingBanner,
            initialized,
            checkMaintenance
        }}>
            {children}
        </MaintenanceContext.Provider>
    )
}

export const useMaintenance = () => useContext(MaintenanceContext)
