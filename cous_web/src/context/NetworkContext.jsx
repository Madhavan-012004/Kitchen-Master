import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const NetworkContext = createContext(null);

const HEALTH_URL = '/api/status';
const POLL_INTERVAL_MS = 8000;

export function NetworkProvider({ children }) {
    const [isOffline, setIsOffline] = useState(false);
    const [errorType, setErrorType] = useState(null);
    const [statusCode, setStatusCode] = useState(null);
    const pollTimerRef = useRef(null);
    const bgCheckRef = useRef(null);       // ← always-running background check
    const isOfflineRef = useRef(false);

    // Keep ref in sync for use inside callbacks
    useEffect(() => { isOfflineRef.current = isOffline; }, [isOffline]);

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const token = localStorage.getItem('km_token');
            const res = await fetch(HEALTH_URL, {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: AbortSignal.timeout(5000),
            });
            // Any real HTTP response means the server is reachable
            if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) {
                setIsOffline(false);
                setErrorType(null);
                setStatusCode(null);
                stopPolling();
                return true;
            }
            // 5xx responses — server is up but erroring
            if (!isOfflineRef.current) {
                setIsOffline(true);
                setErrorType('server_error');
                setStatusCode(res.status);
            }
            return false;
        } catch (e) {
            // Fetch failed = no server reachable at all
            if (!isOfflineRef.current) {
                const isTimeout = e?.name === 'TimeoutError' || e?.message?.includes('timeout');
                setIsOffline(true);
                setErrorType(isTimeout ? 'timeout' : 'no_internet');
                setStatusCode(null);
                startPolling();
            }
            return false;
        }
    }, [stopPolling]);

    const startPolling = useCallback(() => {
        stopPolling();
        pollTimerRef.current = setInterval(checkHealth, POLL_INTERVAL_MS);
    }, [checkHealth, stopPolling]);

    // ── Proactive background check ─────────────────────────────────────────────────
    // Runs immediately on page load so the overlay shows even on the welcome/order screen
    // without waiting for any user-triggered API call to fail.
    useEffect(() => {
        checkHealth(); // fire immediately on mount
        bgCheckRef.current = setInterval(checkHealth, 12000); // background check every 12s
        return () => { clearInterval(bgCheckRef.current); };
    }, [checkHealth]);

    const triggerOffline = useCallback((type, code = null) => {
        setIsOffline(true);
        setErrorType(type);
        setStatusCode(code);
        startPolling();
    }, [startPolling]);

    const retryNow = useCallback(() => {
        checkHealth();
    }, [checkHealth]);

    useEffect(() => () => stopPolling(), [stopPolling]);

    return (
        <NetworkContext.Provider value={{ isOffline, errorType, statusCode, triggerOffline, retryNow }}>
            {children}
        </NetworkContext.Provider>
    );
}


export function useNetwork() {
    const ctx = useContext(NetworkContext);
    if (!ctx) throw new Error('useNetwork must be used within <NetworkProvider>');
    return ctx;
}

let _triggerOfflineGlobal = null;
export function setGlobalTriggerOffline(fn) { _triggerOfflineGlobal = fn; }
export function globalTriggerOffline(type, code) { _triggerOfflineGlobal?.(type, code); }
