// ─── Device Fingerprinting & Active Session Management ───────────────────────

/**
 * Get or generate a persistent unique ID for this device / browser.
 */
export function getDeviceId() {
    let devId = localStorage.getItem('probloom_device_id');
    if (!devId) {
        devId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem('probloom_device_id', devId);
    }
    return devId;
}

/**
 * Detect OS & Browser details for user-friendly display.
 */
export function getDeviceInfo() {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    let browser = 'Unknown Browser';
    let iconType = 'desktop';

    // Detect OS
    if (ua.includes('Win')) os = 'Windows PC';
    else if (ua.includes('Mac')) os = 'macOS Device';
    else if (ua.includes('Android')) { os = 'Android Phone'; iconType = 'mobile'; }
    else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS Device'; iconType = 'mobile'; }
    else if (ua.includes('Linux')) os = 'Linux System';

    // Detect Browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome Browser';
    else if (ua.includes('Edg')) browser = 'Edge Browser';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari Browser';
    else if (ua.includes('Firefox')) browser = 'Firefox Browser';

    const deviceName = `${os} • ${browser}`;

    return {
        deviceId: getDeviceId(),
        deviceName,
        os,
        browser,
        iconType,
        lastActive: new Date().toISOString()
    };
}

/**
 * Get tenant max allowed devices limit (default 3).
 */
export function getTenantDeviceLimit(user) {
    try {
        const limits = JSON.parse(localStorage.getItem('probloom_tenant_device_limits') || '{}');
        const identifier = user?.email || user?.id || user?._id;
        if (identifier && limits[identifier] !== undefined) {
            return Number(limits[identifier]) || 3;
        }
        return Number(user?.maxDevices) || 3;
    } catch {
        return 3;
    }
}

/**
 * Save tenant max devices limit.
 */
export function setTenantDeviceLimit(identifier, limit) {
    try {
        const limits = JSON.parse(localStorage.getItem('probloom_tenant_device_limits') || '{}');
        limits[identifier] = Number(limit) || 3;
        localStorage.setItem('probloom_tenant_device_limits', JSON.stringify(limits));
    } catch (e) {
        console.error('Error saving tenant device limit:', e);
    }
}

/**
 * Get active device sessions map per tenant email/id.
 */
function getSessionsStore() {
    try {
        return JSON.parse(localStorage.getItem('probloom_active_device_sessions') || '{}');
    } catch {
        return {};
    }
}

function saveSessionsStore(store) {
    try {
        localStorage.setItem('probloom_active_device_sessions', JSON.stringify(store));
    } catch (e) {
        console.error('Error saving device sessions:', e);
    }
}

/**
 * Get active sessions list for a specific tenant identifier.
 */
export function getActiveDeviceSessions(identifier) {
    if (!identifier) return [];
    const store = getSessionsStore();
    return store[identifier] || [];
}

/**
 * Check if the current device is already registered for this tenant.
 */
export function isCurrentDeviceRegistered(identifier) {
    const sessions = getActiveDeviceSessions(identifier);
    const currentDevId = getDeviceId();
    return sessions.some(s => s.deviceId === currentDevId);
}

/**
 * Register current device into active sessions.
 */
export function registerCurrentDeviceSession(identifier) {
    if (!identifier) return;
    const store = getSessionsStore();
    const sessions = store[identifier] || [];
    const info = getDeviceInfo();

    // Check if current device exists in sessions
    const existingIndex = sessions.findIndex(s => s.deviceId === info.deviceId);
    if (existingIndex >= 0) {
        sessions[existingIndex].lastActive = new Date().toISOString();
        sessions[existingIndex].deviceName = info.deviceName;
    } else {
        sessions.push(info);
    }

    store[identifier] = sessions;
    saveSessionsStore(store);
}

/**
 * Logout and remove a specific device from active sessions.
 */
export function logoutDeviceSession(identifier, deviceIdToRemove) {
    if (!identifier || !deviceIdToRemove) return;
    const store = getSessionsStore();
    const sessions = store[identifier] || [];
    store[identifier] = sessions.filter(s => s.deviceId !== deviceIdToRemove);
    saveSessionsStore(store);
}
