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
const FALLBACK_URL = (Constants.expoConfig?.extra?.API_URL as string) || 'http://localhost:8080';

/**
 * Returns the full API base URL (e.g. https://.../api)
 * Priority: Stored IP > app.json extra.API_URL > localhost
 */
export async function getApiBaseUrl(): Promise<string> {
    try {
        let stored = await AsyncStorage.getItem(API_STORAGE_KEY);
        if (stored) {
            // Normalize: ensure protocol exists
            if (!stored.startsWith('http')) {
                stored = `http://${stored}`;
            }
            // Auto migrate port 5001 (Node) to 8080 (Java)
            if (stored.includes(':5001')) {
                stored = stored.replace(':5001', ':8080');
                await AsyncStorage.setItem(API_STORAGE_KEY, stored);
            }
            return stored.endsWith('/api') ? stored : `${stored}/api`;
        }
    } catch (_) { }

    // Pro-fix: Automatically detect computer IP when running in Expo Go/Local
    // Constants.expoConfig.hostUri or debuggerHost usually contains the computer's IP (e.g. 192.168.1.5:8081)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const computerIp = hostUri.split(':')[0];
        const autoUrl = `http://${computerIp}:8080/api`;
        console.log('[PROBLOOM] Auto-detected Server IP:', autoUrl);
        return autoUrl;
    }
    
    // Last resort fallback (localhost for emulators)
    return FALLBACK_URL.endsWith('/api') ? FALLBACK_URL : `${FALLBACK_URL}/api`;
}

/**
 * Returns the base server URL without the /api suffix
 */
export async function getServerBaseUrl(): Promise<string> {
    try {
        let stored = await AsyncStorage.getItem(API_STORAGE_KEY);
        if (stored) {
            if (!stored.startsWith('http')) {
                stored = `http://${stored}`;
            }
            if (stored.includes(':5001')) {
                stored = stored.replace(':5001', ':8080');
            }
            return stored.endsWith('/api') ? stored.replace('/api', '') : stored;
        }
    } catch (_) { }

    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const computerIp = hostUri.split(':')[0];
        return `http://${computerIp}:8080`;
    }

    return FALLBACK_URL.endsWith('/api') ? FALLBACK_URL.replace('/api', '') : FALLBACK_URL;
}

/**
 * Resets the server URL to the default Cloud URL
 */
export async function resetServerUrl(): Promise<void> {
    await AsyncStorage.removeItem(API_STORAGE_KEY);
}

/**
 * Saves the server base URL to AsyncStorage.
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
        const res = await fetch(`${normalized}/actuator/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return res.ok;
    } catch (_) {
        return false;
    }
}
