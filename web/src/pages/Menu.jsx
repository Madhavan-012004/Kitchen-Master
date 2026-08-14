import React, { useEffect, useState, useRef } from 'react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { usePOSMode } from '../context/POSModeContext.jsx'
import { useTranslation } from 'react-i18next'
import './Simple.css'
import './Menu.css'

function getItemImage(item) {
    if (!item.imageUrl) return null
    return item.imageUrl
}

export default function MenuPage() {
    const { user } = useAuth()
    const { t, i18n } = useTranslation()
    const { showTamilName } = useLanguage()
    const { isPoultry } = usePOSMode()
    const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager'

    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [updatingRates, setUpdatingRates] = useState(false)
    const [categoryRates, setCategoryRates] = useState({})

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [formData, setFormData] = useState({
        name: '', tamilName: '', description: '', tamilDescription: '', price: '', category: 'Main Course',
        isVeg: true, isAvailable: true,
        // Poultry-specific
        buyingPrice: '', sellingPrice: '', quantityType: 'kg', wastage: '', profit: ''
    })
    const [importing, setImporting] = useState(false)

    // Image upload state
    const [imageFile, setImageFile] = useState(null)
    const [imagePreview, setImagePreview] = useState(null)
    const [uploadingImage, setUploadingImage] = useState(false)
    const imageInputRef = useRef(null)

    const fetchMenu = () => {
        setLoading(true)
        api.get('/menu').then(r => {
            let fetchedItems = r.data.data?.menuItems || r.data.data?.items || [];
            fetchedItems = fetchedItems.map(i => {
                if (i.description && typeof i.description === 'string' && i.description.includes('||META:')) {
                    const [desc, metaStr] = i.description.split('||META:');
                    try {
                        const meta = JSON.parse(metaStr);
                        return {
                            ...i,
                            description: desc,
                            buyingPrice: meta.buy !== undefined ? meta.buy : i.buyingPrice,
                            sellingPrice: meta.sell !== undefined ? meta.sell : i.sellingPrice,
                            quantityType: meta.qty || i.quantityType,
                            wastage: meta.wastage || 0,
                            profit: meta.profit || 0
                        };
                    } catch (err) { return i; }
                }
                return i;
            });
            setItems(fetchedItems);

            // Populate category rates
            const newRates = {};
            fetchedItems.forEach(i => {
                const catStr = (i.category || '').trim().toUpperCase();
                if (catStr && !newRates[catStr] && i.buyingPrice > 0) {
                    newRates[catStr] = i.buyingPrice;
                }
            });
            setCategoryRates(newRates);
        }).catch(console.error).finally(() => setLoading(false))
    }

    useEffect(() => {
        fetchMenu()
    }, [])

    const handleUpdateCategoryRates = async () => {
        setUpdatingRates(true);
        let successCount = 0;
        try {
            const updates = [];
            for (const item of items) {
                const catStr = (item.category || '').trim().toUpperCase();
                const newBase = parseFloat(categoryRates[catStr] || 0);
                if (newBase > 0) {
                    const wastage = parseFloat(item.wastage) || 0;
                    const profit = parseFloat(item.profit) || 0;
                    const oldBase = parseFloat(item.buyingPrice) || 0;

                    if (oldBase !== newBase) {
                        const newSelling = newBase + (newBase * wastage / 100) + profit;
                        const meta = { buy: newBase, sell: +newSelling.toFixed(2), qty: item.quantityType || 'kg', wastage, profit };
                        const descBase = (item.description || '').split('||META:')[0];
                        const newDesc = descBase + '||META:' + JSON.stringify(meta);

                        updates.push(api.put(`/menu/${item._id || item.id}`, {
                            ...item,
                            buyingPrice: newBase,
                            sellingPrice: +newSelling.toFixed(2),
                            price: +newSelling.toFixed(2),
                            description: newDesc
                        }));
                        successCount++;
                    }
                }
            }
            if (updates.length > 0) {
                await Promise.all(updates);
                alert('✅ Successfully updated ' + successCount + ' retail items!');
                fetchMenu();
            } else {
                alert('No category market rates were changed.');
            }
        } catch (err) {
            alert('❌ Failed to update global rates: ' + err.message);
        }
        setUpdatingRates(false);
    };

    const handleAdd = () => {
        setEditingItem(null)
        setFormData({
            name: '', tamilName: '', description: '', tamilDescription: '',
            price: '', category: isPoultry ? 'Chicken' : 'Main Course',
            isVeg: true, isAvailable: true,
            buyingPrice: '', sellingPrice: '', quantityType: 'kg', wastage: '', profit: ''
        })
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
            isAvailable: item.isAvailable !== false,
            buyingPrice: item.buyingPrice != null ? String(item.buyingPrice) : '',
            sellingPrice: item.sellingPrice != null ? String(item.sellingPrice) : '',
            quantityType: item.quantityType || 'kg',
            wastage: item.wastage != null ? String(item.wastage) : '0',
            profit: item.profit != null ? String(item.profit) : '0',
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

            if (isPoultry) {
                payload.quantityType = formData.quantityType || 'kg'
                payload.wastage = Number(formData.wastage) || 0
                payload.profit = Number(formData.profit) || 0

                const base = Number(payload.buyingPrice) || Number(categoryRates[(payload.category || '').trim().toUpperCase()]) || 0;
                payload.buyingPrice = base;

                payload.sellingPrice = +(base + (base * payload.wastage / 100) + payload.profit).toFixed(2);
                payload.price = payload.sellingPrice;

                const meta = { buy: payload.buyingPrice, sell: payload.sellingPrice, qty: payload.quantityType, wastage: payload.wastage, profit: payload.profit };
                payload.description = (formData.description || '').split('||META:')[0] + '||META:' + JSON.stringify(meta);
            }

            let savedItem
            if (editingItem) {
                const res = await api.put(`/menu/${editingItem._id}`, payload)
                savedItem = res.data.data
            } else {
                const res = await api.post('/menu', payload)
                savedItem = res.data.data
            }

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
        } finally {
            setLoading(false)
        }
    }

    const handleDownloadTemplate = () => {
        const csvContent = [
            'name,price,category,type,description,tamilName,image_url',
            'Paneer Butter Masala,280,Main Course,Veg,Creamy paneer dish,பனீர் பட்டர் மசாலா,https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400',
            'Chicken Biryani,320,Rice & Biryani,Non-Veg,Fragrant rice with chicken,சிக்கன் பிரியாணி,https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=400',
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

    const dedupCats = new Map();
    const defaultCats = isPoultry ? ['Chicken', 'General'] : ['Main Course', 'Starters', 'Beverages', 'Desserts', 'General'];
    [...defaultCats, ...items.map(i => i.category)].forEach(c => {
        if (!c) return;
        const norm = String(c).trim().toLowerCase();
        if (!dedupCats.has(norm)) dedupCats.set(norm, String(c).trim());
    });
    const uniqueCategories = Array.from(dedupCats.values());


    return (
        <div className="simple-page">
            <div className="simple-header">
                <div>
                    <h1 className="page-title">{t('nav.menu')}</h1>
                    <span className="page-count">{items.length} {t('pos.items')}</span>
                </div>
                {isManagerOrOwner && (
                    <div className="menu-header-actions">
                        <input type="file" id="menuCsvImport" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
                        <button className="menu-secondary-btn tooltip-btn" onClick={handleDownloadTemplate} title={t('menu.download_template_hint', 'Download a sample CSV')}>
                            📄 <span className="btn-text">{t('menu.download_template', 'Template')}</span>
                        </button>
                        <button className="menu-secondary-btn" onClick={() => document.getElementById('menuCsvImport').click()} disabled={importing}>
                            {importing ? t('menu.importing', 'Importing...') : (
                                <>📥 <span className="btn-text">{t('menu.import_csv', 'Import')}</span></>
                            )}
                        </button>
                        <button className="menu-danger-btn" onClick={handleDeleteAll} disabled={loading}>
                            🗑️ <span className="btn-text">{t('menu.delete_all', 'Delete All')}</span>
                        </button>
                        <button className="menu-primary-btn" onClick={handleAdd}>+ <span className="btn-text">{t('menu.add_item')}</span></button>
                    </div>
                )}
            </div>

            {/* Daily Market Rates Widget (Poultry Only) */}
            {isPoultry && isManagerOrOwner && uniqueCategories.length > 0 && (
                <div className="daily-rates-bar glass-panel">
                    <div className="rates-bar-header">
                        <span style={{ fontSize: '26px' }}>📈</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--accent)' }}>Today's Market Rates</h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Changes base values & recalculates retail prices automatically</span>
                        </div>
                    </div>
                    <div className="rates-inputs-grid">
                        {uniqueCategories.map(cat => (
                            <div key={cat} className="rate-input-card">
                                <label>{cat}</label>
                                <div className="rate-input-wrapper">
                                    <span>₹</span>
                                    <input type="number" min="0" value={categoryRates[cat] || ''} onChange={e => setCategoryRates({ ...categoryRates, [cat]: e.target.value })} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="menu-primary-btn" onClick={handleUpdateCategoryRates} disabled={updatingRates} style={{ padding: '12px 20px' }}>
                        {updatingRates ? '⏳ Updating All...' : '✓ Save Market Rates'}
                    </button>
                </div>
            )}

            {loading ? <div className="loading">{t('common.loading')}</div> : (
                <div className="orders-list">
                    {items.map(i => (
                        <div key={i._id} className="order-row menu-item-row" style={isPoultry ? { padding: '16px 20px', alignItems: 'center' } : {}}>
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
                                <span className="order-table" style={isPoultry ? { fontSize: '15px', fontWeight: 'bold' } : {}}>
                                    {getDisplayName(i)}
                                    {i.tamilName && i.name !== i.tamilName && !showTamilName && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({i.tamilName})</span>
                                    )}
                                    {i.tamilName && i.name !== i.tamilName && showTamilName && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({i.name})</span>
                                    )}
                                </span>
                                <span className="order-items">{i.category} • {i.quantityType || 'kg'}</span>
                            </div>

                            {/* Center Align Math Breakdown in Poultry Mode */}
                            {isPoultry && (
                                <div className="poultry-item-pricing" style={{ flex: 1 }}>
                                    <div className="pricing-math">
                                        <span title="Base Value">₹{i.buyingPrice || categoryRates[i.category] || 0} Base</span>
                                        <span>+ {i.wastage || 0}%</span>
                                        <span>+ ₹{i.profit || 0}</span>
                                        <span>=</span>
                                    </div>
                                    <span className="order-total verify-retail">₹{i.price}</span>
                                </div>
                            )}

                            <div className="order-row-right">
                                {!isPoultry && <span className="order-total" style={{ marginRight: '15px' }}>&#8377;{i.price}</span>}
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
                            {t('menu.no_items', 'No menu items found. Add items to see them here.')}
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
                            <div style={{ padding: '10px 0' }}>
                                {/* Top Section */}
                                <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                                    <div className="menu-image-upload-section" style={{ width: '120px', flexShrink: 0, marginBottom: 0 }}>
                                        <div className="menu-image-dropzone" onClick={() => imageInputRef.current?.click()}>
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Preview" className="menu-image-preview" />
                                            ) : (
                                                <div className="menu-image-placeholder">
                                                    <span style={{ fontSize: '24px', marginBottom: '4px' }}>🍽️</span>
                                                    <span style={{ fontSize: '10px', textAlign: 'center' }}>Upload<br />Photo</span>
                                                </div>
                                            )}
                                            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                                        </div>
                                        {imagePreview && (
                                            <button type="button" style={{ marginTop: '8px', padding: '4px 8px', fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }} onClick={() => { setImageFile(null); setImagePreview(null); }}>
                                                ✕ Remove
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>📝 {t('menu.item_name_en', 'Item Name')}</label>
                                            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="E.g. Chicken Lollipops" />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>🔤 {t('menu.item_name_ta', 'Tamil Name')} <span style={{ opacity: 0.5, fontWeight: 'normal' }}>{t('menu.optional', '(Opt)')}</span></label>
                                            <input value={formData.tamilName} onChange={e => setFormData({ ...formData, tamilName: e.target.value })} placeholder="E.g. சிக்கன்" />
                                        </div>
                                        {!isPoultry && (
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>💰 {t('menu.price', 'Price')} (&#8377;)</label>
                                                <input required type="number" min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="250" />
                                            </div>
                                        )}
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>🏷️ {t('menu.category_label', 'Category')}</label>
                                            {(!formData.category || uniqueCategories.includes(formData.category)) ? (
                                                <select
                                                    required
                                                    value={formData.category || ''}
                                                    onChange={e => {
                                                        if (e.target.value === '___NEW___') {
                                                            setFormData({ ...formData, category: ' ' }); // Set space to trigger text input
                                                        } else {
                                                            setFormData({ ...formData, category: e.target.value });
                                                        }
                                                    }}
                                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-color)', fontSize: '14px', outline: 'none', appearance: 'auto' }}
                                                >
                                                    <option value="" disabled>Select category</option>
                                                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    <option value="___NEW___" style={{ fontWeight: 'bold' }}>➕ Add New Category...</option>
                                                </select>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        required
                                                        value={formData.category.trimStart()}
                                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                        placeholder="Type new category..."
                                                        style={{ flex: 1 }}
                                                        autoFocus
                                                    />
                                                    <button type="button" onClick={() => setFormData({ ...formData, category: uniqueCategories[0] || '' })} style={{ padding: '0 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>✖</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>📄 {t('menu.description', 'Description')} <span style={{ opacity: 0.5, fontWeight: 'normal' }}>(Opt)</span></label>
                                        <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description..." rows={2} style={{ resize: 'none' }} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>🔤 {t('menu.description_ta', 'Tamil Description')} <span style={{ opacity: 0.5, fontWeight: 'normal' }}>(Opt)</span></label>
                                        <textarea value={formData.tamilDescription} onChange={e => setFormData({ ...formData, tamilDescription: e.target.value })} placeholder="இந்த உணவு பற்றிய குறிப்பு..." rows={2} style={{ resize: 'none' }} />
                                    </div>
                                </div>

                                {/* Dynamic Pricing Engine (Poultry) */}
                                {isPoultry && (
                                    <div style={{ background: 'rgba(198,245,61,0.06)', border: '1px solid rgba(198,245,61,0.2)', borderRadius: '10px', padding: '16px', marginBottom: '0' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>🐔 Mathematical Pricing Settings</span>
                                            <span>Current {formData.category || 'Category'} Base: ₹{categoryRates[(formData.category || '').trim().toUpperCase()] || formData.buyingPrice || '0'}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', alignItems: 'end' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>⚠️ Wastage (%)</label>
                                                <input required type="number" min="0" step="0.5"
                                                    value={formData.wastage}
                                                    onChange={e => setFormData({ ...formData, wastage: e.target.value })}
                                                    placeholder="20" />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>🤑 Profit Margin (₹)</label>
                                                <input required type="number" min="0" step="1"
                                                    value={formData.profit}
                                                    onChange={e => setFormData({ ...formData, profit: e.target.value })}
                                                    placeholder="60" />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label>⚖️ Quantity Type</label>
                                                <select required
                                                    value={formData.quantityType}
                                                    onChange={e => setFormData({ ...formData, quantityType: e.target.value })}
                                                    style={{ width: '100%' }}>
                                                    <option value="kg">Per Kilogram (kg)</option>
                                                    <option value="pcs">Per Piece (pcs)</option>
                                                </select>
                                            </div>

                                            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1', background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <label style={{ color: 'var(--text-secondary)' }}>💰 Calculated Retail Price</label>
                                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--accent)', marginTop: '4px' }}>
                                                    {formData.category && (categoryRates[(formData.category || '').trim().toUpperCase()] || formData.buyingPrice) ? (
                                                        `₹${(
                                                            parseFloat(formData.buyingPrice || categoryRates[(formData.category || '').trim().toUpperCase()] || 0) +
                                                            (parseFloat(formData.buyingPrice || categoryRates[(formData.category || '').trim().toUpperCase()] || 0) * (parseFloat(formData.wastage) || 0) / 100) +
                                                            (parseFloat(formData.profit) || 0)
                                                        ).toFixed(2)}`
                                                    ) : '₹0.00 (Enter Base Rate in Widget first)'}
                                                </div>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Formula: Base Value + (Base Value × Wastage%) + Profit</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '20px', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="checkbox" id="isVeg" checked={formData.isVeg} onChange={e => setFormData({ ...formData, isVeg: e.target.checked })} style={{ width: '16px', height: '16px', margin: 0 }} />
                                        <label htmlFor="isVeg" style={{ fontSize: '13px', margin: 0, textTransform: 'none', fontWeight: 500 }}>{t('menu.is_veg', 'Vegetarian Item')}</label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="checkbox" id="isAvailable" checked={formData.isAvailable} onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })} style={{ width: '16px', height: '16px', margin: 0 }} />
                                        <label htmlFor="isAvailable" style={{ fontSize: '13px', margin: 0, textTransform: 'none', fontWeight: 500 }}>{t('menu.is_available', 'Currently In Stock')}</label>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '20px' }}>
                                <button type="button" className="cancel-modal-btn" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
                                <button type="submit" className="save-modal-btn" disabled={uploadingImage}>
                                    {uploadingImage ? '⏳ Uploading...' : editingItem ? t('menu.save_changes', 'Save Changes') : t('menu.add_item')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
