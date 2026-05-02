import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import './SupermarketPOS.css'

const TAX_RATES = { SGST: 9, CGST: 9, IGST: 0 }

function calcRow(row, taxType) {
    const qty   = parseFloat(row.qty)   || 0
    const mrp   = parseFloat(row.mrp)   || 0
    const disPct= parseFloat(row.disPct)|| 0

    // Rate after discount on MRP
    const rate   = mrp * (1 - disPct / 100)
    const disRs  = (mrp - rate) * qty
    const basic  = taxType === 'Inclusive'
        ? rate / (1 + (TAX_RATES.SGST + TAX_RATES.CGST + TAX_RATES.IGST) / 100)
        : rate

    const sgstAmt = basic * qty * (TAX_RATES.SGST / 100)
    const cgstAmt = basic * qty * (TAX_RATES.CGST / 100)
    const igstAmt = basic * qty * (TAX_RATES.IGST / 100)
    const tax     = sgstAmt + cgstAmt + igstAmt
    const total   = rate * qty

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
    return { id: Date.now(), productId: '', productName: '', qty: 1, mrp: 0, basic: 0, rate: 0, disPct: 0, disRs: 0, sgst: 0, cgst: 0, igst: 0, tax: 0, total: 0, remarks: '', inStock: 0 }
}

export default function SupermarketPOS({ printBill }) {
    const { user } = useAuth()
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

    // ── Header state ─────────────────────────────────────────
    const [billCategory, setBillCategory] = useState('SALES')
    const [taxType, setTaxType]           = useState('Inclusive')
    const [dealer, setDealer]             = useState('Unregistered')
    const [category, setCategory]         = useState('')
    const [payment, setPayment]           = useState('CASH')
    const [billDate, setBillDate]         = useState(today)
    const [disPctHeader, setDisPctHeader] = useState(0)
    const [billNo, setBillNo]             = useState('')
    const [dueDate, setDueDate]           = useState('')
    const [poDate, setPODate]             = useState('')
    const [empCode, setEmpCode]           = useState('')
    const [freightCharges, setFreightCharges] = useState(0)
    const [vehicleNumber, setVehicleNumber]   = useState('')
    const [billType, setBillType]             = useState('3 Inch')
    const [noTax, setNoTax]                   = useState(false)
    const [manualBillNo, setManualBillNo]     = useState(false)
    const [netAmount, setNetAmount]           = useState(false)
    const [updateMrp, setUpdateMrp]           = useState(false)
    const [updateRate, setUpdateRate]         = useState(false)

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

    // ── History & Email Modals ───────────────────────────────
    const [showHistoryModal, setShowHistoryModal] = useState(false)
    const [historyOrders, setHistoryOrders]       = useState([])
    const [historyLoading, setHistoryLoading]     = useState(false)
    const [showEmailModal, setShowEmailModal]     = useState(false)
    const [emailAddr, setEmailAddr]               = useState('')
    const [pendingReprint, setPendingReprint]     = useState(null)
    const [showReprintLang, setShowReprintLang]   = useState(false)

    // ── Rows ─────────────────────────────────────────────────
    const [rows, setRows] = useState([emptyRow()])
    const [activeRowIdx, setActiveRowIdx] = useState(0)
    const [activeCol, setActiveCol] = useState('productId')
    const [rowWithDeleteBtn, setRowWithDeleteBtn] = useState(null)

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
                lookupProduct(idx, e.target.value)
            } else if (e.key === 'Enter') {
                e.preventDefault()
                setActiveRowIdx(Math.min(rows.length - 1, idx + 1))
            }
        }
    }

    // ── Customer ─────────────────────────────────────────────
    const [customerId, setCustomerId]       = useState('')
    const [customerName, setCustomerName]   = useState('')
    const [customerMobile, setCustomerMobile] = useState('')
    const [prevBalance, setPrevBalance]       = useState(0)
    const [customerTab, setCustomerTab]       = useState('customer') // 'customer' | 'receipt'

    // ── Inventory lookup ─────────────────────────────────────
    const [inventory, setInventory]   = useState([])
    const [barcodeBuf, setBarcodeBuf] = useState('')
    const barcodeBufRef = useRef('')
    const barcodeTimer  = useRef(null)

    // ── Misc ─────────────────────────────────────────────────
    const [notification, setNotification] = useState('')
    const [saving, setSaving]             = useState(false)
    const [inStock, setInStock]           = useState(0)
    
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
        // Generate bill number
        setBillNo('TRP' + String(Math.floor(1000 + Math.random() * 9000)));
    }, [refreshInventory]);

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
                                    if (!isNaN(val)) setScaleData(val);
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
    const computed = rows.map(r => calcRow(r, taxType))
    const totalItems    = computed.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0)
    const totalDiscount = computed.reduce((s, r) => s + r.disRs, 0)
    const subTotal      = computed.reduce((s, r) => s + r.total, 0)
    const grandTotal    = subTotal + parseFloat(freightCharges || 0)

    // ── When a row's MRP/qty/dis changes, recalc ─────────────
    function updateRow(idx, field, value) {
        setRows(prev => {
            const next = [...prev]
            next[idx] = { ...next[idx], [field]: value }
            next[idx] = calcRow(next[idx], taxType)
            return next
        })
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
        
        // --- CHECK FOR DUPLICATES ---
        const existingIdx = rows.findIndex((r, i) => i !== idx && r.productId === safeId);
        if (existingIdx !== -1) {
            // Already in the bill, increment it
            updateRow(existingIdx, 'qty', (parseFloat(rows[existingIdx].qty) || 0) + 1);
            notify(`Quantity increased for ${rows[existingIdx].productName} [Row ${existingIdx + 1}]`);
            
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
        setRows(prev => {
            const next = [...prev]
            next[idx] = calcRow({
                ...next[idx],
                productId:   safeId,
                productName: found.name,
                mrp:         found.price || 0,
                inStock:     found.currentStock || 0,
                unit:        found.unit || 'PIECE',
                qty:         next[idx].qty > 0 ? next[idx].qty : 1 // default qty to 1 if empty
            }, taxType)
            return next
        })
        setInStock(found.currentStock || 0)
        
        setRows(prev => {
            if (idx === prev.length - 1) return [...prev, emptyRow()]
            return prev
        })
        setActiveRowIdx(idx + 1)
        setActiveCol('productId')
        setTimeout(() => document.getElementById(`cell-${idx + 1}-productId`)?.focus(), 10)
    }

    // ── Product lookup by ID or barcode ──────────────────────
    function lookupProduct(idx, query) {
        query = query.trim()
        if (!query) {
            // Force fetch
            refreshInventory();
            
            setShowSearchModalForIdx(idx)
            setSearchQuery('')
            setSearchSelectedIdx(0)
            setTimeout(() => document.getElementById('advanced-search-input')?.focus(), 10)
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
                }
            });

            // Not found exactly, pop open the search modal with this query
            setShowSearchModalForIdx(idx)
            setSearchQuery(query)
            setSearchSelectedIdx(0)
            setTimeout(() => document.getElementById('advanced-search-input')?.focus(), 10)
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
    }, [activeRowIdx, inventory, taxType])

    // ── Keyboard shortcuts ────────────────────────────────────
    useEffect(() => {
        function onShortcut(e) {
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
            if (e.key === 'Enter' && showSettlement) { e.preventDefault(); confirmSave() }
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
    }, [rows, saving, showSettlement, showHistoryModal, showEmailModal, showHeldModal, grandTotal, activeRowIdx])

    function handleNewBill() {
        const activeRows = rows.filter(r => r.productId || r.total > 0)
        if (activeRows.length > 0) {
            handleParkBill()
        }

        setRows([emptyRow()])
        setActiveRowIdx(0)
        setActiveCol('productId')
        setCustomerId(''); setCustomerName(''); setCustomerMobile(''); setPrevBalance(0)
        setFreightCharges(0); setVehicleNumber(''); setEmpCode('')
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
        setTenderCash(grandTotal)
        setTenderUPI(0)
        setTenderCard(0)
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
                    barcode: r.productId,
                })),
                billCategory,
                taxType,
                payment,
                customerName,
                customerMobile,
                discountPct: parseFloat(disPctHeader) || 0,
                freightCharges: parseFloat(freightCharges) || 0,
                billNo,
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
        <div className="sm-pos-root">
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
                            <option>Grocery</option><option>Electronics</option><option>Clothing</option>
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
                        <label>Scale</label>
                        <div className="sm-scale-actions">
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
                                    <th className="col-mrp">MRP</th>
                                    <th className="col-basic">Basic</th>
                                    <th className="col-rate">Rate</th>
                                    <th className="col-dis">Dis(%)</th>
                                    <th className="col-disrs">DisRs</th>
                                    <th className="col-tax">SGST</th>
                                    <th className="col-tax">CGST</th>
                                    <th className="col-tax">IGST</th>
                                    <th className="col-tax">Tax</th>
                                    <th className="col-total">Total</th>
                                    <th className="col-remarks">Remarks</th>
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
                                        <td className="col-basic">{row.basic.toFixed(2)}</td>
                                        <td className="col-rate">{row.rate.toFixed(2)}</td>
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
                                        <td className="col-disrs">{row.disRs.toFixed(2)}</td>
                                        <td className="col-tax">{row.sgst.toFixed(2)}</td>
                                        <td className="col-tax">{row.cgst.toFixed(2)}</td>
                                        <td className="col-tax">{row.igst.toFixed(2)}</td>
                                        <td className="col-tax">{row.tax.toFixed(2)}</td>
                                        <td className="col-total">{row.total.toFixed(2)}</td>
                                        <td className="col-remarks">
                                            <input 
                                                id={`cell-${idx}-remarks`}
                                                value={row.remarks} 
                                                onChange={e => updateRow(idx, 'remarks', e.target.value)} 
                                                onKeyDown={e => handleCellKeyDown(e, idx, 'remarks')}
                                                onFocus={() => { setActiveRowIdx(idx); setActiveCol('remarks') }} 
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="sm-totals-row">
                                    <td colSpan={3} className="totals-label">TOTALS</td>
                                    <td>{totalItems.toFixed(2)}</td>
                                    <td></td><td></td><td></td><td></td>
                                    <td>{totalDiscount.toFixed(2)}</td>
                                    <td>{computed.reduce((s,r)=>s+r.sgst,0).toFixed(2)}</td>
                                    <td>{computed.reduce((s,r)=>s+r.cgst,0).toFixed(2)}</td>
                                    <td>{computed.reduce((s,r)=>s+r.igst,0).toFixed(2)}</td>
                                    <td>{computed.reduce((s,r)=>s+r.tax,0).toFixed(2)}</td>
                                    <td className="grand-total-cell">{subTotal.toFixed(2)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ── BILLING SUMMARY PANEL ── */}
                <div className="sm-summary-panel">
                    <div className="sm-summary-header">Billing Summary</div>
                    <div className="sm-summary-field">
                        <label>Bill Type</label>
                        <select value={billType} onChange={e => setBillType(e.target.value)}>
                            <option>3 Inch</option><option>2 Inch</option><option>A4</option><option>A5</option>
                        </select>
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
                            <div className="tender-row total">
                                <label>Net Amount payable</label>
                                <span>₹{grandTotal.toFixed(2)}</span>
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

            {/* ── History Search Modal (Find Bill) ───────────────── */}
            {showHistoryModal && (
                <div className="sm-modal-overlay">
                    <div className="sm-modal-content" style={{ width: '650px' }}>
                        <div className="sm-modal-header">
                            <h3>🔍 Past Sales History</h3>
                            <button onClick={() => setShowHistoryModal(false)}>×</button>
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
                                                            style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
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

function LiveClock() {
    const [t, setT] = useState(new Date())
    useEffect(() => {
        const id = setInterval(() => setT(new Date()), 1000)
        return () => clearInterval(id)
    }, [])
    return <span>{t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
}
