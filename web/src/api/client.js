import axios from 'axios'
import { globalTriggerOffline } from '../context/NetworkContext.jsx'

const isElectron = window.location.protocol === 'file:';
const isAndroid = /android/i.test(navigator.userAgent);
// NOTE: Electron backend runs on port 48182 (set by -Dserver.port=48182 in main.cjs)
const API_BASE_URL = 'http://144.217.89.193:8080/api/';

// Set session mode immediately based on runtime context — no network call needed
if (!localStorage.getItem('km_mode')) {
    localStorage.setItem('km_mode', isElectron ? 'offline' : 'online');
}


// Requests that should NOT be retried (mutations that could cause duplicates)
const NON_RETRYABLE_METHODS = new Set(['post', 'put', 'patch', 'delete'])
const NON_RETRYABLE_URLS = ['/auth/login', '/auth/register', '/attendance/checkin', '/attendance/checkout', 'license/status', 'config/mode']

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 90000,       // 90s timeout — allows server cold start
})

// ── Request Interceptor: JWT + tenant header + path normalization ──────────────
api.interceptors.request.use(config => {
    const token = localStorage.getItem('km_token')
    if (token) config.headers.Authorization = `Bearer ${token}`

    // Inject stakeholder restaurant scope header if applicable
    const user = (() => {
        try { return JSON.parse(localStorage.getItem('km_user')) } catch { return null }
    })()
    if (user?.role === 'stakeholder') {
        const selectedId = localStorage.getItem('km_selected_restaurant') || 'ALL'
        config.headers['X-Restaurant-Id'] = selectedId
    }

    // Path normalization: ensure requests are relative to the baseURL
    if (config.url) {
        if (config.url.startsWith('/')) config.url = config.url.substring(1);
        if (config.url.startsWith('api/')) config.url = config.url.substring(4);
    }

    // Initialize retry metadata
    config._retryCount = config._retryCount || 0
    return config
})

// ── Response Interceptor: auth, retry, offline detection ──────────────────────
api.interceptors.response.use(
    res => res,
    async err => {
        const config = err.config
        const status = err.response?.status

        // ── Auth errors: redirect to login ──
        const path = window.location.hash?.replace('#', '') || window.location.pathname
        const isPublicDisplayPage =
            path.includes('/waitlist-monitor/') ||
            path.includes('/menu/') ||
            path.includes('/join-waitlist/') ||
            path === '/login' ||
            path === '/license'

        if (status === 401 || status === 403) {
            if (isPublicDisplayPage) {
                console.warn('Skipping auth redirect because user is on a public display page:', path)
                return Promise.reject(err)
            }
            localStorage.removeItem('km_token')
            localStorage.removeItem('km_user')
            localStorage.removeItem('km_selected_restaurant')
            window.location.href = '/login'
            return Promise.reject(err)
        }

        // ── Retry logic for network failures and timeouts on safe requests ──
        const isRetryable =
            config &&
            !NON_RETRYABLE_METHODS.has(config.method?.toLowerCase()) &&
            !NON_RETRYABLE_URLS.some(u => config.url?.includes(u)) &&
            config._retryCount < 2 && // Reduced to 2 retries for ultra-fast UX failure recovery
            (!err.response || (err.response.status > 500 && err.response.status <= 504)) // Exclude 500 (permanent backend bugs)

        if (isRetryable) {
            config._retryCount += 1
            const delay = Math.min(1000 * config._retryCount, 2000)
            console.warn(`⚡ Retrying request [${config._retryCount}/2] after ${delay}ms:`, config.url)
            await new Promise(r => setTimeout(r, delay))
            return api(config)
        }

        // ── Network / server errors: show offline overlay ──
        if (!err.response) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                globalTriggerOffline('timeout', null)
            } else {
                globalTriggerOffline('server_down', null)
            }
        } else if (status === 502 || status === 503 || status === 504) {
            globalTriggerOffline('server_down', status)
        }

        return Promise.reject(err)
    }
)

/**
 * Connection mode is set by Spring Boot startup profile.
 * This function only updates the local localStorage flag for UI state.
 * Browser = online mode. EXE (Electron) = offline mode by default.
 */
api.setConnectionMode = (mode) => {
    localStorage.setItem('km_mode', mode);
    return Promise.resolve({ success: true, mode });
}

export default api
