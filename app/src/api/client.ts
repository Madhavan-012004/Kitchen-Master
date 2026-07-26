import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';
import { useStakeholderStore } from '../store/useStakeholderStore';
import { useNetworkStore } from '../store/useNetworkStore';

// Requests that should NOT be retried (mutations that could cause duplicates)
const NON_RETRYABLE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const NON_RETRYABLE_URLS = [
    '/auth/login', '/auth/register',
    '/attendance/checkin', '/attendance/checkout',
    '/orders',  // order creation
];

const apiClient = axios.create({
    timeout: 12000,  // 12s — tight enough to surface failures quickly
});

// ── Request Interceptor: base URL + JWT + tenant header + path normalization ──
apiClient.interceptors.request.use(
    async (config) => {
        config.baseURL = await getApiBaseUrl();

        // Attach JWT token
        const token = await AsyncStorage.getItem('km_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Attach X-Restaurant-Id for Stakeholders
        const userStr = await AsyncStorage.getItem('km_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.role === 'stakeholder') {
                    const selectedId = useStakeholderStore.getState().selectedRestaurantId;
                    config.headers['X-Restaurant-Id'] = selectedId || 'ALL';
                }
            } catch { /* ignore parse errors */ }
        }

        // Path normalization: ensure requests are relative to the baseURL
        if (config.url) {
            if (config.url.startsWith('/')) config.url = config.url.substring(1);
            if (config.url.startsWith('api/')) config.url = config.url.substring(4);
        }

        // Initialize retry metadata
        (config as any)._retryCount = (config as any)._retryCount || 0;
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response Interceptor: auto-recover, retry, offline detection ──────────────
apiClient.interceptors.response.use(
    (response) => {
        // Any successful response → auto-recover from offline state
        const { isOffline, setOnline } = useNetworkStore.getState();
        if (isOffline) setOnline();
        return response;
    },
    async (error) => {
        const config = error.config as any;
        const status = error.response?.status;
        const { setOffline } = useNetworkStore.getState();

        // ── Auth errors: clear token ──
        if (status === 401) {
            await AsyncStorage.multiRemove(['km_token', 'km_user']);
            return Promise.reject(error);
        }

        // ── Retry logic for safe/read operations on transient failures ──
        const method = config?.method?.toLowerCase();
        const url = config?.url || '';
        const isRetryable =
            config &&
            !NON_RETRYABLE_METHODS.has(method) &&
            !NON_RETRYABLE_URLS.some(u => url.includes(u)) &&
            config._retryCount < 3 &&
            (!error.response || status >= 500);

        if (isRetryable) {
            config._retryCount += 1;
            // Exponential backoff: 500ms, 1s, 2s
            const delay = Math.min(500 * Math.pow(2, config._retryCount - 1), 4000);
            console.warn(`⚡ Retrying [${config._retryCount}/3] after ${delay}ms: ${url}`);
            await new Promise(r => setTimeout(r, delay));
            return apiClient(config);
        }

        // ── Network / server errors: mark as offline ──
        if (!error.response) {
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                setOffline('timeout', null);
            } else {
                setOffline('no_internet', null);
            }
        } else if (status === 502 || status === 503 || status === 504) {
            setOffline('server_down', status);
        } else if (status >= 500) {
            setOffline('server_error', status);
        }

        return Promise.reject(error);
    }
);

export default apiClient;
