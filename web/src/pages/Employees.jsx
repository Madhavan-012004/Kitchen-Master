import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import './Simple.css'

export default function EmployeesPage() {
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [showModal, setShowModal] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({ _id: '', name: '', email: '', password: '', role: 'waiter', assignedTables: '' })
    const [saving, setSaving] = useState(false)

    const fetchEmployees = () => {
        setLoading(true)
        api.get('/auth/employees').then(r => setEmployees(r.data.data?.employees || []))
            .catch(e => alert(e.response?.data?.message || 'Failed to fetch staff'))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchEmployees()
    }, [])

    const openAddModal = () => {
        setFormData({ _id: '', name: '', email: '', password: '', role: 'waiter', assignedTables: '' })
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
            assignedTables: (emp.assignedTables || []).join(', ')
        })
        setIsEditing(true)
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this staff member?')) return
        try {
            await api.delete(`/auth/${id}`)
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
                assignedTables: formData.assignedTables ? formData.assignedTables.split(',').map(t => t.trim()).filter(Boolean) : []
            }
            if (formData.password) payload.password = formData.password

            if (isEditing) {
                await api.put(`/auth/${formData._id}`, payload)
            } else {
                if (!payload.password) throw new Error("Password is required for new staff")
                await api.post('/auth/register', payload)
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
                                    <label>Assigned Tables (Comma separated numbers)</label>
                                    <input type="text" placeholder="e.g. 1, 2, 5" value={formData.assignedTables} onChange={e => setFormData({ ...formData, assignedTables: e.target.value })} />
                                </div>
                            )}

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="save-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Staff'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
