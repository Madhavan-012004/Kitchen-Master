import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs';
import './Expenditures.css';

export default function Expenditures() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('All');
    const [formData, setFormData] = useState({
        amount: '',
        category: 'Maintenance',
        description: '',
        paymentMethod: 'Cash',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = ['Maintenance', 'Rent', 'Electricity', 'Water', 'Salary', 'Inventory Purchase', 'Marketing', 'Others'];

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/transactions');
            setTransactions(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch transactions', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Convert simple date to ISO
            const payload = {
                ...formData,
                date: new Date(formData.date).toISOString()
            };
            await api.post('/transactions', payload);
            setShowModal(false);
            setFormData({
                amount: '',
                category: 'Maintenance',
                description: '',
                paymentMethod: 'Cash',
                date: new Date().toISOString().split('T')[0]
            });
            fetchTransactions();
        } catch (err) {
            alert('Failed to record expenditure');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        try {
            await api.delete(`/transactions/${id}`);
            fetchTransactions();
        } catch (err) {
            alert('Failed to delete record');
        }
    };

    const filteredTransactions = transactions.filter(t => 
        filter === 'All' || t.category === filter
    );

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="expenditures-page">
            <StakeholderRestaurantTabs />
            <header className="exp-header">
                <div className="title-group">
                    <h1>Expenditure Ledger</h1>
                    <p>Track maintenance, utilities, and operational costs</p>
                </div>
                <div className="header-actions">
                    <button className="add-exp-btn" onClick={() => setShowModal(true)}>
                        <span>+</span> Record New Expense
                    </button>
                </div>
            </header>

            <div className="exp-stats-grid">
                <div className="exp-stat-card">
                    <label>Total Expenditure (Current Month)</label>
                    <div className="value">₹{totalExpense.toLocaleString()}</div>
                    <div className="trend">Financial Year 2024-25</div>
                </div>
                <div className="exp-stat-card">
                    <label>Maintenance Costs</label>
                    <div className="value">
                        ₹{transactions.filter(t => t.category === 'Maintenance').reduce((s,t) => s+t.amount, 0).toLocaleString()}
                    </div>
                </div>
                <div className="exp-stat-card">
                    <label>Inventory Purchases</label>
                    <div className="value">
                        ₹{transactions.filter(t => t.category === 'Inventory Purchase').reduce((s,t) => s+t.amount, 0).toLocaleString()}
                    </div>
                </div>
            </div>

            <div className="exp-controls">
                <div className="filter-tabs">
                    {['All', ...categories].map(cat => (
                        <button 
                            key={cat} 
                            className={`filter-tab ${filter === cat ? 'active' : ''}`}
                            onClick={() => setFilter(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="exp-table-container">
                {loading ? (
                    <div className="loading-state">Loading ledger...</div>
                ) : (
                    <table className="exp-table">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(t => (
                                <tr key={t.id}>
                                    <td>
                                        <div className="date">{new Date(t.date).toLocaleDateString()}</div>
                                        <small>{new Date(t.date).toLocaleTimeString()}</small>
                                    </td>
                                    <td>
                                        <span className={`cat-pill ${t.category.replace(' ', '-').toLowerCase()}`}>
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="desc-cell">{t.description || 'No description'}</td>
                                    <td>{t.paymentMethod}</td>
                                    <td className="amt-cell expense">₹{t.amount.toLocaleString()}</td>
                                    <td>
                                        <button className="del-btn" onClick={() => handleDelete(t.id)}>🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="exp-modal-overlay">
                    <div className="exp-modal">
                        <div className="modal-header">
                            <h2>Log Expenditure</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Category</label>
                                <select 
                                    value={formData.category}
                                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                                    required
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Amount (₹)</label>
                                    <input 
                                        type="number" 
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Payment Method</label>
                                    <select 
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI / GPay</option>
                                        <option value="Card">Credit Card</option>
                                        <option value="Bank">Bank Transfer</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input 
                                    type="date" 
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Description / Reason</label>
                                <textarea 
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="e.g. A/C Servicing, Floor repair..."
                                    rows="3"
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="primary-btn">Save Expenditure</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
