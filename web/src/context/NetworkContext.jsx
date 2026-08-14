import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const NetworkContext = createContext(null)

const isElectron = window.location.protocol === 'file:';
const isAndroid = /android/i.test(navigator.userAgent);
const BASE = 'http://144.217.89.193:8080/api';
const HEALTH_URL = `${BASE}/status`;
const PING_URL = `${BASE}/status/ping`;   // ultra-fast liveness check (no DB query)

// Timing constants — tuned for Render free tier which cold-starts in 30-60s
const BG_CHECK_INTERVAL_MS = 30_000   // background liveness check every 30s
const RECOVERY_POLL_MS = 8_000   // when offline, re-check every 8s
const PING_TIMEOUT_MS = 70_000   // allow 70s for cold start wake-up
const HEALTH_TIMEOUT_MS = 90_000   // allow 90s for full health check on cold start
const RECHECK_DELAY_MS = 5_000   // wait before confirming a failure (avoid flash)
const RETRY_COUNTDOWN_SEC = 8       // countdown shown on overlay

export function NetworkProvider({ children }) {
    const [isOffline, setIsOffline] = useState(false)
    const [errorType, setErrorType] = useState(null)
    const [statusCode, setStatusCode] = useState(null)

    const recoveryPollRef = useRef(null)
    const bgCheckRef = useRef(null)
    const isOfflineRef = useRef(false)
    const pendingRecheckRef = useRef(false)

    // Keep ref in sync so non-React code (interceptor) can read it
    useEffect(() => { isOfflineRef.current = isOffline }, [isOffline])

    // ── Go online ─────────────────────────────────────────────────────────────
    const goOnline = useCallback(() => {
        setIsOffline(false)
        setErrorType(null)
        setStatusCode(null)
        // Stop the aggressive recovery polling — background check takes over
        if (recoveryPollRef.current) {
            clearInterval(recoveryPollRef.current)
            recoveryPollRef.current = null
        }
    }, [])

    // ── Start aggressive recovery polling ────────────────────────────────────
    const startRecoveryPolling = useCallback((checkFn) => {
        if (recoveryPollRef.current) return // already polling
        recoveryPollRef.current = setInterval(checkFn, RECOVERY_POLL_MS)
    }, [])

    // ── Fast ping: just checks server liveness (no DB) ────────────────────────
    const ping = useCallback(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
        try {
            const res = await fetch(PING_URL, {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store',
            });
            clearTimeout(id);
            return res.ok;
        } catch (e) {
            clearTimeout(id);
            return false;
        }
    }, [])

    // ── Full health check with DB validation ─────────────────────────────────
    const checkHealth = useCallback(async (isRecheck = false) => {
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        try {
            const token = localStorage.getItem('km_token')
            const res = await fetch(HEALTH_URL, {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: controller.signal,
                cache: 'no-store',
            })
            clearTimeout(timerId);

            // Any real HTTP response (even auth errors) means server is reachable
            if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) {
                if (isOfflineRef.current) goOnline()
                return true
            }

            // 5xx — double-check before showing overlay to avoid false positives
            if (!isRecheck && !pendingRecheckRef.current) {
                pendingRecheckRef.current = true
                setTimeout(() => {
                    pendingRecheckRef.current = false
                    checkHealth(true)
                }, RECHECK_DELAY_MS)
                return false
            }

            if (!isOfflineRef.current) {
                setIsOffline(true)
                setErrorType('server_error')
                setStatusCode(res.status)
                startRecoveryPolling(() => checkHealth())
            }
            return false

        } catch (e) {
            clearTimeout(timerId);
            // No response at all — backend is down or unreachable
            if (!isOfflineRef.current) {
                const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError' || e?.message?.includes('timeout')
                setIsOffline(true)
                setErrorType(isTimeout ? 'timeout' : 'server_down')
                setStatusCode(null)
                startRecoveryPolling(() => checkHealth())
            }
            return false
        }
    }, [goOnline, startRecoveryPolling])

    // ── Background liveness check (always running) ───────────────────────────
    // Uses the fast /ping endpoint to avoid hammering the DB every 10s
    const bgCheck = useCallback(async () => {
        // Skip if offline (recovery poll handles this)
        if (isOfflineRef.current) return

        const alive = await ping()
        if (!alive) {
            // Ping failed — do a full health check to confirm and get error type
            await checkHealth()
        }
    }, [ping, checkHealth])

    useEffect(() => {
        // Skip blocking health check on startup — UI shows immediately
        // Background check detects server going down during use
        bgCheckRef.current = setInterval(bgCheck, BG_CHECK_INTERVAL_MS)
        return () => {
            clearInterval(bgCheckRef.current)
            if (recoveryPollRef.current) clearInterval(recoveryPollRef.current)
        }
    }, [checkHealth, bgCheck])

    // ── Called by the Axios interceptor when a request fails ─────────────────
    const triggerOffline = useCallback((type, code = null) => {
        if (isOfflineRef.current) return // already handling it
        setIsOffline(true)
        setErrorType(type)
        setStatusCode(code)
        startRecoveryPolling(() => checkHealth())
    }, [checkHealth, startRecoveryPolling])

    // ── Manual retry button on the overlay ───────────────────────────────────
    const retryNow = useCallback(() => {
        checkHealth()
    }, [checkHealth])

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

// Singleton bridge — so client.js (non-React) can call triggerOffline
let _triggerOfflineGlobal = null
export function setGlobalTriggerOffline(fn) { _triggerOfflineGlobal = fn }
export function globalTriggerOffline(type, code) { _triggerOfflineGlobal?.(type, code) }
