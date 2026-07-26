import React, { useEffect, useState, useRef } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useTranslation } from 'react-i18next'
import './Simple.css'
import './Menu.css'

// Vite dev server proxies /uploads → http://localhost:8080
// So /uploads/menu/xxx.jpg works directly in browser
function getItemImage(item) {
    if (!item.imageUrl) return null
    return item.imageUrl  // works for both http://... and /uploads/...
}

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

    // Image upload state
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [uploadingImage, setUploadingImage] = useState(false)
    const imageInputRef = useRef(null)

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
        setImageFile(null)
        setImagePreview(null)
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
        setImageFile(null)
        setImagePreview(getItemImage(item))
        setShowModal(true)
    }

    const handleImageChange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        setImageFile(file)
        const reader = new FileReader()
        reader.onload = (ev) => setImagePreview(ev.target.result)
        reader.readAsDataURL(file)
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
            let savedItem
            if (editingItem) {
                const res = await api.put(`/menu/${editingItem._id}`, payload)
                savedItem = res.data.data
            } else {
                const res = await api.post('/menu', payload)
                savedItem = res.data.data
            }

            // If an image was selected, upload it
            if (imageFile && savedItem) {
                setUploadingImage(true)
                const fd = new FormData()
                fd.append('file', imageFile)
                await api.post(`/menu/${savedItem._id || savedItem.id}/image`, fd)
                setUploadingImage(false)
            }

            setShowModal(false)
            setImageFile(null)
            setImagePreview(null)
            fetchMenu()
        } catch (error) {
            setUploadingImage(false)
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
            alert(`✅ ${res.data.message || t('menu.import_success', 'Import successful!')}`)
            fetchMenu()
        } catch (error) {
            const msg = error.response?.data?.message || error.message || t('menu.upload_failed', 'Upload failed')
            alert('❌ ' + t('menu.bulk_upload_failed', 'Bulk Upload Failed') + ': ' + msg)
            console.error(error)
        } finally {
            setImporting(false)
            e.target.value = ''
        }
    }

    const handleDeleteAll = async () => {
        if (!window.confirm(t('menu.confirm_delete_all', '⚠️ WARNING: This will permanently delete ALL menu items. This action cannot be undone. Are you sure?'))) return

        setLoading(true)
        try {
            await api.delete('/menu/all')
            alert('✅ ' + t('menu.all_deleted', 'All menu items deleted successfully'))
            fetchMenu()
        } catch (error) {
            alert('❌ ' + t('menu.delete_all_failed', 'Failed to delete items') + ': ' + (error.response?.data?.message || error.message))
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadTemplate = () => {
        const csvContent = [
            'name,price,category,type,description,tamilName,image_url',
            'Paneer Butter Masala,280,Main Course,Veg,Creamy paneer dish,பனீர் பட்டர் மசாலா,https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
            'Chicken Biryani,320,Rice & Biryani,Non-Veg,Fragrant rice with chicken,சிக்கன் பிரியாணி,https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=400',
            'Masala Dosa,80,South Indian,Veg,Crispy dosa with potato filling,மசாலா தோசை,',
            'Filter Coffee,40,Beverages,Veg,Traditional South Indian coffee,ஃபில்டர் காபி,',
            'Idli Sambar,60,South Indian,Veg,Soft idlis with sambar,இட்லி சாம்பார்,',
            'Chicken 65,180,Starters,Non-Veg,Spicy fried chicken,சிக்கன் 65,',
            'Veg Fried Rice,150,Rice & Biryani,Veg,Stir-fried rice with vegetables,வெஜ் ஃபிரைட் ரைஸ்,',
            'Mutton Curry,350,Main Course,Non-Veg,Spicy mutton gravy,மட்டன் கறி,',
            'Samosa,30,Starters,Veg,Crispy potato stuffed pastry,சமோசா,',
            'Pongal,70,Breakfast,Veg,Rice and lentil comfort dish,பொங்கல்,'
        ].join('\n')

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'menu_template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

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
                    <div className="menu-header-actions">
                        <input
                            type="file"
                            id="menuCsvImport"
                            accept=".csv,.xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={handleImport}
                        />
                        <button
                            className="menu-secondary-btn tooltip-btn"
                            onClick={handleDownloadTemplate}
                            title={t('menu.download_template_hint', 'Download a sample CSV with Tamil names and image_url column')}
                        >
                            📄 <span className="btn-text">{t('menu.download_template', 'Template')}</span>
                        </button>
                        <button
                            className="menu-secondary-btn"
                            onClick={() => document.getElementById('menuCsvImport').click()}
                            disabled={importing}
                        >
                            {importing ? t('menu.importing', 'Importing...') : (
                                <>📥 <span className="btn-text">{t('menu.import_csv', 'Import')}</span></>
                            )}
                        </button>
                        <button
                            className="menu-danger-btn"
                            onClick={handleDeleteAll}
                            disabled={loading}
                        >
                            🗑️ <span className="btn-text">{t('menu.delete_all', 'Delete All')}</span>
                        </button>
                        <button className="menu-primary-btn" onClick={handleAdd}>+ <span className="btn-text">{t('menu.add_item')}</span></button>
                    </div>
                )}
            </div>

            {loading ? <div className="loading">{t('common.loading')}</div> : (
                <div className="orders-list">
                    {items.map(i => (
                        <div key={i._id} className="order-row menu-item-row">
                            {/* Thumbnail */}
                            <div className="menu-thumb-wrap">
                                {getItemImage(i) ? (
                                    <img src={getItemImage(i)} alt={i.name} className="menu-thumb" />
                                ) : (
                                    <div className="menu-thumb-placeholder">
                                        {i.isVeg ? '🌿' : '🍖'}
                                    </div>
                                )}
                            </div>

                            <div className="order-row-left" style={{ flex: 1 }}>
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
                    <div className="modal-content menu-modal-content">
                        <div className="modal-header">
                            <h2 style={{ color: 'var(--text-primary)' }}>{editingItem ? t('menu.edit_item', 'Edit Menu Item') : t('menu.add_new_item', 'Add New Item')}</h2>
                            <button className="close-modal-btn" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form className="modal-form" onSubmit={handleSubmit}>

                            {/* Image Upload Section */}
                            <div className="menu-image-upload-section">
                                <div
                                    className="menu-image-dropzone"
                                    onClick={() => imageInputRef.current?.click()}
                                >
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="menu-image-preview" />
                                    ) : (
                                        <div className="menu-image-placeholder">
                                            <span style={{ fontSize: '36px' }}>🍽️</span>
                                            <p>Click to upload dish photo</p>
                                            <span className="menu-image-hint">JPG, PNG, WEBP · Max 5MB</span>
                                        </div>
                                    )}
                                    <input
                                        ref={imageInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleImageChange}
                                    />
                                </div>
                                {imagePreview && (
                                    <button
                                        type="button"
                                        className="menu-image-remove-btn"
                                        onClick={() => { setImageFile(null); setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                                    >
                                        ✕ Remove Photo
                                    </button>
                                )}
                            </div>

                            <div className="menu-modal-fields">
                                <div className="form-group">
                                    <label style={{ color: 'var(--text-primary)' }}>📝 {t('menu.item_name_en', 'Item Name (English)')}</label>
                                    <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="E.g. Paneer Butter Masala" />
                                </div>

                                <div className="form-group">
                                    <label style={{ color: 'var(--text-primary)' }}>
                                        🔤 {t('menu.item_name_ta', 'Tamil Name (தமிழ் பெயர்)')}
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
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-modal-btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="save-modal-btn" disabled={uploadingImage}>
                                    {uploadingImage ? '⏳ Uploading Image...' : editingItem ? t('menu.save_changes', 'Save Changes') : t('menu.add_item')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
