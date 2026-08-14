import React, { useState, useEffect, useMemo } from 'react'
import api from '../api/client.js'
import './Customers.css'

export default function CustomersPage() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
    const [adding, setAdding] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    // History Modal State
    const [historyCustomer, setHistoryCustomer] = useState(null)
    const [historyOrders, setHistoryOrders] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState(null)

    useEffect(() => {
        loadCustomers()
    }, [])

    const loadCustomers = async () => {
        setLoading(true)
        try {
            const res = await api.get('/customers')
            if (Array.isArray(res.data)) {
                setCustomers(res.data)
            } else if (res.data?.data && Array.isArray(res.data.data)) {
                setCustomers(res.data.data)
            } else {
                setCustomers([])
            }
        } catch (err) {
            console.error("Failed to load customers", err)
            setCustomers([])
        } finally {
            setLoading(false)
        }
    }

    const handleAddCustomer = async (e) => {
        e.preventDefault()
        if (!newCustomer.name || !newCustomer.phone) return
        setAdding(true)
        try {
            await api.post('/customers', {
                name: newCustomer.name,
                phone: newCustomer.phone,
                role: 'CUSTOMER'
            })
            setShowAddModal(false)
            setNewCustomer({ name: '', phone: '' })
            loadCustomers()
        } catch (err) {
            console.error("Failed to add customer", err)
            alert(err.response?.data?.message || 'Failed to add customer')
        } finally {
            setAdding(false)
        }
    }

    const handleDeleteCustomer = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return
        try {
            await api.delete(`/customers/${id}`)
            loadCustomers()
        } catch (err) {
            console.error("Failed to delete customer", err)
            alert(err.response?.data?.message || 'Failed to delete customer')
        }
    }

    const handleViewHistory = async (customer) => {
        setHistoryCustomer(customer)
        setLoadingHistory(true)
        setHistoryOrders([])
        setSelectedOrder(null)
        try {
            const res = await api.get(`/orders/history?search=${customer.phone}`)
            if (res.data?.data?.orders) {
                setHistoryOrders(res.data.data.orders)
            } else if (res.data?.orders) {
                setHistoryOrders(res.data.orders)
            } else if (Array.isArray(res.data)) {
                setHistoryOrders(res.data)
            }
        } catch (err) {
            console.error("Failed to load history", err)
            alert("Could not load purchase history.")
        } finally {
            setLoadingHistory(false)
        }
    }

    // --- Filtering & Sorting ---
    const displayedCustomers = useMemo(() => {
        let result = [...customers]

        // Apply text search
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(c =>
                (c.name && c.name.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q))
            )
        }

        // default alphabetical
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

        return result
    }, [customers, searchQuery])

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    const totalPages = Math.ceil(displayedCustomers.length / ITEMS_PER_PAGE)
    const paginatedCustomers = displayedCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    // Utility for Avatar colors
    const getAvatarColor = (name) => {
        const colors = [
            'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
            'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
            'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
            'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        ]
        const charCode = (name || 'A').charCodeAt(0)
        return colors[charCode % colors.length]
    }

    return (
        <div className="customers-page animate-fade-in">
            {/* DIRECTORY SECTION */}
            <div className="directory-container glass-panel" style={{ marginTop: '10px' }}>
                <div className="directory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 className="directory-title" style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Customer Directory</h2>
                        <span style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                            {customers.length} Total
                        </span>
                    </div>

                    <div className="directory-actions">
                        <div className="search-bar">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Search by Name or Phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
                            )}
                        </div>
                        <button className="btn-premium-add" onClick={() => setShowAddModal(true)}>
                            <span className="icon">➕</span> Add New
                        </button>
                    </div>
                </div>

                <div className="directory-content">
                    {loading ? (
                        <div className="state-container">
                            <div className="premium-spinner"></div>
                            <p>Loading database...</p>
                        </div>
                    ) : displayedCustomers.length === 0 ? (
                        <div className="state-container empty-state">
                            <div className="empty-icon-3d">📭</div>
                            <h3>No Customers Found</h3>
                            <p>Your search returned no results. Try adjusting the filters or adding a new customer.</p>
                        </div>
                    ) : (
                        <div className="premium-table-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Contact</th>
                                        <th>Loyalty Points</th>
                                        <th>Last Visit</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCustomers.map((customer, index) => {
                                        const initials = (customer.name || 'U').substring(0, 2).toUpperCase()
                                        return (
                                            <tr key={customer.id || customer._id} className="table-row-animate">
                                                <td>
                                                    <div className="customer-cell">
                                                        <div className="customer-avatar" style={{ background: getAvatarColor(customer.name) }}>
                                                            {initials}
                                                        </div>
                                                        <div className="customer-name-group">
                                                            <span className="customer-name">{customer.name || 'Unknown'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="contact-cell">
                                                        <span className="phone-icon">📞</span>
                                                        <span className="phone-number">{customer.phone}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={`loyalty-pill ${customer.loyaltyPoints > 0 ? 'active' : 'inactive'}`}>
                                                        <span className="star-icon">⭐</span>
                                                        <span className="points-text">{customer.loyaltyPoints ? customer.loyaltyPoints.toFixed(2) : '0.00'} Pts</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="date-cell" style={{ color: 'var(--text-secondary)' }}>
                                                        {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (customer.createdAt ? new Date(customer.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A')}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                        <button
                                                            className="hq-act-btn hq-btn-history"
                                                            onClick={() => handleViewHistory(customer)}
                                                            title="Purchase History"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                                                        >
                                                            📄
                                                        </button>
                                                        <button
                                                            className="hq-act-btn hq-btn-delete"
                                                            onClick={() => handleDeleteCustomer(customer.id || customer._id, customer.name)}
                                                            title="Delete Customer"
                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', padding: '15px', borderTop: '1px solid var(--border)' }}>
                                    <button
                                        className="tj-btn tj-btn--ghost"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Prev
                                    </button>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Page {currentPage} of {totalPages}</span>
                                    <button
                                        className="tj-btn tj-btn--ghost"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* SLEEK ADD CUSTOMER MODAL */}
            {showAddModal && (
                <div className="premium-modal-overlay">
                    <div className="premium-modal modal-slide-up">
                        <div className="modal-header-gradient">
                            <div className="modal-title-group">
                                <h3>✨ New Customer</h3>
                                <p>Add a member to your directory</p>
                            </div>
                            <button className="modal-close-glass" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="modal-body-elegant">
                            <form onSubmit={handleAddCustomer} className="elegant-form">
                                <div className="floating-input-group">
                                    <input
                                        type="text"
                                        id="customerName"
                                        className="floating-input"
                                        placeholder=" "
                                        value={newCustomer.name}
                                        onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        required
                                        autoComplete="off"
                                    />
                                    <label htmlFor="customerName" className="floating-label">Full Name</label>
                                </div>
                                <div className="floating-input-group">
                                    <input
                                        type="tel"
                                        id="customerPhone"
                                        className="floating-input"
                                        placeholder=" "
                                        value={newCustomer.phone}
                                        onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                        required
                                        autoComplete="off"
                                    />
                                    <label htmlFor="customerPhone" className="floating-label">Phone Number</label>
                                </div>

                                <div className="modal-actions-glass">
                                    <button type="button" className="btn-glass-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button type="submit" className="btn-glass-submit" disabled={adding}>
                                        {adding ? <span className="spinner-small"></span> : 'Create Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* PURCHASE HISTORY MODAL */}
            {historyCustomer && (
                <div className="premium-modal-overlay">
                    <div className="premium-modal modal-slide-up" style={{ maxWidth: '90vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header-gradient" style={{ flexShrink: 0 }}>
                            <div className="modal-title-group">
                                <h3>📄 Purchase History</h3>
                                <p>{historyCustomer.name} ({historyCustomer.phone})</p>
                            </div>
                            <button className="modal-close-glass" onClick={() => { setHistoryCustomer(null); setSelectedOrder(null); }}>✕</button>
                        </div>
                        <div className="modal-body-elegant" style={{ flex: 1, padding: '0', display: 'flex', overflow: 'hidden' }}>
                            {loadingHistory ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div className="premium-spinner" style={{ marginBottom: '10px' }}></div>
                                    <p style={{ color: 'var(--text-muted)' }}>Loading history...</p>
                                </div>
                            ) : historyOrders.length === 0 ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '50px', marginBottom: '15px' }}>🛍️</div>
                                    <p>No purchase history found for this customer.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Left Pane: Orders List */}
                                    <div style={{ width: '35%', borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                                        {historyOrders.map((order, i) => (
                                            <div
                                                key={order.id || i}
                                                onClick={() => setSelectedOrder(order)}
                                                style={{
                                                    padding: '16px',
                                                    borderBottom: '1px solid var(--border)',
                                                    cursor: 'pointer',
                                                    background: selectedOrder?.id === order.id ? 'var(--bg-hover)' : 'transparent',
                                                    borderLeft: selectedOrder?.id === order.id ? '4px solid var(--accent)' : '4px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <strong style={{ color: 'var(--text-primary)' }}>#{order.orderNumber || order.id}</strong>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {new Date(order.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 'bold', color: '#22c55e' }}>₹{(order.total || 0).toFixed(2)}</span>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold',
                                                        background: order.paymentStatus === 'PAID' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: order.paymentStatus === 'PAID' ? '#22c55e' : '#ef4444'
                                                    }}>
                                                        {order.paymentStatus || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Right Pane: Order Details */}
                                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg-primary)' }}>
                                        {selectedOrder ? (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                                                    <div>
                                                        <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: 'var(--text-primary)' }}>Order #{selectedOrder.orderNumber || selectedOrder.id}</h2>
                                                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#22c55e' }}>₹{(selectedOrder.total || 0).toFixed(2)}</h2>
                                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Type: {selectedOrder.orderType}</p>
                                                    </div>
                                                </div>

                                                <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Items Purchased</h4>
                                                <div className="premium-table-wrapper" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <table className="premium-table" style={{ margin: 0 }}>
                                                        <thead>
                                                            <tr>
                                                                <th>Item Name</th>
                                                                <th>Price</th>
                                                                <th>Qty</th>
                                                                <th style={{ textAlign: 'right' }}>Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                                                selectedOrder.items.map((item, idx) => (
                                                                    <tr key={idx}>
                                                                        <td>
                                                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>{item.name}</span>
                                                                            {item.notes && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note: {item.notes}</span>}
                                                                        </td>
                                                                        <td>₹{(item.price || 0).toFixed(2)}</td>
                                                                        <td><span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>x{item.quantity}</span></td>
                                                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--text-primary)' }}>₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No items found for this order.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div style={{ marginTop: '20px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                                        <span>Subtotal</span>
                                                        <span>₹{(selectedOrder.subtotal || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                                        <span>Tax Amount</span>
                                                        <span>₹{(selectedOrder.taxAmount || 0).toFixed(2)}</span>
                                                    </div>
                                                    {(selectedOrder.discountAmount > 0) && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ef4444' }}>
                                                            <span>Discount</span>
                                                            <span>-₹{selectedOrder.discountAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {(selectedOrder.pointsRedeemed > 0) && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#3b82f6' }}>
                                                            <span>Points Redeemed</span>
                                                            <span>-₹{selectedOrder.pointsRedeemed.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed var(--border)', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                                        <span>Grand Total</span>
                                                        <span>₹{(selectedOrder.total || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🧾</div>
                                                <h3>Select an Order</h3>
                                                <p>Click on an order from the left pane to view its detailed receipt and products.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
