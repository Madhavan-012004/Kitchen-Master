import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import './SupermarketPOS.css'

const TAX_RATES = { SGST: 9, CGST: 9, IGST: 0 }

function useStickyState(defaultValue, key) {
    const [value, setValue] = useState(() => {
        const stickyValue = window.localStorage.getItem(key);
        return stickyValue !== null
            ? JSON.parse(stickyValue)
            : defaultValue;
    });
    useEffect(() => {
        window.localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);
    return [value, setValue];
}


function calcRow(row, taxType, taxRate = 18) {
    const qty   = parseFloat(row.qty)   || 0
    const mrp   = parseFloat(row.mrp)   || 0
    const disPct= parseFloat(row.disPct)|| 0

    // Rate after discount on MRP
    const rate   = mrp * (1 - disPct / 100)
    const disRs  = (mrp - rate) * qty

    const sgstPct = taxRate / 2
    const cgstPct = taxRate / 2
    const igstPct = 0

    let basic, sgstAmt, cgstAmt, igstAmt, tax, total

    if (taxType === 'Inclusive') {
        sgstAmt = rate * qty * (sgstPct / 100)
        cgstAmt = rate * qty * (cgstPct / 100)
        igstAmt = rate * qty * (igstPct / 100)
        tax     = sgstAmt + cgstAmt + igstAmt
        basic   = rate * (1 - taxRate / 100)
        total   = rate * qty
    } else {
        basic   = rate
        sgstAmt = basic * qty * (sgstPct / 100)
        cgstAmt = basic * qty * (cgstPct / 100)
        igstAmt = basic * qty * (igstPct / 100)
        tax     = sgstAmt + cgstAmt + igstAmt
        total   = basic * qty + tax
    }

    return {
        ...row,
        rate:    +rate.toFixed(2),
        basic:   +basic.toFixed(2),
        disRs:   +disRs.toFixed(2),
        sgst:    +sgstAmt.toFixed(2),
        cgst:    +cgstAmt.toFixed(2),
        igst:    +igstAmt.toFixed(2),
        tax:     +tax.toFixed(2),
        total:   +total.toFixed(2),
    }
}

function emptyRow() {
    return { id: Date.now(), productId: '', productName: '', qty: 1, mrp: 0, basic: 0, rate: 0, disPct: 0, disRs: 0, sgst: 0, cgst: 0, igst: 0, tax: 0, total: 0, remarks: '', inStock: 0, batchNo: '', mfgDate: '', expDate: '', hsnCode: '' }
}

function SupermarketPOSContent({ tabId, printBill, isActive, onBillNoChange }) {
    const { user } = useAuth()
    const taxRate = typeof user?.taxRate === 'number' ? user.taxRate : 18;
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

    // ── Header state ─────────────────────────────────────────
    const [billCategory, setBillCategory] = useStickyState('SALES', `sm_pos_billCategory_${tabId}`)
    const [taxType, setTaxType]           = useStickyState('Inclusive', `sm_pos_taxType_${tabId}`)
    const [dealer, setDealer]             = useStickyState('Unregistered', `sm_pos_dealer_${tabId}`)
    const [category, setCategory]         = useStickyState('', `sm_pos_category_${tabId}`)
    const [payment, setPayment]           = useStickyState('CASH', `sm_pos_payment_${tabId}`)
    const [billDate, setBillDate]         = useStickyState(today, `sm_pos_billDate_${tabId}`)
    const [disPctHeader, setDisPctHeader] = useState(0)
    const [billNo, setBillNo]             = useStickyState('', `sm_pos_billNo_${tabId}`)
    const [dueDate, setDueDate]           = useStickyState('', `sm_pos_dueDate_${tabId}`)
    const [poDate, setPODate]             = useStickyState('', `sm_pos_poDate_${tabId}`)
    const [empCode, setEmpCode]           = useStickyState('', `sm_pos_empCode_${tabId}`)
    const [freightCharges, setFreightCharges] = useStickyState(0, `sm_pos_freightCharges_${tabId}`)
    const [vehicleNumber, setVehicleNumber]   = useStickyState('', `sm_pos_vehicleNumber_${tabId}`)
    const billType = '3 Inch';

    const [noTax, setNoTax]                   = useStickyState(false, `sm_pos_noTax_${tabId}`)
    const [manualBillNo, setManualBillNo]     = useStickyState(false, `sm_pos_manualBillNo_${tabId}`)
    const [netAmount, setNetAmount]           = useStickyState(false, `sm_pos_netAmount_${tabId}`)
    const [updateMrp, setUpdateMrp]           = useStickyState(false, `sm_pos_updateMrp_${tabId}`)
    const [updateRate, setUpdateRate]         = useStickyState(false, `sm_pos_updateRate_${tabId}`)
    const [showAdvancedCols, setShowAdvancedCols] = useStickyState(false, `sm_pos_showAdvancedCols_${tabId}`)

    // ── Advanced Search Modal ────────────────────────────────
    const [showSearchModalForIdx, setShowSearchModalForIdx] = useState(null)
    const [heldBills, setHeldBills] = useState([])
    const [showHeldModal, setShowHeldModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchSelectedIdx, setSearchSelectedIdx] = useState(0)

    // ── Settlement Modal ─────────────────────────────────────
    const [showSettlement, setShowSettlement] = useState(false)
    const [tenderCash, setTenderCash]         = useState(0)
    const [tenderUPI, setTenderUPI]           = useState(0)
    const [tenderCard, setTenderCard]         = useState(0)
    const [editableGrandTotal, setEditableGrandTotal] = useState(undefined)

    // ── History & Email Modals ───────────────────────────────
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [historyOrders, setHistoryOrders]       = useState([])
    const [historyLoading, setHistoryLoading]     = useState(false)
    const [showEmailModal, setShowEmailModal]     = useState(false)
    const [emailAddr, setEmailAddr]               = useState('')
    const [pendingReprint, setPendingReprint]     = useState(null)
    const [showReprintLang, setShowReprintLang]   = useState(false)

    // ── Rows ─────────────────────────────────────────────────
    const [rows, setRows] = useStickyState([emptyRow()], `sm_pos_rows_${tabId}`)
    const [activeRowIdx, setActiveRowIdx] = useState(0)
    const [activeCol, setActiveCol] = useState('productId')
    const [rowWithDeleteBtn, setRowWithDeleteBtn] = useState(null)
    const [outOfStockAlert, setOutOfStockAlert] = useState(null)

    // Auto-focus the active cell
    useEffect(() => {
        const el = document.getElementById(`cell-${activeRowIdx}-${activeCol}`)
        if (el) el.focus()
    }, [activeRowIdx, activeCol])

    // Auto-revert row delete button after 2s
    useEffect(() => {
        if (rowWithDeleteBtn === null) return;
        const timer = setTimeout(() => setRowWithDeleteBtn(null), 3000);
        return () => clearTimeout(timer);
    }, [rowWithDeleteBtn]);

    // Click anywhere else to revert row delete button
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.col-sno')) {
                setRowWithDeleteBtn(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleCellKeyDown(e, idx, col) {
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveRowIdx(Math.max(0, idx - 1))
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveRowIdx(Math.min(rows.length - 1, idx + 1))
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (col === 'productId' || col === 'productName') {
                e.preventDefault()
                lookupProduct(idx, e.target.value, e.key === 'Tab')
            } else if (e.key === 'Enter') {
                e.preventDefault()
                setActiveRowIdx(Math.min(rows.length - 1, idx + 1))
            }
        }
    }

    // ── Customer & Bill Details ──────────────────────────────
    const [customerId, setCustomerId]       = useStickyState('', `sm_pos_customerId_${tabId}`)
    const [customerName, setCustomerName]   = useStickyState('', `sm_pos_customerName_${tabId}`)
    const [customerMobile, setCustomerMobile] = useStickyState('', `sm_pos_customerMobile_${tabId}`)
    const [prevBalance, setPrevBalance]       = useStickyState(0, `sm_pos_prevBalance_${tabId}`)
    const [customerTab, setCustomerTab]       = useState('customer') // 'customer' | 'receipt'
    
    // ── Pharmacy/Custom Bill Fields ──────────────────────────
    const billTemplate = user?.basicBillTemplate || 'standard';
    const [printWithGst, setPrintWithGst]     = useStickyState(true, `sm_pos_printWithGst_${tabId}`);

    // Automatically set printWithGst checkbox depending on taxType selection
    useEffect(() => {
        if (taxType === 'No Tax') {
            setPrintWithGst(false);
        } else {
            setPrintWithGst(true);
        }
    }, [taxType, setPrintWithGst]);

    const [doctorName, setDoctorName]         = useStickyState('', `sm_pos_doctorName_${tabId}`)
    const [numberOfDays, setNumberOfDays]     = useStickyState('', `sm_pos_numberOfDays_${tabId}`)
    const [isPharmacyDetailsOpen, setIsPharmacyDetailsOpen] = useState(true)
    const [showTemplateModal, setShowTemplateModal] = useState(false)

    // ── Inventory lookup ─────────────────────────────────────
    const [inventory, setInventory]   = useState([])
    const [barcodeBuf, setBarcodeBuf] = useState('')
    const barcodeBufRef = useRef('')
    const barcodeTimer  = useRef(null)

    // ── Misc ─────────────────────────────────────────────────
    const [notification, setNotification] = useState('')
    const [saving, setSaving]             = useState(false)
    const [inStock, setInStock]           = useState(0)
    const lastEnterTimeRef = useRef(0)
    
    // ── Scale state ──────────────────────────────────────────
    const [scaleData, setScaleData] = useState(0)
    const [isScaleConnected, setIsScaleConnected] = useState(false)
    const [port, setPort] = useState(null)
    const [baudRate, setBaudRate] = useState(9600)
    const readerRef = useRef(null)
    const keepReadingRef = useRef(true)

    const firstProductIdRef = useRef(null)

    // ── Fetch inventory catalog ───────────────────────────────
    const refreshInventory = useCallback(async () => {
        try {
            const res = await api.get('/inventory');
            let items = [];
            // Handle different API response structures
            if (Array.isArray(res.data)) {
                items = res.data;
            } else if (res.data?.data?.items && Array.isArray(res.data.data.items)) {
                items = res.data.data.items;
            } else if (res.data?.items && Array.isArray(res.data.items)) {
                items = res.data.items;
            } else if (res.data?.data && Array.isArray(res.data.data)) {
                items = res.data.data;
            }
            setInventory(items);
            return items;
        } catch (err) {
            console.error('Failed to refresh inventory', err);
            return [];
        }
    }, []);

    useEffect(() => {
        refreshInventory();
        // Generate bill number only if it's empty (prevents overwriting sticky state on load)
        if (!billNo) {
            setBillNo('TRP' + String(Math.floor(1000 + Math.random() * 9000)));
        }
    }, [refreshInventory]);

    useEffect(() => {
        if (onBillNoChange) onBillNoChange(billNo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [billNo]);

    function notify(msg, ms = 2500) {
        setNotification(msg)
        setTimeout(() => setNotification(''), ms)
    }

    // ── SCALE INTEGRATION (Web Serial API) ────────────────────
    const connectScale = async () => {
        if (!("serial" in navigator)) {
            alert("Web Serial API not supported in your browser. Use Chrome or Edge.");
            return;
        }

        try {
            if (port) { try { await port.close(); } catch(e) {} }

            const newPort = await navigator.serial.requestPort();
            await newPort.open({ baudRate: baudRate });
            setPort(newPort);
            setIsScaleConnected(true);
            keepReadingRef.current = true;

            const reader = newPort.readable.getReader();
            readerRef.current = reader;
            const decoder = new TextDecoder();

            let buffer = '';
            try {
                while (keepReadingRef.current) {
                    try {
                        const { value, done } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;

                        if (buffer.includes('\n') || buffer.includes('\r')) {
                            const lines = buffer.split(/[\r\n]+/);
                            buffer = lines.pop();
                            for (const line of lines) {
                                if (!line.trim()) continue;
                                console.log('Scale Raw Data:', line);
                                const match = line.match(/[-+]?\d*\.?\d+/);
                                if (match) {
                                    const val = parseFloat(match[0]);
                                    if (!isNaN(val)) setScaleData(Math.abs(val));
                                }
                            }
                        }
                    } catch (readErr) {
                        console.warn('Transient scale read error, retrying...', readErr);
                        // Brief pause before retry if loop is still active
                        if (keepReadingRef.current) await new Promise(r => setTimeout(r, 100));
                        else break;
                    }
                }
            } catch (err) {
                console.error('Scale loop critical error:', err);
            } finally {
                try { reader.releaseLock(); } catch(e) {}
                readerRef.current = null;
            }
        } catch (err) {
            console.error('Scale connection failed:', err);
            setIsScaleConnected(false);
            if (err.name === 'NetworkError') {
                alert("Could not open port. Is another app using it? Try replugging the scale.");
            }
        }
    };

    const disconnectScale = async () => {
        setIsScaleConnected(false);
        keepReadingRef.current = false;
        if (readerRef.current) { try { await readerRef.current.cancel(); } catch(e) {} }
        if (port) {
            try { await port.close(); } catch (err) { console.error('Port close error:', err); }
            setPort(null);
        }
    };

    const handleCaptureWeight = (idx) => {
        if (!isScaleConnected) {
            notify('⚠️ Connect scale first');
            return;
        }
        updateRow(idx, 'qty', scaleData);
        notify(`⚖️ Weight captured: ${scaleData}`);
    };

    // ── Computed totals ───────────────────────────────────────
    const computed = rows.map(r => calcRow(r, taxType, taxRate))
    const totalItems    = computed.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0)
    const totalDiscount = computed.reduce((s, r) => s + r.disRs, 0)
    const subTotal      = computed.reduce((s, r) => s + r.total, 0)
    const grandTotal    = subTotal + parseFloat(freightCharges || 0) - (subTotal * (parseFloat(disPctHeader) || 0) / 100)

    const handleEditableGrandTotalChange = (e) => {
        const val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0) {
            setEditableGrandTotal(e.target.value);
            return;
        }
        setEditableGrandTotal(val);
        
        const baseSubtotal = subTotal;
        const extraCharges = parseFloat(freightCharges || 0);
        const discountAmt = Math.max(0, baseSubtotal + extraCharges - val);
        
        const newDisPct = baseSubtotal > 0 ? (discountAmt / baseSubtotal) * 100 : 0;
        setDisPctHeader(Number(newDisPct.toFixed(2)));
    };

    const handleDiscountPctChange = (e) => {
        const val = parseFloat(e.target.value) || 0;
        setDisPctHeader(val);
        setEditableGrandTotal(undefined);
    };

    const handleDiscountAmtChange = (e) => {
        const val = parseFloat(e.target.value) || 0;
        const newDisPct = subTotal > 0 ? (val / subTotal) * 100 : 0;
        setDisPctHeader(Number(newDisPct.toFixed(2)));
        setEditableGrandTotal(undefined);
    };

    // ── When a row's MRP/qty/dis changes, recalc ─────────────
    function updateRow(idx, field, value) {
        let triggerStockAlert = null;

        setRows(prev => {
            const next = [...prev]
            let finalValue = value;

            if (field === 'qty' && next[idx] && next[idx].productId) {
                const newQty = parseFloat(value) || 0;
                let otherQty = 0;
                for (let i = 0; i < next.length; i++) {
                    if (i !== idx && next[i].productId === next[idx].productId) {
                        otherQty += (parseFloat(next[i].qty) || 0);
                    }
                }
                const totalRequested = otherQty + newQty;
                const available = parseFloat(next[idx].inStock) || 0;
                
                if (totalRequested > available) {
                    triggerStockAlert = {
                        name: next[idx].productName,
                        available: available,
                        requested: totalRequested
                    };
                    finalValue = available - otherQty;
                    if (finalValue < 0) finalValue = 0;
                }
            }

            next[idx] = { ...next[idx], [field]: finalValue }
            next[idx] = calcRow(next[idx], taxType, taxRate)
            return next
        })

        if (triggerStockAlert) {
            setOutOfStockAlert(triggerStockAlert);
        }
    }

    // ── Advanced Search Matches ───────────────────────────────
    const searchMatches = useMemo(() => {
        if (!inventory || !Array.isArray(inventory)) return []
        if (!searchQuery) return inventory.slice(0, 50)
        const q = searchQuery.trim().toLowerCase()
        return inventory.filter(i => 
            (i.name || '').toLowerCase().includes(q) || 
            (i.barcode || '').toLowerCase().includes(q)
        ).slice(0, 50)
    }, [inventory, searchQuery])

    function forceApplyProductToRow(idx, found) {
        const safeId = found.barcode || found.id || found._id || 'N/A';
        const available = found.currentStock || 0;
        let triggerStockAlert = null;
        
        // --- CHECK FOR DUPLICATES ---
        const existingIdx = rows.findIndex((r, i) => i !== idx && r.productId === safeId);
        if (existingIdx !== -1) {
            // Already in the bill, increment it
            const currentQty = parseFloat(rows[existingIdx].qty) || 0;
            const newQty = currentQty + 1;
            
            if (newQty > available) {
                setOutOfStockAlert({
                    name: rows[existingIdx].productName,
                    available: available,
                    requested: newQty
                });
            } else {
                updateRow(existingIdx, 'qty', newQty);
                notify(`Quantity increased for ${rows[existingIdx].productName} [Row ${existingIdx + 1}]`);
            }
            
            // Clear the current input row (idx) so it remains empty for the next scan
            setRows(prev => {
                const next = [...prev];
                next[idx] = emptyRow();
                return next;
            });

            // Focus back on the current row's productId for next scan
            setActiveRowIdx(idx);
            setActiveCol('productId');
            setTimeout(() => {
                const el = document.getElementById(`cell-${idx}-productId`);
                if (el) { el.value = ''; el.focus(); }
            }, 10);
            return;
        }

        // --- Standard logic for new item ---
        let initialQty = rows[idx]?.qty > 0 ? rows[idx].qty : 1;
        if (initialQty > available) {
            triggerStockAlert = {
                name: found.name,
                available: available,
                requested: initialQty
            };
            initialQty = available > 0 ? available : 0;
        }

        setRows(prev => {
            const next = [...prev]
            next[idx] = calcRow({
                ...next[idx],
                productId:   safeId,
                productName: found.name,
                mrp:         found.price ? Number(found.price).toFixed(2) : 0,
                inStock:     available,
                unit:        found.unit || 'PIECE',
                qty:         initialQty,
                batchNo:     found.batchNo || '',
                mfgDate:     found.mfgDate || '',
                expDate:     found.expDate || '',
                hsnCode:     found.hsnCode || '',
                barcode:     found.barcode || '',
                inventoryItemId: found._id || found.id || ''
            }, taxType, taxRate)
            return next
        })
        setInStock(available)
        
        if (triggerStockAlert) {
            setOutOfStockAlert(triggerStockAlert);
        }
        
        setRows(prev => {
            if (idx === prev.length - 1) return [...prev, emptyRow()]
            return prev
        })
        setActiveRowIdx(idx + 1)
        setActiveCol('productId')
        setTimeout(() => document.getElementById(`cell-${idx + 1}-productId`)?.focus(), 10)
    }

    // ── Product lookup by ID or barcode ──────────────────────
    function lookupProduct(idx, query, isTab = false) {
        query = query.trim()
        if (!query) {
            if (isTab) {
                // Force fetch
                refreshInventory();
                
                setShowSearchModalForIdx(idx)
                setSearchQuery('')
                setSearchSelectedIdx(0)
                setTimeout(() => document.getElementById('advanced-search-input')?.focus(), 10)
            } else {
                // Enter pressed on empty field, just move to next row
                setActiveRowIdx(Math.min(rows.length - 1, idx + 1))
            }
            return
        }
        const found = inventory.find(i =>
            (i.barcode && i.barcode === query) ||
            String(i.id) === query ||
            String(i._id) === query ||
            (i.name || '').toLowerCase() === query.toLowerCase()
        )
        if (found) {
            forceApplyProductToRow(idx, found)
        } else {
            // Force fetch just in case it was newly added in a different tab
            refreshInventory().then(actualItems => {
                // Try searching again after refresh
                const foundAfterSync = actualItems.find(i =>
                    i.barcode === query ||
                    String(i._id) === query ||
                    (i.name || '').toLowerCase() === query.toLowerCase()
                );
                if (foundAfterSync) {
                    forceApplyProductToRow(idx, foundAfterSync);
                } else if (!isTab) {
                    notify('❌ Product not found')
                }
            });

            if (isTab) {
                // Not found exactly, pop open the search modal with this query
                setShowSearchModalForIdx(idx)
                setSearchQuery(query)
                setSearchSelectedIdx(0)
                setTimeout(() => document.getElementById('advanced-search-input')?.focus(), 10)
            }
        }
    }

    // ── Global HID Barcode Scanner & Shortcuts ────────────────
    useEffect(() => {
        function onKey(e) {
            // ALT+S for Scale toggle
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (isScaleConnected) disconnectScale();
                else connectScale();
                return;
            }

            if (e.key === 'Enter' && barcodeBufRef.current.length > 2) {
                const code = barcodeBufRef.current
                barcodeBufRef.current = ''
                lookupProduct(activeRowIdx, code)
                return
            }
            if (e.key.length === 1) {
                barcodeBufRef.current += e.key
                clearTimeout(barcodeTimer.current)
                barcodeTimer.current = setTimeout(() => { barcodeBufRef.current = '' }, 120)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [activeRowIdx, inventory, taxType, isActive, isScaleConnected])

    // ── Keyboard shortcuts ────────────────────────────────────
    useEffect(() => {
        function onShortcut(e) {
            if (!isActive) return;
            if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); isScaleConnected ? disconnectScale() : connectScale() }
            if (e.key === 'F1')  { e.preventDefault(); handleNewBill() }
            if (e.key === 'F2')  { e.preventDefault(); handleSave() }
            if (e.key === 'F3')  { e.preventDefault(); loadHistory() }
            if (e.key === 'F4')  { e.preventDefault(); handleParkBill() }
            if (e.key === 'F5')  { e.preventDefault(); focusBarcode() }
            if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); setShowEmailModal(true) }
            if (e.altKey && e.key.toLowerCase() === 'c') { 
                e.preventDefault(); 
                const errs = computed.filter(r=>r.productName && r.mrp===0);
                notify(errs.length ? `⚠️ ${errs.length} rows have MRP=0` : '✅ No errors')
            }
            if (e.altKey && e.key.toLowerCase() === 'w') { e.preventDefault(); setShowHeldModal(true) }
            
            if (e.key === 'Delete') { 
                e.preventDefault(); 
                if (activeRowIdx !== null) handleDeleteRow(activeRowIdx) 
            }
            if (e.key === 'Enter') {
                const now = Date.now()
                const diff = now - lastEnterTimeRef.current
                lastEnterTimeRef.current = now

                if (showSettlement) {
                    e.preventDefault()
                    confirmSave()
                } else if (diff < 500) {
                    // Double enter detected
                    const validRows = computed.filter(r => r.productName && r.qty > 0)
                    if (validRows.length > 0) {
                        e.preventDefault()
                        handleSave()
                    }
                }
            }

            if (e.key === 'Escape') {
                if (showSettlement) setShowSettlement(false)
                if (showHistoryModal) setShowHistoryModal(false)
                if (showEmailModal) setShowEmailModal(false)
                if (showHeldModal) setShowHeldModal(false)
                if (showSearchModalForIdx !== null) setShowSearchModalForIdx(null)
            }

            if (e.key === 'F11') { e.preventDefault(); setUpdateRate(p=>!p); notify('💰 Update Rate mode toggled') }
            if (e.key === 'F9')  { e.preventDefault(); document.getElementById('sm-customer-name')?.focus() }
        }
        window.addEventListener('keydown', onShortcut)
        return () => window.removeEventListener('keydown', onShortcut)
    }, [rows, saving, showSettlement, showHistoryModal, showEmailModal, showHeldModal, grandTotal, activeRowIdx, isActive, isScaleConnected])

    function handleNewBill() {
        const activeRows = rows.filter(r => r.productId || r.total > 0)
        if (activeRows.length > 0) {
            handleParkBill()
        }

        setRows([emptyRow()])
        setActiveRowIdx(0)
        setActiveCol('productId')
        setCustomerId(''); setCustomerName(''); setCustomerMobile(''); setPrevBalance(0)
        setDoctorName(''); setNumberOfDays(''); setIsPharmacyDetailsOpen(true)
        setFreightCharges(0); setVehicleNumber(''); setEmpCode('')
        setEditableGrandTotal(undefined)
        setDisPctHeader(0)
        setBillNo('TRP' + String(Math.floor(1000 + Math.random() * 9000)))
        setBillDate(today)
        notify('🆕 New Bill started')
    }

    const handleParkBill = () => {
        const activeRows = rows.filter(r => r.productId || r.total > 0)
        if (activeRows.length === 0) { notify('⚠️ Bill is empty'); return }
        
        const billToHold = {
            rows: [...rows],
            customerName,
            customerMobile,
            doctorName,
            numberOfDays,
            billTemplate,
            disPctHeader,
            freightCharges,
            taxType,
            payment,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            total: grandTotal
        }
        setHeldBills(prev => [billToHold, ...prev])
        setRows([emptyRow()])
        notify('⏸️ Bill Parked')
    }

    const loadHistory = async () => {
        setHistoryLoading(true)
        setShowHistoryModal(true)
        try {
            const res = await api.get('/orders/history?limit=30')
            setHistoryOrders(res.data.data?.orders || [])
        } catch (err) {
            notify('❌ Failed to load history')
        } finally {
            setHistoryLoading(false)
        }
    }

    const clearBillHistory = async () => {
        if (!window.confirm("Are you sure you want to CLEAR ALL bill history? This action cannot be undone.")) return;
        if (!window.confirm("FINAL WARNING: This will PERMANENTLY DELETE all orders. Proceed?")) return;
        
        try {
            await api.delete('/orders/history/clear');
            notify("✅ Bill history cleared successfully");
            setHistoryOrders([]);
            setShowHistoryModal(false);
        } catch (err) {
            console.error(err);
            notify("❌ Failed to clear history");
        }
    }

    const handleSendEmail = () => {
        if (!emailAddr) { notify('⚠️ Enter email address'); return }
        notify(`📧 Sending bill to ${emailAddr}...`)
        setTimeout(() => {
            notify('✅ Email sent successfully!')
            setShowEmailModal(false)
            setEmailAddr('')
        }, 1500)
    }

    const handleReprintRequest = (order) => {
        setPendingReprint(order)
        setShowReprintLang(true)
    }

    const confirmReprint = (lang) => {
        if (pendingReprint) {
            printBill(pendingReprint, true, false, lang)
            setPendingReprint(null)
            setShowReprintLang(false)
            notify(`🖨️ Printing bill in ${lang === 'ta' ? 'Tamil' : 'English'}...`)
        }
    }

    const focusBarcode = () => {
        let idx = rows.findIndex(r => !r.productId)
        if (idx === -1) {
            setRows(prev => [...prev, emptyRow()])
            idx = rows.length
        }
        setActiveRowIdx(idx)
        setActiveCol('productId')
        setTimeout(() => document.getElementById(`cell-${idx}-productId`)?.focus(), 10)
    }

    const recallBill = (index) => {
        const bill = heldBills[index]
        if (!bill) return

        setRows(bill.rows)
        setCustomerName(bill.customerName || '')
        setCustomerMobile(bill.customerMobile || '')
        setDoctorName(bill.doctorName || '')
        setNumberOfDays(bill.numberOfDays || '')
        // setBillTemplate(bill.billTemplate || 'standard')
        setDisPctHeader(bill.disPctHeader || 0)
        setFreightCharges(bill.freightCharges || 0)
        setTaxType(bill.taxType || 'Inclusive') // Default to Inclusive if not set
        setPayment(bill.payment || 'CASH') // Default to CASH if not set

        // Remove from held list
        setHeldBills(prev => prev.filter((_, i) => i !== index))
        setShowHeldModal(false)
        notify('▶️ Bill Resumed')
    }

    function handleSave() {
        if (saving) return
        const validRows = computed.filter(r => r.productName && r.qty > 0)
        if (validRows.length === 0) { notify('⚠️ Add at least one item'); return }

        // --- OUT OF STOCK CHECK ---
        const stockMap = {};
        for (const r of validRows) {
            if (r.inventoryItemId) {
                stockMap[r.inventoryItemId] = {
                    name: r.productName,
                    inStock: parseFloat(r.inStock) || 0,
                    qty: (stockMap[r.inventoryItemId]?.qty || 0) + parseFloat(r.qty)
                };
            }
        }
        for (const id in stockMap) {
            const item = stockMap[id];
            if (item.qty > item.inStock) {
                setOutOfStockAlert({
                    name: item.name,
                    available: item.inStock,
                    requested: item.qty
                });
                return;
            }
        }

        setTenderCash(grandTotal)
        setTenderUPI(0)
        setTenderCard(0)
        setEditableGrandTotal(undefined)
        setShowSettlement(true)
    }

    async function confirmSave() {
        if (saving) return
        const validRows = computed.filter(r => r.productName && r.qty > 0)
        
        setSaving(true)
        setShowSettlement(false)
        try {
            // Master Data Sync: Update MRP if checked
            if (updateMrp) {
                validRows.forEach(r => {
                    if (r.productId && r.mrp > 0) {
                        const invItem = inventory.find(i => i.barcode === r.productId || String(i._id || i.id).slice(-6) === r.productId);
                        if (invItem && invItem.price !== r.mrp) {
                            const actualId = invItem._id || invItem.id
                            api.put(`/inventory/${actualId}`, { price: r.mrp, name: r.productName }).catch(()=>{});
                        }
                    }
                });
            }

            // Determine dominant payment type for the backend
            let dominantPayment = payment // default from header
            if (tenderUPI > tenderCash && tenderUPI > tenderCard) dominantPayment = 'UPI'
            else if (tenderCard > tenderCash && tenderCard > tenderUPI) dominantPayment = 'CARD'
            else if (tenderCash > 0) dominantPayment = 'CASH'

            const payload = {
                tableNumber: 'Takeaway',
                type: 'TAKEAWAY',
                items: validRows.map(r => ({
                    name: r.productName,
                    price: r.rate,
                    quantity: parseFloat(r.qty),
                    barcode: r.barcode || r.productId,
                    inventoryItemId: r.inventoryItemId,
                    batchNo: r.batchNo || '',
                    mfgDate: r.mfgDate || '',
                    expDate: r.expDate || '',
                    hsnCode: r.hsnCode || '',
                    mrp: r.mrp,
                    disPct: r.disPct,
                    taxRate: printWithGst ? (r.gstPercent !== undefined ? r.gstPercent : taxRate) : 0.0,
                })),
                billCategory,
                taxType,
                payment,
                customerName,
                customerPhone: customerMobile,
                discountPct: parseFloat(disPctHeader) || 0,
                discountType: 'PERCENTAGE',
                discountValue: parseFloat(disPctHeader) || 0,
                discountAmount: subTotal * (parseFloat(disPctHeader) / 100),
                freightCharges: parseFloat(freightCharges) || 0,
                billNo,
                doctorName,
                numberOfDays,
                billTemplate,
                customerFirm: customerId,
                printWithGst: printWithGst,
            }
            const existing = null // for new bill always create
            const res = await api.post('/orders', payload)
            // Handle both Java backend ({ data: { id: 123 } }) and Node backend formats
            const orderObj = res.data.data || res.data.order || res.data
            const orderId = orderObj?.id || orderObj?._id || orderObj?.id
            
            if (orderId) {
                await api.patch(`/orders/${orderId}/payment`, { 
                    paymentMethod: payment.toUpperCase(), 
                    paymentStatus: 'PAID' 
                })
                notify('✅ Bill saved & paid!')
                const printOrderObj = {
                    ...(res.data.data || res.data.order || res.data),
                    _id: orderId,
                    items: validRows.map(r => ({
                        name: r.productName,
                        price: r.rate,
                        mrp: r.mrp,
                        quantity: parseFloat(r.qty),
                        barcode: r.productId,
                        disPct: r.disPct,
                        sgst: r.sgst,
                        cgst: r.cgst,
                        igst: r.igst,
                        tax: r.tax,
                        total: r.total,
                        batchNo: r.batchNo || '',
                        mfgDate: r.mfgDate || '',
                        expDate: r.expDate || '',
                        hsnCode: r.hsnCode || '',
                        taxRate: printWithGst ? (r.gstPercent !== undefined ? r.gstPercent : taxRate) : 0.0,
                    })),
                    customerName,
                    customerPhone: customerMobile,
                    customerFirm: customerId,
                    doctorName,
                    numberOfDays,
                    billTemplate,
                    printWithGst,
                    billNo,
                    taxType,
                    total: grandTotal,
                    subtotal: subTotal,
                    totalDiscount: totalDiscount,
                    totalTax: printWithGst ? (taxType === 'Inclusive' ? (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) - (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) / (1 + taxRate / 100))) : (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) * (taxRate / 100))) : 0.0,
                    totalSgst: printWithGst ? ((taxType === 'Inclusive' ? (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) - (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) / (1 + taxRate / 100))) : (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) * (taxRate / 100))) / 2) : 0.0,
                    totalCgst: printWithGst ? ((taxType === 'Inclusive' ? (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) - (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) / (1 + taxRate / 100))) : (subTotal * (1 - (parseFloat(disPctHeader) || 0) / 100) * (taxRate / 100))) / 2) : 0.0,
                    discountPct: parseFloat(disPctHeader) || 0,
                    freightCharges: parseFloat(freightCharges) || 0,
                    createdAt: new Date(),
                    skipKOT: true,
                    isPharmacy: (billTemplate === 'pharmacy' || billType === 'A4'),
                    source: 'supermarket'
                }
                printBill(printOrderObj, true, false, 'en')
                setTimeout(() => handleNewBill(), 1200)
            }
        } catch (err) {
            notify('❌ Error saving bill: ' + (err.response?.data?.message || 'unknown'))
        } finally {
            setSaving(false)
        }
    }

    function handleDeleteRow(idx) {
        if (rows.length === 1) { setRows([emptyRow()]); return }
        setRows(prev => prev.filter((_, i) => i !== idx))
        setActiveRowIdx(Math.max(0, idx - 1))
        setRowWithDeleteBtn(null)
    }

    // ── Render ────────────────────────────────────────────────
    return (
        <div className="sm-pos-root" style={{ display: isActive ? 'flex' : 'none', flex: 1 }}>
            {notification && <div className="sm-pos-toast">{notification}</div>}

            {/* ── HEADER FIELDS ── */}
            <div className="sm-header-bar">
                <div className="sm-header-row">
                    <div className="sm-field-group">
                        <label>Bill Category</label>
                        <select value={billCategory} onChange={e => setBillCategory(e.target.value)}>
                            <option>SALES</option><option>PURCHASE</option><option>RETURN</option>
                        </select>
                    </div>
                    <div className="sm-field-group">
                        <label>Tax type</label>
                        <select value={taxType} onChange={e => setTaxType(e.target.value)}>
                            <option>Inclusive</option><option>Exclusive</option><option>No Tax</option>
                        </select>
                    </div>
                    <div className="sm-field-group">
                        <label>Dealer</label>
                        <select value={dealer} onChange={e => setDealer(e.target.value)}>
                            <option>Unregistered</option><option>Registered</option>
                        </select>
                    </div>
                    <div className="sm-field-group">
                        <label>Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">Please select</option>
                            <option>Grocery</option><option>Electronics</option><option>Clothing</option><option>Pharmacy</option>
                        </select>
                    </div>
                    <div className="sm-field-group">
                        <label>Payment</label>
                        <select value={payment} onChange={e => setPayment(e.target.value)}>
                            <option>CASH</option><option>UPI</option><option>CARD</option><option>CREDIT</option>
                        </select>
                    </div>
                    <div className="sm-field-group">
                        <label>Bill Date</label>
                        <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
                    </div>
                    <div className="sm-field-group compact">
                        <label>Dis(%)</label>
                        <input type="number" value={disPctHeader} onChange={e => setDisPctHeader(e.target.value)} min="0" max="100" />
                    </div>
                    <div className="sm-field-group">
                        <label>Options</label>
                        <div className="sm-scale-actions">
                            <button 
                                className={`sm-scale-toggle-btn ${showAdvancedCols ? 'connected' : ''}`}
                                onClick={() => setShowAdvancedCols(prev => !prev)}
                                title="Toggle Advanced Columns"
                            >
                                <span className="scale-icon">⚙️</span>
                                <span className="scale-label">Advance</span>
                            </button>
                            <button 
                                className={`sm-scale-toggle-btn ${isScaleConnected ? 'connected' : ''}`}
                                onClick={() => isScaleConnected ? disconnectScale() : connectScale()}
                                title="Toggle Scale Connection (Alt+S)"
                            >
                                <span className="scale-icon">⚖️</span>
                                <span className="scale-label">{isScaleConnected ? 'Connected' : 'Connect'}</span>
                            </button>
                            {isScaleConnected && (
                                <select 
                                    className="sm-baud-select" 
                                    value={baudRate} 
                                    onChange={e => setBaudRate(parseInt(e.target.value))}
                                >
                                    <option value={2400}>2400</option>
                                    <option value={4800}>4800</option>
                                    <option value={9600}>9600</option>
                                </select>
                            )}
                        </div>
                    </div>
                    <div className="sm-customer-top">
                        <label>Customer/Supplier</label>
                        <input id="sm-customer-name" type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name or search..." />
                    </div>
                </div>
            </div>

            {/* ── MAIN BODY ── */}
            <div className="sm-body">
                {/* ── BILLING TABLE ── */}
                <div className="sm-table-panel">
                    <div className="sm-table-scroll">
                        <table className="sm-main-table">
                            <thead>
                                <tr>
                                    <th className="col-sno">#</th>
                                    <th className="col-pid">ProductID</th>
                                    <th className="col-name">Product Name</th>
                                    <th className="col-weight">Weight</th>
                                    <th className="col-qty">Qty</th>
                                    {showAdvancedCols && <th className="col-batch">Batch</th>}
                                    {showAdvancedCols && <th className="col-date">Mfg Date</th>}
                                    {showAdvancedCols && <th className="col-date">Exp Date</th>}
                                    <th className="col-hsn">HSN</th>
                                    {showAdvancedCols && <th className="col-mrp">MRP</th>}
                                    {showAdvancedCols && <th className="col-basic">Basic</th>}
                                    <th className="col-rate">Rate</th>
                                    {showAdvancedCols && <th className="col-dis">Dis(%)</th>}
                                    {showAdvancedCols && <th className="col-disrs">DisRs</th>}
                                    {showAdvancedCols && <th className="col-tax">SGST</th>}
                                    {showAdvancedCols && <th className="col-tax">CGST</th>}
                                    {showAdvancedCols && <th className="col-tax">IGST</th>}
                                    <th className="col-tax">Tax</th>
                                    <th className="col-total">Total</th>
                                    {showAdvancedCols && <th className="col-remarks">Remarks</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {computed.map((row, idx) => (
                                    <tr
                                        key={row.id}
                                        className={idx === activeRowIdx ? 'row-active' : ''}
                                    >
                                        <td className="col-sno" onDoubleClick={() => setRowWithDeleteBtn(idx)}>
                                            {rowWithDeleteBtn === idx ? (
                                                <button className="sm-sno-del-btn" onClick={() => handleDeleteRow(idx)}>✕</button>
                                            ) : (
                                                idx + 1
                                            )}
                                        </td>
                                        <td className="col-pid">
                                            <input
                                                id={`cell-${idx}-productId`}
                                                className={activeRowIdx === idx && activeCol === 'productId' ? 'cell-active' : ''}
                                                value={row.productId}
                                                onChange={e => updateRow(idx, 'productId', e.target.value)}
                                                onKeyDown={e => handleCellKeyDown(e, idx, 'productId')}
                                                onFocus={() => { setActiveRowIdx(idx); setActiveCol('productId') }}
                                            />
                                        </td>
                                        <td className="col-name" style={{ position: 'relative' }}>
                                            <input
                                                id={`cell-${idx}-productName`}
                                                className={activeRowIdx === idx && activeCol === 'productName' ? 'cell-active' : ''}
                                                value={row.productName}
                                                onChange={e => updateRow(idx, 'productName', e.target.value)}
                                                onKeyDown={e => handleCellKeyDown(e, idx, 'productName')}
                                                onFocus={() => { setActiveRowIdx(idx); setActiveCol('productName') }}
                                            />
                                        </td>
                                        <td className="col-weight">
                                            {(row.unit === 'KG' || row.unit === 'G') && (
                                                <div className="weight-display-wrapper">
                                                    <span className={`live-weight ${idx === activeRowIdx && isScaleConnected ? 'active' : ''}`} style={{ fontWeight: 'bold', minWidth: '40px', textAlign: 'center' }}>
                                                        {idx === activeRowIdx && isScaleConnected ? scaleData : '---'}
                                                    </span>
                                                    <button 
                                                        className="fix-weight-btn" 
                                                        onClick={() => handleCaptureWeight(idx)}
                                                        title="Capture Weight"
                                                    >
                                                        FIX
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="col-qty">
                                            <div className="qty-cell-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input type="number" min="0.001" step="0.001"
                                                    id={`cell-${idx}-qty`}
                                                    className={activeRowIdx === idx && activeCol === 'qty' ? 'cell-active' : ''}
                                                    value={row.qty}
                                                    onChange={e => updateRow(idx, 'qty', e.target.value)}
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'qty')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('qty') }}
                                                />
                                            </div>
                                        </td>
                                        {showAdvancedCols && (
                                            <td className="col-batch">
                                                <input
                                                    id={`cell-${idx}-batchNo`}
                                                    className={activeRowIdx === idx && activeCol === 'batchNo' ? 'cell-active' : ''}
                                                    value={row.batchNo}
                                                    onChange={e => updateRow(idx, 'batchNo', e.target.value)}
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'batchNo')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('batchNo') }}
                                                    placeholder="BATCH"
                                                />
                                            </td>
                                        )}
                                        {showAdvancedCols && (
                                            <td className="col-date">
                                                <input
                                                    id={`cell-${idx}-mfgDate`}
                                                    className={activeRowIdx === idx && activeCol === 'mfgDate' ? 'cell-active' : ''}
                                                    value={row.mfgDate}
                                                    onChange={e => updateRow(idx, 'mfgDate', e.target.value)}
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'mfgDate')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('mfgDate') }}
                                                    placeholder="MM/YY"
                                                />
                                            </td>
                                        )}
                                        {showAdvancedCols && (
                                            <td className="col-date">
                                                <input
                                                    id={`cell-${idx}-expDate`}
                                                    className={activeRowIdx === idx && activeCol === 'expDate' ? 'cell-active' : ''}
                                                    value={row.expDate}
                                                    onChange={e => updateRow(idx, 'expDate', e.target.value)}
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'expDate')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('expDate') }}
                                                    placeholder="MM/YY"
                                                />
                                            </td>
                                        )}
                                        <td className="col-hsn">
                                            <input
                                                id={`cell-${idx}-hsnCode`}
                                                className={activeRowIdx === idx && activeCol === 'hsnCode' ? 'cell-active' : ''}
                                                value={row.hsnCode}
                                                onChange={e => updateRow(idx, 'hsnCode', e.target.value)}
                                                onKeyDown={e => handleCellKeyDown(e, idx, 'hsnCode')}
                                                onFocus={() => { setActiveRowIdx(idx); setActiveCol('hsnCode') }}
                                                placeholder="HSN"
                                            />
                                        </td>
                                        {showAdvancedCols && (
                                            <td className="col-mrp">
                                                <input type="number" min="0" step="0.01"
                                                    id={`cell-${idx}-mrp`}
                                                    className={activeRowIdx === idx && activeCol === 'mrp' ? 'cell-active' : ''}
                                                    value={row.mrp}
                                                    onChange={e => updateRow(idx, 'mrp', e.target.value)}
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'mrp')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('mrp') }}
                                                />
                                            </td>
                                        )}
                                        {showAdvancedCols && <td className="col-basic">{row.basic.toFixed(2)}</td>}
                                        <td className="col-rate">{row.rate.toFixed(2)}</td>
                                        {showAdvancedCols && (
                                            <td className="col-dis">
                                                <input type="number" min="0" max="100" step="0.01"
                                                    id={`cell-${idx}-disPct`}
                                                    className={activeRowIdx === idx && activeCol === 'disPct' ? 'cell-active' : ''}
                                                    value={row.disPct}
                                                    onChange={e => updateRow(idx, 'disPct', e.target.value)}
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'disPct')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('disPct') }}
                                                />
                                            </td>
                                        )}
                                        {showAdvancedCols && <td className="col-disrs">{row.disRs.toFixed(2)}</td>}
                                        {showAdvancedCols && <td className="col-tax">{row.sgst.toFixed(2)}</td>}
                                        {showAdvancedCols && <td className="col-tax">{row.cgst.toFixed(2)}</td>}
                                        {showAdvancedCols && <td className="col-tax">{row.igst.toFixed(2)}</td>}
                                        <td className="col-tax">{row.tax.toFixed(2)}</td>
                                        <td className="col-total">{row.total.toFixed(2)}</td>
                                        {showAdvancedCols && (
                                            <td className="col-remarks">
                                                <input 
                                                    id={`cell-${idx}-remarks`}
                                                    value={row.remarks} 
                                                    onChange={e => updateRow(idx, 'remarks', e.target.value)} 
                                                    onKeyDown={e => handleCellKeyDown(e, idx, 'remarks')}
                                                    onFocus={() => { setActiveRowIdx(idx); setActiveCol('remarks') }} 
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="sm-totals-row">
                                    <td colSpan={3} className="totals-label">TOTALS</td>
                                    <td></td>
                                    <td>{totalItems.toFixed(2)}</td>
                                    {showAdvancedCols && <td></td>}
                                    {showAdvancedCols && <td></td>}
                                    {showAdvancedCols && <td></td>}
                                    <td></td>
                                    {showAdvancedCols && <td></td>}
                                    {showAdvancedCols && <td></td>}
                                    <td></td>
                                    {showAdvancedCols && <td></td>}
                                    {showAdvancedCols && <td>{totalDiscount.toFixed(2)}</td>}
                                    {showAdvancedCols && <td>{computed.reduce((s,r)=>s+r.sgst,0).toFixed(2)}</td>}
                                    {showAdvancedCols && <td>{computed.reduce((s,r)=>s+r.cgst,0).toFixed(2)}</td>}
                                    {showAdvancedCols && <td>{computed.reduce((s,r)=>s+r.igst,0).toFixed(2)}</td>}
                                    <td>{computed.reduce((s,r)=>s+r.tax,0).toFixed(2)}</td>
                                    <td className="grand-total-cell">{subTotal.toFixed(2)}</td>
                                    {showAdvancedCols && <td></td>}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ── BILLING SUMMARY PANEL ── */}
                <div className="sm-summary-panel">
                    {/* Live Total Header (Fixed Visibility) */}
                    <div style={{
                        background: 'linear-gradient(180deg, #0277bd 0%, #01579b 100%)',
                        color: '#fff',
                        padding: '15px 10px',
                        textAlign: 'center',
                        flexShrink: 0,
                        borderBottom: '3px solid #c6f53d',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        zIndex: 10
                    }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, marginBottom: '4px' }}>
                            Net Amount
                        </div>
                        <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, textShadow: '1px 2px 4px rgba(0,0,0,0.5)' }}>
                            ₹{grandTotal.toFixed(2)}
                        </div>
                    </div>
                    
                    <div className="sm-summary-header">Billing Summary</div>
                    <div className="sm-summary-field" style={{ display: 'none' }}>
                        <label>Bill Type</label>
                    </div>
                    <div className="sm-summary-field">
                        <label>Bill No</label>
                        <input value={billNo} onChange={e => setBillNo(e.target.value)} readOnly={!manualBillNo} className={!manualBillNo ? 'readonly' : ''} />
                    </div>
                    <div className="sm-summary-field">
                        <label>Due Date</label>
                        <input value={dueDate} onChange={e => setDueDate(e.target.value)} placeholder="E No" />
                    </div>
                    <div className="sm-summary-field">
                        <label>PO Date</label>
                        <input value={poDate} onChange={e => setPODate(e.target.value)} placeholder="C No" />
                    </div>
                    <div className="sm-summary-field">
                        <label>Emp Code</label>
                        <input value={empCode} onChange={e => setEmpCode(e.target.value)} />
                    </div>
                    <div className="sm-summary-field">
                        <label>Freight Charges</label>
                        <input type="number" value={freightCharges} onChange={e => setFreightCharges(e.target.value)} min="0" />
                    </div>
                    <div className="sm-summary-field">
                        <label>Vehicle Number</label>
                        <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} />
                    </div>

                    <div className="sm-kpi-card orange">
                        <div className="kpi-label">Total Items</div>
                        <div className="kpi-val">{computed.filter(r => r.productName).length}</div>
                    </div>
                    <div className="sm-kpi-card blue">
                        <div className="kpi-label">Total Discount</div>
                        <div className="kpi-val">{totalDiscount.toFixed(2)}</div>
                    </div>
                    <div className="sm-kpi-card orange">
                        <div className="kpi-label">Net Amount</div>
                        <div className="kpi-val">{grandTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* ── CUSTOMER / RECEIPT PANEL ── */}
            <div className="sm-customer-panel">
                <div className="sm-tabs">
                    <button className={customerTab === 'customer' ? 'tab active' : 'tab'} onClick={() => setCustomerTab('customer')}>
                        Customer/Supplier
                    </button>
                    <button className={customerTab === 'receipt' ? 'tab active' : 'tab'} onClick={() => setCustomerTab('receipt')}>
                        Receipt/Payment
                    </button>
                </div>
                <div className="sm-customer-fields">
                    <div className="sm-cust-field"><label>Id</label><input value={customerId} onChange={e => setCustomerId(e.target.value)} /></div>
                    <div className="sm-cust-field"><label>Customer Name</label><input value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                    <div className="sm-cust-field"><label>Mobile Number</label><input value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} /></div>
                    <div className="sm-cust-field"><label>Previous Balance</label><input readOnly value={prevBalance} className="readonly" /></div>
                </div>

                {/* ── Details Section removed ── */}
            </div>


            {/* ── ACTION BUTTONS ── */}
            <div className="sm-action-bar">
                <button className="sm-action-btn primary" onClick={handleNewBill} title="F1">
                    <span className="action-icon">🧾</span>
                    <span className="action-label">Bill</span>
                    <span className="action-key">[F1]</span>
                </button>
                <button className="sm-action-btn green" onClick={handleSave} disabled={saving} title="F2">
                    <span className="action-icon">💾</span>
                    <span className="action-label">{saving ? 'Saving...' : 'Save'}</span>
                    <span className="action-key">[F2]</span>
                </button>
                <button className="sm-action-btn" onClick={loadHistory} title="F3">
                    <span className="action-icon">🔍</span>
                    <span className="action-label">Find Bill</span>
                    <span className="action-key">[F3]</span>
                </button>
                <button className="sm-action-btn" onClick={handleParkBill} title="F4">
                    <span className="action-icon">⏸</span>
                    <span className="action-label">Hold</span>
                    <span className="action-key">[F4]</span>
                </button>
                <button className="sm-action-btn" onClick={focusBarcode} title="F5">
                    <span className="action-icon">▐▌</span>
                    <span className="action-label">Barcode</span>
                    <span className="action-key">[F5]</span>
                </button>
                <button className="sm-action-btn" onClick={() => setShowEmailModal(true)} title="Alt+M">
                    <span className="action-icon">📧</span>
                    <span className="action-label">EMail</span>
                    <span className="action-key">[Alt+M]</span>
                </button>
                <button className="sm-action-btn yellow" onClick={() => { const errs = computed.filter(r=>r.productName && r.mrp===0); notify(errs.length ? `⚠️ ${errs.length} rows have MRP=0` : '✅ No errors') }} title="Alt+C">
                    <span className="action-icon">⚠️</span>
                    <span className="action-label">Errors</span>
                    <span className="action-key">[Alt+C]</span>
                </button>
                <button className="sm-action-btn red" onClick={() => { if(window.confirm('Clear current bill?')) setRows([emptyRow()]) }} title="F2+C">
                    <span className="action-icon">✕</span>
                    <span className="action-label">Cancel</span>
                    <span className="action-key">[F2+C]</span>
                </button>
                <button className="sm-action-btn red" onClick={() => handleDeleteRow(activeRowIdx)} title="Delete Selected Row [Del]">
                    <span className="action-icon">🗑️</span>
                    <span className="action-label">Del Row</span>
                    <span className="action-key">[Del]</span>
                </button>
                <button className="sm-action-btn" onClick={() => setShowHeldModal(true)} title="Alt+W">
                    <span className="action-icon">⌚</span>
                    <span className="action-label">Waiting</span>
                    <span className="action-key">[Alt+W]</span>
                </button>
                <div className="sm-narration-area">
                    <label>Narration</label>
                    <input type="text" placeholder="Bill narration..." />
                </div>
            </div>

            {/* ── STATUS BAR ── */}
            <div className="sm-status-bar">
                <div className="sm-status-left">
                    <label className="sm-chk"><input type="checkbox" onChange={e => setManualBillNo(e.target.checked)} /> Manual Bill No</label>
                    <label className="sm-chk"><input type="checkbox" onChange={e => setNoTax(e.target.checked)} /> No Tax</label>
                    <label className="sm-chk"><input type="checkbox" onChange={e => setNetAmount(e.target.checked)} /> Netamount</label>
                    
                    <label className="sm-chk"><input type="checkbox" checked={updateRate} onChange={e => setUpdateRate(e.target.checked)} /> Update Rate</label>
                    <label className="sm-chk"><input type="checkbox" checked={updateMrp} onChange={e => setUpdateMrp(e.target.checked)} /> Update MRP</label>
                    <label className="sm-chk"><input type="checkbox" /> Focus Barcode</label>
                    <span className="sm-status-sep">|</span>
                    <span className="sm-status-hint">Stock Entry [Alt+8]</span>
                    <span className="sm-status-hint">Customer Entry [F9]</span>
                    <span className="sm-status-hint">WRate [F11]</span>
                </div>
                <div className="sm-status-right">
                    <div className={`sm-instock-badge ${inStock > 0 ? 'green' : 'grey'}`}>
                        In Stock: {inStock}
                    </div>
                    <div className="sm-instock-badge grey">
                        DB Items: {inventory.length}
                    </div>
                    <div className="sm-clock">
                        <LiveClock />
                    </div>
                </div>
            </div>

            {/* ── ADVANCED PRODUCT SEARCH MODAL ── */}
            {showSearchModalForIdx !== null && (
                <div className="sm-search-modal-overlay">
                    <div className="sm-search-modal">
                        <div className="sm-sm-header">
                            <span>Search Products...</span>
                            <button className="sm-sm-close" onClick={() => {
                                setShowSearchModalForIdx(null);
                                setTimeout(() => document.getElementById(`cell-${showSearchModalForIdx}-productName`)?.focus(), 10)
                            }}>X</button>
                        </div>
                        <div className="sm-sm-body">
                            <div className="sm-sm-searchbox">
                                <span>🔍</span>
                                <input 
                                    id="advanced-search-input"
                                    autoFocus
                                    value={searchQuery}
                                    placeholder="Type item name or code..."
                                    onChange={e => { setSearchQuery(e.target.value); setSearchSelectedIdx(0) }}
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setShowSearchModalForIdx(null);
                                            setTimeout(() => document.getElementById(`cell-${showSearchModalForIdx}-productName`)?.focus(), 10)
                                        } else if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setSearchSelectedIdx(Math.min(searchMatches.length - 1, searchSelectedIdx + 1));
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setSearchSelectedIdx(Math.max(0, searchSelectedIdx - 1));
                                        } else if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const match = searchMatches[searchSelectedIdx];
                                            if (match) {
                                                forceApplyProductToRow(showSearchModalForIdx, match);
                                                setShowSearchModalForIdx(null);
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div className="sm-sm-table-wrap">
                                <table className="sm-sm-table">
                                    <thead>
                                        <tr>
                                            <th>ProductId</th>
                                            <th>Item Name</th>
                                            <th>Rate</th>
                                            <th>MRP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {searchMatches.map((m, i) => (
                                            <tr 
                                                key={m._id || m.id} 
                                                className={i === searchSelectedIdx ? 'selected' : ''}
                                                onClick={() => {
                                                    forceApplyProductToRow(showSearchModalForIdx, m);
                                                    setShowSearchModalForIdx(null);
                                                }}
                                            >
                                                <td>{m.barcode || m.id || m._id}</td>
                                                <td>{m.name || 'Untitled'}</td>
                                                <td className={i === searchSelectedIdx ? 'hl-red' : ''}>{m.price}</td>
                                                <td className={i === searchSelectedIdx ? 'hl-red' : ''}>{m.price}</td>
                                            </tr>
                                        ))}
                                        {searchMatches.length === 0 && (
                                            <tr>
                                                <td colSpan="4" style={{textAlign:'center', padding:'20px', color:'var(--text-muted)'}}>No items found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SETTLEMENT MODAL ── */}
            {showSettlement && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content">
                        <div className="sm-modal-header">
                            <h2>Settlement / Tender</h2>
                            <button onClick={() => setShowSettlement(false)}>✕</button>
                        </div>
                        <div className="sm-tender-body">
                            <div className="tender-row total" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <label style={{ color: '#0f172a', fontWeight: 'bold' }}>Net Amount Payable (Editable)</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    step="0.01" 
                                    value={editableGrandTotal !== undefined ? editableGrandTotal : grandTotal.toFixed(2)} 
                                    onChange={handleEditableGrandTotalChange} 
                                    style={{ 
                                        fontSize: '24px', 
                                        fontWeight: 'bold', 
                                        color: '#22c55e', 
                                        background: '#f8fafc', 
                                        border: '2px solid #cbd5e1', 
                                        borderRadius: '8px', 
                                        padding: '5px 10px', 
                                        width: '100%', 
                                        textAlign: 'right' 
                                    }} 
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px', marginBottom: '15px', width: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Discount (%)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        step="0.1" 
                                        value={disPctHeader} 
                                        onChange={handleDiscountPctChange} 
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', background: '#fff' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>Discount (₹)</label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        step="0.01" 
                                        value={(subTotal * (parseFloat(disPctHeader) / 100)).toFixed(2)} 
                                        onChange={handleDiscountAmtChange} 
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', background: '#fff' }}
                                    />
                                </div>
                            </div>
                            <div className="tender-row mt-3">
                                <label>Cash</label>
                                <input autoFocus type="number" min="0" value={tenderCash} onChange={e => setTenderCash(parseFloat(e.target.value)||0)} onFocus={e => e.target.select()} />
                            </div>
                            <div className="tender-row">
                                <label>UPI / WALLET</label>
                                <input type="number" min="0" value={tenderUPI} onChange={e => setTenderUPI(parseFloat(e.target.value)||0)} onFocus={e => e.target.select()} />
                            </div>
                            <div className="tender-row">
                                <label>Card</label>
                                <input type="number" min="0" value={tenderCard} onChange={e => setTenderCard(parseFloat(e.target.value)||0)} onFocus={e => e.target.select()} />
                            </div>

                            <div className="sm-template-section" style={{ margin: '20px 0', background: 'none', border: 'none', boxShadow: 'none', padding: 0 }}>
                                <div className="sm-template-toggle" style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f8fafc', padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', flex: 1 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={printWithGst} 
                                            onChange={(e) => setPrintWithGst(e.target.checked)} 
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>Print with GST</span>
                                    </label>
                                </div>

                                {billTemplate === 'pharmacy' && (
                                    <div className="sm-pharmacy-details fade-in-down" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px' }}>
                                        <div className="pharmacy-header" onClick={() => setIsPharmacyDetailsOpen(!isPharmacyDetailsOpen)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="sm-icon">📝</span>
                                                <span style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '13px' }}>Prescription Details</span>
                                            </div>
                                            <span style={{ fontSize: '12px', color: '#0f172a', transition: 'transform 0.2s', transform: isPharmacyDetailsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                        </div>
                                        {isPharmacyDetailsOpen && (
                                            <div className="pharmacy-grid fade-in-down" style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                                                <div className="sm-cust-field">
                                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}>Doctor Name</label>
                                                    <input
                                                        value={doctorName}
                                                        onChange={e => setDoctorName(e.target.value)}
                                                        placeholder="Dr. Name..."
                                                        style={{ width: '100%', padding: '6px', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                    />
                                                </div>
                                                <div className="sm-cust-field">
                                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}>No. of Days</label>
                                                    <input
                                                        type="number"
                                                        value={numberOfDays}
                                                        onChange={e => setNumberOfDays(e.target.value)}
                                                        placeholder="Days"
                                                        min="1"
                                                        style={{ width: '100%', padding: '6px', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                    />
                                                </div>
                                                <div className="sm-cust-field full-width">
                                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}>M/S (Customer Firm)</label>
                                                    <input
                                                        value={customerId}
                                                        onChange={e => setCustomerId(e.target.value)}
                                                        placeholder="Customer Firm Name"
                                                        style={{ width: '100%', padding: '6px', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                    />
                                                </div>
                                                <div className="sm-cust-field">
                                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}>Customer Name</label>
                                                    <input
                                                        value={customerName}
                                                        onChange={e => setCustomerName(e.target.value)}
                                                        placeholder="Name"
                                                        style={{ width: '100%', padding: '6px', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                    />
                                                </div>
                                                <div className="sm-cust-field">
                                                    <label style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '12px' }}>Mobile Number</label>
                                                    <input
                                                        value={customerMobile}
                                                        onChange={e => setCustomerMobile(e.target.value)}
                                                        placeholder="Mobile"
                                                        style={{ width: '100%', padding: '6px', color: '#0f172a', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="tender-summary">
                                <div className="t-sum-item">
                                    <span>Received</span>
                                    <span>₹{(tenderCash + tenderUPI + tenderCard).toFixed(2)}</span>
                                </div>
                                <div className="t-sum-item highlight">
                                    <span>Change to Return</span>
                                    <span>₹{Math.max(0, (tenderCash + tenderUPI + tenderCard) - grandTotal).toFixed(2)}</span>
                                </div>
                                <div className="t-sum-item highlight-red">
                                    <span>Balance Due</span>
                                    <span>₹{Math.max(0, grandTotal - (tenderCash + tenderUPI + tenderCard)).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="tender-actions">
                                <button className="btn-cancel" onClick={() => setShowSettlement(false)}>Cancel [Esc]</button>
                                <button className="btn-save" onClick={confirmSave} disabled={saving}>Confirm & Print [Enter]</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Held Bills Modal ──────────────────────────────── */}
            {showHeldModal && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content" style={{ maxWidth: '600px' }}>
                        <div className="sm-modal-header">
                            <h3>⏸️ Parked Bills</h3>
                            <button className="sm-close-btn" onClick={() => setShowHeldModal(false)}>×</button>
                        </div>
                        <div className="held-bills-list" style={{ maxHeight: '400px', overflowY: 'auto', padding: '10px' }}>
                            {heldBills.length === 0 ? (
                                <p className="held-empty-msg">No bills are currently on hold.</p>
                            ) : (
                                heldBills.map((bill, idx) => (
                                    <div key={idx} className="held-bill-item" onClick={() => recallBill(idx)}>
                                        <div className="held-bill-info">
                                            <div className="held-bill-header">{bill.timestamp} - {bill.customerName || 'Walking Customer'}</div>
                                            <div className="held-bill-count">{bill.rows.filter(r => r.productName).length} Items</div>
                                        </div>
                                        <div className="held-bill-status">
                                            <div className="held-bill-total">₹{bill.total.toFixed(2)}</div>
                                            <div className="held-bill-action">Click to Resume</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Out of Stock Alert Modal ────────────────────────────── */}
            {outOfStockAlert && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content" style={{ width: '400px', borderTop: '4px solid #ef4444' }}>
                        <div className="sm-modal-header">
                            <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⚠️</span> Out of Stock!
                            </h3>
                            <button onClick={() => setOutOfStockAlert(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                        </div>
                        <div style={{ padding: '20px', fontSize: '14px', lineHeight: '1.6' }}>
                            <p style={{ margin: '0 0 10px 0' }}>
                                You are trying to bill more than what is available in the inventory. The quantity has been automatically adjusted to the maximum available.
                            </p>
                            <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                                <div style={{ marginBottom: '8px' }}><strong>Product:</strong> <span style={{ color: '#991b1b' }}>{outOfStockAlert.name}</span></div>
                                <div style={{ marginBottom: '8px' }}><strong>Available in Inventory:</strong> <span style={{ fontWeight: 'bold' }}>{outOfStockAlert.available}</span></div>
                                <div><strong>You tried to bill:</strong> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{outOfStockAlert.requested}</span></div>
                            </div>
                        </div>
                        <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                            <button 
                                onClick={() => setOutOfStockAlert(null)}
                                style={{ background: '#ef4444', color: '#fff', padding: '8px 20px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── History Search Modal (Find Bill) ───────────────── */}
            {showHistoryModal && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content" style={{ width: '650px' }}>
                        <div className="sm-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <h3 style={{ margin: 0 }}>🔍 Past Sales History</h3>
                                <button 
                                    onClick={clearBillHistory}
                                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
                                    onMouseOver={e => e.target.style.opacity = '0.8'}
                                    onMouseOut={e => e.target.style.opacity = '1'}
                                >
                                    🗑️ Clear All
                                </button>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                        </div>
                        <div style={{ padding: '15px' }}>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>Loading history...</div>
                            ) : (
                                <div className="sm-sm-table-wrap" style={{ height: '350px' }}>
                                    <table className="sm-sm-table">
                                        <thead>
                                            <tr>
                                                <th>Bill No</th>
                                                <th>Customer</th>
                                                <th>Total</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyOrders.map(o => (
                                                <tr key={o._id}>
                                                    <td>{o.orderNumber || o.billNo || String(o._id).slice(-8).toUpperCase()}</td>
                                                    <td>{o.customerName || 'Walking'}</td>
                                                    <td>₹{(o.total || 0).toFixed(2)}</td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '2px 6px', borderRadius: '4px', fontSize: '10px',
                                                            background: o.status === 'PAID' ? 'var(--success-light)' : 'var(--bg-hover)',
                                                            color: o.status === 'PAID' ? 'var(--success-text)' : 'var(--text-muted)'
                                                        }}>
                                                            {o.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button 
                                                            style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                            onClick={() => handleReprintRequest(o)}
                                                        >
                                                            🖨️ Reprint
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Email Dialog Modal ─────────────────────────────── */}
            {showEmailModal && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content" style={{ maxWidth: '400px' }}>
                        <div className="sm-modal-header">
                            <h3>📧 Send Receipt via Email</h3>
                            <button onClick={() => setShowEmailModal(false)}>×</button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <div className="sm-field-group" style={{ marginBottom: '20px' }}>
                                <label>Customer's Email Address</label>
                                <input 
                                    autoFocus
                                    type="email" 
                                    placeholder="example@mail.com" 
                                    value={emailAddr}
                                    onChange={e => setEmailAddr(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                                    style={{ width: '100%', padding: '10px', marginTop: '8px' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-save" style={{ flex: 1 }} onClick={handleSendEmail}>Send Email</button>
                                <button className="btn-cancel" style={{ flex: 1 }} onClick={() => setShowEmailModal(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reprint Language Modal ────────────────────────────── */}
            {showReprintLang && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content" style={{ maxWidth: '350px', padding: '24px', textAlign: 'center' }}>
                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>🧾</div>
                        <h3 style={{ marginBottom: '8px' }}>Reprint Bill</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Select language for the receipt</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                className="sm-action-btn" 
                                style={{ flex: 1, padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                onClick={() => confirmReprint('en')}
                            >
                                English
                            </button>
                            <button 
                                className="sm-action-btn" 
                                style={{ flex: 1, padding: '12px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                onClick={() => confirmReprint('ta')}
                            >
                                தமிழ்
                            </button>
                        </div>
                        <button 
                            onClick={() => setShowReprintLang(false)}
                            style={{ background: 'none', border: 'none', marginTop: '15px', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

        </div>
    )
}

export default function SupermarketPOS({ printBill }) {
    const [tabs, setTabs] = useState(() => {
        const saved = localStorage.getItem('sm_pos_tabs');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
        }
        return [{ id: Date.now(), title: 'New Order' }];
    });
    
    const [activeTabId, setActiveTabId] = useState(() => {
        const saved = localStorage.getItem('sm_pos_active_tab');
        if (saved) return Number(saved);
        return tabs[0].id;
    });

    useEffect(() => {
        localStorage.setItem('sm_pos_tabs', JSON.stringify(tabs));
    }, [tabs]);

    useEffect(() => {
        localStorage.setItem('sm_pos_active_tab', activeTabId);
    }, [activeTabId]);

    const addTab = () => {
        const id = Date.now();
        setTabs([...tabs, { id, title: 'New Order' }]);
        setActiveTabId(id);
    };

    const closeTab = (id, e) => {
        e.stopPropagation();
        if (tabs.length === 1) return; // Prevent closing the last tab
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        
        // Cleanup local storage for this tab
        Object.keys(localStorage).forEach(key => {
            if (key.endsWith(`_${id}`)) {
                localStorage.removeItem(key);
            }
        });

        if (activeTabId === id) {
            setActiveTabId(newTabs[0].id);
        }
    };

    const handleBillNoChange = (id, billNo) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, title: billNo || 'New Order' } : t));
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                addTab();
            }
            if (e.ctrlKey && e.key === 'Tab') {
                e.preventDefault();
                setTabs(prev => {
                    const currentIdx = prev.findIndex(t => t.id === activeTabId);
                    const nextIdx = (currentIdx + 1) % prev.length;
                    setActiveTabId(prev[nextIdx].id);
                    return prev;
                });
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'w') {
                if (tabs.length > 1) {
                    e.preventDefault();
                    closeTab(activeTabId, e);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTabId, tabs.length]);

    return (
        <div className="sm-pos-tab-wrapper">
            <div className="sm-pos-tab-bar">
                {tabs.map(tab => (
                    <div 
                        key={tab.id} 
                        className={`sm-pos-tab ${activeTabId === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTabId(tab.id)}
                    >
                        <span className="sm-pos-tab-title">{tab.title}</span>
                        {tabs.length > 1 && (
                            <button className="sm-pos-tab-close" onClick={(e) => closeTab(tab.id, e)}>✕</button>
                        )}
                    </div>
                ))}
                <button className="sm-pos-tab-add" onClick={addTab} title="New Order Tab (Ctrl+T)">
                    <span>+</span>
                </button>
            </div>
            
            <div className="sm-pos-tab-content-area">
                {tabs.map(tab => (
                    <div 
                        key={tab.id} 
                        className={`sm-pos-tab-content ${activeTabId === tab.id ? 'active-tab' : ''}`}
                        style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
                    >
                        <SupermarketPOSContent 
                            tabId={tab.id}
                            printBill={printBill} 
                            isActive={activeTabId === tab.id}
                            onBillNoChange={(billNo) => handleBillNoChange(tab.id, billNo)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

function LiveClock() {
    const [t, setT] = useState(new Date())
    useEffect(() => {
        const id = setInterval(() => setT(new Date()), 1000)
        return () => clearInterval(id)
    }, [])
    return <span>{t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
}
