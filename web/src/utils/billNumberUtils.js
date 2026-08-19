/**
 * Utility for Employee-Specific Bill Number Generation, Biller Metadata Binding,
 * Offline Sequence Isolation, and Sales History Filtering.
 */

/**
 * Returns a short employee code string (e.g., 'W1', 'W2', 'B1', 'B2', 'S1') or '' for Owner.
 */
export function getEmployeeCode(user) {
    if (!user || user.role === 'owner' || user.isProBloomAdmin) {
        return '';
    }

    if (user.employeeCode && typeof user.employeeCode === 'string' && user.employeeCode.trim()) {
        return user.employeeCode.trim().toUpperCase();
    }

    const name = (user.name || '').trim();
    const role = (user.role || 'biller').toLowerCase();

    // 1. Try to extract explicit role abbreviation + number from name (e.g., "Waiter 1" -> "W1", "Biller 2" -> "B2")
    const match = name.match(/(waiter|biller|staff|emp|employee|w|b|m|s)\s*(\d+)/i);
    if (match) {
        const prefix = match[1][0].toUpperCase();
        const num = match[2];
        return `${prefix}${num}`;
    }

    // 2. If name doesn't contain a number, try role initial + user ID hash or index
    const roleInitial = (role === 'waiter' ? 'W' : role === 'biller' ? 'B' : role === 'inventory' ? 'I' : 'E');

    if (user._id || user.id) {
        const idStr = String(user._id || user.id);
        const shortHex = idStr.slice(-2).toUpperCase();
        return `${roleInitial}-${shortHex}`;
    }

    const words = name.split(/\s+/).filter(Boolean);
    const initials = words.map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
    return initials ? `${roleInitial}-${initials}` : roleInitial;
}

/**
 * Generates an employee-specific bill number with an independent offline counter.
 * Examples:
 * Owner -> DIS-000001
 * Waiter 1 -> DIS-W1-000001
 * Waiter 2 -> DIS-W2-000001
 * Biller 1 -> DIS-B1-000001
 */
export function generateBillNumber(user, modePrefix = 'DIS') {
    const empCode = getEmployeeCode(user);
    const prefix = modePrefix.toUpperCase();

    // Per-user isolated sequence key to prevent offline collisions across devices / users
    const userKey = user?._id || user?.id || user?.email || 'owner';
    const seqStorageKey = `pos_bill_seq_${prefix}_${userKey}`;

    let currentSeq = 1;
    try {
        const raw = localStorage.getItem(seqStorageKey);
        if (raw) currentSeq = parseInt(raw, 10) || 1;
    } catch (_) { }

    const seqStr = String(currentSeq).padStart(6, '0');
    const billNumber = empCode ? `${prefix}-${empCode}-${seqStr}` : `${prefix}-${seqStr}`;

    // Increment and store next sequence
    try {
        localStorage.setItem(seqStorageKey, String(currentSeq + 1));
    } catch (_) { }

    return billNumber;
}

/**
 * Binds biller metadata & note tags onto an order payload before submission or offline queuing.
 */
export function attachBillerMetaToPayload(payload, user) {
    if (!user) return payload;

    const empCode = getEmployeeCode(user);
    const billerName = user.name || 'Owner';
    const billerId = user._id || user.id || '';
    const billerRole = user.role || 'owner';

    // Format bill number if not present or generic
    let billNumber = payload.billNumber || payload.orderNumber || payload.billNo;
    if (!billNumber || billNumber.startsWith('ORD000') || billNumber.startsWith('OFF-')) {
        const modePrefix = payload.source === 'poultry' ? 'PLT' : (payload.orderType === 'LINE_POS' ? 'DIS' : 'DIS');
        billNumber = generateBillNumber(user, modePrefix);
    }

    const existingNotes = payload.notes || '';
    const tagString = `||BILLNO:${billNumber}||BILLER:${billerName}||ROLE:${billerRole}||EMPID:${billerId}||EMPCODE:${empCode}||`;
    const updatedNotes = existingNotes.includes('||BILLNO:')
        ? existingNotes
        : (existingNotes ? `${existingNotes} ${tagString}` : tagString);

    return {
        ...payload,
        billNumber,
        orderNumber: billNumber,
        billerName,
        billerRole,
        billerId,
        employeeId: billerId,
        employeeName: billerName,
        employeeCode: empCode,
        notes: updatedNotes,
    };
}

/**
 * Extracts normalized biller info from an order object or embedded note tags.
 */
export function extractBillerMeta(order) {
    if (!order) return { billerName: 'Unknown', billerRole: '', billerId: '', employeeCode: '' };

    let billerName = order.billerName || order.employeeName || order.createdByName || order.createdBy?.name || order.user?.name || '';
    let billerId = order.billerId || order.employeeId || order.createdBy?._id || order.userId || '';
    let billerRole = order.billerRole || order.createdBy?.role || order.role || '';
    let empCode = order.employeeCode || '';

    if (order.notes && typeof order.notes === 'string') {
        const bNameMatch = order.notes.match(/\|\|BILLER:([^|]+)\|\|/);
        if (bNameMatch && bNameMatch[1]) billerName = bNameMatch[1];

        const rMatch = order.notes.match(/\|\|ROLE:([^|]+)\|\|/);
        if (rMatch && rMatch[1]) billerRole = rMatch[1];

        const idMatch = order.notes.match(/\|\|EMPID:([^|]+)\|\|/);
        if (idMatch && idMatch[1]) billerId = idMatch[1];

        const codeMatch = order.notes.match(/\|\|EMPCODE:([^|]+)\|\|/);
        if (codeMatch && codeMatch[1]) empCode = codeMatch[1];
    }

    if (!billerName) {
        billerName = billerRole ? billerRole.toUpperCase() : 'Owner / System';
    }

    return { billerName, billerId, billerRole, employeeCode: empCode };
}

/**
 * Filters order list for employee sales history isolation.
 * Owners/Managers see ALL orders; Employees see ONLY their own orders.
 */
export function filterOrdersForUser(orders, currentUser) {
    if (!Array.isArray(orders)) return [];
    if (!currentUser) return orders;

    const isOwnerOrManager = currentUser.role === 'owner' || currentUser.role === 'manager' || currentUser.role === 'stakeholder' || currentUser.isProBloomAdmin;

    if (isOwnerOrManager) {
        return orders;
    }

    // For non-owner employees, filter only orders where billerId or billerName matches
    const userId = String(currentUser._id || currentUser.id || '');
    const userName = (currentUser.name || '').trim().toLowerCase();

    return orders.filter(order => {
        const meta = extractBillerMeta(order);

        if (userId && meta.billerId && String(meta.billerId) === userId) {
            return true;
        }

        if (userName && meta.billerName && meta.billerName.trim().toLowerCase() === userName) {
            return true;
        }

        // Check if order was created by this user
        if (order.userId && String(order.userId) === userId) return true;
        if (order.employeeId && String(order.employeeId) === userId) return true;

        return false;
    });
}
