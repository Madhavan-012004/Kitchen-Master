import React, { useState, useEffect, useCallback } from 'react'
import {
    getClothingProducts, createClothingProduct, updateClothingProduct, deleteClothingProduct,
    getVariantsForProduct, createClothingVariant, updateClothingVariant,
    restockVariant, transferVariant, getClothingStats
} from '../api/clothing.js'
import './ClothingStock.css'

const MATERIAL_TYPES = ['Premium', 'Party', 'Casual', 'Formal', 'Ethnic', 'Sportswear', 'Kids', 'Other']

const statusColor = (v) => {
    if (v.mainStock <= 0) return '#ef4444'
    if (v.isLowStock || v.mainStock <= v.lowStockThreshold) return '#f59e0b'
    return '#22c55e'
}

export default function ClothingStock() {
    const [products, setProducts] = useState([])
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [variants, setVariants] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState(null)

    // Modals
    const [showAddProduct, setShowAddProduct] = useState(false)
    const [showEditProduct, setShowEditProduct] = useState(null)
    const [showAddVariant, setShowAddVariant] = useState(false)
    const [showRestock, setShowRestock] = useState(null)
    const [showTransfer, setShowTransfer] = useState(null)

    // Forms
    const [productForm, setProductForm] = useState({ brand: '', materialType: 'Casual', description: '', basePrice: '', gstPercent: 5, hsnCode: '' })
    const [variantForm, setVariantForm] = useState({ color: '', size: '', sellingPrice: '', costPrice: '', mainStock: 0, subStock: 0, lowStockThreshold: 2, barcode: '' })
    const [restockForm, setRestockForm] = useState({ quantity: 1, target: 'main' })
    const [transferForm, setTransferForm] = useState({ quantity: 1 })

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const loadProducts = useCallback(async () => {
        try {
            const [pRes, sRes] = await Promise.all([getClothingProducts(), getClothingStats()])
            setProducts(pRes.data?.data || [])
            setStats(sRes.data?.data || {})
        } catch (e) {
            showToast('Failed to load products', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    const loadVariants = useCallback(async (product) => {
        if (!product) return
        try {
            const res = await getVariantsForProduct(product._id)
            setVariants(res.data?.data || [])
        } catch (e) {
            showToast('Failed to load variants', 'error')
        }
    }, [])

    useEffect(() => { loadProducts() }, [loadProducts])
    useEffect(() => { loadVariants(selectedProduct) }, [selectedProduct, loadVariants])

    const handleSelectProduct = (p) => {
        setSelectedProduct(p)
        setVariants([])
    }

    // ── Product CRUD ──────────────────────────────────────────────────────────
    const handleAddProduct = async (e) => {
        e.preventDefault()
        try {
            await createClothingProduct(productForm)
            setShowAddProduct(false)
            setProductForm({ brand: '', materialType: 'Casual', description: '', basePrice: '', gstPercent: 5, hsnCode: '' })
            loadProducts()
            showToast('Product added successfully!')
        } catch (err) { showToast('Failed to add product', 'error') }
    }

    const handleUpdateProduct = async (e) => {
        e.preventDefault()
        try {
            await updateClothingProduct(showEditProduct._id, productForm)
            setShowEditProduct(null)
            loadProducts()
            showToast('Product updated!')
        } catch (err) { showToast('Failed to update product', 'error') }
    }

    const handleDeleteProduct = async (p) => {
        if (!window.confirm(`Deactivate "${p.brand} - ${p.materialType}"?`)) return
        try {
            await deleteClothingProduct(p._id)
            if (selectedProduct?._id === p._id) setSelectedProduct(null)
            loadProducts()
            showToast('Product deactivated')
        } catch (err) { showToast('Failed to delete', 'error') }
    }

    const openEditProduct = (p) => {
        setProductForm({ brand: p.brand, materialType: p.materialType, description: p.description || '', basePrice: p.basePrice || '', gstPercent: p.gstPercent || 5, hsnCode: p.hsnCode || '' })
        setShowEditProduct(p)
    }

    // ── Variant CRUD ──────────────────────────────────────────────────────────
    const handleAddVariant = async (e) => {
        e.preventDefault()
        try {
            await createClothingVariant(selectedProduct._id, variantForm)
            setShowAddVariant(false)
            setVariantForm({ color: '', size: '', sellingPrice: '', costPrice: '', mainStock: 0, subStock: 0, lowStockThreshold: 2, barcode: '' })
            loadVariants(selectedProduct)
            loadProducts()
            showToast('Variant added!')
        } catch (err) { showToast('Failed to add variant', 'error') }
    }

    const handleRestock = async (e) => {
        e.preventDefault()
        try {
            await restockVariant(showRestock._id, restockForm)
            setShowRestock(null)
            loadVariants(selectedProduct)
            showToast(`Restocked ${restockForm.quantity} units to ${restockForm.target} stock`)
        } catch (err) { showToast('Restock failed', 'error') }
    }

    const handleTransfer = async (e) => {
        e.preventDefault()
        try {
            await transferVariant(showTransfer._id, transferForm)
            setShowTransfer(null)
            loadVariants(selectedProduct)
            showToast(`Transferred ${transferForm.quantity} units to main stock`)
        } catch (err) { showToast('Transfer failed', 'error') }
    }

    const filteredProducts = products.filter(p =>
        p.brand?.toLowerCase().includes(search.toLowerCase()) ||
        p.materialType?.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return (
        <div className="cs-loading">
            <div className="cs-spinner" />
            <span>Loading Clothing Stock...</span>
        </div>
    )

    return (
        <div className="cs-root">
            {/* TOAST */}
            {toast && <div className={`cs-toast cs-toast--${toast.type}`}>{toast.msg}</div>}

            {/* HEADER */}
            <div className="cs-header">
                <div className="cs-header-left">
                    <h1 className="cs-title">👗 Clothing Stock</h1>
                    <p className="cs-subtitle">Manage brands, material types, colors and sizes</p>
                </div>
                <div className="cs-stats-bar">
                    <div className="cs-stat">
                        <span className="cs-stat-val">{stats.totalProducts || 0}</span>
                        <span className="cs-stat-label">Products</span>
                    </div>
                    <div className="cs-stat">
                        <span className="cs-stat-val">{stats.totalVariants || 0}</span>
                        <span className="cs-stat-label">Variants</span>
                    </div>
                    <div className={`cs-stat ${stats.lowStockCount > 0 ? 'cs-stat--warn' : ''}`}>
                        <span className="cs-stat-val">{stats.lowStockCount || 0}</span>
                        <span className="cs-stat-label">Low Stock</span>
                    </div>
                </div>
            </div>

            <div className="cs-body">
                {/* LEFT: Products Panel */}
                <div className="cs-products-panel">
                    <div className="cs-panel-header">
                        <input
                            className="cs-search"
                            type="text"
                            placeholder="🔍 Search brand or type..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <button className="cs-btn cs-btn--primary" onClick={() => setShowAddProduct(true)}>+ Product</button>
                    </div>

                    <div className="cs-products-list">
                        {filteredProducts.length === 0 && (
                            <div className="cs-empty">
                                <span className="cs-empty-icon">👗</span>
                                <p>No clothing products yet.</p>
                                <button className="cs-btn cs-btn--primary" onClick={() => setShowAddProduct(true)}>Add First Product</button>
                            </div>
                        )}
                        {filteredProducts.map(p => (
                            <div
                                key={p._id}
                                className={`cs-product-card ${selectedProduct?._id === p._id ? 'cs-product-card--selected' : ''}`}
                                onClick={() => handleSelectProduct(p)}
                            >
                                <div className="cs-product-icon">👗</div>
                                <div className="cs-product-info">
                                    <div className="cs-product-brand">{p.brand}</div>
                                    <div className="cs-product-type">{p.materialType}</div>
                                    {p.hsnCode && <div className="cs-product-hsn">HSN: {p.hsnCode}</div>}
                                </div>
                                <div className="cs-product-actions">
                                    <button className="cs-icon-btn" title="Edit" onClick={e => { e.stopPropagation(); openEditProduct(p) }}>✏️</button>
                                    <button className="cs-icon-btn cs-icon-btn--danger" title="Deactivate" onClick={e => { e.stopPropagation(); handleDeleteProduct(p) }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Variants Panel */}
                <div className="cs-variants-panel">
                    {!selectedProduct ? (
                        <div className="cs-no-selection">
                            <span>👈</span>
                            <p>Select a product to manage its variants</p>
                        </div>
                    ) : (
                        <>
                            <div className="cs-panel-header">
                                <div>
                                    <h2 className="cs-variants-title">{selectedProduct.brand} — {selectedProduct.materialType}</h2>
                                    <p className="cs-variants-subtitle">{variants.length} variant{variants.length !== 1 ? 's' : ''}</p>
                                </div>
                                <button className="cs-btn cs-btn--primary" onClick={() => setShowAddVariant(true)}>+ Add Variant</button>
                            </div>

                            <div className="cs-variants-grid">
                                {variants.length === 0 && (
                                    <div className="cs-empty" style={{ gridColumn: '1/-1' }}>
                                        <span className="cs-empty-icon">🎨</span>
                                        <p>No variants yet. Add colors and sizes!</p>
                                    </div>
                                )}
                                {variants.map(v => (
                                    <div
                                        key={v._id}
                                        className={`cs-variant-card ${v.mainStock <= 0 ? 'cs-variant-card--oos' : (v.mainStock <= v.lowStockThreshold ? 'cs-variant-card--low' : '')}`}
                                    >
                                        <div className="cs-variant-header">
                                            <div className="cs-color-dot" style={{ background: colorToCSS(v.color) }} title={v.color} />
                                            <span className="cs-variant-color">{v.color}</span>
                                            <span className="cs-size-badge">{v.size || 'OS'}</span>
                                        </div>
                                        <div className="cs-variant-stocks">
                                            <div className="cs-stock-item">
                                                <span className="cs-stock-label">Main</span>
                                                <span className="cs-stock-val" style={{ color: statusColor(v) }}>{v.mainStock}</span>
                                            </div>
                                            <div className="cs-stock-divider" />
                                            <div className="cs-stock-item">
                                                <span className="cs-stock-label">Sub</span>
                                                <span className="cs-stock-val cs-stock-sub">{v.subStock}</span>
                                            </div>
                                        </div>
                                        <div className="cs-variant-price">₹{v.sellingPrice?.toLocaleString('en-IN')}</div>
                                        {v.sku && <div className="cs-variant-sku">{v.sku}</div>}
                                        {(v.mainStock <= v.lowStockThreshold && v.mainStock > 0) && (
                                            <div className="cs-low-badge">⚠️ Low Stock</div>
                                        )}
                                        {v.mainStock <= 0 && <div className="cs-oos-badge">🔴 Out of Stock</div>}
                                        <div className="cs-variant-actions">
                                            <button
                                                className="cs-action-btn"
                                                onClick={() => { setShowRestock(v); setRestockForm({ quantity: 1, target: 'main' }) }}
                                            >
                                                📦 Restock
                                            </button>
                                            <button
                                                className="cs-action-btn cs-action-btn--transfer"
                                                onClick={() => { setShowTransfer(v); setTransferForm({ quantity: 1 }) }}
                                            >
                                                ↗ Transfer
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ADD PRODUCT MODAL */}
            {showAddProduct && (
                <div className="cs-modal-overlay" onClick={() => setShowAddProduct(false)}>
                    <div className="cs-modal" onClick={e => e.stopPropagation()}>
                        <h2 className="cs-modal-title">Add New Product</h2>
                        <form onSubmit={handleAddProduct} className="cs-form">
                            <div className="cs-form-row">
                                <label className="cs-label">Brand Name *</label>
                                <input
                                    className="cs-input"
                                    required
                                    value={productForm.brand}
                                    onChange={e => setProductForm(f => ({ ...f, brand: e.target.value }))}
                                    placeholder="e.g. AAVASA, Raymond"
                                />
                            </div>
                            <div className="cs-form-row">
                                <label className="cs-label">Material / Category *</label>
                                <select
                                    className="cs-input"
                                    required
                                    value={productForm.materialType}
                                    onChange={e => setProductForm(f => ({ ...f, materialType: e.target.value }))}
                                >
                                    {MATERIAL_TYPES.map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="cs-form-row">
                                <label className="cs-label">Description</label>
                                <textarea
                                    className="cs-input cs-textarea"
                                    value={productForm.description}
                                    onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Optional product description"
                                    rows={2}
                                />
                            </div>
                            <div className="cs-form-grid-2">
                                <div className="cs-form-row">
                                    <label className="cs-label">Base Price (₹)</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        value={productForm.basePrice}
                                        onChange={e => setProductForm(f => ({ ...f, basePrice: e.target.value }))}
                                    />
                                </div>
                                <div className="cs-form-row">
                                    <label className="cs-label">GST %</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        value={productForm.gstPercent}
                                        onChange={e => setProductForm(f => ({ ...f, gstPercent: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="cs-form-row">
                                <label className="cs-label">HSN Code</label>
                                <input
                                    className="cs-input"
                                    value={productForm.hsnCode}
                                    onChange={e => setProductForm(f => ({ ...f, hsnCode: e.target.value }))}
                                    placeholder="e.g. 6205"
                                />
                            </div>
                            <div className="cs-modal-actions">
                                <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setShowAddProduct(false)}>Cancel</button>
                                <button type="submit" className="cs-btn cs-btn--primary">Add Product</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT PRODUCT MODAL */}
            {showEditProduct && (
                <div className="cs-modal-overlay" onClick={() => setShowEditProduct(null)}>
                    <div className="cs-modal" onClick={e => e.stopPropagation()}>
                        <h2 className="cs-modal-title">Edit Product</h2>
                        <form onSubmit={handleUpdateProduct} className="cs-form">
                            <div className="cs-form-row">
                                <label className="cs-label">Brand Name *</label>
                                <input
                                    className="cs-input"
                                    required
                                    value={productForm.brand}
                                    onChange={e => setProductForm(f => ({ ...f, brand: e.target.value }))}
                                />
                            </div>
                            <div className="cs-form-row">
                                <label className="cs-label">Material / Category *</label>
                                <select
                                    className="cs-input"
                                    value={productForm.materialType}
                                    onChange={e => setProductForm(f => ({ ...f, materialType: e.target.value }))}
                                >
                                    {MATERIAL_TYPES.map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="cs-form-grid-2">
                                <div className="cs-form-row">
                                    <label className="cs-label">Base Price (₹)</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        value={productForm.basePrice}
                                        onChange={e => setProductForm(f => ({ ...f, basePrice: e.target.value }))}
                                    />
                                </div>
                                <div className="cs-form-row">
                                    <label className="cs-label">GST %</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        value={productForm.gstPercent}
                                        onChange={e => setProductForm(f => ({ ...f, gstPercent: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="cs-modal-actions">
                                <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setShowEditProduct(null)}>Cancel</button>
                                <button type="submit" className="cs-btn cs-btn--primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD VARIANT MODAL */}
            {showAddVariant && (
                <div className="cs-modal-overlay" onClick={() => setShowAddVariant(false)}>
                    <div className="cs-modal cs-modal--wide" onClick={e => e.stopPropagation()}>
                        <h2 className="cs-modal-title">Add Variant to {selectedProduct?.brand} — {selectedProduct?.materialType}</h2>
                        <form onSubmit={handleAddVariant} className="cs-form">
                            <div className="cs-form-grid-2">
                                <div className="cs-form-row">
                                    <label className="cs-label">Color *</label>
                                    <input
                                        className="cs-input"
                                        required
                                        value={variantForm.color}
                                        onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))}
                                        placeholder="e.g. Red, Navy Blue"
                                    />
                                </div>
                                <div className="cs-form-row">
                                    <label className="cs-label">Size</label>
                                    <input
                                        className="cs-input"
                                        value={variantForm.size}
                                        onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))}
                                        placeholder="e.g. S, M, L, XL, 38"
                                    />
                                </div>
                            </div>
                            <div className="cs-form-grid-2">
                                <div className="cs-form-row">
                                    <label className="cs-label">Selling Price (₹) *</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        required
                                        value={variantForm.sellingPrice}
                                        onChange={e => setVariantForm(f => ({ ...f, sellingPrice: e.target.value }))}
                                    />
                                </div>
                                <div className="cs-form-row">
                                    <label className="cs-label">Cost Price (₹)</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        value={variantForm.costPrice}
                                        onChange={e => setVariantForm(f => ({ ...f, costPrice: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="cs-form-grid-3">
                                <div className="cs-form-row">
                                    <label className="cs-label">Main Stock</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        min={0}
                                        value={variantForm.mainStock}
                                        onChange={e => setVariantForm(f => ({ ...f, mainStock: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="cs-form-row">
                                    <label className="cs-label">Sub Stock</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        min={0}
                                        value={variantForm.subStock}
                                        onChange={e => setVariantForm(f => ({ ...f, subStock: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="cs-form-row">
                                    <label className="cs-label">Low Stock Alert</label>
                                    <input
                                        type="number"
                                        className="cs-input"
                                        min={0}
                                        value={variantForm.lowStockThreshold}
                                        onChange={e => setVariantForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 2 }))}
                                    />
                                </div>
                            </div>
                            <div className="cs-form-row">
                                <label className="cs-label">Barcode (optional)</label>
                                <input
                                    className="cs-input"
                                    value={variantForm.barcode}
                                    onChange={e => setVariantForm(f => ({ ...f, barcode: e.target.value }))}
                                    placeholder="Leave empty to auto-generate SKU"
                                />
                            </div>
                            <div className="cs-modal-actions">
                                <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setShowAddVariant(false)}>Cancel</button>
                                <button type="submit" className="cs-btn cs-btn--primary">Add Variant</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RESTOCK MODAL */}
            {showRestock && (
                <div className="cs-modal-overlay" onClick={() => setShowRestock(null)}>
                    <div className="cs-modal cs-modal--sm" onClick={e => e.stopPropagation()}>
                        <h2 className="cs-modal-title">📦 Restock Variant</h2>
                        <p className="cs-modal-sub">{showRestock.color} — Size {showRestock.size || 'OS'}</p>
                        <form onSubmit={handleRestock} className="cs-form">
                            <div className="cs-form-row">
                                <label className="cs-label">Quantity to Add</label>
                                <input
                                    type="number"
                                    className="cs-input"
                                    min={1}
                                    required
                                    value={restockForm.quantity}
                                    onChange={e => setRestockForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                                />
                            </div>
                            <div className="cs-form-row">
                                <label className="cs-label">Add to</label>
                                <div className="cs-radio-group">
                                    <label className="cs-radio">
                                        <input type="radio" checked={restockForm.target === 'main'} onChange={() => setRestockForm(f => ({ ...f, target: 'main' }))} />
                                        Main Stock
                                    </label>
                                    <label className="cs-radio">
                                        <input type="radio" checked={restockForm.target === 'sub'} onChange={() => setRestockForm(f => ({ ...f, target: 'sub' }))} />
                                        Sub Stock
                                    </label>
                                </div>
                            </div>
                            <div className="cs-modal-actions">
                                <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setShowRestock(null)}>Cancel</button>
                                <button type="submit" className="cs-btn cs-btn--primary">Restock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TRANSFER MODAL */}
            {showTransfer && (
                <div className="cs-modal-overlay" onClick={() => setShowTransfer(null)}>
                    <div className="cs-modal cs-modal--sm" onClick={e => e.stopPropagation()}>
                        <h2 className="cs-modal-title">↗ Transfer to Main</h2>
                        <p className="cs-modal-sub">{showTransfer.color} — Size {showTransfer.size || 'OS'} | Sub Stock: {showTransfer.subStock}</p>
                        <form onSubmit={handleTransfer} className="cs-form">
                            <div className="cs-form-row">
                                <label className="cs-label">Units to Transfer (Sub → Main)</label>
                                <input
                                    type="number"
                                    className="cs-input"
                                    min={1}
                                    max={showTransfer.subStock}
                                    required
                                    value={transferForm.quantity}
                                    onChange={e => setTransferForm({ quantity: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                            <div className="cs-modal-actions">
                                <button type="button" className="cs-btn cs-btn--ghost" onClick={() => setShowTransfer(null)}>Cancel</button>
                                <button type="submit" className="cs-btn cs-btn--primary">Transfer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// Attempt to interpret color name as CSS color
function colorToCSS(colorName) {
    const map = {
        red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
        black: '#111827', white: '#f9fafb', pink: '#ec4899', purple: '#a855f7',
        orange: '#f97316', brown: '#78350f', grey: '#6b7280', gray: '#6b7280',
        navy: '#1e3a5f', maroon: '#7f1d1d', gold: '#f59e0b', beige: '#d4b896',
        cyan: '#06b6d4', teal: '#14b8a6', indigo: '#6366f1', lime: '#84cc16',
    }
    const key = colorName?.toLowerCase().trim()
    return map[key] || 'var(--accent)'
}
