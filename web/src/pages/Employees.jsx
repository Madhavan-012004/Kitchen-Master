import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import StakeholderRestaurantTabs from '../components/StakeholderRestaurantTabs'
import './Simple.css'

export default function EmployeesPage() {
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({ _id: '', name: '', email: '', password: '', role: 'waiter', assignedTables: [] })
    const [saving, setSaving] = useState(false)
    const [totalTables, setTotalTables] = useState(0)

    const fetchEmployees = () => {
        setLoading(true)
        api.get('/auth/employees').then(r => setEmployees(r.data.data?.employees || []))
            .catch(e => alert(e.response?.data?.message || 'Failed to fetch staff'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchEmployees()
        api.get('/auth/me').then(r => {
            setTotalTables(r.data.data?.totalTables || 30)
        }).catch(() => setTotalTables(30))
    }, [])

    const openAddModal = () => {
        setFormData({ _id: '', name: '', email: '', password: '', role: 'waiter', assignedTables: [] })
        setIsEditing(false)
        setShowModal(true)
    }

    const openEditModal = (emp) => {
        setFormData({
            _id: emp._id,
            name: emp.name,
            email: emp.email,
            password: '', // blank password unless changing
            role: emp.role || 'waiter',
            assignedTables: emp.assignedTables || []
        })
        setIsEditing(true)
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this staff member?')) return
        try {
            await api.delete(`/auth/users/${id}`)
            fetchEmployees()
        } catch (e) {
            alert(e.response?.data?.message || 'Failed to delete staff')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                assignedTables: formData.assignedTables || []
            }
            if (formData.password) payload.password = formData.password

            if (isEditing) {
                await api.put(`/auth/users/${formData._id}`, payload)
            } else {
                if (!payload.password) throw new Error("Password is required for new staff")
                await api.post('/auth/employee/register', payload)
            }
            setShowModal(false)
            fetchEmployees()
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Error saving staff')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="simple-page">
            <StakeholderRestaurantTabs />
            <div className="simple-header">
                <div>
                    <h1 className="page-title">Staff Management</h1>
                    <span className="page-count">{employees.length} staff</span>
                </div>
                <button className="add-btn" onClick={openAddModal}>+ Add Staff</button>
            </div>

            {loading ? <div className="loading">Loading...</div> : (
                <div className="orders-list">
                    {employees.map(e => (
                        <div key={e._id} className="order-row">
                            <div className="order-row-left">
                                <div className="emp-avatar">{e.name?.charAt(0)?.toUpperCase()}</div>
                                <div>
                                    <div className="order-table">{e.name}</div>
                                    <div className="order-items">{e.email}</div>
                                </div>
                            </div>
                            <div className="order-row-right" style={{ gap: '10px' }}>
                                <span className="role-badge">{e.role?.toUpperCase()}</span>
                                {e.assignedTables?.length > 0 && (
                                    <span className="order-items" style={{ marginRight: '15px' }}>
                                        Tables: {e.assignedTables.join(', ')}
                                    </span>
                                )}
                                <button className="edit-btn" onClick={() => openEditModal(e)}>Edit</button>
                                {e.role !== 'owner' && (
                                    <button className="delete-btn" onClick={() => handleDelete(e._id)}>Del</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{isEditing ? 'Edit Staff' : 'Add New Staff'}</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Name</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Email (Login)</label>
                                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Password {isEditing ? '(Leave blank to keep current)' : ''}</label>
                                <input type="text" required={!isEditing} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                    <option value="waiter">Waiter</option>
                                    <option value="kitchen">Kitchen</option>
                                    <option value="manager">Manager</option>
                                    <option value="owner">Owner</option>
                                </select>
                            </div>
                            {formData.role === 'waiter' && (
                                <div className="form-group">
                                    <label>Assigned Tables (Select one or more)</label>
                                    <div className="table-selection-grid">
                                        {(() => {
                                            const otherAssignments = employees
                                                .filter(e => e._id !== formData._id)
                                                .reduce((acc, e) => [...acc, ...(e.assignedTables || [])], []);
                                            
                                            return Array.from({ length: totalTables }, (_, i) => i + 1).map(num => {
                                                const tableStr = String(num);
                                                const isSelected = formData.assignedTables.includes(tableStr);
                                                const isTaken = otherAssignments.includes(tableStr);
                                                
                                                return (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        className={`table-select-btn ${isSelected ? 'active' : ''} ${isTaken ? 'taken' : ''}`}
                                                        disabled={isTaken}
                                                        title={isTaken ? "Table already assigned to another staff" : ""}
                                                        onClick={() => {
                                                            const current = formData.assignedTables;
                                                            if (isSelected) {
                                                                setFormData({ ...formData, assignedTables: current.filter(t => t !== tableStr) });
                                                            } else {
                                                                setFormData({ ...formData, assignedTables: [...current, tableStr] });
                                                            }
                                                        }}
                                                    >
                                                        {num}
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="cancel-modal-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="save-modal-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Staff'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
