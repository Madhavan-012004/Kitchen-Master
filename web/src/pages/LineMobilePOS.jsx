import React, { useState } from 'react';
import useLinePOS, { getDisplayBillNumber } from './useLinePOS.js';
import BillSuccessModal from '../components/BillSuccessModal.jsx';
import { shareViaWhatsApp, shareViaSMS } from '../utils/billSharer.js';
import './LinePOS.css';

const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

// ── Mobile Shops Tab ────────────────────────────────────────────────────────
function ShopsTab({ pos, onSelectShop }) {
    return (
        <div className="lpos-mobile-tab-content">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                    className="lpos-search"
                    style={{ flex: 1 }}
                    placeholder="Search by name, phone, area…"
                    value={pos.shopSearch}
                    onChange={e => pos.setShopSearch(e.target.value)}
                />
                <button className="lpos-add-btn" onClick={() => pos.setShowAddShop(true)}>+</button>
            </div>
            {pos.selectedShop && (
                <div className="lpos-selected-shop-banner" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div>
                            <h4 style={{ margin: 0 }}>✓ Selected: {pos.selectedShop.name}</h4>
                            <p style={{ margin: 0 }}>{pos.selectedShop.phone}</p>
                        </div>
                        <button
                            type="button"
                            className="lpos-unselect-btn"
                            onClick={() => pos.setSelectedShop(null)}
                            style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >✕ Unselect</button>
                    </div>
                    <button
                        className="primary-btn"
                        style={{ marginTop: 6, width: '100%', fontSize: 12, padding: 6 }}
                        onClick={onSelectShop}
                    >
                        Proceed to Items →
                    </button>
                </div>
            )}
            {pos.shopsLoading ? <div className="lpos-spinner" /> : (
                pos.filteredShops.length === 0
                    ? <div className="lpos-empty-state">No shops found</div>
                    : pos.filteredShops.map(shop => {
                        const shopId = shop.id || shop._id;
                        const selectedId = pos.selectedShop?.id || pos.selectedShop?._id;
                        const isSelected = !!selectedId && !!shopId && String(selectedId) === String(shopId);
                        return (
                            <div
                                key={shopId}
                                className={`lpos-shop-item ${isSelected ? 'active' : ''}`}
                                onClick={() => {
                                    if (isSelected) {
                                        pos.setSelectedShop(null);
                                    } else {
                                        pos.setSelectedShop(shop);
                                        onSelectShop();
                                    }
                                }}
                                style={{ marginBottom: 6 }}
                            >
                                <div className="lpos-shop-avatar">{initials(shop.name)}</div>
                                <div className="lpos-shop-info">
                                    <div className="lpos-shop-name">{shop.name}</div>
                                    <div className="lpos-shop-sub">
                                        {shop.phone}
                                        {(shop.area || shop.address || (shop.email?.startsWith('area:') ? shop.email.slice(5) : null)) && (
                                            ` · ${shop.area || shop.address || shop.email.slice(5)}`
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
            )}
        </div>
    );
}

// ── Mobile Items Tab ────────────────────────────────────────────────────────
function ItemsTab({ pos, onGoToShops }) {
    if (!pos.selectedShop) {
        return (
            <div className="lpos-mobile-tab-content">
                <div className="lpos-shop-locked-state">
                    <div className="lpos-lock-icon">🏪</div>
                    <h3>Please Select a Shop First</h3>
                    <p>You must select a shop to start adding items to the cart.</p>
                    <button className="lpos-bill-btn" style={{ marginTop: 12 }} onClick={onGoToShops}>
                        👈 Select a Shop
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="lpos-mobile-tab-content">
            {/* Frequently Bought Quick-Add Chips Strip */}
            {pos.frequentItems.length > 0 && (
                <div className="lpos-freq-standalone-strip" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '4px 8px', background: 'var(--lpos-surface2)', borderRadius: '8px', border: '1px solid var(--lpos-border)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lpos-muted)', flexShrink: 0 }}>⭐ Frequent:</span>
                    <div className="freq-chips" style={{ display: 'flex', gap: 4, overflowX: 'auto', flex: 1, whiteSpace: 'nowrap' }}>
                        {pos.frequentItems.map(fi => (
                            <button
                                key={fi.name}
                                className="lpos-freq-chip-compact"
                                onClick={() => {
                                    const found = pos.inventory.find(i =>
                                        i.name?.toLowerCase() === fi.name?.toLowerCase()
                                    );
                                    if (found) pos.addToCart(found);
                                }}
                            >
                                + {fi.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Single Row Integrated Category & Storage Location Filter Bar */}
            <div className="lpos-integrated-filter-row">
                <div className="lpos-cat-scroll">
                    {pos.categories.map(cat => (
                        <button
                            key={cat}
                            className={`lpos-cat-chip ${pos.selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => pos.setSelectedCategory(cat)}
                        >{cat}</button>
                    ))}
                </div>
                <select
                    className="lpos-location-select-mobile"
                    value={pos.selectedLocation}
                    onChange={(e) => pos.setSelectedLocation(e.target.value)}
                >
                    {pos.locations.map(loc => (
                        <option key={loc} value={loc}>📍 {loc}</option>
                    ))}
                </select>
            </div>

            {pos.inventoryLoading
                ? <div className="lpos-spinner" />
                : (
                    <div className="lpos-item-grid-mobile">
                        {pos.filteredInventory.length === 0
                            ? <div className="lpos-empty-state" style={{ gridColumn: '1/-1' }}>
                                No items found.
                            </div>
                            : pos.filteredInventory.map(item => {
                                return (
                                    <div
                                        key={item.id}
                                        className="lpos-item-card"
                                        onClick={() => pos.addToCart(item)}
                                    >
                                        {item.image
                                            ? <img className="lpos-item-img" src={item.image} alt={item.name} />
                                            : <div className="lpos-item-img-placeholder">📦</div>
                                        }
                                        <span className="lpos-item-name">{item.name}</span>
                                    </div>
                                );
                            })
                        }
                    </div>
                )
            }
        </div>
    );
}

// ── Mobile Cart Tab ─────────────────────────────────────────────────────────
function CartTab({ pos, onGoToShops }) {
    if (!pos.selectedShop) {
        return (
            <div className="lpos-mobile-tab-content">
                <div className="lpos-shop-locked-state">
                    <div className="lpos-lock-icon">🏪</div>
                    <h3>Please Select a Shop First</h3>
                    <p>Select a shop before proceeding to cart & checkout.</p>
                    <button className="lpos-bill-btn" style={{ marginTop: 12 }} onClick={onGoToShops}>
                        👈 Select a Shop
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="lpos-mobile-tab-content">
            {pos.cart.length === 0 ? (
                <div className="lpos-empty-state">Cart is empty. Go to Items to add products.</div>
            ) : (
                <>
                    {pos.cart.map(item => {
                        const isRet = item.itemType === 'RETURN' || item.isReturn;
                        const isFr = item.itemType === 'FREE' || item.isFree;
                        const itemType = item.itemType || (isRet ? 'RETURN' : isFr ? 'FREE' : 'SALE');

                        const lineTotal = isFr ? 0 : item.price * item.qty * (isRet ? -1 : 1);
                        const hasDiscount = !isFr && item.standardPrice != null && item.price < item.standardPrice;
                        const diffPerUnit = hasDiscount ? (item.standardPrice - item.price) : 0;
                        return (
                            <div key={item.cartId} className={`lpos-cart-item ${isRet ? 'return-row' : ''} ${isFr ? 'free-row' : ''}`} style={{ marginBottom: 8 }}>
                                <div className="lpos-cart-item-top">
                                    <span className="lpos-cart-item-name">
                                        {isRet && <span className="lpos-badge-icon return">↩ RETURN</span>}
                                        {isFr && <span className="lpos-badge-icon free">🎁 FREE</span>}
                                        {!isRet && !isFr && <span className="lpos-badge-icon sale">🏷️ SALE</span>}
                                        &nbsp;{item.name}
                                    </span>
                                    <span className={`lpos-cart-item-price ${isRet ? 'negative' : ''} ${isFr ? 'free-tag' : ''}`}>
                                        {isFr ? 'FREE' : currency(lineTotal)}
                                    </span>
                                    <button className="lpos-cart-remove" onClick={() => pos.removeFromCart(item.cartId)}>✕</button>
                                </div>

                                {/* Segmented Type Selector (SALE / RETURN / FREE) */}
                                <div className="lpos-cart-type-selector">
                                    <button
                                        className={`lpos-type-btn sale ${itemType === 'SALE' ? 'active' : ''}`}
                                        onClick={() => pos.updateItemType(item.cartId, 'SALE')}
                                    >
                                        🏷️ Sale
                                    </button>
                                    <button
                                        className={`lpos-type-btn return ${itemType === 'RETURN' ? 'active' : ''}`}
                                        onClick={() => pos.updateItemType(item.cartId, 'RETURN')}
                                    >
                                        ↩ Return
                                    </button>
                                    <button
                                        className={`lpos-type-btn free ${itemType === 'FREE' ? 'active' : ''}`}
                                        onClick={() => pos.updateItemType(item.cartId, 'FREE')}
                                    >
                                        🎁 Free
                                    </button>
                                </div>

                                {/* Editable Unit Price & Savings Badge */}
                                {!isFr && (
                                    <div className="lpos-cart-price-edit-row">
                                        <label className="lpos-price-label">Rate ₹</label>
                                        <input
                                            className="lpos-unit-price-input"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.price}
                                            onChange={e => pos.updateUnitPrice(item.cartId, e.target.value)}
                                            title="Edit unit price for this customer"
                                        />
                                        {hasDiscount && (
                                            <span className="lpos-price-savings-tag" title={`Standard retail price: ₹${item.standardPrice}`}>
                                                Std ₹{item.standardPrice} (Saved ₹{diffPerUnit.toFixed(2)}/unit)
                                            </span>
                                        )}
                                    </div>
                                )}
                                {isFr && (
                                    <div className="lpos-cart-price-edit-row">
                                        <span className="lpos-free-notice">🎁 Sample / Free Item — Price set to ₹0.00</span>
                                    </div>
                                )}

                                <div className="lpos-cart-item-controls">
                                    <button className="lpos-qty-btn" onClick={() => pos.updateQty(item.cartId, item.qty - 1)}>−</button>
                                    <input
                                        className="lpos-qty-val"
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={e => pos.updateQty(item.cartId, parseInt(e.target.value) || 1)}
                                    />
                                    <button className="lpos-qty-btn" onClick={() => pos.updateQty(item.cartId, item.qty + 1)}>+</button>

                                    {itemType === 'SALE' && (
                                        <button
                                            className="lpos-add-line-btn return"
                                            onClick={() => pos.addSpecificCartLine(item, 'RETURN')}
                                            title="Add a Return line for this product"
                                        >
                                            + ↩ Return
                                        </button>
                                    )}
                                    {itemType === 'SALE' && (
                                        <button
                                            className="lpos-add-line-btn free"
                                            onClick={() => pos.addSpecificCartLine(item, 'FREE')}
                                            title="Add a Free Sample line for this product"
                                        >
                                            + 🎁 Free
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <hr className="lpos-divider" />
                    <div className="lpos-total-row"><span>Subtotal</span><span>{currency(pos.subtotal)}</span></div>
                    <div className="lpos-discount-row">
                        <label>Discount ₹</label>
                        <input
                            className="lpos-discount-input"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={pos.discount}
                            onChange={e => pos.setDiscount(e.target.value)}
                        />
                    </div>
                    <div className="lpos-total-row grand"><span>Total</span><span>{currency(pos.grandTotal)}</span></div>

                    <div className="lpos-payment-row" style={{ marginTop: 12 }}>
                        {['Cash', 'UPI', 'Credit'].map(m => (
                            <button key={m} className={`lpos-pay-btn ${pos.paymentMethod === m ? 'active' : ''}`} onClick={() => pos.setPaymentMethod(m)}>
                                {m === 'Cash' ? '💵' : m === 'UPI' ? '📱' : '🏦'} {m}
                            </button>
                        ))}
                    </div>

                    <button
                        className="lpos-bill-btn"
                        onClick={pos.submitBill}
                        disabled={pos.billingLoading || !pos.cart.length}
                    >
                        {pos.billingLoading ? '⏳ Saving…' : `💾 Save & Print ${currency(pos.grandTotal)}`}
                    </button>
                    <button className="lpos-clear-btn" onClick={pos.clearCart}>Clear Cart</button>
                </>
            )}
        </div>
    );
}

// ── Mobile History Tab ──────────────────────────────────────────────────────
function HistoryTab({ pos }) {
    if (!pos.selectedShop) {
        return <div className="lpos-empty-state" style={{ padding: 40 }}>Select a shop first to view purchase history.</div>;
    }
    return (
        <div className="lpos-mobile-tab-content">
            <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{pos.selectedShop.name}</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{pos.selectedShop.phone}</div>
            </div>

            {pos.historyLoading ? <div className="lpos-spinner" /> : (
                <>
                    {pos.frequentItems.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', marginBottom: 8 }}>⭐ Frequently Bought</div>
                            {pos.frequentItems.map(fi => (
                                <span
                                    key={fi.name}
                                    className="lpos-freq-chip"
                                    onClick={() => {
                                        const found = pos.inventory.find(i => i.name?.toLowerCase() === fi.name?.toLowerCase());
                                        if (found) pos.addToCart(found);
                                    }}
                                >
                                    {fi.name} <span className="lpos-freq-count">×{fi.count}</span>
                                </span>
                            ))}
                        </div>
                    )}
                    {pos.purchaseHistory.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>📜 All Purchase Bills ({pos.purchaseHistory.length})</span>
                                <span style={{ fontSize: 10, textTransform: 'none', color: '#6e7681' }}>Newest to Oldest</span>
                            </div>
                            {pos.purchaseHistory.map((order, oIdx) => {
                                const billNum = getDisplayBillNumber(order, pos.purchaseHistory);
                                const dateStr = order.createdAt
                                    ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                    : 'Recent Transaction';
                                const itemsList = order.items || order.orderItems || [];
                                const billTotal = order.total ?? order.grandTotal ?? 0;

                                return (
                                    <div key={order._id || order.id || oIdx} className="lpos-hist-order-card" style={{ marginBottom: 14 }}>
                                        <div className="lpos-hist-card-head">
                                            <div className="lpos-hist-card-left">
                                                <span className="lpos-hist-bill-badge">🧾 {billNum}</span>
                                                <span className="lpos-hist-card-date">📅 {dateStr}</span>
                                            </div>
                                            <div className="lpos-hist-card-total">{currency(billTotal)}</div>
                                        </div>

                                        <div className="lpos-hist-card-items">
                                            {itemsList.map((it, idx) => {
                                                const isRet = it.itemType === 'RETURN' || it.isReturn || (it.name && it.name.includes('(Return)'));
                                                const isFr = it.itemType === 'FREE' || it.isFree || (it.name && it.name.includes('(Free)'));
                                                const cleanName = (it.name || it.itemName || 'Item').replace(' (Return)', '').replace(' (Free)', '');
                                                return (
                                                    <div key={idx} className="lpos-hist-item-row">
                                                        <span className="lpos-hist-item-name">
                                                            {isRet && <span className="lpos-badge-icon return">↩ RET</span>}
                                                            {isFr && <span className="lpos-badge-icon free">🎁 FREE</span>}
                                                            &nbsp;{cleanName}
                                                        </span>
                                                        <span className="lpos-hist-item-qty">×{Math.abs(it.quantity || 1)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="lpos-hist-share-actions">
                                            <button
                                                className="lpos-mini-share-btn whatsapp"
                                                onClick={() => shareViaWhatsApp(pos.selectedShop?.phone, order)}
                                            >
                                                📱 Share WhatsApp
                                            </button>
                                            <button
                                                className="lpos-mini-share-btn sms"
                                                onClick={() => shareViaSMS(pos.selectedShop?.phone, order)}
                                            >
                                                💬 Share SMS
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {pos.purchaseHistory.length === 0 && pos.frequentItems.length === 0 && (
                        <div className="lpos-empty-state">No purchase history for this shop.</div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Add Shop Modal (reusable) ──────────────────────────────────────────────
function AddShopModal({ newShop, setNewShop, onSave, onClose }) {
    return (
        <div className="lpos-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="lpos-modal">
                <h3>➕ Add New Shop</h3>
                {[
                    { label: 'Shop Name *', key: 'name', placeholder: 'e.g. Ravi Stores' },
                    { label: 'Phone *', key: 'phone', placeholder: '9876543210', type: 'tel' },
                    { label: 'Area / Location', key: 'area', placeholder: 'e.g. Anna Nagar' },
                ].map(f => (
                    <div className="lpos-modal-field" key={f.key}>
                        <label>{f.label}</label>
                        <input
                            className="lpos-modal-input"
                            type={f.type || 'text'}
                            placeholder={f.placeholder}
                            value={newShop[f.key]}
                            onChange={e => setNewShop(prev => ({ ...prev, [f.key]: e.target.value }))}
                        />
                    </div>
                ))}
                <div className="lpos-modal-actions">
                    <button className="secondary-btn" onClick={onClose}>Cancel</button>
                    <button className="primary-btn" onClick={onSave}>Add Shop</button>
                </div>
            </div>
        </div>
    );
}

// ── Main Mobile Component ───────────────────────────────────────────────────
export default function LineMobilePOS() {
    const pos = useLinePOS();
    const [activeTab, setActiveTab] = useState('shops');

    const TABS = [
        { id: 'shops', icon: '🏪', label: 'Shops' },
        { id: 'items', icon: '📦', label: 'Items' },
        { id: 'cart', icon: '🛒', label: 'Cart' },
        { id: 'history', icon: '📋', label: 'History' },
    ];

    return (
        <div className="lpos-mobile-root">
            {/* Header */}
            <div className="lpos-header">
                <div className="lpos-header-logo">🚚</div>
                <div className="lpos-header-title">
                    Distributor POS
                    <span>{pos.selectedShop ? `Shop: ${pos.selectedShop.name}` : 'Select a shop'}</span>
                </div>
            </div>

            {/* Top Segmented Navigation Bar */}
            <div className="lpos-top-nav-segmented">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`lpos-top-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="nav-icon">{tab.icon}</span>
                        <span className="nav-label">{tab.label}</span>
                        {tab.id === 'cart' && pos.cart.length > 0 && (
                            <span className="lpos-cart-badge">{pos.cart.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="lpos-mobile-content">
                {activeTab === 'shops' && <ShopsTab pos={pos} onSelectShop={() => setActiveTab('items')} />}
                {activeTab === 'items' && <ItemsTab pos={pos} onGoToShops={() => setActiveTab('shops')} />}
                {activeTab === 'cart' && <CartTab pos={pos} onGoToShops={() => setActiveTab('shops')} />}
                {activeTab === 'history' && <HistoryTab pos={pos} onGoToShops={() => setActiveTab('shops')} />}
            </div>

            {/* Add Shop Modal */}
            {pos.showAddShop && (
                <AddShopModal
                    newShop={pos.newShop}
                    setNewShop={pos.setNewShop}
                    onSave={pos.addShop}
                    onClose={() => pos.setShowAddShop(false)}
                />
            )}

            {/* Bill Success Modal with WhatsApp & SMS Sharing */}
            {pos.billResult && (
                <BillSuccessModal
                    order={pos.billResult}
                    shopPhone={pos.selectedShop?.phone}
                    onClose={() => pos.setBillResult(null)}
                />
            )}

            {/* Toast */}
            {pos.toast && (
                <div className={`lpos-toast ${pos.toast.type}`}>
                    {pos.toast.type === 'success' ? '✅' : '❌'} {pos.toast.msg}
                </div>
            )}
        </div>
    );
}
