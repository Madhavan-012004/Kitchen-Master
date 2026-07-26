import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useStakeholder } from '../context/StakeholderContext.jsx'
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs'
import './Analytics.css'

// Recharts imports for professional graphics
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'

export default function AnalyticsPage() {
    const { selectedRestaurantId } = useStakeholder()
    const [data, setData] = useState(null)
    const [period, setPeriod] = useState('7d')
    const [loading, setLoading] = useState(true)
    const [selectedReport, setSelectedReport] = useState(null)
    const [reportData, setReportData] = useState(null)
    const [reportLoading, setReportLoading] = useState(false)
    const [showSelector, setShowSelector] = useState(false)
    const [selectedDate, setSelectedDate] = useState('')

    const reports = [
        { id: 'sales-summary', label: 'Sales Summary', icon: '📊' },
        { id: 'sales-report', label: 'Sales Report', icon: '📝' },
        { id: 'sales-gst-report', label: 'Sales Report (With GST)', icon: '💰' },
        { id: 'sales-non-gst-report', label: 'Sales Report (Without GST)', icon: '💳' },
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
        { id: 'month-wise-stock-report', label: 'Month Wise Stock Report', icon: '📅' }
    ]

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
            setData(res.data.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const fetchReportData = async (reportId) => {
        setReportLoading(true)
        try {
            const res = await api.get(`/analytics/report-data?type=${reportId}`)
            setReportData(res.data.data)
        } catch (e) {
            console.error(e)
        } finally {
            setReportLoading(false)
        }
    }

    const handleDownload = async (reportId, format = 'pdf') => {
        try {
            const mimeMap = {
                pdf:  'application/pdf',
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
            link.href = url
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
            label: 'Gross Profit',
            value: `₹${Math.round(data?.summary?.grossProfit || 0).toLocaleString('en-IN')}`,
            icon: '💎',
            bg: 'rgba(139,92,246,0.1)',
            color: '#a78bfa',
            trend: 'After COGS',
            borderColor: 'rgba(139,92,246,0.5)'
        },
        {
            label: 'Total Expense',
            value: `₹${Math.round(data?.summary?.totalExpense || 0).toLocaleString('en-IN')}`,
            icon: '💸',
            bg: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            trend: 'Expenditure',
            borderColor: 'rgba(239,68,68,0.5)'
        },
        {
            label: 'Net Profit',
            value: `₹${Math.round(data?.summary?.netProfit || 0).toLocaleString('en-IN')}`,
            icon: '📈',
            bg: 'rgba(45,212,121,0.1)',
            color: '#2DD479',
            trend: `${data?.summary?.profitMargin?.toFixed(1) || 0}% Margin`,
            borderColor: 'rgba(45,212,121,0.5)'
        },
        {
            label: 'Total Orders',
            value: data?.summary?.totalOrders || 0,
            icon: '🧾',
            bg: 'rgba(59,130,246,0.1)',
            color: '#60a5fa',
            trend: '+8.2%',
            borderColor: 'rgba(59,130,246,0.5)'
        }
    ]

    const renderReportView = () => {
        if (reportLoading) return <div className="loading-centered"><div className="spinner"></div></div>
        if (!reportData && selectedReport) return <div className="loading-centered">No data available for this report</div>

        const downloadBar = (
            <div className="export-format-bar">
                <span className="export-label">Export As:</span>
                <button className="export-btn export-pdf" onClick={() => handleDownload(selectedReport.id, 'pdf')}>
                    <span className="export-icon">📄</span> PDF
                </button>
                <button className="export-btn export-word" onClick={() => handleDownload(selectedReport.id, 'word')}>
                    <span className="export-icon">📝</span> Word
                </button>
                <button className="export-btn export-excel" onClick={() => handleDownload(selectedReport.id, 'excel')} style={{background: 'rgba(0, 214, 143, 0.1)', color: '#00D68F', border: '1px solid rgba(0, 214, 143, 0.3)'}}>
                    <span className="export-icon">📊</span> Excel
                </button>
                <button className="export-btn export-json" onClick={() => handleDownload(selectedReport.id, 'json')}>
                    <span className="export-icon">{'{ }'}</span> JSON
                </button>
            </div>
        )

        switch (selectedReport?.id) {
            case 'sales-summary':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid">
                            <div className="summary-val-card">
                                <span className="label">Gross Sales</span>
                                <span className="val">₹{reportData?.summary?.totalRevenue?.toLocaleString('en-IN') || 0}</span>
                            </div>
                            <div className="summary-val-card">
                                <span className="label">Total Orders</span>
                                <span className="val">{reportData?.summary?.totalOrders || 0}</span>
                            </div>
                            <div className="summary-val-card">
                                <span className="label">Income</span>
                                <span className="val">₹{reportData?.income || 0}</span>
                            </div>
                            <div className="summary-val-card">
                                <span className="label">Expense</span>
                                <span className="val">₹{reportData?.expense || 0}</span>
                            </div>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'sales-report':
                return (
                    <div className="report-content-view">
                        <div className="report-table-wrapper">
                            <table className="premium-table">
                               <thead>
                                   <tr>
                                       <th>Order #</th>
                                       <th>Date</th>
                                       <th>Customer</th>
                                       <th>Total</th>
                                       <th>Status</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {reportData?.sales?.map((s, i) => (
                                       <tr key={i}>
                                           <td>{s.orderNumber}</td>
                                           <td>{new Date(s.date).toLocaleDateString()}</td>
                                           <td>{s.customer || '-'}</td>
                                           <td>₹{s.total?.toLocaleString()}</td>
                                           <td><span className={`status-pill ${s.status.toLowerCase()}`}>{s.status}</span></td>
                                       </tr>
                                   ))}
                               </tbody>
                            </table>
                        </div>
                        <div className="report-footer-summary">
                            <span>Total Revenue: <b>₹{reportData?.totalRevenue?.toLocaleString()}</b></span>
                        </div>
                        {downloadBar}
                    </div>
                )
            case 'sales-gst-report':
                return (
                    <div className="report-content-view">
                        <div className="report-summary-grid mini">
                            <div className="summary-val-card" style={{ background: 'rgba(37,99,235,0.07)' }}>
                                <span className="label">Total Revenue (incl. GST)</span>
                                <span className="val">₹{reportData?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(45,212,121,0.07)' }}>
                                <span className="label">Base Revenue (excl. GST)</span>
                                <span className="val" style={{ color: '#2DD479' }}>₹{reportData?.totalBaseRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="summary-val-card" style={{ background: 'rgba(239,68,68,0.07)' }}>
                                <span className="label">Total GST Collected</span>
                                <span className="val" style={{ color: '#ef4444' }}>₹{reportData?.totalTaxCollected?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                        <th>Base Amt</th>
                                        <th style={{ color: '#ef4444' }}>GST Amt</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData?.sales?.map((s, i) => {
                                        const tax  = s.taxAmount || 0
                                        const base = s.baseAmount ?? (s.total - tax)
                                        return (
                                            <tr key={i}>
                                                <td>{s.orderNumber}</td>
                                                <td>{new Date(s.date).toLocaleDateString()}</td>
                                                <td>{s.customer || 'Walk-in'}</td>
                                                <td>{String(s.payment || '-')}</td>
                                                <td>₹{base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td style={{ color: '#ef4444' }}>₹{tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td><b>₹{s.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="report-footer-summary">
                            <span>CGST: <b>₹{((reportData?.totalTaxCollected || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                            &nbsp;&nbsp;|
                            <span> SGST: <b>₹{((reportData?.totalTaxCollected || 0) / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                        </div>
                        {downloadBar}
                    </div>
                )
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
                                                {p.freeQuantity > 0 && <span style={{color:'#16a34a',fontSize:'0.9em',display:'block'}}>+{p.freeQuantity} Free</span>}
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
                                                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00D68F" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#00D68F" stopOpacity={0}/>
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
                                                tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
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
                                            data={data?.expenseBreakdown?.length > 0 ? data.expenseBreakdown : [{name: 'No Data', value: 1}]}
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
                        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
                            <div className="card-custom-header" style={{ marginBottom: '16px' }}>
                                <h3 className="card-title">🛒 Product Sales — What's Selling</h3>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    {data?.topItems?.length || 0} products sold in this period
                                </span>
                            </div>

                            {data?.topItems?.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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
                                                    const RANK_COLORS = ['#FFD700','#C0C0C0','#CD7F32','#C6F53D','#60a5fa','#a78bfa','#f472b6','#34d399','#fb923c','#e879f9'];
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
                                                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
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
                                                        const COLORS = ['#FFD700','#C0C0C0','#CD7F32','#C6F53D','#60a5fa','#a78bfa','#f472b6','#34d399','#fb923c','#e879f9'];
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
