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
    totalTables?: number;
    parentOwnerId?: string;
    subscription: { plan: string; expiresAt: string; isActive: boolean };
    onboardingCompleted: boolean;
    onboardingStep: number;
    currency?: string;
    taxRate?: number;
    address?: string;
    latitude?: number;
    longitude?: number;
    gstNumber?: string;
    tableMetadata?: string | object;
    logo?: string;
    accentColor?: string;

    // Table & Location settings
    geofenceRadius?: number;
    acTables?: string;
    acChargePercentage?: number;
    tableCategories?: string | any[];

    // Printer settings
    billPrinterEnabled?: boolean;
    counterPrinterIp?: string;
    kotPrinterEnabled?: boolean;
    kitchenPrinterIp?: string;
    categoryPrinterEnabled?: boolean;
    autoPrintEnabled?: boolean;
    minPrintPrice?: number;
    consolidatedReceipt?: boolean;
    reprintKOT?: boolean;
    reprintBill?: boolean;
    largeFontKOT?: boolean;
    itemWiseKOT?: boolean;
    printCount?: number;
    customPrinters?: string | any[];

    // POS Behavior
    quickMode?: boolean;
    manualQuantity?: boolean;
    preferredPosMode?: string;
    menuLayout?: string;
    menuColorStyle?: string;
    menuItemColumnCount?: number;
    lowStockAlert?: boolean;
    allowNoStockSale?: boolean;
    trackCustomerDetail?: boolean;

    // Online Order settings
    onlineAutoAccept?: boolean;
    onlineAutoPrint?: boolean;
    onlinePrintCounter?: boolean;
    onlinePrintKitchen?: boolean;
    onlineNotification?: boolean;
    onlineStockActivateTime?: boolean;

    // WhatsApp settings
    whatsappCountryCode?: string;
    whatsappDetailedBill?: boolean;

    // Language settings
    preferredLanguage?: string;
    printLanguage?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isUnlocked: boolean; // Controls MPIN layer
    error: string | null;
    setUnlocked: (status: boolean) => void;
    login: (email: string, password: string, latitude?: number, longitude?: number) => Promise<void>;
    stakeholderLogin: (phone: string, password: string, latitude?: number, longitude?: number) => Promise<void>;
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
    isUnlocked: false,
    error: null,

    setUnlocked: (status) => set({ isUnlocked: status }),

    login: async (email, password, latitude, longitude) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.login(email, password, latitude, longitude);
            const { token, user } = res.data.data;
            await AsyncStorage.multiSet([
                ['km_token', token],
                ['km_user', JSON.stringify(user)],
            ]);
            set({ token, user, isAuthenticated: true, isUnlocked: true, isLoading: false });
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

    stakeholderLogin: async (phone, password, latitude, longitude) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.stakeholderLogin(phone, password, latitude, longitude);
            const { token, user } = res.data.data;
            await AsyncStorage.multiSet([
                ['km_token', token],
                ['km_user', JSON.stringify(user)],
            ]);
            set({ token, user, isAuthenticated: true, isUnlocked: true, isLoading: false });

            // Fetch accessible restaurants and populate store
            try {
                const { useStakeholderStore } = require('./useStakeholderStore');
                const restaurantsRes = await authAPI.getAccessibleRestaurants();
                if (restaurantsRes.data.success) {
                    useStakeholderStore.getState().setAccessibleRestaurants(restaurantsRes.data.data.restaurants || []);
                }
            } catch (err) {
                console.warn('Failed to fetch stakeholder restaurants', err);
            }
        } catch (error: any) {
            let errorMsg = error.response?.data?.message || error.message || 'Stakeholder Login failed';
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
            set({ token, user, isAuthenticated: true, isUnlocked: true, isLoading: false });
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
            // Silent error - user successfully logs out locally
        }
        try {
            const SecureStore = require('expo-secure-store');
            await SecureStore.deleteItemAsync('km_mpin');
        } catch (_) { }

        await AsyncStorage.multiRemove(['km_token', 'km_user']);
        set({ user: null, token: null, isAuthenticated: false, isUnlocked: false });
    },

    loadStoredAuth: async () => {
        try {
            const [token, userStr] = await AsyncStorage.multiGet(['km_token', 'km_user']);
            if (token[1] && userStr[1]) {
                const userObj = JSON.parse(userStr[1]);
                set({
                    token: token[1],
                    user: userObj,
                    isAuthenticated: true,
                    isUnlocked: false // Forces the user to the Lock Screen immediately
                });
            }
        } catch (_) { }
    },

    updateUser: (user) => set({ user }),
    updateProfile: async (data: any) => {
        set({ isLoading: true, error: null });
        try {
            const res = await authAPI.updateProfile(data);
            // Handle both nested { user: ... } and direct user object responses
            const user = res.data.data.user || res.data.data;

            if (user) {
                await AsyncStorage.setItem('km_user', JSON.stringify(user));
                set({ user, isLoading: false });
            } else {
                throw new Error('Invalid user data received');
            }
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
