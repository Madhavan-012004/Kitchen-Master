import React, { useState, useEffect } from 'react';
import { getPendingOfflineOrders, subscribeQueue, syncPendingOrders } from '../services/OfflineSyncService.js';
import './OfflineSyncBadge.css';

export default function OfflineSyncBadge() {
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncToast, setSyncToast] = useState(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const unsubscribe = subscribeQueue((queue) => {
            setPendingCount(queue.length);
        });

        const handleSyncCompleted = (e) => {
            const count = e.detail?.syncedCount || 0;
            if (count > 0) {
                setSyncToast(`⚡ Auto-synced ${count} offline bill${count > 1 ? 's' : ''} to cloud!`);
                setTimeout(() => setSyncToast(null), 4000);
            }
        };

        window.addEventListener('offline-sync-completed', handleSyncCompleted);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('offline-sync-completed', handleSyncCompleted);
            unsubscribe();
        };
    }, []);

    const handleManualSync = async () => {
        if (!isOnline || isSyncing || pendingCount === 0) return;
        setIsSyncing(true);
        await syncPendingOrders();
        setIsSyncing(false);
    };

    if (pendingCount === 0 && isOnline && !syncToast) {
        return (
            <div className="offline-sync-pill online-synced" title="Cloud Sync Connected & Active">
                <span className="sync-dot green-dot"></span>
                <span className="sync-text">Cloud Active</span>
            </div>
        );
    }

    return (
        <div className="offline-sync-container">
            {syncToast && (
                <div className="sync-toast-popup">
                    {syncToast}
                </div>
            )}

            {!isOnline && (
                <div className="offline-sync-pill offline-warning" title="Network disconnected — billing running in offline cache mode">
                    <span className="sync-dot amber-dot"></span>
                    <span className="sync-text">Offline Mode ({pendingCount} Queued)</span>
                </div>
            )}

            {isOnline && pendingCount > 0 && (
                <button
                    className={`offline-sync-pill sync-action-btn ${isSyncing ? 'syncing' : ''}`}
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    title="Click to manually push queued offline bills to cloud database"
                >
                    <span className="sync-icon">{isSyncing ? '🔄' : '☁️'}</span>
                    <span className="sync-text">
                        {isSyncing ? `Syncing ${pendingCount}...` : `Sync ${pendingCount} Offline Bill${pendingCount > 1 ? 's' : ''}`}
                    </span>
                </button>
            )}
        </div>
    );
}
