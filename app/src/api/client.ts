import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';
import { useStakeholderStore } from '../store/useStakeholderStore';
import { useNetworkStore } from '../store/useNetworkStore';

const apiClient = axios.create({
    timeout: 15000,
});

// Dynamically set baseURL before every request (reads AsyncStorage for the saved server IP)
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
            const user = JSON.parse(userStr);
            if (user.role === 'stakeholder') {
                const selectedId = useStakeholderStore.getState().selectedRestaurantId;
                config.headers['X-Restaurant-Id'] = selectedId || 'ALL';
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Handle global 401 + network error detection
apiClient.interceptors.response.use(
    (response) => {
        // If a previous request had failed and this one succeeded → auto-recover
        const { isOffline, setOnline } = useNetworkStore.getState();
        if (isOffline) setOnline();
        return response;
    },
    async (error) => {
        const status = error.response?.status;
        const { setOffline } = useNetworkStore.getState();

        // ── Auth errors: clear token (existing behaviour) ──
        if (status === 401) {
            await AsyncStorage.multiRemove(['km_token', 'km_user']);
            return Promise.reject(error);
        }

        // ── Network / server errors: show offline screen ──
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
