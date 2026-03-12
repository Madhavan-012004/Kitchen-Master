/**
 * api.ts — Dynamic API URL configuration for Expo Go / mobile support.
 *
 * Priority order:
 *  1. User-saved IP from AsyncStorage (set via ServerConfigScreen)
 *  2. Fallback to app.json extra.API_URL
 *  3. Last resort: localhost (only works in emulators/simulators)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_STORAGE_KEY = 'km_server_ip';
const FALLBACK_URL = (Constants.expoConfig?.extra?.API_URL as string) || 'http://localhost:5001';

/**
 * Returns the full API base URL (e.g. http://192.168.1.5:5001/api)
 * Reads from AsyncStorage so it works on every real phone.
 */
export async function getApiBaseUrl(): Promise<string> {
    try {
        let stored = await AsyncStorage.getItem(API_STORAGE_KEY);
        if (stored) {
            // Auto migrate port 5000 to 5001
            if (stored.includes(':5000')) {
                stored = stored.replace(':5000', ':5001');
                await AsyncStorage.setItem(API_STORAGE_KEY, stored);
            }
            // stored is the raw URL like "http://192.168.x.x:5001"
            return stored.endsWith('/api') ? stored : `${stored}/api`;
        }
    } catch (_) { }
    return FALLBACK_URL.endsWith('/api') ? FALLBACK_URL : `${FALLBACK_URL}/api`;
}

/**
 * Returns the base server URL without the /api suffix
 * (used for health-check and socket.io)
 */
export async function getServerBaseUrl(): Promise<string> {
    try {
        let stored = await AsyncStorage.getItem(API_STORAGE_KEY);
        if (stored) {
            // Auto migrate port 5000 to 5001
            if (stored.includes(':5000')) {
                stored = stored.replace(':5000', ':5001');
                await AsyncStorage.setItem(API_STORAGE_KEY, stored);
            }
            return stored.endsWith('/api') ? stored.replace('/api', '') : stored;
        }
    } catch (_) { }
    return FALLBACK_URL.endsWith('/api') ? FALLBACK_URL.replace('/api', '') : FALLBACK_URL;
}

/**
 * Saves the server base URL to AsyncStorage.
 * @param url e.g. "http://192.168.1.5:5000"
 */
export async function saveServerUrl(url: string): Promise<void> {
    // Normalize: strip trailing slash and /api suffix
    const normalized = url.trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
    await AsyncStorage.setItem(API_STORAGE_KEY, normalized);
}

/**
 * Tests connectivity to the server health endpoint.
 * Returns true if the server responds.
 */
export async function testServerConnection(baseUrl: string): Promise<boolean> {
    try {
        const normalized = baseUrl.trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${normalized}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return res.ok;
    } catch (_) {
        return false;
    }
}
