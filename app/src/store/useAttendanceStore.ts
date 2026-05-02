import { create } from 'zustand';
import { attendanceAPI } from '../api/attendance';

interface AttendanceState {
    isActive: boolean;
    checkInTime: string | null;
    isLoading: boolean;
    error: string | null;
    
    fetchStatus: () => Promise<void>;
    checkIn: (latitude: number, longitude: number) => Promise<void>;
    checkOut: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
    isActive: false,
    checkInTime: null,
    isLoading: false,
    error: null,

    fetchStatus: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await attendanceAPI.getStatus();
            const { isActive, checkInTime } = res.data.data;
            set({ isActive, checkInTime, isLoading: false });
        } catch (error: any) {
            set({ isLoading: false });
            // Don't set error for background status check
        }
    },

    checkIn: async (latitude, longitude) => {
        set({ isLoading: true, error: null });
        try {
            const res = await attendanceAPI.checkIn(latitude, longitude);
            const { checkInTime } = res.data.data;
            set({ isActive: true, checkInTime, isLoading: false });
        } catch (error: any) {
            const msg = error.response?.data?.message || error.message || 'Check-in failed';
            set({ error: msg, isLoading: false });
            throw error;
        }
    },

    checkOut: async () => {
        set({ isLoading: true, error: null });
        try {
            await attendanceAPI.checkOut();
            set({ isActive: false, checkInTime: null, isLoading: false });
        } catch (error: any) {
            const msg = error.response?.data?.message || error.message || 'Check-out failed';
            set({ error: msg, isLoading: false });
            throw error;
        }
    },
}));
