import { create } from 'zustand';

export interface Notification {
    id: string;
    message: string;
    timestamp: Date;
    isRead: boolean;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (message: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    unreadCount: 0,

    addNotification: (message) => set((state) => {
        const newNotification: Notification = {
            id: Math.random().toString(36).substring(7),
            message,
            timestamp: new Date(),
            isRead: false
        };
        return {
            notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
            unreadCount: state.unreadCount + 1
        };
    }),

    markAllAsRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0
    })),

    clearAll: () => set({
        notifications: [],
        unreadCount: 0
    })
}));
