import axios from 'axios'
import { globalTriggerOffline } from '../context/NetworkContext.jsx'

const api = axios.create({
    baseURL: 'http://localhost:8080/api',
    timeout: 15000
})

// Attach JWT + X-Restaurant-Id (for stakeholder multi-tenancy) to every request
api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('km_token')
    if (token) config.headers.Authorization = `Bearer ${token}`

    // Inject stakeholder restaurant scope header if applicable
    const user = (() => {
        try { return JSON.parse(sessionStorage.getItem('km_user')) } catch { return null }
    })()
    if (user?.role === 'stakeholder') {
        const selectedId = sessionStorage.getItem('km_selected_restaurant') || 'ALL'
        config.headers['X-Restaurant-Id'] = selectedId
    }

    // Path normalization: ensure requests are relative to the baseURL
    if (config.url) {
        if (config.url.startsWith('/')) config.url = config.url.substring(1);
        if (config.url.startsWith('api/')) config.url = config.url.substring(4);
    }
    return config
})

// Auto-clear token on 401 + Network error detection
api.interceptors.response.use(
    res => res,
    err => {
        const status = err.response?.status

        // ── Auth errors: redirect to login (existing behaviour) ──
        // EXCEPTION: public display pages (TV Monitor, Customer Menu, Waitlist join)
        // must never be redirected to /login even if a background request returns 401.
        const path = window.location.pathname
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
            sessionStorage.removeItem('km_token')
            sessionStorage.removeItem('km_user')
            sessionStorage.removeItem('km_selected_restaurant')
            window.location.href = '/login'
            return Promise.reject(err)
        }

        // ── Network / server errors: show offline overlay ──
        // Note: all API calls go through the Vite proxy to localhost:8080.
        // "No response" always means the local backend is down — not internet loss.
        //
        // IMPORTANT: Only trigger the overlay when the backend is truly unreachable.
        // Individual API calls returning 5xx (e.g. a transient error on page load)
        // must NOT flash the overlay — the dedicated /api/status health check already
        // detects genuine backend downtime via its background polling loop.
        if (!err.response) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                globalTriggerOffline('timeout', null)
            } else {
                globalTriggerOffline('server_down', null)  // backend not reachable
            }
        } else if (status === 502 || status === 503 || status === 504) {
            // Gateway errors → backend process is down behind the proxy
            globalTriggerOffline('server_down', status)
        }
        // Any other 5xx (500, 501, etc.) is a per-endpoint server error.
        // Let each page/component handle it locally — do NOT show the overlay.

        return Promise.reject(err)
    }
)

export default api
