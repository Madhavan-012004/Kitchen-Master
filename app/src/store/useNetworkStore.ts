import { create } from 'zustand';

export type NetworkErrorType =
    | 'no_internet'
    | 'timeout'
    | 'server_error'
    | 'server_down'
    | null;

interface NetworkState {
    isOffline: boolean;
    errorType: NetworkErrorType;
    statusCode: number | null;
    setOffline: (type: NetworkErrorType, code?: number | null) => void;
    setOnline: () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
    isOffline: false,
    errorType: null,
    statusCode: null,
    setOffline: (type, code = null) => set({ isOffline: true, errorType: type, statusCode: code }),
    setOnline: () => set({ isOffline: false, errorType: null, statusCode: null }),
}));
