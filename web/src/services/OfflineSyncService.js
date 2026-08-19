import api from '../api/client.js';

// Keys used in localStorage
const QUEUE_KEY = 'km_offline_orders_queue';
const CACHE_KEYS = {
    MENU: 'km_cached_menu',
    INVENTORY: 'km_cached_inventory',
    CUSTOMERS: 'km_cached_customers',
};

// Listeners for queue updates
const listeners = new Set();

function notifyListeners(queue) {
    listeners.forEach(fn => {
        try { fn(queue); } catch (_) { }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Data Caching
// ─────────────────────────────────────────────────────────────────────────────
export function cacheMasterData(type, data) {
    if (!CACHE_KEYS[type]) return;
    try {
        localStorage.setItem(CACHE_KEYS[type], JSON.stringify({
            timestamp: Date.now(),
            data,
        }));
    } catch (e) {
        console.warn(`[OfflineSync] Failed to cache ${type}:`, e);
    }
}

export function getCachedMasterData(type) {
    if (!CACHE_KEYS[type]) return null;
    try {
        const raw = localStorage.getItem(CACHE_KEYS[type]);
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed.data || null;
        }
    } catch (_) { }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline Order Queue Management
// ─────────────────────────────────────────────────────────────────────────────
export function getPendingOfflineOrders() {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

export function saveOfflineOrder(orderPayload) {
    const queue = getPendingOfflineOrders();
    const offlineId = 'OFFLINE-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    const dateStr = new Date().toISOString();

    const constructedOrder = {
        ...orderPayload,
        _id: offlineId,
        id: offlineId,
        offlineId: offlineId,
        isOffline: true,
        orderNumber: orderPayload.orderNumber || ('OFF-' + Math.floor(100000 + Math.random() * 900000)),
        createdAt: dateStr,
        status: orderPayload.status || 'PAID',
        paymentStatus: orderPayload.paymentStatus || 'PAID',
        _synced: false,
    };

    queue.push(constructedOrder);
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error('[OfflineSync] LocalStorage write failed for queue:', e);
    }

    notifyListeners(queue);
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { count: queue.length } }));
    return constructedOrder;
}

export function removeOfflineOrder(offlineId) {
    let queue = getPendingOfflineOrders();
    queue = queue.filter(o => (o.offlineId || o._id || o.id) !== offlineId);
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (_) { }
    notifyListeners(queue);
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { count: queue.length } }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Sync Engine
// ─────────────────────────────────────────────────────────────────────────────
let isSyncing = false;

export async function syncPendingOrders() {
    if (isSyncing) return;
    const queue = getPendingOfflineOrders();
    if (!queue.length) return;

    isSyncing = true;
    console.log(`[OfflineSync] Syncing ${queue.length} offline orders to cloud...`);

    let syncedCount = 0;

    for (const order of queue) {
        try {
            // Strip client internal helper properties before POST
            const { _id, _synced, isOffline, offlineId, ...cleanPayload } = order;
            const payloadToSubmit = {
                ...cleanPayload,
                offlineId: order.offlineId || order._id,
                isOffline: true,
            };

            await api.post('/orders', payloadToSubmit);
            removeOfflineOrder(order.offlineId || order._id || order.id);
            syncedCount++;
        } catch (err) {
            console.warn(`[OfflineSync] Failed to sync order ${order.offlineId}:`, err?.message);
            // If server error, pause queue to avoid hammering
            if (err?.response?.status >= 500) break;
        }
    }

    isSyncing = false;
    if (syncedCount > 0) {
        console.log(`[OfflineSync] Successfully synced ${syncedCount} orders to cloud.`);
        window.dispatchEvent(new CustomEvent('offline-sync-completed', { detail: { syncedCount } }));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-listeners on network connect
// ─────────────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[OfflineSync] Network reconnected — triggering auto sync');
        setTimeout(syncPendingOrders, 2000);
    });

    // Heartbeat check every 20 seconds
    setInterval(() => {
        if (navigator.onLine && getPendingOfflineOrders().length > 0) {
            syncPendingOrders();
        }
    }, 20000);
}

export function subscribeQueue(fn) {
    listeners.add(fn);
    fn(getPendingOfflineOrders());
    return () => listeners.delete(fn);
}

export default {
    cacheMasterData,
    getCachedMasterData,
    getPendingOfflineOrders,
    saveOfflineOrder,
    removeOfflineOrder,
    syncPendingOrders,
    subscribeQueue,
};
