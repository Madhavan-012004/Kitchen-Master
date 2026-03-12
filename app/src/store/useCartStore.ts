import { create } from 'zustand';

export interface CartItem {
    _id?: string;
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    taxRate: number;
    category: string;
    notes?: string;
    status?: string;
    addedBy?: string;
    addedByName?: string;
}

interface CartState {
    items: CartItem[];
    tableNumber: string;
    orderId: string | null;
    orderNotes: string;
    discountType: 'none' | 'percentage' | 'flat';
    discountValue: number;
    addItem: (item: CartItem) => void;
    removeItem: (menuItemId: string) => void;
    updateQuantity: (menuItemId: string, qty: number) => void;
    updateNotes: (menuItemId: string, notes: string) => void;
    setTableNumber: (t: string) => void;
    setOrderNotes: (n: string) => void;
    setDiscount: (type: 'none' | 'percentage' | 'flat', value: number) => void;
    loadOrder: (order: any) => void;
    clearCart: () => void;
    getSubtotal: () => number;
    getTaxAmount: () => number;
    getDiscountAmount: () => number;
    getTotal: () => number;
    markItemServed: (menuItemId: string) => void;
    addBulkItems: (items: CartItem[]) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    tableNumber: 'Takeaway',
    orderId: null,
    orderNotes: '',
    discountType: 'none',
    discountValue: 0,

    addItem: (item) =>
        set((state) => {
            // Only consolidate with items that don't have an _id (i.e., not yet sent to server)
            const existing = state.items.find((i) => i.menuItemId === item.menuItemId && !i._id);
            if (existing) {
                return {
                    items: state.items.map((i) =>
                        (i.menuItemId === item.menuItemId && !i._id)
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    ),
                };
            }
            // If it's a new item being added, ensure it doesn't have an _id and status is preparing
            return { items: [...state.items, { ...item, quantity: 1, _id: undefined, status: 'preparing' }] };
        }),

    removeItem: (menuItemId) =>
        set((state) => ({ items: state.items.filter((i) => i.menuItemId !== menuItemId) })),

    updateQuantity: (menuItemId, qty) =>
        set((state) => ({
            items: qty <= 0
                ? state.items.filter((i) => i.menuItemId !== menuItemId)
                : state.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity: qty } : i)),
        })),

    updateNotes: (menuItemId, notes) =>
        set((state) => ({
            items: state.items.map((i) => (i.menuItemId === menuItemId ? { ...i, notes } : i)),
        })),

    setTableNumber: (tableNumber) => set({ tableNumber }),
    setOrderNotes: (orderNotes) => set({ orderNotes }),
    setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),

    loadOrder: (order) => set({
        items: order.items || [],
        tableNumber: order.tableNumber || 'Takeaway',
        orderId: order._id || null,
        orderNotes: order.notes || '',
        discountType: order.discountType || 'none',
        discountValue: order.discountValue || 0,
    }),

    clearCart: () =>
        set({ items: [], tableNumber: 'Takeaway', orderId: null, orderNotes: '', discountType: 'none', discountValue: 0 }),

    getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    },

    getTaxAmount: () => {
        const { items } = get();
        return items.reduce((sum, i) => sum + (i.price * i.quantity * i.taxRate) / 100, 0);
    },

    getDiscountAmount: () => {
        const { discountType, discountValue } = get();
        const subtotal = get().getSubtotal();
        if (discountType === 'percentage') return (subtotal * discountValue) / 100;
        if (discountType === 'flat') return Math.min(discountValue, subtotal);
        return 0;
    },

    getTotal: () => {
        const subtotal = get().getSubtotal();
        const tax = get().getTaxAmount();
        const discount = get().getDiscountAmount();
        return Math.max(0, subtotal + tax - discount);
    },

    markItemServed: (menuItemId) =>
        set((state) => ({
            items: state.items.map((i) => i.menuItemId === menuItemId ? { ...i, status: 'served' } : i)
        })),

    addBulkItems: (newItems) =>
        set((state) => {
            let currentItems = [...state.items];
            newItems.forEach(item => {
                const existing = currentItems.find(i => i.menuItemId === item.menuItemId && !i._id);
                if (existing) {
                    currentItems = currentItems.map(i =>
                        (i.menuItemId === item.menuItemId && !i._id)
                            ? { ...i, quantity: i.quantity + item.quantity }
                            : i
                    );
                } else {
                    currentItems.push({ ...item, _id: undefined, status: 'preparing' });
                }
            });
            return { items: currentItems };
        }),
}));
