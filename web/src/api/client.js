import axios from 'axios'
import { globalTriggerOffline } from '../context/NetworkContext.jsx'

const api = axios.create({
    baseURL: '/api',
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

    return config
})

// Auto-clear token on 401 + Network error detection
api.interceptors.response.use(
    res => res,
    err => {
        const status = err.response?.status

        // ── Auth errors: redirect to login (existing behaviour) ──
        if (status === 401 || status === 403) {
            sessionStorage.removeItem('km_token')
            sessionStorage.removeItem('km_user')
            sessionStorage.removeItem('km_selected_restaurant')
            window.location.href = '/login'
            return Promise.reject(err)
        }

        // ── Network / server errors: show offline overlay ──
        // Note: all API calls go through the Vite proxy to localhost:8080.
        // "No response" always means the local backend is down — not internet loss.
        if (!err.response) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                globalTriggerOffline('timeout', null)
            } else {
                globalTriggerOffline('server_down', null)  // backend not reachable
            }
        } else if (status === 502 || status === 503 || status === 504) {
            globalTriggerOffline('server_down', status)
        } else if (status >= 500) {
            globalTriggerOffline('server_error', status)
        }

        return Promise.reject(err)
    }
)

export default api
