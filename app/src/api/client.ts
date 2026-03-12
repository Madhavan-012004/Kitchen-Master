import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';

const apiClient = axios.create({
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
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
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle global 401 (token expired)
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await AsyncStorage.multiRemove(['km_token', 'km_user']);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
