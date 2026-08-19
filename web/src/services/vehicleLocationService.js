// ─────────────────────────────────────────────────────────────────────────────
// Vehicle Location & Multi-Stock Management Helper Service
// ─────────────────────────────────────────────────────────────────────────────

const LS_VEHICLE_LOCATIONS_KEY = 'km_vehicle_locations';
const LS_VEHICLE_STOCKS_KEY = 'km_vehicle_inventory_stocks';
const LS_EMP_VEHICLES_KEY = 'km_employee_assigned_vehicles';

export const DEFAULT_LOCATIONS = ['Godown', 'Vehicle 1', 'Vehicle 2', 'Vehicle 3', 'Vehicle 4', 'Vehicle 5'];

/**
 * Get all available inventory storage locations (Godown + Vehicles)
 */
export function getVehicleLocations() {
    try {
        const raw = localStorage.getItem(LS_VEHICLE_LOCATIONS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return ['Godown', ...parsed.filter(l => l !== 'Godown')];
            }
        }
    } catch (_) { }
    return DEFAULT_LOCATIONS;
}

/**
 * Save updated list of vehicle locations
 */
export function saveVehicleLocations(locations) {
    const list = Array.from(new Set(locations.filter(Boolean)));
    localStorage.setItem(LS_VEHICLE_LOCATIONS_KEY, JSON.stringify(list.filter(l => l !== 'Godown')));
}

/**
 * Add a new storage space / vehicle
 */
export function addLocation(name) {
    if (!name || typeof name !== 'string') return getVehicleLocations();
    const cleanName = name.trim();
    if (!cleanName || cleanName.toLowerCase() === 'godown') return getVehicleLocations();

    const current = getVehicleLocations();
    if (!current.includes(cleanName)) {
        const updated = [...current, cleanName];
        saveVehicleLocations(updated);
        return updated;
    }
    return current;
}

/**
 * Delete an existing storage space / vehicle (Godown cannot be deleted)
 */
export function deleteLocation(name) {
    if (!name || name === 'Godown') return getVehicleLocations();
    const current = getVehicleLocations();
    const updated = current.filter(l => l !== name);
    saveVehicleLocations(updated);
    return updated;
}

/**
 * Get stored location stock map for all items
 * Format: { [itemId]: { "Godown": 100, "Vehicle 1": 20 } }
 */
export function getAllLocationStocks() {
    try {
        const raw = localStorage.getItem(LS_VEHICLE_STOCKS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

/**
 * Save location stocks map
 */
export function saveAllLocationStocks(stocksMap) {
    try {
        localStorage.setItem(LS_VEHICLE_STOCKS_KEY, JSON.stringify(stocksMap));
    } catch (_) { }
}

/**
 * Get stock breakdown by location for a single item.
 * Fallback: If no breakdown exists, entire currentStock is placed in "Godown".
 */
export function getItemLocationStock(item) {
    if (!item) return { 'Godown': 0 };
    const itemId = String(item._id || item.id || item.name);
    const allStocks = getAllLocationStocks();
    const stored = allStocks[itemId];

    if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
        return stored;
    }

    // Try parsing notes if present
    if (item.notes) {
        try {
            const parsed = JSON.parse(item.notes);
            if (parsed.locationStock && typeof parsed.locationStock === 'object') {
                return parsed.locationStock;
            }
        } catch (_) { }
    }

    // Fallback: Default all stock to Godown
    const total = parseFloat(item.currentStock) || 0;
    return { 'Godown': total };
}

/**
 * Set and persist location stock breakdown for an item
 */
export function setItemLocationStock(item, locationStockMap) {
    if (!item) return;
    const itemId = String(item._id || item.id || item.name);
    const allStocks = getAllLocationStocks();
    allStocks[itemId] = locationStockMap;
    saveAllLocationStocks(allStocks);
}

const LS_STOCK_MOVEMENTS_KEY = 'km_stock_movements';

/**
 * Get recorded stock movement history / audit trail
 */
export function getStockMovements() {
    try {
        const raw = localStorage.getItem(LS_STOCK_MOVEMENTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

/**
 * Log a single stock movement audit entry
 */
export function logStockMovement(entry) {
    if (!entry || !entry.itemName) return;
    const history = getStockMovements();
    const newEntry = {
        id: `MOV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toISOString(),
        itemName: entry.itemName,
        action: entry.action || 'TRANSFER', // TRANSFER, SALE, RETURN, FREE, PURCHASE
        quantity: parseFloat(entry.quantity) || 0,
        sourceLocation: entry.sourceLocation || 'Godown',
        destinationLocation: entry.destinationLocation || 'Godown',
        employee: entry.employee || 'System',
        refNo: entry.refNo || '-',
        notes: entry.notes || ''
    };
    const updated = [newEntry, ...history].slice(0, 1000); // keep last 1000 events
    try {
        localStorage.setItem(LS_STOCK_MOVEMENTS_KEY, JSON.stringify(updated));
    } catch (_) { }
}

/**
 * Transfer stock from Source Location (e.g. Godown) to Target Vehicle (e.g. Vehicle 1)
 */
export function transferItemStock(item, sourceLoc, targetLoc, quantity, employeeName = 'System') {
    if (!item || !sourceLoc || !targetLoc || quantity <= 0) return false;
    const currentMap = { ...getItemLocationStock(item) };

    const sourceStock = parseFloat(currentMap[sourceLoc] || 0);
    if (sourceStock < quantity) {
        throw new Error(`Insufficient stock in ${sourceLoc}! Available: ${sourceStock}, Requested: ${quantity}`);
    }

    currentMap[sourceLoc] = +(sourceStock - quantity).toFixed(2);
    currentMap[targetLoc] = +((parseFloat(currentMap[targetLoc] || 0)) + quantity).toFixed(2);

    setItemLocationStock(item, currentMap);

    // Audit log
    logStockMovement({
        itemName: item.name || item.itemName,
        action: 'TRANSFER',
        quantity,
        sourceLocation: sourceLoc,
        destinationLocation: targetLoc,
        employee: employeeName,
        notes: `Transferred ${quantity} from ${sourceLoc} to ${targetLoc}`
    });

    return currentMap;
}

/**
 * Get employee vehicle assignment map
 * Format: { [empIdOrEmail]: "Vehicle 1" }
 */
export function getEmployeeVehicles() {
    try {
        const raw = localStorage.getItem(LS_EMP_VEHICLES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

/**
 * Assign a vehicle/location (or array of locations) to an employee
 */
export function setEmployeeVehicle(empKey, vehicle) {
    if (!empKey) return;
    const map = getEmployeeVehicles();
    if (vehicle && vehicle !== 'Unassigned') {
        map[String(empKey)] = Array.isArray(vehicle) ? vehicle.join(',') : vehicle;
    } else {
        delete map[String(empKey)];
    }
    localStorage.setItem(LS_EMP_VEHICLES_KEY, JSON.stringify(map));
}

/**
 * Get assigned vehicle locations as an array for an employee object or ID/email
 */
export function getAssignedLocations(emp) {
    if (!emp) return ['Godown'];
    const map = getEmployeeVehicles();
    const keyId = emp._id || emp.id;
    const keyEmail = emp.email;

    let val = null;
    if (keyId && map[String(keyId)]) val = map[String(keyId)];
    else if (keyEmail && map[String(keyEmail)]) val = map[String(keyEmail)];
    else if (emp.assignedVehicle) val = emp.assignedVehicle;
    else if (Array.isArray(emp.assignedLocations) && emp.assignedLocations.length > 0) val = emp.assignedLocations;

    if (!val) return ['Godown'];
    if (Array.isArray(val)) return val.length > 0 ? val : ['Godown'];
    if (typeof val === 'string' && val.includes(',')) return val.split(',').map(s => s.trim()).filter(Boolean);
    return [val];
}

/**
 * Get primary assigned vehicle for an employee object or ID/email
 */
export function getAssignedVehicle(emp) {
    const locs = getAssignedLocations(emp);
    return locs[0] || 'Godown';
}

/**
 * Deduct stock from a specific location (Vehicle/Godown) when a bill is submitted
 */
export function deductVehicleStock(items, location = 'Godown', employeeName = 'Biller', billNo = '-') {
    if (!Array.isArray(items) || items.length === 0) return;
    const allStocks = getAllLocationStocks();

    items.forEach(cartItem => {
        const itemId = String(cartItem.itemId || cartItem.id || cartItem._id || cartItem.name);
        const qty = parseFloat(cartItem.qty || cartItem.quantity) || 0;
        if (qty <= 0) return;

        const currentMap = allStocks[itemId] ? { ...allStocks[itemId] } : { 'Godown': parseFloat(cartItem.currentStock || 0) };
        const currentLocStock = parseFloat(currentMap[location] || 0);
        const newLocStock = Math.max(0, +(currentLocStock - qty).toFixed(2));
        currentMap[location] = newLocStock;

        allStocks[itemId] = currentMap;

        // Audit log
        const isFree = cartItem.itemType === 'FREE' || cartItem.isFree;
        const isReturn = cartItem.itemType === 'RETURN' || cartItem.isReturn;
        const actionType = isFree ? 'FREE' : (isReturn ? 'RETURN' : 'SALE');

        logStockMovement({
            itemName: cartItem.name || cartItem.itemName || itemId,
            action: actionType,
            quantity: qty,
            sourceLocation: isReturn ? 'Customer' : location,
            destinationLocation: isReturn ? location : 'Customer',
            employee: employeeName,
            refNo: billNo
        });
    });

    saveAllLocationStocks(allStocks);
}
