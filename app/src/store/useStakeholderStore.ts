import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StakeholderState {
    accessibleRestaurants: any[];
    selectedRestaurantId: string | null;
    setAccessibleRestaurants: (restaurants: any[]) => void;
    setSelectedRestaurantId: (id: string | null) => void;
    clearStakeholderData: () => void;
}

export const useStakeholderStore = create<StakeholderState>()(
    persist(
        (set) => ({
            accessibleRestaurants: [],
            selectedRestaurantId: null, // null means "ALL"
            setAccessibleRestaurants: (restaurants) => set({ accessibleRestaurants: restaurants }),
            setSelectedRestaurantId: (id) => set({ selectedRestaurantId: id }),
            clearStakeholderData: () => set({ accessibleRestaurants: [], selectedRestaurantId: null }),
        }),
        {
            name: 'km-stakeholder-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
