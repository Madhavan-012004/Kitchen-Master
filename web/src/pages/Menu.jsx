import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import './Simple.css'

export default function MenuPage() {
    const { user } = useAuth()
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager'

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [formData, setFormData] = useState({
        name: '', description: '', price: '', category: 'Main Course',
        isVeg: true, isAvailable: true
    })

    const fetchMenu = () => {
        setLoading(true)
        api.get('/menu').then(r => setItems(r.data.data?.menuItems || r.data.data?.items || []))
            .catch(console.error).finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchMenu()
    }, [])

    const handleAdd = () => {
        setEditingItem(null)
        setFormData({ name: '', description: '', price: '', category: 'Main Course', isVeg: true, isAvailable: true })
        setShowModal(true)
    }

    const handleEdit = (item) => {
        setEditingItem(item)
        setFormData({
            name: item.name,
            description: item.description || '',
            price: String(item.price),
            category: item.category || 'Main Course',
            isVeg: item.isVeg !== false,
            isAvailable: item.isAvailable !== false
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this menu item?")) return
        try {
            await api.delete(`/menu/${id}`)
            fetchMenu()
        } catch (error) {
            alert('Failed to delete item')
            console.error(error)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const payload = { ...formData, price: Number(formData.price) }
            if (editingItem) {
                await api.put(`/menu/${editingItem._id}`, payload)
            } else {
                await api.post('/menu', payload)
            }
            setShowModal(false)
            fetchMenu()
        } catch (error) {
            alert(editingItem ? 'Failed to update item' : 'Failed to add item')
            console.error(error)
        }
    }

    return (
        <div className="simple-page">
            <div className="simple-header">
                <div>
                    <h1 className="page-title">Menu</h1>
                    <span className="page-count">{items.length} items</span>
                </div>
                {isManagerOrOwner && (
                    <button className="add-btn" onClick={handleAdd}>+ Add Item</button>
                )}
            </div>

            {loading ? <div className="loading">Loading...</div> : (
                <div className="orders-list">
                    {items.map(i => (
                        <div key={i._id} className="order-row">
                            <div className="order-row-left">
                                <div className={`veg-indicator ${i.isVeg ? 'veg' : 'nonveg'}`} />
                                <span className="order-table">{i.name}</span>
                                <span className="order-items">{i.category}</span>
                            </div>
                            <div className="order-row-right">
                                <span className="order-total" style={{ marginRight: '15px' }}>₹{i.price}</span>
                                {!i.isAvailable && <span className="role-badge" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#f87171' }}>Out of Stock</span>}

                                {isManagerOrOwner && (
                                    <>
                                        <button className="edit-btn" onClick={() => handleEdit(i)}>Edit</button>
                                        <button className="delete-btn" onClick={() => handleDelete(i._id)}>Delete</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingItem ? 'Edit Menu Item' : 'Add New Item'}</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form className="modal-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Item Name</label>
                                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="E.g. Paneer Butter Masala" />
                            </div>

                            <div className="form-group">
                                <label>Price (₹)</label>
                                <input required type="number" min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="E.g. 250" />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                    <option value="Starters">Starters</option>
                                    <option value="Main Course">Main Course</option>
                                    <option value="Breads">Breads</option>
                                    <option value="Rice & Biryani">Rice & Biryani</option>
                                    <option value="Desserts">Desserts</option>
                                    <option value="Beverages">Beverages</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" id="isVeg" checked={formData.isVeg} onChange={e => setFormData({ ...formData, isVeg: e.target.checked })} />
                                <label htmlFor="isVeg" style={{ fontSize: '14px', cursor: 'pointer' }}>Is Vegetarian?</label>
                            </div>

                            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" id="isAvailable" checked={formData.isAvailable} onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })} />
                                <label htmlFor="isAvailable" style={{ fontSize: '14px', cursor: 'pointer' }}>Is Available in stock?</label>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="save-btn">{editingItem ? 'Save Changes' : 'Add Item'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
