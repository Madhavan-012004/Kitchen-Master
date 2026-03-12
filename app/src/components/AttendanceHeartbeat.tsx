import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/client';

const PING_INTERVAL_MS = 3 * 60 * 1000; // Every 3 minutes

/**
 * AttendanceHeartbeat: invisible component that periodically pings the backend
 * with the employee's GPS location. If they leave the 200m radius, the backend
 * marks them as disconnected and returns 403, triggering auto-logout.
 */
export default function AttendanceHeartbeat() {
    const { user, logout, isAuthenticated } = useAuthStore();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Only run for employees (not owners/managers who set up the restaurant)
        if (!isAuthenticated || !user || user.role === 'owner') return;

        const ping = async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                await apiClient.post('/attendance/ping', {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                });
            } catch (error: any) {
                // If the server returns 403, the employee is out of range — log them out
                if (error?.response?.status === 403) {
                    await logout();
                    // Note: Navigation will reset automatically because isAuthenticated becomes false
                }
            }
        };

        // Fire once immediately, then on interval
        ping();
        intervalRef.current = setInterval(ping, PING_INTERVAL_MS);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isAuthenticated, user?.role]);

    return null; // This is an invisible tracker component
}
