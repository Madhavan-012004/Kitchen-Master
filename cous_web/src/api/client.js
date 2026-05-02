import axios from 'axios';
import { globalTriggerOffline } from '../context/NetworkContext.jsx';

const api = axios.create({
    baseURL: `http://${window.location.hostname}:8080/api`,
    timeout: 15000,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('km_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Network error detection
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status;

        if (!err.response) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                globalTriggerOffline('timeout', null);
            } else {
                globalTriggerOffline('no_internet', null);
            }
        } else if (status === 502 || status === 503 || status === 504) {
            globalTriggerOffline('server_down', status);
        } else if (status >= 500) {
            globalTriggerOffline('server_error', status);
        }

        return Promise.reject(err);
    }
);

export default api;
