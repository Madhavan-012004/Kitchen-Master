import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useTranslation } from 'react-i18next'
import './Simple.css'

export default function MenuPage() {
    const { user } = useAuth()
    const { t, i18n } = useTranslation()
    const { showTamilName } = useLanguage()
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager'

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [formData, setFormData] = useState({
        name: '', tamilName: '', description: '', tamilDescription: '', price: '', category: 'Main Course',
        isVeg: true, isAvailable: true
    })
    const [importing, setImporting] = useState(false)

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
        setFormData({ name: '', tamilName: '', description: '', tamilDescription: '', price: '', category: 'Main Course', isVeg: true, isAvailable: true })
        setShowModal(true)
    }

    const handleEdit = (item) => {
        setEditingItem(item)
        setFormData({
            name: item.name,
            tamilName: item.tamilName || '',
            description: item.description || '',
            tamilDescription: item.tamilDescription || '',
            price: String(item.price),
            category: item.category || 'Main Course',
            isVeg: item.isVeg !== false,
            isAvailable: item.isAvailable !== false
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!window.confirm(t('menu.confirm_delete', 'Are you sure you want to delete this menu item?'))) return
        try {
            await api.delete(`/menu/${id}`)
            fetchMenu()
        } catch (error) {
            alert(t('menu.delete_failed', 'Failed to delete item'))
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
            alert(editingItem ? t('menu.update_failed', 'Failed to update item') : t('menu.add_failed', 'Failed to add item'))
            console.error(error)
        }
    }

    const handleImport = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setImporting(true)
        const fd = new FormData()
        fd.append('file', file)

        try {
            const res = await api.post('/menu/import', fd)
            alert(`\u2705 ${res.data.message || t('menu.import_success', 'Import successful!')}`)
            fetchMenu()
        } catch (error) {
            const msg = error.response?.data?.message || error.message || t('menu.upload_failed', 'Upload failed')
            alert('\u274c ' + t('menu.bulk_upload_failed', 'Bulk Upload Failed') + ': ' + msg)
            console.error(error)
        } finally {
            setImporting(false)
            e.target.value = ''
        }
    }

    const handleDeleteAll = async () => {
        if (!window.confirm(t('menu.confirm_delete_all', '\u26a0\ufe0f WARNING: This will permanently delete ALL menu items. This action cannot be undone. Are you sure?'))) return

        setLoading(true)
        try {
            await api.delete('/menu/all')
            alert('\u2705 ' + t('menu.all_deleted', 'All menu items deleted successfully'))
            fetchMenu()
        } catch (error) {
            alert('\u274c ' + t('menu.delete_all_failed', 'Failed to delete items') + ': ' + (error.response?.data?.message || error.message))
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadTemplate = () => {
        const csvContent = [
            'name,price,category,type,description,tamilName',
            'Paneer Butter Masala,280,Main Course,Veg,Creamy paneer dish,\u0baa\u0ba9\u0bc0\u0bb0\u0bcd \u0baa\u0b9f\u0bcd\u0b9f\u0bb0\u0bcd \u0bae\u0b9a\u0bbe\u0bb2\u0bbe',
            'Chicken Biryani,320,Rice & Biryani,Non-Veg,Fragrant rice with chicken,\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0ba9\u0bcd \u0baa\u0bbf\u0bb0\u0bbf\u0baf\u0bbe\u0ba3\u0bbf',
            'Masala Dosa,80,South Indian,Veg,Crispy dosa with potato filling,\u0bae\u0b9a\u0bbe\u0bb2\u0bbe \u0ba4\u0bcb\u0b9a\u0bc8',
            'Filter Coffee,40,Beverages,Veg,Traditional South Indian coffee,\u0b83\u0baa\u0bbf\u0bb2\u0bcd\u0b9f\u0bb0\u0bcd \u0b95\u0bbe\u0baa\u0bbf',
            'Idli Sambar,60,South Indian,Veg,Soft idlis with sambar,\u0b87\u0b9f\u0bcd\u0bb2\u0bbf \u0b9a\u0bbe\u0bae\u0bcd\u0baa\u0bbe\u0bb0\u0bcd',
            'Chicken 65,180,Starters,Non-Veg,Spicy fried chicken,\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0ba9\u0bcd 65',
            'Veg Fried Rice,150,Rice & Biryani,Veg,Stir-fried rice with vegetables,\u0bb5\u0bc6\u0b9c\u0bcd \u0b83\u0baa\u0bcd\u0bb0\u0bc8\u0b9f\u0bcd \u0bb0\u0bc8\u0bb8\u0bcd',
            'Mutton Curry,350,Main Course,Non-Veg,Spicy mutton gravy,\u0bae\u0b9f\u0bcd\u0b9f\u0ba9\u0bcd \u0b95\u0bb1\u0bbf',
            'Samosa,30,Starters,Veg,Crispy potato stuffed pastry,\u0b9a\u0bae\u0bcb\u0b9a\u0bbe',
            'Pongal,70,Breakfast,Veg,Rice and lentil comfort dish,\u0baa\u0bca\u0b99\u0bcd\u0b95\u0bb2\u0bcd'
        ].join('\n')

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'menu.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    // Display name based on active language
    const getDisplayName = (item) => {
        return (showTamilName && item.tamilName) ? item.tamilName : item.name
    }

    return (
        <div className="simple-page">
            <div className="simple-header">
                <div>
                    <h1 className="page-title">{t('nav.menu')}</h1>
                    <span className="page-count">{items.length} {t('pos.items')}</span>
                </div>
                {isManagerOrOwner && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <input
                            type="file"
                            id="menuCsvImport"
                            accept=".csv,.xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={handleImport}
                        />
                        <button
                            className="add-btn"
                            style={{ background: '#6366f1' }}
                            onClick={handleDownloadTemplate}
                            title={t('menu.download_template_hint', 'Download a sample CSV with Tamil names')}
                        >
                            📄 {t('menu.download_template', 'Download CSV Template')}
                        </button>
                        <button
                            className="add-btn"
                            style={{ background: '#4f46e5' }}
                            onClick={() => document.getElementById('menuCsvImport').click()}
                            disabled={importing}
                        >
                            {importing ? t('menu.importing', 'Importing...') : `📥 ${t('menu.import_csv', 'Import CSV')}`}
                        </button>
                        <button
                            className="add-btn"
                            style={{ background: '#ef4444' }}
                            onClick={handleDeleteAll}
                            disabled={loading}
                        >
                            🗑️ {t('menu.delete_all', 'Delete All')}
                        </button>
                        <button className="add-btn" onClick={handleAdd}>+ {t('menu.add_item')}</button>
                    </div>
                )}
            </div>

            {loading ? <div className="loading">{t('common.loading')}</div> : (
                <div className="orders-list">
                    {items.map(i => (
                        <div key={i._id} className="order-row">
                            <div className="order-row-left">
                                <div className={`veg-indicator ${i.isVeg ? 'veg' : 'nonveg'}`} />
                                <span className="order-table">
                                    {getDisplayName(i)}
                                    {i.tamilName && i.name !== i.tamilName && !showTamilName && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({i.tamilName})</span>
                                    )}
                                    {i.tamilName && i.name !== i.tamilName && showTamilName && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({i.name})</span>
                                    )}
                                </span>
                                <span className="order-items">{i.category}</span>
                            </div>
                            <div className="order-row-right">
                                <span className="order-total" style={{ marginRight: '15px' }}>&#8377;{i.price}</span>
                                {!i.isAvailable && <span className="role-badge" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#f87171' }}>{t('menu.unavailable')}</span>}

                                {isManagerOrOwner && (
                                    <>
                                        <button className="edit-btn" onClick={() => handleEdit(i)}>{t('common.edit')}</button>
                                        <button className="delete-btn" onClick={() => handleDelete(i._id)}>{t('common.delete')}</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                            {t('menu.no_items', 'No menu items found. Add items or import a CSV file.')}
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 style={{ color: 'var(--text-primary)' }}>{editingItem ? t('menu.edit_item', 'Edit Menu Item') : t('menu.add_new_item', 'Add New Item')}</h2>
                            <button className="close-modal-btn" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form className="modal-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label style={{ color: 'var(--text-primary)' }}>📝 {t('menu.item_name_en', 'Item Name (English)')}</label>
                                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="E.g. Paneer Butter Masala" />
                            </div>

                            <div className="form-group">
                                <label style={{ color: 'var(--text-primary)' }}>
                                    🔤 {t('menu.item_name_ta', 'Tamil Name (\u0ba4\u0bae\u0bbf\u0bb4\u0bcd \u0baa\u0bc6\u0baf\u0bb0\u0bcd)')}
                                    <span className="optional-text">{t('menu.optional', '(Optional)')}</span>
                                </label>
                                <input value={formData.tamilName} onChange={e => setFormData({ ...formData, tamilName: e.target.value })} placeholder="E.g. பனீர் பட்டர் மசாலா" />
                            </div>

                            <div className="form-group">
                                <label style={{ color: 'var(--text-primary)' }}>💰 {t('menu.price', 'Price')} (&#8377;)</label>
                                <input required type="number" min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="E.g. 250" />
                            </div>

                            <div className="form-group">
                                <label style={{ color: 'var(--text-primary)' }}>🏷️ {t('menu.category_label', 'Category (Select or type new)')}</label>
                                <input
                                    list="category-suggestions"
                                    required
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="e.g. Starters"
                                />
                                <datalist id="category-suggestions">
                                    <option value="Starters" />
                                    <option value="Main Course" />
                                    <option value="Lunch Special" />
                                    <option value="Breakfast" />
                                    <option value="South Indian" />
                                    <option value="Rice & Biryani" />
                                    <option value="Breads" />
                                    <option value="Desserts" />
                                    <option value="Snacks & Sides" />
                                    <option value="Beverages" />
                                </datalist>
                            </div>

                            <div className="form-group">
                                <label style={{ color: 'var(--text-primary)' }}>📄 {t('menu.description', 'Description')}</label>
                                <textarea 
                                    value={formData.description} 
                                    onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                    placeholder="Brief description of the dish..."
                                    rows={2}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ color: 'var(--text-primary)' }}>🔤 {t('menu.description_ta', 'Tamil Description')}</label>
                                <textarea 
                                    value={formData.tamilDescription} 
                                    onChange={e => setFormData({ ...formData, tamilDescription: e.target.value })} 
                                    placeholder="இந்த உணவு பற்றிய சிறு குறிப்பு..."
                                    rows={2}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', background: 'var(--bg-primary)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <input type="checkbox" id="isVeg" checked={formData.isVeg} onChange={e => setFormData({ ...formData, isVeg: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="isVeg" style={{ fontSize: '14px', cursor: 'pointer', marginBottom: 0, color: 'var(--text-primary)' }}>{t('menu.is_veg', 'Vegetarian')}</label>
                                </div>

                                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', background: 'var(--bg-primary)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <input type="checkbox" id="isAvailable" checked={formData.isAvailable} onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                    <label htmlFor="isAvailable" style={{ fontSize: '14px', cursor: 'pointer', marginBottom: 0, color: 'var(--text-primary)' }}>{t('menu.is_available', 'In Stock')}</label>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-modal-btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="save-modal-btn">{editingItem ? t('menu.save_changes', 'Save Changes') : t('menu.add_item')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
