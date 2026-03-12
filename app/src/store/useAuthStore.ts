import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/auth';
import { attendanceAPI } from '../api/attendance';

interface User {
    _id: string;
    name: string;
    email: string;
    restaurantName: string;
    phone?: string;
    role: string;
    assignedTables?: string[];
    parentOwnerId?: string;
    subscription: { plan: string; expiresAt: string; isActive: boolean };
    onboardingCompleted: boolean;
    onboardingStep: number;
    currency: string;
    taxRate: number;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;
    login: (email: string, password: string, latitude?: number, longitude?: number) => Promise<void>;
    register: (data: any) => Promise<void>;
    logout: () => Promise<void>;
    loadStoredAuth: () => Promise<void>;
    updateUser: (user: User) => void;
    updateProfile: (data: any) => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    error: null,

    login: async (email, password, latitude, longitude) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.login(email, password, latitude, longitude);
            const { token, user } = res.data.data;
            await AsyncStorage.multiSet([
                ['km_token', token],
                ['km_user', JSON.stringify(user)],
            ]);
            set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            let errorMsg = error.response?.data?.message || error.message || 'Login failed';
            if (errorMsg === 'Network Error') {
                errorMsg = 'Network Error: Cannot reach backend. Go back to Login and click the Gear icon to set your PC IP Address.';
            }
            set({
                error: errorMsg,
                isLoading: false,
            });
            throw error;
        }
    },

    register: async (data) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.register(data);
            const { token, user } = res.data.data;
            await AsyncStorage.multiSet([
                ['km_token', token],
                ['km_user', JSON.stringify(user)],
            ]);
            set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            let errorMsg = error.response?.data?.message || error.message || 'Registration failed';
            if (errorMsg === 'Network Error') {
                errorMsg = 'Network Error: Cannot reach backend. Go back to Login and click the Gear icon to set your PC IP Address.';
            }
            set({
                error: errorMsg,
                isLoading: false,
            });
            throw error;
        }
    },

    logout: async () => {
        try {
            // Attempt to checkout from attendance system if active
            await attendanceAPI.checkOut();
        } catch (err) {
            // Silent error - we still want to log out locally
            console.log('Attendance checkout error:', err);
        }
        await AsyncStorage.multiRemove(['km_token', 'km_user']);
        set({ user: null, token: null, isAuthenticated: false });
    },

    loadStoredAuth: async () => {
        try {
            // Keep the token for API requests if needed, but DO NOT auto-authenticate.
            // This ensures the user is forced to the AuthStack (login screen) every time the app opens.
            const [token, userStr] = await AsyncStorage.multiGet(['km_token', 'km_user']);
            if (token[1] && userStr[1]) {
                set({
                    token: token[1], // We restore token so user's email might be prefillable, but they must login
                    // Intentionally NOT setting user or isAuthenticated: true
                    isAuthenticated: false,
                });
            }
        } catch (_) { }
    },

    updateUser: (user) => set({ user }),
    updateProfile: async (data: any) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.updateProfile(data);
            const user = res.data.data.user;
            await AsyncStorage.setItem('km_user', JSON.stringify(user));
            set({ user, isLoading: false });
        } catch (error: any) {
            set({
                error: error.response?.data?.message || error.message || 'Update failed',
                isLoading: false
            });
            throw error;
        }
    },
    clearError: () => set({ error: null }),
}));
