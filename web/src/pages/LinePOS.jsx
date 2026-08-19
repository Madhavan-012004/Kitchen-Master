import React, { useState } from 'react';
import useLinePOS, { getDisplayBillNumber } from './useLinePOS.js';
import BillSuccessModal from '../components/BillSuccessModal.jsx';
import { shareViaWhatsApp, shareViaSMS } from '../utils/billSharer.js';
import './LinePOS.css';

// ── Helpers ────────────────────────────────────────────────────────────────
const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

// ── Item Card ──────────────────────────────────────────────────────────────
function ItemCard({ item, onAdd }) {
    return (
        <div className="lpos-item-card" onClick={() => onAdd(item)} title={`Add ${item.name}`}>
            {item.image
                ? <img className="lpos-item-img" src={item.image} alt={item.name} />
                : <div className="lpos-item-img-placeholder">📦</div>
            }
            <span className="lpos-item-name">{item.name}</span>
        </div>
    );
}

// ── Cart Row ───────────────────────────────────────────────────────────────
function CartRow({ item, onQty, onUnitPrice, onUpdateType, onRemove, onAddSpecific }) {
    const isRet = item.itemType === 'RETURN' || item.isReturn;
    const isFr = item.itemType === 'FREE' || item.isFree;
    const itemType = item.itemType || (isRet ? 'RETURN' : isFr ? 'FREE' : 'SALE');

    const lineTotal = isFr ? 0 : item.price * item.qty * (isRet ? -1 : 1);
    const hasDiscount = !isFr && item.standardPrice != null && item.price < item.standardPrice;
    const diffPerUnit = hasDiscount ? (item.standardPrice - item.price) : 0;

    return (
        <div className={`lpos-cart-item ${isRet ? 'return-row' : ''} ${isFr ? 'free-row' : ''}`}>
            <div className="lpos-cart-item-top">
                <span className="lpos-cart-item-name" title={item.name}>
                    {isRet && <span className="lpos-badge-icon return">↩ RETURN</span>}
                    {isFr && <span className="lpos-badge-icon free">🎁 FREE</span>}
                    {!isRet && !isFr && <span className="lpos-badge-icon sale">🏷️ SALE</span>}
                    &nbsp;{item.name}
                </span>
                <span className={`lpos-cart-item-price ${isRet ? 'negative' : ''} ${isFr ? 'free-tag' : ''}`}>
                    {isFr ? 'FREE' : currency(lineTotal)}
                </span>
                <button className="lpos-cart-remove" onClick={() => onRemove(item.cartId)} title="Remove item">✕</button>
            </div>

            {/* Segmented Type Selector (SALE / RETURN / FREE) */}
            <div className="lpos-cart-type-selector">
                <button
                    className={`lpos-type-btn sale ${itemType === 'SALE' ? 'active' : ''}`}
                    onClick={() => onUpdateType(item.cartId, 'SALE')}
                    title="Regular billing sale item"
                >
                    🏷️ Sale
                </button>
                <button
                    className={`lpos-type-btn return ${itemType === 'RETURN' ? 'active' : ''}`}
                    onClick={() => onUpdateType(item.cartId, 'RETURN')}
                    title="Returned item (credited to customer)"
                >
                    ↩ Return
                </button>
                <button
                    className={`lpos-type-btn free ${itemType === 'FREE' ? 'active' : ''}`}
                    onClick={() => onUpdateType(item.cartId, 'FREE')}
                    title="Free / Sample item (₹0 price)"
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
                        onChange={e => onUnitPrice(item.cartId, e.target.value)}
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
                <button className="lpos-qty-btn" onClick={() => onQty(item.cartId, item.qty - 1)}>−</button>
                <input
                    className="lpos-qty-val"
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={e => onQty(item.cartId, parseInt(e.target.value) || 1)}
                />
                <button className="lpos-qty-btn" onClick={() => onQty(item.cartId, item.qty + 1)}>+</button>

                {/* Quick Add Companion Line Buttons */}
                {onAddSpecific && itemType === 'SALE' && (
                    <button
                        className="lpos-add-line-btn return"
                        onClick={() => onAddSpecific(item, 'RETURN')}
                        title="Add a Return line for this product"
                    >
                        + ↩ Return
                    </button>
                )}
                {onAddSpecific && itemType === 'SALE' && (
                    <button
                        className="lpos-add-line-btn free"
                        onClick={() => onAddSpecific(item, 'FREE')}
                        title="Add a Free Sample line for this product"
                    >
                        + 🎁 Free
                    </button>
                )}
            </div>
        </div>
    );
}

// ── History Drawer ─────────────────────────────────────────────────────────
function HistoryDrawer({ shop, history, frequentItems, loading, onClose, onAddItem, inventory }) {
    const lastOrder = history[0];
    return (
        <div className="lpos-history-drawer">
            <div className="lpos-drawer-head">
                <h4>📋 Purchase History — {shop?.name}</h4>
                <button className="lpos-drawer-close" onClick={onClose}>✕</button>
            </div>
            <div className="lpos-drawer-body">
                {loading ? <div className="lpos-spinner" /> : (
                    <>
                        {frequentItems.length > 0 && (
                            <div className="lpos-drawer-section" style={{ marginBottom: 16 }}>
                                <h5>⭐ Frequently Bought</h5>
                                <div>
                                    {frequentItems.map(fi => (
                                        <span
                                            key={fi.name}
                                            className="lpos-freq-chip"
                                            onClick={() => {
                                                const found = inventory.find(i =>
                                                    i.name?.toLowerCase() === fi.name?.toLowerCase()
                                                );
                                                if (found) onAddItem(found);
                                            }}
                                        >
                                            {fi.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {history.length > 0 && (
                            <div className="lpos-drawer-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <h5 style={{ margin: 0 }}>📜 All Purchase Bills ({history.length})</h5>
                                    <span style={{ fontSize: 10, color: '#6e7681' }}>Newest to Oldest</span>
                                </div>
                                {history.map((order, oIdx) => {
                                    const billNum = getDisplayBillNumber(order, history);
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
                                                    onClick={() => shareViaWhatsApp(shop?.phone, order)}
                                                >
                                                    📱 Share WhatsApp
                                                </button>
                                                <button
                                                    className="lpos-mini-share-btn sms"
                                                    onClick={() => shareViaSMS(shop?.phone, order)}
                                                >
                                                    💬 Share SMS
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {history.length === 0 && !frequentItems.length && (
                            <div className="lpos-empty-state">No purchase history found for this shop.</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ── Add Shop Modal ─────────────────────────────────────────────────────────
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

// ── Main Web Component ─────────────────────────────────────────────────────
export default function LinePOS() {
    const pos = useLinePOS();
    const [showHistory, setShowHistory] = useState(false);

    // ── Shop Panel ─────────────────────────────────────────────────────────
    const ShopPanel = (
        <div className="lpos-panel lpos-shop-panel">
            <div className="lpos-panel-head">
                <h3>🏪 Shops</h3>
                <div className="lpos-search-wrap">
                    <input
                        className="lpos-search"
                        placeholder="Name, phone, area…"
                        value={pos.shopSearch}
                        onChange={e => pos.setShopSearch(e.target.value)}
                    />
                    <button
                        className="lpos-add-btn"
                        onClick={() => pos.setShowAddShop(true)}
                        title="Add new shop"
                    >+</button>
                </div>
            </div>

            {pos.selectedShop && (
                <div className="lpos-selected-shop-banner">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h4>✓ {pos.selectedShop.name}</h4>
                            <p>{pos.selectedShop.phone}</p>
                        </div>
                        <button
                            className="lpos-unselect-btn"
                            onClick={() => pos.setSelectedShop(null)}
                            title="Unselect current shop"
                            style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >✕ Unselect</button>
                    </div>
                    <button
                        className="lpos-hist-btn"
                        onClick={() => setShowHistory(true)}
                    >View purchase history →</button>
                </div>
            )}

            <div className="lpos-shop-list">
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
                                            setShowHistory(false);
                                        }
                                    }}
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
        </div>
    );

    // ── Item Grid Panel ────────────────────────────────────────────────────
    const ItemPanel = (
        <div className="lpos-panel lpos-item-panel">
            {!pos.selectedShop ? (
                <div className="lpos-shop-locked-state">
                    <div className="lpos-lock-icon">🏪</div>
                    <h3>Please Select a Shop First</h3>
                    <p>Select a customer/shop from the left panel to unlock inventory items & billing.</p>
                </div>
            ) : (
                <>
                    {/* Top In-Item Shop & Purchase History Banner */}
                    <div className="lpos-item-shop-header">
                        <div className="lpos-item-shop-main">
                            <div className="lpos-item-shop-info">
                                <span className="lpos-item-shop-name">🏪 {pos.selectedShop.name}</span>
                                <span className="lpos-item-shop-phone">{pos.selectedShop.phone}</span>
                            </div>
                            {pos.lastOrder && (
                                <div className="lpos-item-last-order">
                                    <span className="lpos-last-tag">🕐 Last Purchase:</span>
                                    <span className="lpos-last-amount">
                                        {pos.lastOrder.createdAt
                                            ? new Date(pos.lastOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                            : 'Recent'}
                                        &nbsp;·&nbsp;<strong>{currency(pos.lastOrder.total ?? pos.lastOrder.grandTotal ?? 0)}</strong>
                                    </span>
                                    <div className="lpos-mini-share-row">
                                        <button
                                            className="lpos-mini-share-btn whatsapp"
                                            onClick={() => shareViaWhatsApp(pos.selectedShop.phone, pos.lastOrder)}
                                            title="Share Last Bill via WhatsApp"
                                        >📱 WhatsApp</button>
                                        <button
                                            className="lpos-mini-share-btn sms"
                                            onClick={() => shareViaSMS(pos.selectedShop.phone, pos.lastOrder)}
                                            title="Share Last Bill via SMS"
                                        >💬 SMS</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Frequently / Recently Bought Quick-Add Chips */}
                        {pos.frequentItems.length > 0 && (
                            <div className="lpos-item-freq-bar">
                                <span className="lpos-freq-label">⭐ Frequently Bought:</span>
                                <div className="lpos-freq-scroll">
                                    {pos.frequentItems.map(fi => (
                                        <button
                                            key={fi.name}
                                            className="lpos-freq-chip"
                                            onClick={() => {
                                                const found = pos.inventory.find(i =>
                                                    i.name?.toLowerCase() === fi.name?.toLowerCase()
                                                );
                                                if (found) pos.addToCart(found);
                                            }}
                                            title={`Add ${fi.name} to cart`}
                                        >
                                            + {fi.name} <span className="lpos-freq-count">×{fi.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Category tabs */}
                    <div className="lpos-cat-bar">
                        {pos.categories.map(cat => (
                            <button
                                key={cat}
                                className={`lpos-cat-chip ${pos.selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => pos.setSelectedCategory(cat)}
                            >{cat}</button>
                        ))}
                    </div>

                    {/* Location filter */}
                    <div style={{ display: 'flex', gap: 6, padding: '8px 12px 0', flexWrap: 'wrap', flexShrink: 0 }}>
                        {pos.locations.map(loc => (
                            <button
                                key={loc}
                                className={`lpos-cat-chip ${pos.selectedLocation === loc ? 'active' : ''}`}
                                style={{ fontSize: 11 }}
                                onClick={() => pos.setSelectedLocation(loc)}
                            >📍 {loc}</button>
                        ))}
                    </div>

                    {pos.inventoryLoading
                        ? <div className="lpos-loading-wrap"><div className="lpos-spinner" /></div>
                        : (
                            <div className="lpos-item-grid">
                                {pos.filteredInventory.length === 0
                                    ? <div className="lpos-empty-state" style={{ gridColumn: '1/-1' }}>
                                        No items found for this category/location.
                                    </div>
                                    : pos.filteredInventory.map(item => (
                                        <ItemCard key={item.id} item={item} onAdd={pos.addToCart} />
                                    ))
                                }
                            </div>
                        )
                    }
                </>
            )}
        </div>
    );

    // ── Cart Panel ─────────────────────────────────────────────────────────
    const CartPanel = (
        <div className="lpos-panel lpos-cart-panel">
            <div className="lpos-panel-head">
                <h3>🛒 Cart {pos.cart.length > 0 && `(${pos.cart.length})`}</h3>
            </div>

            <div className="lpos-cart-list">
                {pos.cart.length === 0
                    ? <div className="lpos-empty-state">Cart is empty.<br />Tap items to add.</div>
                    : pos.cart.map(item => (
                        <CartRow
                            key={item.cartId}
                            item={item}
                            onQty={pos.updateQty}
                            onUnitPrice={pos.updateUnitPrice}
                            onUpdateType={pos.updateItemType}
                            onRemove={pos.removeFromCart}
                            onAddSpecific={pos.addSpecificCartLine}
                        />
                    ))
                }
            </div>

            <div className="lpos-cart-footer">
                <div className="lpos-total-row">
                    <span>Subtotal</span>
                    <span>{currency(pos.subtotal)}</span>
                </div>
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
                <div className="lpos-total-row grand">
                    <span>Total</span>
                    <span>{currency(pos.grandTotal)}</span>
                </div>

                <div className="lpos-payment-row">
                    {['Cash', 'UPI', 'Credit'].map(m => (
                        <button
                            key={m}
                            className={`lpos-pay-btn ${pos.paymentMethod === m ? 'active' : ''}`}
                            onClick={() => pos.setPaymentMethod(m)}
                        >{m === 'Cash' ? '💵' : m === 'UPI' ? '📱' : '🏦'} {m}</button>
                    ))}
                </div>

                <button
                    className="lpos-bill-btn"
                    onClick={pos.submitBill}
                    disabled={pos.billingLoading || !pos.cart.length}
                >
                    {pos.billingLoading ? '⏳ Saving…' : `💾 Save & Print ${currency(pos.grandTotal)}`}
                </button>
                {pos.cart.length > 0 && (
                    <button className="lpos-clear-btn" onClick={pos.clearCart}>Clear Cart</button>
                )}
            </div>
        </div>
    );

    return (
        <div className="lpos-root">
            {/* Header */}
            <div className="lpos-header">
                <div className="lpos-header-logo">🚚</div>
                <div className="lpos-header-title">
                    Distributor POS
                    <span>Salesman / Route Billing System</span>
                </div>
                <span style={{ fontSize: 12, color: '#8b949e' }}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
            </div>

            {/* 3-column body */}
            <div className="lpos-body" style={{ position: 'relative' }}>
                {ShopPanel}
                {ItemPanel}
                {CartPanel}

                {/* History Drawer — overlays cart panel */}
                {showHistory && pos.selectedShop && (
                    <HistoryDrawer
                        shop={pos.selectedShop}
                        history={pos.purchaseHistory}
                        frequentItems={pos.frequentItems}
                        loading={pos.historyLoading}
                        inventory={pos.inventory}
                        onClose={() => setShowHistory(false)}
                        onAddItem={pos.addToCart}
                    />
                )}
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
