import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const NetworkContext = createContext(null)

// The health endpoint to poll — uses the same base as all other requests
const HEALTH_URL = '/api/status'
const POLL_INTERVAL_MS = 8000
const RETRY_COUNTDOWN_SEC = 5

export function NetworkProvider({ children }) {
    const [isOffline, setIsOffline] = useState(false)
    const [errorType, setErrorType] = useState(null) // 'no_internet' | 'timeout' | 'server_error' | 'server_down'
    const [statusCode, setStatusCode] = useState(null)
    const pollTimerRef = useRef(null)
    const bgCheckRef = useRef(null)     // ← background periodic check (always running)
    const isOfflineRef = useRef(false)

    // Keep ref in sync so the interceptor (outside React) can read it
    useEffect(() => {
        isOfflineRef.current = isOffline
    }, [isOffline])

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
        }
    }, [])

    const checkHealth = useCallback(async (isRecheck = false) => {
        try {
            const token = sessionStorage.getItem('km_token')
            const res = await fetch(HEALTH_URL, {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: AbortSignal.timeout(5000),
            })
            if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) {
                // Any real HTTP response (even auth errors) means server is UP
                setIsOffline(false)
                setErrorType(null)
                setStatusCode(null)
                stopPolling()
                return true  // server reachable
            }
            // 5xx from health endpoint — confirm with a re-check before showing overlay
            // to avoid flashing on a single transient failure
            if (!isRecheck) {
                setTimeout(() => checkHealth(true), 2000)
                return false
            }
            if (!isOfflineRef.current) {
                setIsOffline(true)
                setErrorType('server_error')
                setStatusCode(res.status)
            }
            return false
        } catch (e) {
            // Fetch failed = local backend is not running or not reachable
            if (!isOfflineRef.current) {
                const isTimeout = e?.name === 'TimeoutError' || e?.message?.includes('timeout')
                setIsOffline(true)
                setErrorType(isTimeout ? 'timeout' : 'server_down')
                setStatusCode(null)
                startPolling()
            }
            return false
        }
    }, [stopPolling])

    const startPolling = useCallback(() => {
        stopPolling()
        pollTimerRef.current = setInterval(checkHealth, POLL_INTERVAL_MS)
    }, [checkHealth, stopPolling])

    // ── Proactive background check (runs always, every 12s) ──────────────────────
    // This is what makes the overlay appear on the LOGIN page without any user action.
    useEffect(() => {
        // Run immediately on mount
        checkHealth()
        // Then poll every 12s (slower background check — only escalates if down)
        bgCheckRef.current = setInterval(checkHealth, 12000)
        return () => {
            clearInterval(bgCheckRef.current)
        }
    }, [checkHealth])

    // Called by the Axios interceptor
    const triggerOffline = useCallback((type, code = null) => {
        setIsOffline(true)
        setErrorType(type)
        setStatusCode(code)
        startPolling()
    }, [startPolling])

    const retryNow = useCallback(() => {
        checkHealth()
    }, [checkHealth])

    // Clean up on unmount
    useEffect(() => () => stopPolling(), [stopPolling])

    return (
        <NetworkContext.Provider value={{ isOffline, errorType, statusCode, triggerOffline, retryNow, RETRY_COUNTDOWN_SEC }}>
            {children}
        </NetworkContext.Provider>
    )
}

export function useNetwork() {
    const ctx = useContext(NetworkContext)
    if (!ctx) throw new Error('useNetwork must be used within <NetworkProvider>')
    return ctx
}

// Singleton ref — so client.js (non-React) can call triggerOffline
let _triggerOfflineGlobal = null
export function setGlobalTriggerOffline(fn) { _triggerOfflineGlobal = fn }
export function globalTriggerOffline(type, code) { _triggerOfflineGlobal?.(type, code) }
