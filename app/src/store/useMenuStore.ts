import { create } from 'zustand';
import { menuAPI } from '../api/menu';

export interface MenuItem {
    _id: string;
    name: string;
    category: string;
    price: number;
    description: string;
    isAvailable: boolean;
    isVeg: boolean;
    taxRate: number;
    imageUrl?: string;
    preparationTime?: number;
}

interface MenuState {
    items: MenuItem[];
    grouped: Record<string, MenuItem[]>;
    categories: string[];
    isLoading: boolean;
    error: string | null;
    fetchMenu: () => Promise<void>;
    addItem: (data: any) => Promise<void>;
    updateItem: (id: string, data: any) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    toggleItem: (id: string) => Promise<void>;
    bulkImport: (items: any[]) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
    items: [],
    grouped: {},
    categories: [],
    isLoading: false,
    error: null,

    fetchMenu: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await menuAPI.getAll();
            const { items, grouped, categories } = res.data.data;
            set({ items, grouped, categories, isLoading: false });
        } catch (e: any) {
            set({ error: e.response?.data?.message || 'Failed to load menu', isLoading: false });
        }
    },

    addItem: async (data) => {
        const res = await menuAPI.create(data);
        await get().fetchMenu();
        return res.data.data.item;
    },

    updateItem: async (id, data) => {
        await menuAPI.update(id, data);
        await get().fetchMenu();
    },

    deleteItem: async (id) => {
        await menuAPI.delete(id);
        set((state) => ({ items: state.items.filter((i) => i._id !== id) }));
    },

    toggleItem: async (id) => {
        await menuAPI.toggleAvailability(id);
        set((state) => ({
            items: state.items.map((i) =>
                i._id === id ? { ...i, isAvailable: !i.isAvailable } : i
            ),
        }));
    },

    bulkImport: async (items) => {
        await menuAPI.bulkCreate(items);
        await get().fetchMenu();
    },
}));
