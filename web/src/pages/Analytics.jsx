import React, { useEffect, useState, useMemo } from 'react'
import api from '../api/client.js'
import { useStakeholder } from '../context/StakeholderContext.jsx'
import { usePOSMode } from '../context/POSModeContext.jsx'
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs'
import { getVehicleLocations, getAllLocationStocks, getStockMovements, getEmployeeVehicles, getItemLocationStock } from '../services/vehicleLocationService.js'
import './Analytics.css'

// Recharts imports for professional graphics
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'

export default function AnalyticsPage() {
    const { selectedRestaurantId } = useStakeholder()
    const { isPoultry } = usePOSMode()
    const [data, setData] = useState(null)
    const [period, setPeriod] = useState('7d')
    const [loading, setLoading] = useState(true)
    const [selectedReport, setSelectedReport] = useState(null)
    const [reportData, setReportData] = useState(null)
    const [reportLoading, setReportLoading] = useState(false)
    const [showSelector, setShowSelector] = useState(false)
    const [selectedDate, setSelectedDate] = useState('')

    // Universal Report Filter States
    const [filterFromDate, setFilterFromDate] = useState('')
    const [filterToDate, setFilterToDate] = useState('')
    const [filterSearch, setFilterSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterClient, setFilterClient] = useState('')
    const [filterLocation, setFilterLocation] = useState('')
    const [filterEmployee, setFilterEmployee] = useState('')

    // Raw datasets for offline/frontend calculations
    const [allOrders, setAllOrders] = useState([])
    const [allInventory, setAllInventory] = useState([])

    const reports = [
        { id: 'free-stock-report', label: '1. Free / Complimentary Stock Report', icon: '🎁' },
        { id: 'returned-stock-report', label: '2. Returned Stock Report', icon: '↩️' },
        { id: 'sales-report', label: '3. Sales Analytics Report', icon: '📝' },
        { id: 'sales-gst-report', label: '4. GST Sales Report', icon: '💰' },
        { id: 'sales-non-gst-report', label: '5. Non-GST Sales Report', icon: '💳' },
        { id: 'client-wise-sales', label: '6. Client-Wise Sales Report', icon: '🏪' },
        { id: 'location-wise-stock', label: '7. Vehicle/Location-Wise Stock Management', icon: '📍' },
        { id: 'stock-audit-trail', label: '8. Stock Movement / Audit Trail Report', icon: '🔍' },
        { id: 'sales-summary', label: 'Sales Summary', icon: '📊' },
        { id: 'payment-mode-sales', label: 'Payment Mode Wise Report', icon: '💳' },
        { id: 'monthly-day-wise', label: 'Monthly Day wise Report', icon: '📅' },
        { id: 'end-day-report', label: 'End Day Report', icon: '🏁' },
        { id: 'category-item-wise', label: 'Category & Item wise Report', icon: '📁' },
        { id: 'item-wise-sales', label: 'Item wise sales Report', icon: '🍔' },
        { id: 'income-expense', label: 'Income & Expense Report', icon: '💸' },
        { id: 'expenditure-report', label: 'Detailed Expenditure Report', icon: '🧾' },
        { id: 'purchase-gst-report', label: 'Purchase Report (With GST)', icon: '🧮' },
        { id: 'purchase-non-gst-report', label: 'Purchase Report (Without GST)', icon: '🔖' },
        { id: 'stock-report', label: 'Stock Report', icon: '📦' },
        { id: 'recipe-stock', label: 'Recipe Stock Report', icon: '🥘' },
        { id: 'purchase-item-stock', label: 'Purchase Item Stock Report', icon: '📥' },
        { id: 'purchase-recipe-stock', label: 'Purchase Recipe Stock Report', icon: '🍲' },
        { id: 'expiry-date-wise', label: 'Expiry Date Wise Stock Report', icon: '⚠️' },
        { id: 'total-inventory-valuation', label: 'Total Inventory Valuation', icon: '💰' },
        { id: 'cashier-wise-sales', label: 'Cashier wise sales Report', icon: '👤' },
        { id: 'hsn-summary', label: 'HSN Summary', icon: '🔢' },
        { id: 'cancelled-item-summary', label: 'Cancelled Item Summary', icon: '❌' },
        { id: 'month-wise-stock-report', label: 'Month Wise Stock Report', icon: '📅' },
        { id: 'inventory-category-report', label: 'Inventory Category Report', icon: '📂' }
    ]

    // Download CSV Utility
    const handleExportCSV = (filename, columns, dataRows) => {
        if (!dataRows || dataRows.length === 0) {
            alert('No data available to export!');
            return;
        }
        const headers = columns.map(c => c.label).join(',');
        const rows = dataRows.map(row => {
            return columns.map(c => {
                let val = row[c.key];
                if (val === undefined || val === null) val = '';
                if (typeof val === 'string') {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(',');
        });
        const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            let url = `/analytics/sales?period=${period}`
            if (period === 'custom' && selectedDate) {
                const from = `${selectedDate}T00:00:00`
                const to = `${selectedDate}T23:59:59`
                url += `&from=${from}&to=${to}`
            }
            const res = await api.get(url)
            let fetchedData = res.data?.data || { summary: { totalRevenue: 0, grossProfit: 0, netProfit: 0, totalOrders: 0 } };

            // Also fetch raw order history & inventory items for offline report calculations
            try {
                const [ordersRes, invRes] = await Promise.all([
                    api.get('/orders/history').catch(() => ({ data: { data: [] } })),
                    api.get('/inventory').catch(() => ({ data: { data: [] } }))
                ]);
                let bOrders = ordersRes.data?.data || [];
                const pOrders = JSON.parse(localStorage.getItem('poultry_history_bills') || '[]');

                // Format pOrders into uniform structure
                const formattedPoultry = pOrders.map(p => ({
                    ...p,
                    orderNumber: p.billNumber || p.id || 'PLT-OFF',
                    date: p.date || p.createdAt || new Date().toISOString(),
                    customer: p.customerName || (p.notes && p.notes.includes('CLIENTNAME:') ? p.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in'),
                    location: p.assignedVehicle || (p.notes && p.notes.includes('LOCATION:') ? p.notes.split('LOCATION:')[1].split('||')[0] : 'Godown'),
                    employee: p.employeeName || 'Biller',
                    items: p.items || []
                }));

                const combinedOrders = [...bOrders, ...formattedPoultry];
                setAllOrders(combinedOrders);
                setAllInventory(invRes.data?.data || []);
            } catch (err) {
                console.warn('Raw orders fetch error', err);
            }

            if (fetchedData && fetchedData.topItems) {
                const tailoringItems = fetchedData.topItems.filter(i => i._id && i._id.startsWith('Tailoring: '));
                const tRev = tailoringItems.reduce((acc, curr) => acc + (curr.totalRevenue || 0), 0);
                if (tRev > 0 && fetchedData.summary) {
                    fetchedData.summary.totalRevenue = Math.max(0, fetchedData.summary.totalRevenue - tRev);
                    fetchedData.summary.grossProfit -= tRev;
                    fetchedData.summary.netProfit -= tRev;
                }
            }

            // ── Pure JS Alone: Aggregate Poultry POS Bills into Analytics Dashboard ──
            try {
                const poultryHistory = JSON.parse(localStorage.getItem('poultry_history_bills') || '[]');
                if (poultryHistory.length > 0) {
                    let now = new Date();
                    let minDate = new Date(0);
                    if (period === 'today') {
                        minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    } else if (period === '7d') {
                        minDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    } else if (period === '30d') {
                        minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    } else if (period === 'custom' && selectedDate) {
                        minDate = new Date(`${selectedDate}T00:00:00`);
                        now = new Date(`${selectedDate}T23:59:59`);
                    }

                    const filteredPoultry = poultryHistory.filter(b => {
                        const bTime = new Date(b.date || b.createdAt || Date.now());
                        return bTime >= minDate && bTime <= now;
                    });

                    const pRev = filteredPoultry.reduce((sum, b) => sum + (parseFloat(b.total) || 0), 0);
                    const pCount = filteredPoultry.length;

                    if (!fetchedData.summary) {
                        fetchedData.summary = { totalRevenue: 0, grossProfit: 0, netProfit: 0, totalOrders: 0 };
                    }

                    fetchedData.summary.totalRevenue = (fetchedData.summary.totalRevenue || 0) + pRev;
                    fetchedData.summary.grossProfit = (fetchedData.summary.grossProfit || 0) + pRev;
                    fetchedData.summary.netProfit = (fetchedData.summary.netProfit || 0) + pRev;
                    fetchedData.summary.totalOrders = (fetchedData.summary.totalOrders || 0) + pCount;
                }
            } catch (pErr) {
                console.warn('Poultry bills JS aggregation error', pErr);
            }

            setData(fetchedData)
        } catch (e) {
            console.error(e)
            try {
                const poultryHistory = JSON.parse(localStorage.getItem('poultry_history_bills') || '[]');
                const pRev = poultryHistory.reduce((sum, b) => sum + (parseFloat(b.total) || 0), 0);
                setData({
                    summary: {
                        totalRevenue: pRev,
                        grossProfit: pRev,
                        netProfit: pRev,
                        totalOrders: poultryHistory.length
                    }
                });
            } catch (err) { }
        } finally {
            setLoading(false)
        }
    }

    const fetchReportData = async (reportId) => {
        setReportLoading(true)
        try {
            const res = await api.get(`/analytics/report-data?type=${reportId}`).catch(() => ({ data: { data: null } }))
            setReportData(res.data?.data || null)
        } catch (e) {
            console.error(e)
        } finally {
            setReportLoading(false)
        }
    }

    const handleDownload = async (reportId, format = 'pdf') => {
        try {
            const mimeMap = {
                pdf: 'application/pdf',
                word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                json: 'application/json',
            }
            const extMap = { pdf: 'pdf', word: 'docx', excel: 'xlsx', json: 'json' }
            const res = await api.get(
                `/analytics/download-report?type=${reportId}&format=${format}`,
                { responseType: 'blob' }
            )
            const blob = new Blob([res.data], { type: mimeMap[format] })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url;
            link.setAttribute('download', `${reportId}.${extMap[format]}`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (e) {
            console.error(e)
            alert('Failed to download report. Please try again.')
        }
    }

    useEffect(() => {
        fetchAnalytics()
    }, [period, selectedDate, selectedRestaurantId])

    useEffect(() => {
        if (selectedReport) {
            fetchReportData(selectedReport.id)
        }
    }, [selectedReport])

    // Compute Summary Card Metrics for Main Dashboard
    const dashboardMetrics = useMemo(() => {
        const pOrders = JSON.parse(localStorage.getItem('poultry_history_bills') || '[]');
        const combined = [...allOrders, ...pOrders];

        let totalGstSales = 0;
        let totalNonGstSales = 0;
        let totalReturnsVal = 0;
        let totalFreeVal = 0;

        combined.forEach(o => {
            const items = o.items || [];
            let orderGst = 0;
            items.forEach(i => {
                const qty = parseFloat(i.quantity || i.qty) || 0;
                const amt = parseFloat(i.amount || (qty * (i.rate || 0))) || 0;
                const isFree = i.itemType === 'FREE' || i.isFree || i.rate === 0;
                const isReturn = i.itemType === 'RETURN' || i.isReturn;

                if (isFree) totalFreeVal += (qty * (i.buyingPrice || i.costPerUnit || 10));
                if (isReturn) totalReturnsVal += amt;
                if ((i.gstPercent || 0) > 0 || (i.gstAmount || 0) > 0) orderGst += amt;
            });

            if (orderGst > 0) totalGstSales += (o.total || 0);
            else totalNonGstSales += (o.total || 0);
        });

        const movements = getStockMovements();
        const locations = getVehicleLocations();
        const allLocStocks = getAllLocationStocks();

        let stockValuation = 0;
        let lowStockCount = 0;

        allInventory.forEach(inv => {
            const qty = parseFloat(inv.currentStock) || 0;
            const cost = parseFloat(inv.costPerUnit || inv.buyingPrice) || 0;
            stockValuation += (qty * cost);
            if (qty <= (inv.lowStockThreshold || 5)) lowStockCount++;
        });

        return {
            totalGstSales,
            totalNonGstSales,
            totalReturnsVal,
            totalFreeVal,
            stockValuation,
            lowStockCount,
            movementCount: movements.length,
            locationCount: locations.length
        };
    }, [allOrders, allInventory]);

    const kpis = [
        {
            label: 'Total Revenue',
            value: `₹${data?.summary?.totalRevenue?.toLocaleString('en-IN') || 0}`,
            icon: '💰',
            bg: 'rgba(198,245,61,0.1)',
            color: '#C6F53D',
            trend: '+12.5%',
            borderColor: 'rgba(198,245,61,0.5)'
        },
        {
            label: 'GST Sales',
            value: `₹${Math.round(dashboardMetrics.totalGstSales).toLocaleString('en-IN')}`,
            icon: '🏛️',
            bg: 'rgba(59,130,246,0.1)',
            color: '#60a5fa',
            trend: 'Taxed Sales',
            borderColor: 'rgba(59,130,246,0.5)'
        },
        {
            label: 'Non-GST Sales',
            value: `₹${Math.round(dashboardMetrics.totalNonGstSales).toLocaleString('en-IN')}`,
            icon: '💳',
            bg: 'rgba(139,92,246,0.1)',
            color: '#a78bfa',
            trend: 'Exempt Sales',
            borderColor: 'rgba(139,92,246,0.5)'
        },
        {
            label: 'Stock Returns',
            value: `₹${Math.round(dashboardMetrics.totalReturnsVal).toLocaleString('en-IN')}`,
            icon: '↩️',
            bg: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            trend: 'Returned',
            borderColor: 'rgba(239,68,68,0.5)'
        },
        {
            label: 'Free Stock Given',
            value: `₹${Math.round(dashboardMetrics.totalFreeVal).toLocaleString('en-IN')}`,
            icon: '🎁',
            bg: 'rgba(16,185,129,0.1)',
            color: '#10b981',
            trend: 'Complimentary',
            borderColor: 'rgba(16,185,129,0.5)'
        },
        {
            label: 'Stock Valuation',
            value: `₹${Math.round(dashboardMetrics.stockValuation).toLocaleString('en-IN')}`,
            icon: '📦',
            bg: 'rgba(245,158,11,0.1)',
            color: '#f59e0b',
            trend: `${dashboardMetrics.lowStockCount} Low Stock`,
            borderColor: 'rgba(245,158,11,0.5)'
        },
        {
            label: 'Storage Spaces',
            value: `${dashboardMetrics.locationCount} Spaces`,
            icon: '📍',
            bg: 'rgba(236,72,153,0.1)',
            color: '#ec4899',
            trend: `${dashboardMetrics.movementCount} Logs`,
            borderColor: 'rgba(236,72,153,0.5)'
        }
    ]

    const renderReportView = () => {
        if (reportLoading) return <div className="loading-centered"><div className="spinner"></div></div>

        // Universal Filter Component Bar
        const filterToolbar = (
            <div className="an-report-filter-bar">
                <div className="filter-item">
                    <span className="filter-label">From:</span>
                    <input type="date" className="filter-input" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} />
                </div>
                <div className="filter-item">
                    <span className="filter-label">To:</span>
                    <input type="date" className="filter-input" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} />
                </div>
                <div className="filter-item">
                    <span className="filter-label">Search / Item:</span>
                    <input type="text" className="filter-input" placeholder="Search product..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
                </div>
                <div className="filter-item">
                    <span className="filter-label">Location:</span>
                    <select className="filter-input" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                        <option value="">All Storage Spaces</option>
                        {getVehicleLocations().map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-item">
                    <span className="filter-label">Client:</span>
                    <input type="text" className="filter-input" placeholder="Client name..." value={filterClient} onChange={e => setFilterClient(e.target.value)} />
                </div>
                <div className="filter-item">
                    <span className="filter-label">Employee:</span>
                    <input type="text" className="filter-input" placeholder="Staff..." value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} />
                </div>
                {(filterFromDate || filterToDate || filterSearch || filterLocation || filterClient || filterEmployee) && (
                    <button className="clear-filter-btn" onClick={() => {
                        setFilterFromDate(''); setFilterToDate(''); setFilterSearch(''); setFilterLocation(''); setFilterClient(''); setFilterEmployee('');
                    }}>✕ Clear Filters</button>
                )}
            </div>
        );

        const renderDownloadBar = (cols, exportData, filename) => (
            <div className="export-format-bar">
                <span className="export-label">Export As:</span>
                <button className="export-btn export-csv" onClick={() => handleExportCSV(filename || selectedReport?.id || 'report', cols, exportData)} style={{ background: 'rgba(198,245,61,0.15)', color: '#C6F53D', border: '1px solid rgba(198,245,61,0.4)' }}>
                    <span className="export-icon">📥</span> CSV / Excel
                </button>
                <button className="export-btn export-pdf" onClick={() => handleDownload(selectedReport?.id, 'pdf')}>
                    <span className="export-icon">📄</span> PDF
                </button>
                <button className="export-btn export-word" onClick={() => handleDownload(selectedReport?.id, 'word')}>
                    <span className="export-icon">📝</span> Word
                </button>
                <button className="export-btn export-json" onClick={() => handleDownload(selectedReport?.id, 'json')}>
                    <span className="export-icon">{'{ }'}</span> JSON
                </button>
            </div>
        );

        // Combined orders dataset (API + local storage poultry bills)
        const combinedOrders = allOrders.length > 0 ? allOrders : (JSON.parse(localStorage.getItem('poultry_history_bills') || '[]'));

        // Helper filter logic for order line items
        const passesFilters = (itemDateStr, itemLocation, clientName, empName, prodName) => {
            if (filterFromDate && new Date(itemDateStr) < new Date(`${filterFromDate}T00:00:00`)) return false;
            if (filterToDate && new Date(itemDateStr) > new Date(`${filterToDate}T23:59:59`)) return false;
            if (filterLocation && String(itemLocation || '').toLowerCase() !== filterLocation.toLowerCase()) return false;
            if (filterClient && !String(clientName || '').toLowerCase().includes(filterClient.toLowerCase())) return false;
            if (filterEmployee && !String(empName || '').toLowerCase().includes(filterEmployee.toLowerCase())) return false;
            if (filterSearch && !String(prodName || '').toLowerCase().includes(filterSearch.toLowerCase())) return false;
            return true;
        };

        switch (selectedReport?.id) {

            // ── 1. Free/Complimentary Stock Report ───────────────────────
            case 'free-stock-report': {
                const freeRows = [];
                combinedOrders.forEach(o => {
                    const dateStr = o.date || o.createdAt || new Date().toISOString();
                    const client = o.customer || o.customerName || (o.notes && o.notes.includes('CLIENTNAME:') ? o.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in');
                    const loc = o.location || o.assignedVehicle || (o.notes && o.notes.includes('LOCATION:') ? o.notes.split('LOCATION:')[1].split('||')[0] : 'Godown');
                    const emp = o.employee || o.employeeName || 'Biller';

                    (o.items || []).forEach(i => {
                        const isFree = i.itemType === 'FREE' || i.isFree || parseFloat(i.rate) === 0;
                        const name = i.itemName || i.name;
                        if (isFree && passesFilters(dateStr, loc, client, emp, name)) {
                            const qty = parseFloat(i.quantity || i.qty) || 0;
                            const estRate = parseFloat(i.buyingPrice || i.costPerUnit || i.originalRate) || 10;
                            freeRows.push({
                                date: new Date(dateStr).toLocaleDateString('en-IN'),
                                billNo: o.orderNumber || o.billNumber || o.id || 'PLT-FREE',
                                product: name,
                                category: i.category || 'General',
                                quantity: qty,
                                unit: i.quantityType || i.type || 'pcs',
                                estRate: estRate,
                                totalVal: qty * estRate,
                                location: loc,
                                client: client,
                                employee: emp
                            });
                        }
                    });
                });

                const totalFreeQty = freeRows.reduce((sum, r) => sum + r.quantity, 0);
                const totalFreeVal = freeRows.reduce((sum, r) => sum + r.totalVal, 0);

                const cols = [
                    { label: 'Date', key: 'date' },
                    { label: 'Bill #', key: 'billNo' },
                    { label: 'Product Name', key: 'product' },
                    { label: 'Category', key: 'category' },
                    { label: 'Qty Given', key: 'quantity' },
                    { label: 'Unit', key: 'unit' },
                    { label: 'Est. Unit Value', key: 'estRate' },
                    { label: 'Total Value', key: 'totalVal' },
                    { label: 'Location', key: 'location' },
                    { label: 'Client', key: 'client' },
                    { label: 'Employee', key: 'employee' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(16,185,129,0.08)' }}>
                                <span className="label">Total Free Items</span>
                                <span className="val" style={{ color: '#10b981' }}>{freeRows.length} Transactions</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="label">Total Free Quantity</span>
                                <span className="val" style={{ color: '#60a5fa' }}>{totalFreeQty} Units</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(198,245,61,0.08)' }}>
                                <span className="label">Total Value Given</span>
                                <span className="val" style={{ color: '#C6F53D' }}>₹{totalFreeVal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Bill #</th>
                                        <th>Product</th>
                                        <th>Category</th>
                                        <th>Qty</th>
                                        <th>Location</th>
                                        <th>Client</th>
                                        <th>Employee</th>
                                        <th>Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {freeRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{r.date}</td>
                                            <td><b>{r.billNo}</b></td>
                                            <td>{r.product}</td>
                                            <td>{r.category}</td>
                                            <td><b style={{ color: '#10b981' }}>{r.quantity} {r.unit}</b></td>
                                            <td><span className="status-pill warning">{r.location}</span></td>
                                            <td>{r.client}</td>
                                            <td>{r.employee}</td>
                                            <td><b style={{ color: '#C6F53D' }}>₹{r.totalVal.toLocaleString('en-IN')}</b></td>
                                        </tr>
                                    ))}
                                    {freeRows.length === 0 && (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No free/complimentary stock items found matching the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, freeRows, 'Free_Stock_Report')}
                    </div>
                );
            }

            // ── 2. Returned Stock Report ───────────────────────────────
            case 'returned-stock-report': {
                const returnRows = [];
                combinedOrders.forEach(o => {
                    const dateStr = o.date || o.createdAt || new Date().toISOString();
                    const client = o.customer || o.customerName || (o.notes && o.notes.includes('CLIENTNAME:') ? o.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in');
                    const loc = o.location || o.assignedVehicle || (o.notes && o.notes.includes('LOCATION:') ? o.notes.split('LOCATION:')[1].split('||')[0] : 'Godown');
                    const emp = o.employee || o.employeeName || 'Biller';

                    (o.items || []).forEach(i => {
                        const isReturn = i.itemType === 'RETURN' || i.isReturn;
                        const name = i.itemName || i.name;
                        if (isReturn && passesFilters(dateStr, loc, client, emp, name)) {
                            const qty = parseFloat(i.quantity || i.qty) || 0;
                            const amt = parseFloat(i.amount || (qty * (i.rate || 0))) || 0;
                            returnRows.push({
                                date: new Date(dateStr).toLocaleDateString('en-IN'),
                                billNo: o.orderNumber || o.billNumber || o.id || 'PLT-RET',
                                product: name,
                                returnedQty: qty,
                                unit: i.quantityType || i.type || 'pcs',
                                returnVal: amt,
                                location: loc,
                                client: client,
                                employee: emp
                            });
                        }
                    });
                });

                const totalReturnedQty = returnRows.reduce((sum, r) => sum + r.returnedQty, 0);
                const totalReturnedVal = returnRows.reduce((sum, r) => sum + r.returnVal, 0);

                const cols = [
                    { label: 'Date', key: 'date' },
                    { label: 'Bill #', key: 'billNo' },
                    { label: 'Product Name', key: 'product' },
                    { label: 'Returned Qty', key: 'returnedQty' },
                    { label: 'Unit', key: 'unit' },
                    { label: 'Return Value', key: 'returnVal' },
                    { label: 'Location', key: 'location' },
                    { label: 'Client', key: 'client' },
                    { label: 'Employee', key: 'employee' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card error">
                                <span className="label">Returned Items Count</span>
                                <span className="val">{returnRows.length} Records</span>
                            </div>
                            <div className="summary-val-card warning">
                                <span className="label">Total Returned Qty</span>
                                <span className="val">{totalReturnedQty} Units</span>
                            </div>
                            <div className="summary-val-card error">
                                <span className="label">Total Return Value</span>
                                <span className="val">₹{totalReturnedVal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Bill #</th>
                                        <th>Product</th>
                                        <th>Qty</th>
                                        <th>Return Value</th>
                                        <th>Location</th>
                                        <th>Client</th>
                                        <th>Employee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returnRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{r.date}</td>
                                            <td><b>{r.billNo}</b></td>
                                            <td>{r.product}</td>
                                            <td><b style={{ color: '#ef4444' }}>{r.returnedQty} {r.unit}</b></td>
                                            <td><b style={{ color: '#ef4444' }}>₹{r.returnVal.toLocaleString('en-IN')}</b></td>
                                            <td><span className="status-pill warning">{r.location}</span></td>
                                            <td>{r.client}</td>
                                            <td>{r.employee}</td>
                                        </tr>
                                    ))}
                                    {returnRows.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No returned stock records found matching the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, returnRows, 'Returned_Stock_Report')}
                    </div>
                );
            }

            // ── 3. Sales Analytics Report ──────────────────────────────
            case 'sales-report': {
                const salesRows = [];
                combinedOrders.forEach(o => {
                    const dateStr = o.date || o.createdAt || new Date().toISOString();
                    const client = o.customer || o.customerName || (o.notes && o.notes.includes('CLIENTNAME:') ? o.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in');
                    const loc = o.location || o.assignedVehicle || (o.notes && o.notes.includes('LOCATION:') ? o.notes.split('LOCATION:')[1].split('||')[0] : 'Godown');
                    const emp = o.employee || o.employeeName || 'Biller';
                    const itemsSummary = (o.items || []).map(i => `${i.itemName || i.name} (x${i.quantity || i.qty})`).join(', ');

                    if (passesFilters(dateStr, loc, client, emp, itemsSummary)) {
                        salesRows.push({
                            date: new Date(dateStr).toLocaleDateString('en-IN'),
                            billNo: o.orderNumber || o.billNumber || o.id || 'PLT-SALE',
                            client: client,
                            itemsCount: (o.items || []).length,
                            itemsSummary: itemsSummary || 'Sales Order',
                            total: parseFloat(o.total) || 0,
                            payment: o.paymentMethod || o.payment || 'CASH',
                            location: loc,
                            employee: emp,
                            status: o.paymentStatus || 'PAID'
                        });
                    }
                });

                const totalRev = salesRows.reduce((sum, r) => sum + r.total, 0);

                const cols = [
                    { label: 'Date', key: 'date' },
                    { label: 'Bill #', key: 'billNo' },
                    { label: 'Client / Customer', key: 'client' },
                    { label: 'Items Summary', key: 'itemsSummary' },
                    { label: 'Total Value', key: 'total' },
                    { label: 'Payment Method', key: 'payment' },
                    { label: 'Location', key: 'location' },
                    { label: 'Employee', key: 'employee' },
                    { label: 'Status', key: 'status' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(198,245,61,0.08)' }}>
                                <span className="label">Total Sales Revenue</span>
                                <span className="val" style={{ color: '#C6F53D' }}>₹{totalRev.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="label">Total Transactions</span>
                                <span className="val" style={{ color: '#60a5fa' }}>{salesRows.length} Bills</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(139,92,246,0.08)' }}>
                                <span className="label">Avg Transaction Value</span>
                                <span className="val" style={{ color: '#a78bfa' }}>₹{salesRows.length > 0 ? Math.round(totalRev / salesRows.length).toLocaleString('en-IN') : 0}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Bill #</th>
                                        <th>Client</th>
                                        <th>Items Summary</th>
                                        <th>Total</th>
                                        <th>Payment</th>
                                        <th>Location</th>
                                        <th>Employee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{r.date}</td>
                                            <td><b>{r.billNo}</b></td>
                                            <td>{r.client}</td>
                                            <td><span style={{ fontSize: '0.85em', opacity: 0.85 }}>{r.itemsSummary}</span></td>
                                            <td><b style={{ color: '#C6F53D' }}>₹{r.total.toLocaleString('en-IN')}</b></td>
                                            <td><span className="status-pill success">{r.payment}</span></td>
                                            <td><span className="status-pill warning">{r.location}</span></td>
                                            <td>{r.employee}</td>
                                        </tr>
                                    ))}
                                    {salesRows.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No sales transactions found matching the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, salesRows, 'Sales_Analytics_Report')}
                    </div>
                );
            }

            // ── 4. GST Sales Report ────────────────────────────────────
            case 'sales-gst-report': {
                const gstRows = [];
                combinedOrders.forEach(o => {
                    const dateStr = o.date || o.createdAt || new Date().toISOString();
                    const client = o.customer || o.customerName || (o.notes && o.notes.includes('CLIENTNAME:') ? o.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in');
                    const loc = o.location || o.assignedVehicle || (o.notes && o.notes.includes('LOCATION:') ? o.notes.split('LOCATION:')[1].split('||')[0] : 'Godown');
                    const emp = o.employee || o.employeeName || 'Biller';

                    (o.items || []).forEach(i => {
                        const gstRate = parseFloat(i.gstPercent || i.taxRate || 18) || 0;
                        const isGstItem = gstRate > 0 || (i.gstAmount || 0) > 0;
                        const name = i.itemName || i.name;

                        if (isGstItem && passesFilters(dateStr, loc, client, emp, name)) {
                            const qty = parseFloat(i.quantity || i.qty) || 0;
                            const totalVal = parseFloat(i.amount || (qty * (i.rate || 0))) || 0;
                            const taxAmt = i.gstAmount ? parseFloat(i.gstAmount) : (totalVal * gstRate / (100 + gstRate));
                            const baseAmt = totalVal - taxAmt;
                            const cgst = taxAmt / 2;
                            const sgst = taxAmt / 2;

                            gstRows.push({
                                date: new Date(dateStr).toLocaleDateString('en-IN'),
                                billNo: o.orderNumber || o.billNumber || o.id || 'GST-SALE',
                                client: client,
                                product: name,
                                quantity: qty,
                                baseAmt: +baseAmt.toFixed(2),
                                gstRate: gstRate,
                                cgst: +cgst.toFixed(2),
                                sgst: +sgst.toFixed(2),
                                totalGst: +taxAmt.toFixed(2),
                                totalVal: +totalVal.toFixed(2),
                                location: loc,
                                employee: emp
                            });
                        }
                    });
                });

                const totalBase = gstRows.reduce((sum, r) => sum + r.baseAmt, 0);
                const totalGst = gstRows.reduce((sum, r) => sum + r.totalGst, 0);
                const totalFinal = gstRows.reduce((sum, r) => sum + r.totalVal, 0);

                const cols = [
                    { label: 'Date', key: 'date' },
                    { label: 'Bill #', key: 'billNo' },
                    { label: 'Client', key: 'client' },
                    { label: 'Product Name', key: 'product' },
                    { label: 'Qty Sold', key: 'quantity' },
                    { label: 'Taxable Base (₹)', key: 'baseAmt' },
                    { label: 'GST Rate (%)', key: 'gstRate' },
                    { label: 'CGST (₹)', key: 'cgst' },
                    { label: 'SGST (₹)', key: 'sgst' },
                    { label: 'Total GST (₹)', key: 'totalGst' },
                    { label: 'Final Total (₹)', key: 'totalVal' },
                    { label: 'Location', key: 'location' },
                    { label: 'Employee', key: 'employee' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="label">Taxable Base Revenue</span>
                                <span className="val" style={{ color: '#60a5fa' }}>₹{totalBase.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="summary-val-card error">
                                <span className="label">Total GST Collected</span>
                                <span className="val">₹{totalGst.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(198,245,61,0.08)' }}>
                                <span className="label">Total Final Sales</span>
                                <span className="val" style={{ color: '#C6F53D' }}>₹{totalFinal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Bill #</th>
                                        <th>Client</th>
                                        <th>Product</th>
                                        <th>Base Amt</th>
                                        <th>GST Rate</th>
                                        <th>CGST</th>
                                        <th>SGST</th>
                                        <th>Total GST</th>
                                        <th>Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gstRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{r.date}</td>
                                            <td><b>{r.billNo}</b></td>
                                            <td>{r.client}</td>
                                            <td>{r.product}</td>
                                            <td>₹{r.baseAmt.toLocaleString('en-IN')}</td>
                                            <td>{r.gstRate}%</td>
                                            <td>₹{r.cgst.toLocaleString('en-IN')}</td>
                                            <td>₹{r.sgst.toLocaleString('en-IN')}</td>
                                            <td><b style={{ color: '#ef4444' }}>₹{r.totalGst.toLocaleString('en-IN')}</b></td>
                                            <td><b style={{ color: '#C6F53D' }}>₹{r.totalVal.toLocaleString('en-IN')}</b></td>
                                        </tr>
                                    ))}
                                    {gstRows.length === 0 && (
                                        <tr>
                                            <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No GST sales transactions found matching the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, gstRows, 'GST_Sales_Report')}
                    </div>
                );
            }

            // ── 5. Non-GST Sales Report ────────────────────────────────
            case 'sales-non-gst-report': {
                const nonGstRows = [];
                combinedOrders.forEach(o => {
                    const dateStr = o.date || o.createdAt || new Date().toISOString();
                    const client = o.customer || o.customerName || (o.notes && o.notes.includes('CLIENTNAME:') ? o.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in');
                    const loc = o.location || o.assignedVehicle || (o.notes && o.notes.includes('LOCATION:') ? o.notes.split('LOCATION:')[1].split('||')[0] : 'Godown');
                    const emp = o.employee || o.employeeName || 'Biller';

                    (o.items || []).forEach(i => {
                        const gstRate = parseFloat(i.gstPercent || i.taxRate || 0) || 0;
                        const isNonGstItem = gstRate === 0 && !i.gstAmount;
                        const name = i.itemName || i.name;

                        if (isNonGstItem && passesFilters(dateStr, loc, client, emp, name)) {
                            const qty = parseFloat(i.quantity || i.qty) || 0;
                            const rate = parseFloat(i.rate) || 0;
                            const totalVal = parseFloat(i.amount || (qty * rate)) || 0;

                            nonGstRows.push({
                                date: new Date(dateStr).toLocaleDateString('en-IN'),
                                billNo: o.orderNumber || o.billNumber || o.id || 'NONGST-SALE',
                                client: client,
                                product: name,
                                quantity: qty,
                                sellingPrice: rate,
                                totalVal: totalVal,
                                location: loc,
                                employee: emp
                            });
                        }
                    });
                });

                const totalNonGstVal = nonGstRows.reduce((sum, r) => sum + r.totalVal, 0);

                const cols = [
                    { label: 'Date', key: 'date' },
                    { label: 'Bill #', key: 'billNo' },
                    { label: 'Client', key: 'client' },
                    { label: 'Product Name', key: 'product' },
                    { label: 'Quantity', key: 'quantity' },
                    { label: 'Selling Price (₹)', key: 'sellingPrice' },
                    { label: 'Total Amount (₹)', key: 'totalVal' },
                    { label: 'Storage Location', key: 'location' },
                    { label: 'Employee', key: 'employee' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(139,92,246,0.08)' }}>
                                <span className="label">Total Non-GST Sales</span>
                                <span className="val" style={{ color: '#a78bfa' }}>₹{totalNonGstVal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="label">Items Sold (No Tax)</span>
                                <span className="val" style={{ color: '#60a5fa' }}>{nonGstRows.length} Line Items</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Bill #</th>
                                        <th>Client</th>
                                        <th>Product</th>
                                        <th>Qty</th>
                                        <th>Selling Price</th>
                                        <th>Total Amount</th>
                                        <th>Location</th>
                                        <th>Employee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nonGstRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td>{r.date}</td>
                                            <td><b>{r.billNo}</b></td>
                                            <td>{r.client}</td>
                                            <td>{r.product}</td>
                                            <td>{r.quantity}</td>
                                            <td>₹{r.sellingPrice}</td>
                                            <td><b style={{ color: '#a78bfa' }}>₹{r.totalVal.toLocaleString('en-IN')}</b></td>
                                            <td><span className="status-pill warning">{r.location}</span></td>
                                            <td>{r.employee}</td>
                                        </tr>
                                    ))}
                                    {nonGstRows.length === 0 && (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No Non-GST sales records found matching the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, nonGstRows, 'Non_GST_Sales_Report')}
                    </div>
                );
            }

            // ── 6. Client-Wise Sales Report ────────────────────────────
            case 'client-wise-sales': {
                const clientRows = [];
                combinedOrders.forEach(o => {
                    const dateStr = o.date || o.createdAt || new Date().toISOString();
                    const client = o.customer || o.customerName || (o.notes && o.notes.includes('CLIENTNAME:') ? o.notes.split('CLIENTNAME:')[1].split('||')[0] : 'Walk-in');
                    const loc = o.location || o.assignedVehicle || (o.notes && o.notes.includes('LOCATION:') ? o.notes.split('LOCATION:')[1].split('||')[0] : 'Godown');
                    const emp = o.employee || o.employeeName || 'Biller';

                    (o.items || []).forEach(i => {
                        const name = i.itemName || i.name;
                        if (passesFilters(dateStr, loc, client, emp, name)) {
                            const qty = parseFloat(i.quantity || i.qty) || 0;
                            const totalVal = parseFloat(i.amount || (qty * (i.rate || 0))) || 0;
                            const isGst = (i.gstPercent || 0) > 0 || (i.gstAmount || 0) > 0;

                            clientRows.push({
                                client: client,
                                billNo: o.orderNumber || o.billNumber || o.id || 'CLI-SALE',
                                date: new Date(dateStr).toLocaleDateString('en-IN'),
                                product: name,
                                quantity: qty,
                                totalVal: totalVal,
                                taxClass: isGst ? 'GST' : 'Non-GST',
                                location: loc,
                                employee: emp
                            });
                        }
                    });
                });

                const uniqueClients = [...new Set(clientRows.map(r => r.client))].length;
                const grandTotal = clientRows.reduce((sum, r) => sum + r.totalVal, 0);

                const cols = [
                    { label: 'Client Name', key: 'client' },
                    { label: 'Bill #', key: 'billNo' },
                    { label: 'Date', key: 'date' },
                    { label: 'Product Name', key: 'product' },
                    { label: 'Qty Sold', key: 'quantity' },
                    { label: 'Total Value (₹)', key: 'totalVal' },
                    { label: 'Tax Classification', key: 'taxClass' },
                    { label: 'Storage Location', key: 'location' },
                    { label: 'Employee', key: 'employee' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(198,245,61,0.08)' }}>
                                <span className="label">Total Client Sales</span>
                                <span className="val" style={{ color: '#C6F53D' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="label">Clients Served</span>
                                <span className="val" style={{ color: '#60a5fa' }}>{uniqueClients} Clients</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Client Name</th>
                                        <th>Bill #</th>
                                        <th>Date</th>
                                        <th>Product</th>
                                        <th>Qty</th>
                                        <th>Total Value</th>
                                        <th>Tax Type</th>
                                        <th>Location</th>
                                        <th>Employee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td><b>{r.client}</b></td>
                                            <td>{r.billNo}</td>
                                            <td>{r.date}</td>
                                            <td>{r.product}</td>
                                            <td>{r.quantity}</td>
                                            <td><b style={{ color: '#C6F53D' }}>₹{r.totalVal.toLocaleString('en-IN')}</b></td>
                                            <td><span className={`status-pill ${r.taxClass === 'GST' ? 'success' : 'muted'}`}>{r.taxClass}</span></td>
                                            <td><span className="status-pill warning">{r.location}</span></td>
                                            <td>{r.employee}</td>
                                        </tr>
                                    ))}
                                    {clientRows.length === 0 && (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No client sales records found matching the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, clientRows, 'Client_Wise_Sales_Report')}
                    </div>
                );
            }

            // ── 7. Vehicle/Location-Wise Stock Report ──────────────────
            case 'location-wise-stock': {
                const locations = getVehicleLocations();
                const allLocStocks = getAllLocationStocks();
                const locationRows = [];

                locations.forEach(loc => {
                    if (filterLocation && loc.toLowerCase() !== filterLocation.toLowerCase()) return;

                    allInventory.forEach(inv => {
                        const itemId = String(inv._id || inv.id || inv.name);
                        const locStockMap = allLocStocks[itemId] || { 'Godown': inv.currentStock || 0 };
                        const currentLocStock = parseFloat(locStockMap[loc] || 0);

                        if (filterSearch && !inv.name.toLowerCase().includes(filterSearch.toLowerCase())) return;

                        if (currentLocStock > 0 || !filterSearch) {
                            const cost = parseFloat(inv.costPerUnit || inv.buyingPrice) || 0;
                            locationRows.push({
                                location: loc,
                                item: inv.name,
                                category: inv.category || 'General',
                                stock: currentLocStock,
                                unit: inv.unit || 'pcs',
                                costPerUnit: cost,
                                totalVal: currentLocStock * cost
                            });
                        }
                    });
                });

                const totalLocStockVal = locationRows.reduce((sum, r) => sum + r.totalVal, 0);

                const cols = [
                    { label: 'Storage Space / Location', key: 'location' },
                    { label: 'Item Name', key: 'item' },
                    { label: 'Category', key: 'category' },
                    { label: 'Current Stock', key: 'stock' },
                    { label: 'Unit', key: 'unit' },
                    { label: 'Cost / Unit (₹)', key: 'costPerUnit' },
                    { label: 'Location Stock Value (₹)', key: 'totalVal' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(236,72,153,0.08)' }}>
                                <span className="label">Total Locations</span>
                                <span className="val" style={{ color: '#ec4899' }}>{locations.length} Spaces</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(245,158,11,0.08)' }}>
                                <span className="label">Total Location Stock Value</span>
                                <span className="val" style={{ color: '#f59e0b' }}>₹{totalLocStockVal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Storage Space</th>
                                        <th>Item Name</th>
                                        <th>Category</th>
                                        <th>Stock</th>
                                        <th>Cost/Unit</th>
                                        <th>Total Valuation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {locationRows.map((r, idx) => (
                                        <tr key={idx}>
                                            <td><span className="status-pill warning">{r.location}</span></td>
                                            <td><b>{r.item}</b></td>
                                            <td>{r.category}</td>
                                            <td><b style={{ color: '#C6F53D' }}>{r.stock} {r.unit}</b></td>
                                            <td>₹{r.costPerUnit}</td>
                                            <td><b style={{ color: '#f59e0b' }}>₹{r.totalVal.toLocaleString('en-IN')}</b></td>
                                        </tr>
                                    ))}
                                    {locationRows.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No location stock records found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, locationRows, 'Location_Wise_Stock_Report')}
                    </div>
                );
            }

            // ── 8. Stock Movement / Audit Trail Report ─────────────────
            case 'stock-audit-trail': {
                const movements = getStockMovements();
                const filteredMovements = movements.filter(m => {
                    const dateStr = m.timestamp;
                    if (filterFromDate && new Date(dateStr) < new Date(`${filterFromDate}T00:00:00`)) return false;
                    if (filterToDate && new Date(dateStr) > new Date(`${filterToDate}T23:59:59`)) return false;
                    if (filterSearch && !m.itemName.toLowerCase().includes(filterSearch.toLowerCase())) return false;
                    if (filterLocation && m.sourceLocation.toLowerCase() !== filterLocation.toLowerCase() && m.destinationLocation.toLowerCase() !== filterLocation.toLowerCase()) return false;
                    if (filterEmployee && !m.employee.toLowerCase().includes(filterEmployee.toLowerCase())) return false;
                    return true;
                });

                const cols = [
                    { label: 'Timestamp', key: 'timestamp' },
                    { label: 'Action Type', key: 'action' },
                    { label: 'Item Name', key: 'itemName' },
                    { label: 'Quantity', key: 'quantity' },
                    { label: 'Source Location', key: 'sourceLocation' },
                    { label: 'Destination Location', key: 'destinationLocation' },
                    { label: 'Employee', key: 'employee' },
                    { label: 'Ref / Bill #', key: 'refNo' }
                ];

                return (
                    <div className="report-content-view">
                        {filterToolbar}
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="label">Total Audit Trail Logs</span>
                                <span className="val" style={{ color: '#60a5fa' }}>{filteredMovements.length} Events</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date &amp; Time</th>
                                        <th>Action</th>
                                        <th>Item Name</th>
                                        <th>Qty</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Employee</th>
                                        <th>Ref #</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMovements.map((m, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(m.timestamp).toLocaleString('en-IN')}</td>
                                            <td>
                                                <span className={`status-pill ${m.action === 'SALE' ? 'success' : m.action === 'TRANSFER' ? 'warning' : m.action === 'RETURN' ? 'error' : 'info'}`}>
                                                    {m.action}
                                                </span>
                                            </td>
                                            <td><b>{m.itemName}</b></td>
                                            <td><b>{m.quantity}</b></td>
                                            <td>{m.sourceLocation}</td>
                                            <td>{m.destinationLocation}</td>
                                            <td>{m.employee}</td>
                                            <td>{m.refNo}</td>
                                        </tr>
                                    ))}
                                    {filteredMovements.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                                No stock audit movements found matching the filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {renderDownloadBar(cols, filteredMovements, 'Stock_Audit_Trail_Report')}
                    </div>
                );
            }
            case 'sales-non-gst-report':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(45,212,121,0.07)' }}>
                                <span className="label">Total Revenue (No GST)</span>
                                <span className="val" style={{ color: '#2DD479' }}>₹{reportData?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Order #</th>
                                        <th>Date</th>
                                        <th>Customer</th>
                                        <th>Payment</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.sales?.map((s, i) => (
                                        <tr key={i}>
                                            <td>{s.orderNumber}</td>
                                            <td>{new Date(s.date).toLocaleDateString()}</td>
                                            <td>{s.customer || 'Walk-in'}</td>
                                            <td>{String(s.payment || '-')}</td>
                                            <td><b>₹{s.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="report-footer-summary">
                            <span>Total: <b>₹{reportData?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'payment-mode-sales':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid">
                            <div className="summary-val-card">
                                <span className="label">Grand Total</span>
                                <span className="val">₹{reportData?.grandTotal?.toLocaleString() || 0}</span>
                            </div>
                            {Object.entries(reportData?.paymentTotals || {}).map(([mode, val]) => (
                                <div key={mode} className="summary-val-card" style={{ background: 'rgba(37, 99, 235, 0.05)' }}>
                                    <span className="label">{mode} Total</span>
                                    <span className="val" style={{ color: 'var(--accent)' }}>₹{val.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <div className="report-table-wrapper" style={{ marginTop: '20px' }}>
                            {['CASH', 'UPI', 'CARD', 'PENDING'].map(mode => {
                                const modeData = reportData?.[`Mode_${mode}`];
                                if (!modeData || modeData.length === 0) return null;
                                return (
                                    <div key={mode} style={{ marginBottom: '30px' }}>
                                        <h4 style={{ color: 'var(--accent)', marginBottom: '10px', fontSize: '1.1rem' }}>💳 {mode} Transactions</h4>
                                        <table className="premium-table">
                                            <thead>
                                                <tr>
                                                    <th>Order #</th>
                                                    <th>Date</th>
                                                    <th>Customer</th>
                                                    <th>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {modeData.map((o, i) => (
                                                    <tr key={i}>
                                                        <td>{o['Order Number']}</td>
                                                        <td>{o['Date']}</td>
                                                        <td>{o['Customer'] || '-'}</td>
                                                        <td>₹{o['Amount']?.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            })}
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'end-day-report':
                return (
                    <div className="report-content-view">
                        <div className="end-day-summary">
                            <div className="stat-row">
                                <span>Total Sales Today</span>
                                <b>₹{reportData?.totalSales?.toLocaleString()}</b>
                            </div>
                            <div className="stat-row">
                                <span>Total Orders</span>
                                <b>{reportData?.orderCount}</b>
                            </div>
                            <div className="payment-breakdown">
                                <h4>Payment Modes</h4>
                                {Object.entries(reportData?.payments || {}).map(([mode, val]) => (
                                    <div key={mode} className="pay-row">
                                        <span>{mode}</span>
                                        <b>₹{val.toLocaleString()}</b>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'category-item-wise':
            case 'item-wise-sales':
                return (
                    <div className="report-content-view">
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Item Name</th>
                                        <th>Quantity Sold</th>
                                        <th>Total Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.items?.map((item, i) => (
                                        <tr key={i}>
                                            <td>{item.name}</td>
                                            <td>{item.quantity}</td>
                                            <td>₹{item.revenue?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'income-expense':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card income">
                                <span className="label">Total Income</span>
                                <span className="val">₹{reportData?.totalIncome?.toLocaleString()}</span>
                            </div>
                            <div className="summary-val-card expense">
                                <span className="label">Total Expense</span>
                                <span className="val">₹{reportData?.totalExpense?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.transactions?.map((t, i) => (
                                        <tr key={i}>
                                            <td>{new Date(t.date).toLocaleDateString()}</td>
                                            <td>{t.description}</td>
                                            <td><span className={`type-pill ${t.type.toLowerCase()}`}>{t.type}</span></td>
                                            <td>₹{t.amount?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'expenditure-report':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card expense">
                                <span className="label">Total Expenditure</span>
                                <span className="val">₹{reportData?.totalExpense?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Category</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.expenses?.map((t, i) => (
                                        <tr key={i}>
                                            <td>{new Date(t.date).toLocaleDateString()}</td>
                                            <td>{t.description}</td>
                                            <td>{t.category || '-'}</td>
                                            <td>₹{t.amount?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'purchase-gst-report':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card expense">
                                <span className="label">Total Purchases (incl. GST)</span>
                                <span className="val">₹{reportData?.totalExpense?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(37,99,235,0.07)' }}>
                                <span className="label">Base Amount (excl. GST)</span>
                                <span className="val" style={{ color: 'var(--accent)' }}>₹{reportData?.totalBaseAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(239,68,68,0.07)' }}>
                                <span className="label">Total GST Paid</span>
                                <span className="val" style={{ color: '#ef4444' }}>₹{reportData?.totalGstAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Invoice #</th>
                                        <th>Base Amount</th>
                                        <th>GST Amount</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.expenses?.map((t, i) => {
                                        const gst = t.gstAmount || 0
                                        const base = t.amount - gst
                                        return (
                                            <tr key={i}>
                                                <td>{new Date(t.date).toLocaleDateString()}</td>
                                                <td>{t.description}</td>
                                                <td>{t.invoiceNumber || '-'}</td>
                                                <td>₹{base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td style={{ color: '#ef4444' }}>₹{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td><b>₹{t.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'purchase-non-gst-report':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card expense">
                                <span className="label">Total Purchases (No GST)</span>
                                <span className="val">₹{reportData?.totalExpense?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Category</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.expenses?.map((t, i) => (
                                        <tr key={i}>
                                            <td>{new Date(t.date).toLocaleDateString()}</td>
                                            <td>{t.description}</td>
                                            <td>{t.category || '-'}</td>
                                            <td>₹{t.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'inventory-category-report':
            case 'stock-report':
            case 'recipe-stock':
            case 'total-inventory-valuation':
                return (
                    <div className="report-content-view">
                        <div className="valuation-card-premium">
                            <div className="val-main">
                                <span className="val-label">Total Stock Value</span>
                                <span className="val-amount">₹{reportData?.totalValue?.toLocaleString('en-IN') || reportData?.totalStockValue || 0}</span>
                            </div>
                            <div className="val-sub">
                                <span>Based on {reportData?.count || reportData?.itemCount || 0} Active Items</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Item Name</th>
                                        <th>Category</th>
                                        <th>Purchased Stock</th>
                                        <th>Sold Stock</th>
                                        <th>Current Stock</th>
                                        <th>Cost/Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.items?.map((item, i) => (
                                        <tr key={i} className={item.currentStock <= item.lowStockThreshold ? 'low-stock-row' : ''}>
                                            <td>{item.name}</td>
                                            <td>{item.category}</td>
                                            <td>{Number(item.purchasedCount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {item.unit}</td>
                                            <td>{Number(item.soldCount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {item.unit}</td>
                                            <td>{Number(item.currentStock || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {item.unit}</td>
                                            <td>₹{Number(item.costPerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'purchase-item-stock':
            case 'purchase-recipe-stock':
                return (
                    <div className="report-content-view">
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Item</th>
                                        <th>Quantity</th>
                                        <th>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.purchases?.map((p, i) => (
                                        <tr key={i}>
                                            <td>{new Date(p.createdAt).toLocaleString()}</td>
                                            <td>{p.inventoryItem?.name}</td>
                                            <td>
                                                {p.paidQuantity > 0 ? p.paidQuantity : p.quantity} {p.inventoryItem?.unit}
                                                {p.freeQuantity > 0 && <span style={{ color: '#16a34a', fontSize: '0.9em', display: 'block' }}>+{p.freeQuantity} Free</span>}
                                            </td>
                                            <td>{p.createdBy?.name || 'System'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'cashier-wise-sales':
                return (
                    <div className="report-content-view">
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Cashier Name</th>
                                        <th>Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(reportData?.cashiers || {}).map(([name, val]) => (
                                        <tr key={name}>
                                            <td>{name}</td>
                                            <td>₹{val.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'cancelled-item-summary':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card warning">
                                <span className="label">Cancelled Count</span>
                                <span className="val">{reportData?.count}</span>
                            </div>
                            <div className="summary-val-card error">
                                <span className="label">Total Loss</span>
                                <span className="val">₹{reportData?.totalLoss?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Order #</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.cancelledOrders?.map((o, i) => (
                                        <tr key={i}>
                                            <td>{o.orderNumber}</td>
                                            <td>{new Date(o.createdAt).toLocaleString()}</td>
                                            <td>₹{o.total?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'monthly-day-wise':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(198,245,61,0.08)' }}>
                                <span className="label">Monthly Total</span>
                                <span className="val">₹{(reportData?.dailySales || []).reduce((s, d) => s + (d.revenue || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(45,212,121,0.07)' }}>
                                <span className="label">Total Orders</span>
                                <span className="val">{(reportData?.dailySales || []).reduce((s, d) => s + (d.orderCount || 0), 0)}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.07)' }}>
                                <span className="label">Active Days</span>
                                <span className="val">{(reportData?.dailySales || []).filter(d => d.orderCount > 0).length}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Day</th>
                                        <th>Orders</th>
                                        <th>Revenue</th>
                                        <th>Avg Order Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(reportData?.dailySales || []).map((d, i) => {
                                        const dateObj = new Date(d.date || d.day);
                                        const avgVal = d.orderCount > 0 ? (d.revenue / d.orderCount) : 0;
                                        return (
                                            <tr key={i} className={d.orderCount === 0 ? 'muted-row' : ''}>
                                                <td>{isNaN(dateObj) ? (d.date || d.day) : dateObj.toLocaleDateString('en-IN')}</td>
                                                <td>{isNaN(dateObj) ? '-' : dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}</td>
                                                <td><b>{d.orderCount || 0}</b></td>
                                                <td><b style={{ color: '#C6F53D' }}>₹{(d.revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                                                <td>₹{avgVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'month-wise-stock-report':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(37,99,235,0.07)' }}>
                                <span className="label">Total Months Covered</span>
                                <span className="val">{[...new Set(reportData?.monthWiseStock?.map(r => r.month) || [])].length}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(45,212,121,0.07)' }}>
                                <span className="label">Items Added</span>
                                <span className="val" style={{ color: '#2DD479' }}>{reportData?.monthWiseStock?.reduce((sum, r) => sum + (r.added || 0), 0)?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(239,68,68,0.07)' }}>
                                <span className="label">Items Consumed</span>
                                <span className="val" style={{ color: '#ef4444' }}>{reportData?.monthWiseStock?.reduce((sum, r) => sum + (r.consumed || 0), 0)?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Item Name</th>
                                        <th>Total Added</th>
                                        <th>Total Consumed</th>
                                        <th>Net Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.monthWiseStock?.map((r, i) => (
                                        <tr key={i}>
                                            <td>{r.month}</td>
                                            <td>{r.item}</td>
                                            <td>
                                                {(r.added || 0) > 0
                                                    ? <span style={{ color: '#2DD479' }}>+{Number(r.added).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Added</span>
                                                }
                                            </td>
                                            <td>
                                                {(r.consumed || 0) > 0
                                                    ? <span style={{ color: '#ef4444' }}>-{Number(r.consumed).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                }
                                            </td>
                                            <td>
                                                <b style={{ color: r.netChange > 0 ? '#2DD479' : (r.netChange < 0 ? '#ef4444' : 'inherit') }}>
                                                    {r.netChange > 0 ? '+' : ''}{Number(r.netChange || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </b>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!reportData?.monthWiseStock || reportData.monthWiseStock.length === 0) && (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                                No stock movements found for the selected period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'expiry-date-wise':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card warning">
                                <span className="label">Expiring Within 7 Days</span>
                                <span className="val">{(reportData?.items || []).filter(i => i.daysUntilExpiry != null && i.daysUntilExpiry <= 7 && i.daysUntilExpiry >= 0).length}</span>
                            </div>
                            <div className="summary-val-card error">
                                <span className="label">Already Expired</span>
                                <span className="val">{(reportData?.items || []).filter(i => i.daysUntilExpiry != null && i.daysUntilExpiry < 0).length}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(59,130,246,0.07)' }}>
                                <span className="label">Total Items Tracked</span>
                                <span className="val">{(reportData?.items || []).length}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Item Name</th>
                                        <th>Category</th>
                                        <th>Batch / Lot</th>
                                        <th>Stock</th>
                                        <th>Expiry Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(reportData?.items || [])
                                        .sort((a, b) => (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999))
                                        .map((item, i) => {
                                            const days = item.daysUntilExpiry;
                                            let statusLabel, statusClass;
                                            if (days == null) { statusLabel = 'No Expiry'; statusClass = 'muted'; }
                                            else if (days < 0) { statusLabel = `Expired ${Math.abs(days)}d ago`; statusClass = 'error'; }
                                            else if (days <= 3) { statusLabel = `Critical: ${days}d left`; statusClass = 'error'; }
                                            else if (days <= 7) { statusLabel = `Warning: ${days}d left`; statusClass = 'warning'; }
                                            else { statusLabel = `OK: ${days}d left`; statusClass = 'success'; }
                                            return (
                                                <tr key={i}>
                                                    <td><b>{item.name}</b></td>
                                                    <td>{item.category || '-'}</td>
                                                    <td>{item.batchNumber || '-'}</td>
                                                    <td>{item.currentStock} {item.unit}</td>
                                                    <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '-'}</td>
                                                    <td><span className={`status-pill ${statusClass}`}>{statusLabel}</span></td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'hsn-summary':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(198,245,61,0.08)' }}>
                                <span className="label">Total Taxable Value</span>
                                <span className="val">₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.taxableValue || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(239,68,68,0.07)' }}>
                                <span className="label">Total GST</span>
                                <span className="val" style={{ color: '#ef4444' }}>₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.totalGst || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(45,212,121,0.07)' }}>
                                <span className="label">HSN Codes</span>
                                <span className="val">{(reportData?.hsnRows || []).length}</span>
                            </div>
                        </div>
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>HSN Code</th>
                                        <th>Description</th>
                                        <th>Qty</th>
                                        <th>Taxable Value</th>
                                        <th>GST Rate</th>
                                        <th>CGST</th>
                                        <th>SGST</th>
                                        <th>IGST</th>
                                        <th>Total GST</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(reportData?.hsnRows || []).map((row, i) => (
                                        <tr key={i}>
                                            <td><b>{row.hsnCode}</b></td>
                                            <td>{row.description || '-'}</td>
                                            <td>{row.qty || 0}</td>
                                            <td>₹{(row.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td>{row.gstRate || 0}%</td>
                                            <td>₹{(row.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td>₹{(row.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td>₹{(row.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td><b style={{ color: '#ef4444' }}>₹{(row.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'rgba(198,245,61,0.06)', fontWeight: 700 }}>
                                        <td colSpan={3}>TOTAL</td>
                                        <td>₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.taxableValue || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td>-</td>
                                        <td>₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.cgst || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td>₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.sgst || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td>₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.igst || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td>₹{(reportData?.hsnRows || []).reduce((s, r) => s + (r.totalGst || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {downloadBar}
                    </div>
                )
            default:
                return (
                    <div className="report-content-view">
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                            No data available for <b>{selectedReport?.label}</b>.
                        </p>
                        {downloadBar}
                    </div>
                )
        }
    }

    return (
        <div className="analytics-container">
            {/* ── PAGE HEADER ─────────────────────────────────────────── */}
            <div className="an-page-header">
                <div className="an-header-top">
                    <div className="an-title-group">
                        <div className="an-title-icon">📊</div>
                        <div>
                            <h1 className="an-title">Business Analytics</h1>
                            <p className="an-subtitle">Track sales, expenses, profit &amp; stock in real-time</p>
                        </div>
                    </div>
                    <div className="an-header-right">
                        {/* Report Selector */}
                        <div className="report-selector-wrapper">
                            <button
                                className={`report-selector-btn ${showSelector ? 'active' : ''}`}
                                onClick={() => setShowSelector(!showSelector)}
                            >
                                📋 {selectedReport ? selectedReport.label : 'Select Report'}
                                <span className={`chevron ${showSelector ? 'open' : ''}`}>▼</span>
                            </button>
                            {showSelector && (
                                <div className="report-dropdown-premium">
                                    {reports.map(r => (
                                        <div
                                            key={r.id}
                                            className={`dropdown-item ${selectedReport?.id === r.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedReport(r)
                                                setShowSelector(false)
                                            }}
                                        >
                                            <div className="item-content">
                                                <span className="item-icon">{r.icon}</span>
                                                <span className="item-label">{r.label}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Period Switcher */}
                        <div className="an-period-switcher">
                            {[
                                { id: '1d', label: 'Today' },
                                { id: '7d', label: '1 Week' },
                                { id: '30d', label: '1 Month' },
                                { id: '90d', label: '3 Months' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setPeriod(p.id)}
                                    className={`an-period-btn ${period === p.id ? 'active' : ''}`}
                                >
                                    {p.label}
                                </button>
                            ))}

                            <div className="period-btn-calendar">
                                <button
                                    onClick={() => document.getElementById('analytics-date-picker').showPicker()}
                                    className={`an-period-btn calendar-btn ${period === 'custom' ? 'active' : ''}`}
                                    title="Pick a specific date"
                                >
                                    📅 {period === 'custom' ? selectedDate : 'Custom'}
                                </button>
                                <input
                                    type="date"
                                    id="analytics-date-picker"
                                    value={selectedDate}
                                    onChange={(e) => {
                                        setSelectedDate(e.target.value)
                                        setPeriod('custom')
                                    }}
                                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {loading ? (
                <div className="loading" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <>

                    <div className="kpi-grid">
                        {kpis.map((k, i) => (
                            <div
                                key={i}
                                className="kpi-card"
                                style={{ borderLeft: `4px solid ${k.borderColor}` }}
                            >
                                <div className="kpi-icon-row">
                                    <div className="kpi-icon" style={{ background: k.bg }}>
                                        {k.icon}
                                    </div>
                                    <span
                                        className="kpi-trend"
                                        style={{
                                            color: k.color,
                                            background: k.bg,
                                            border: `1px solid ${k.borderColor}`
                                        }}
                                    >
                                        {k.trend}
                                    </span>
                                </div>
                                <div className="kpi-text-group">
                                    <div className="kpi-label">{k.label}</div>
                                    <div className="kpi-value">{k.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="analytics-main-grid">
                        {/* Financial Performance Area Chart */}
                        <div className="dashboard-card chart-master">
                            <div className="card-custom-header">
                                <h3 className="card-title">📈 Financial Performance</h3>
                                <div className="custom-legend">
                                    <div className="legend-item"><span className="dot rev"></span> Revenue</div>
                                    <div className="legend-item"><span className="dot profit"></span> Profit</div>
                                </div>
                            </div>
                            <div className="chart-wrapper">
                                {data?.revenueByDay?.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={data.revenueByDay}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00D68F" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#00D68F" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                                tickFormatter={(val) => val.includes('-') ? val.slice(5) : val}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                                tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e1e2d', border: 'none', borderRadius: '8px', color: '#fff' }}
                                                itemStyle={{ color: '#fff' }}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="var(--accent)" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                                            <Area type="monotone" dataKey="profit" stroke="#00D68F" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="no-data-chart">
                                        <span>No sales data found for this period</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Expense Breakdown Pie Chart */}
                        <div className="dashboard-card">
                            <h3 className="card-title">💸 Expenditure Breakdown</h3>
                            <div className="chart-wrapper">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={data?.expenseBreakdown?.length > 0 ? data.expenseBreakdown : [{ name: 'No Data', value: 1 }]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {(data?.expenseBreakdown || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['var(--accent)', '#4C8EFF', '#00D68F', '#9d50bb', '#e74c3c'][index % 5]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* P&L Analysis */}
                        <div className="dashboard-card">
                            <h3 className="card-title">💡 Insight: Profitability</h3>
                            <div className="profit-analysis">
                                <div className="profit-value-row">
                                    <div style={{ flex: 1 }}>
                                        <div className="text-sm text-gray-400">Gross Profit</div>
                                        <span className="big-profit" style={{ color: '#00D68F' }}>₹{Math.round(data?.summary?.grossProfit || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="text-sm text-gray-400">Net Profit</div>
                                        <span className="big-profit">₹{Math.round(data?.summary?.netProfit || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    <span className={`profit-indicator ${data?.summary?.netProfit >= 0 ? 'pos' : 'neg'}`}>
                                        {data?.summary?.netProfit >= 0 ? '▲ Positive' : '▼ Negative'}
                                    </span>
                                </div>
                                <div className="margin-bar-container">
                                    <div className="margin-label">Gross Margin: {data?.summary?.profitMargin?.toFixed(1) || 0}%</div>
                                    <div className="margin-bar-bg">
                                        <div className="margin-bar-fill" style={{ width: `${Math.min(100, Math.max(0, data?.summary?.profitMargin || 0))}%` }}></div>
                                    </div>
                                </div>
                                <p className="profit-desc">
                                    Gross Profit = Revenue - Material Cost (COGS). Net Profit = Revenue - All Expenses.
                                </p>
                            </div>
                        </div>

                        {/* ── Product Sales Board ── */}
                        <div className="dashboard-card product-sales-card">
                            <div className="card-custom-header" style={{ marginBottom: '16px' }}>
                                <h3 className="card-title">🛒 Product Sales — What's Selling</h3>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    {data?.topItems?.length || 0} products sold in this period
                                </span>
                            </div>

                            {data?.topItems?.length > 0 ? (
                                <div className="product-sales-grid">
                                    {/* Left: Table with progress bars */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="premium-table" style={{ fontSize: '13px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '32px' }}>#</th>
                                                    <th>Product Name</th>
                                                    <th style={{ textAlign: 'right' }}>Units Sold</th>
                                                    <th style={{ textAlign: 'right' }}>Revenue</th>
                                                    <th style={{ width: '120px' }}>Share</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    const maxQty = Math.max(...(data.topItems.map(i => i.totalQuantity || 0)));
                                                    const totalQty = data.topItems.reduce((s, i) => s + (i.totalQuantity || 0), 0);
                                                    const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#C6F53D', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#e879f9'];
                                                    return data.topItems.map((item, idx) => {
                                                        const pct = maxQty > 0 ? (item.totalQuantity / maxQty) * 100 : 0;
                                                        const sharePct = totalQty > 0 ? ((item.totalQuantity / totalQty) * 100).toFixed(1) : '0.0';
                                                        const col = RANK_COLORS[idx % RANK_COLORS.length];
                                                        return (
                                                            <tr key={idx}>
                                                                <td>
                                                                    <div style={{
                                                                        width: '24px', height: '24px', borderRadius: '6px',
                                                                        background: idx < 3 ? `${col}22` : 'var(--bg-secondary)',
                                                                        color: col, fontWeight: 700, fontSize: '11px',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                    }}>{idx + 1}</div>
                                                                </td>
                                                                <td>
                                                                    <span style={{ fontWeight: idx < 3 ? 700 : 400, color: 'var(--text-primary)' }}>
                                                                        {item._id || item.name}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <b style={{ color: col }}>{item.totalQuantity}</b>
                                                                </td>
                                                                <td style={{ textAlign: 'right', color: '#C6F53D' }}>
                                                                    ₹{(item.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                                </td>
                                                                <td>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                                                            <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                                                        </div>
                                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '32px' }}>{sharePct}%</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                            <tfoot>
                                                <tr style={{ background: 'rgba(198,245,61,0.04)', fontWeight: 700 }}>
                                                    <td colSpan={2} style={{ color: '#C6F53D' }}>TOTAL</td>
                                                    <td style={{ textAlign: 'right', color: '#C6F53D' }}>
                                                        {data.topItems.reduce((s, i) => s + (i.totalQuantity || 0), 0)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#C6F53D' }}>
                                                        ₹{data.topItems.reduce((s, i) => s + (i.totalRevenue || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                    </td>
                                                    <td />
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Right: BarChart */}
                                    <div>
                                        <ResponsiveContainer width="100%" height={320}>
                                            <BarChart
                                                data={data.topItems.slice(0, 10).map(i => ({ name: (i._id || i.name || '').slice(0, 14), qty: i.totalQuantity, rev: i.totalRevenue || 0 }))}
                                                layout="vertical"
                                                margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                                <XAxis
                                                    type="number"
                                                    axisLine={false} tickLine={false}
                                                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                                                />
                                                <YAxis
                                                    type="category" dataKey="name"
                                                    axisLine={false} tickLine={false}
                                                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                                    width={90}
                                                />
                                                <Tooltip
                                                    contentStyle={{ background: 'var(--bg-card)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }}
                                                    formatter={(val, name) => [val, name === 'qty' ? 'Units Sold' : 'Revenue ₹']}
                                                />
                                                <Bar dataKey="qty" name="Units Sold" radius={[0, 4, 4, 0]}>
                                                    {data.topItems.slice(0, 10).map((_, idx) => {
                                                        const COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#C6F53D', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#e879f9'];
                                                        return <Cell key={idx} fill={COLORS[idx % COLORS.length]} />;
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-data-chart" style={{ padding: '40px 0' }}>
                                    <span>No product sales found for this period</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Report Preview Modal */}
            {selectedReport && (
                <div className="report-overlay" onClick={() => setSelectedReport(null)}>
                    <div className="report-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{selectedReport.label}</h3>
                            <button className="close-modal" onClick={() => setSelectedReport(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {renderReportView()}
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
