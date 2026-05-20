import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, ShoppingBag, ChevronRight, X, Plus, Minus,
    Star, Clock, CheckCircle2, AlertCircle, LogOut, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import './Home.css';

/* ─── Small pure helpers ─── */
function getDishImage(item) {
    if (item.imageUrl && item.imageUrl.startsWith('http')) return item.imageUrl;
    const name = item.name?.toLowerCase() || '';
    const cat = item.category?.toLowerCase() || '';
    if (name.includes('biryani')) return "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=400&auto=format&fit=crop";
    if (cat.includes('starter') || name.includes('fry') || name.includes('65')) return "https://images.unsplash.com/photo-1599487488170-d11ec9c175f0?q=80&w=400&auto=format&fit=crop";
    if (cat.includes('main') || name.includes('curry') || name.includes('sukka')) return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400&auto=format&fit=crop";
    if (name.includes('parotta') || name.includes('bread')) return "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?q=80&w=400&auto=format&fit=crop";
    if (cat.includes('dessert') || name.includes('payasam')) return "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=400&auto=format&fit=crop";
    if (cat.includes('beverage') || cat.includes('drink') || name.includes('lassi') || name.includes('juice')) return "https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=400&auto=format&fit=crop";
    return `https://loremflickr.com/400/300/food,${encodeURIComponent(item.name || 'dish')}/all`;
}

/* ─── Language Toggle Pill ─── */
function LangToggle() {
    const { i18n } = useTranslation();
    const isTamil = i18n.language === 'ta';
    const toggle = () => {
        const next = isTamil ? 'en' : 'ta';
        i18n.changeLanguage(next);
        localStorage.setItem('customerLanguage', next);
    };
    return (
        <div className={`lang-pill-switch ${isTamil ? 'lang-tamil' : 'lang-en'}`} onClick={toggle} title="Change language">
            <div className="lang-indicator" />
            <span className={`lang-opt ${!isTamil ? 'active' : ''}`}>EN</span>
            <span className={`lang-opt ${isTamil ? 'active' : ''}`}>தமிழ்</span>
        </div>
    );
}

/* ─── Main Component ─── */
export default function Home() {
    const { restaurantId, tableNumber } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme, toggle } = useTheme();

    const user = JSON.parse(localStorage.getItem('km_user') || '{}');
    const firstName = user.name?.split(' ')[0] || 'Guest';

    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState(['All']);
    const [items, setItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState(() => {
        try { return JSON.parse(localStorage.getItem(`cart-${restaurantId}-${tableNumber}`) || '[]'); }
        catch { return []; }
    });
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [orderStatus, setOrderStatus] = useState(null);
    const [activeOrder, setActiveOrder] = useState(null);
    const [placedOrderId, setPlacedOrderId] = useState(null);
    const [error, setError] = useState(null);
    const [showCart, setShowCart] = useState(false);
    const [showActiveOrderModal, setShowActiveOrderModal] = useState(false);
    const [orderNotes, setOrderNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [showUserMenu, setShowUserMenu] = useState(false);

    /* ─── Auth guard ─── */
    useEffect(() => {
        const token = localStorage.getItem('km_token');
        if (!token || !user?.phone) {
            navigate(`/order/${restaurantId}/${tableNumber}`, { replace: true });
        }
    }, []);

    /* ─── Data loading ─── */
    const loadMenu = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [menuRes, catRes, restRes] = await Promise.allSettled([
                api.get(`/menu/public/${restaurantId}`),
                api.get(`/menu/public/${restaurantId}/categories`),
                api.get(`/auth/public/${restaurantId}`)
            ]);
            if (menuRes.status === 'fulfilled') {
                const itemsList = menuRes.value.data.data.items || [];
                setItems(itemsList);
                const derived = ['All', ...new Set(itemsList.map(i => i.category).filter(Boolean))];
                setCategories(derived);
            } else {
                setError("Could not load menu. Please check your connection.");
            }
            if (catRes.status === 'fulfilled') {
                const officialCats = catRes.value.data.data.categories || [];
                if (officialCats.length > 0) setCategories(['All', ...officialCats]);
            }
            if (restRes.status === 'fulfilled') setRestaurant(restRes.value.data.data);
        } catch {
            setError("Something went wrong. Let's try again.");
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    const fetchActiveOrder = useCallback(async () => {
        try {
            const res = await api.get('/orders/public/active', { params: { restaurantId, tableNumber } });
            if (res.data.success && res.data.data?.length > 0) {
                const allOrders = res.data.data;
                allOrders.sort((a, b) => (a.id || a._id) - (b.id || b._id));
                const combinedItems = [];
                let combinedNotes = '';
                allOrders.forEach(o => {
                    if (o.items) combinedItems.push(...o.items);
                    if (o.notes) combinedNotes += (combinedNotes ? ' | ' : '') + o.notes;
                });
                const masterOrder = { ...allOrders[0], items: combinedItems, notes: combinedNotes };
                setActiveOrder(masterOrder);
                setPlacedOrderId(masterOrder.id || masterOrder._id);
            } else {
                setActiveOrder(null);
                setPlacedOrderId(null);
            }
        } catch { /* silent */ }
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        loadMenu();
        fetchActiveOrder();
        const saved = localStorage.getItem(`cart-${restaurantId}-${tableNumber}`);
        if (saved) { try { setCart(JSON.parse(saved)); } catch { setCart([]); } }
        else setCart([]);
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        if (restaurantId && tableNumber)
            localStorage.setItem(`cart-${restaurantId}-${tableNumber}`, JSON.stringify(cart));
    }, [cart, restaurantId, tableNumber]);

    /* ─── Socket & Fast Polling ─── */
    useEffect(() => {
        const s = io({
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            secure: window.location.protocol === 'https:',
            rejectUnauthorized: false
        });
        const normalizedTable = (tableNumber && !tableNumber.toLowerCase().startsWith('table ') && tableNumber.toLowerCase() !== 'takeaway')
            ? `Table ${tableNumber}` : tableNumber;
        s.on('connect', () => s.emit('join', `table-${restaurantId}-${normalizedTable}`));
        
        // Speed-of-light zero latency state mutation for items
        s.on('kot:itemUpdate', (data) => {
            if (data?.itemId && data?.status) {
                setActiveOrder(prev => {
                    if (!prev) return prev;
                    const newItems = prev.items.map(it => 
                        (it.id === data.itemId || it._id === data.itemId || it.menuItemId === data.itemId) 
                             ? { ...it, status: data.status } : it
                    );
                    return { ...prev, items: newItems, status: data.orderStatus || prev.status };
                });
            }
            fetchActiveOrder(); // Background sync safety
        });
        
        s.on('kot:statusUpdate', () => fetchActiveOrder());
        s.on('kot:itemsReady', () => fetchActiveOrder());

        // Hyper-fast polling fallback (1 second) to ensure immediate visible changes
        const pollInt = setInterval(fetchActiveOrder, 800);

        return () => { 
            s.close(); 
            clearInterval(pollInt); 
        };
    }, [restaurantId, tableNumber, fetchActiveOrder]);

    /* ─── Cart helpers ─── */
    const addToCart = (item) => setCart(prev => {
        const ex = prev.find(i => i._id === item._id);
        return ex ? prev.map(i => i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i)
                  : [...prev, { ...item, quantity: 1 }];
    });
    const removeFromCart = (itemId) => setCart(prev => {
        const ex = prev.find(i => i._id === itemId);
        return ex?.quantity > 1 ? prev.map(i => i._id === itemId ? { ...i, quantity: i.quantity - 1 } : i)
                                : prev.filter(i => i._id !== itemId);
    });
    const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    /* ─── Order actions ─── */
    const handlePlaceOrder = async () => {
        setOrderStatus('submitting');
        try {
            const payload = {
                restaurantId,
                tableNumber: tableNumber === 'Takeaway' ? 'Takeaway' : `Table ${tableNumber}`,
                items: cart.map(i => ({ menuItemId: i._id, quantity: i.quantity, name: i.name, price: i.price, notes: '' })),
                customerName: user.name || 'Guest',
                customerPhone: user.phone,
                orderType: tableNumber === 'Takeaway' ? 'takeaway' : 'dine-in',
                notes: orderNotes,
                paymentMethod,
            };
            const res = await api.post('/orders/public', payload);
            if (res.data.success) {
                setPlacedOrderId(res.data.data._id || res.data.data.id);
                setOrderStatus('success');
                setCart([]);
                setOrderNotes('');
                setActiveOrder(res.data.data);
            }
        } catch { setOrderStatus('error'); }
    };

    const handleRequestBill = async () => {
        if (!placedOrderId || !activeOrder) return;
        try {
            await api.patch(`/orders/public/${placedOrderId}/bill-request`);
            alert("Bill requested! Our staff will bring it shortly.");
        } catch (err) { 
            const msg = err.response?.data?.message || err.message;
            alert(`Failed to request bill: ${msg}. Please call a waiter.`); 
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('km_token');
        localStorage.removeItem('km_user');
        navigate(`/order/${restaurantId}/${tableNumber}`, { replace: true });
    };

    const getRecommendedAddons = () => {
        const addonCats = ['Beverages', 'Soft Drinks', 'Starters', 'Sides', 'Desserts'];
        return items.filter(i => addonCats.includes(i.category) && i.isAvailable !== false && !cart.some(c => c._id === i._id)).slice(0, 6);
    };

    const filteredItems = items.filter(item => {
        const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              item.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch && item.isAvailable !== false;
    });

    /* ─── Loading / Error screens ─── */
    if (loading) return (
        <div className="home-loader">
            <div className="loader-ring">
                <div /><div /><div /><div />
            </div>
            <p>Unfolding Flavours…</p>
        </div>
    );

    if (error) return (
        <div className="error-container">
            <AlertCircle size={52} color="#FF4D4D" />
            <h2>Something went wrong</h2>
            <p>{error}</p>
            <button className="retry-btn" onClick={loadMenu}>Try Again</button>
        </div>
    );

    /* ─── Render ─── */
    return (
        <div className="home-container">
            {/* ── TOP HEADER ── */}
            <header className="home-header">
                <div className="res-info">
                    <span className="welcome-tag">{t('customer.welcome', 'Welcome back,')} <strong>{firstName}</strong> 👋</span>
                    <h1 className="res-name">{restaurant?.restaurantName || 'Menu'}</h1>
                    <div className="table-badge">
                        <span className="dot" />
                        {tableNumber === 'Takeaway' ? '🛵 Takeaway' : `🪑 Table ${tableNumber}`}
                    </div>
                </div>

                <div className="header-actions">
                    {/* Premium Language Toggle */}
                    <LangToggle />

                    {/* Theme Toggle */}
                    <button className="top-cart-btn theme-toggle-btn" onClick={(e) => toggle(e)} title="Toggle theme">
                        <div style={{ transform: theme === 'dark' ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(90deg)', opacity: theme === 'dark' ? 1 : 0, transition: 'all 0.3s ease', position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Moon size={20} />
                        </div>
                        <div style={{ transform: theme === 'light' ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-90deg)', opacity: theme === 'light' ? 1 : 0, transition: 'all 0.3s ease', position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sun size={20} color="#FF9500" />
                        </div>
                    </button>

                    {/* Cart icon */}
                    {cartCount > 0 && (
                        <button className="top-cart-btn" onClick={() => setShowCart(true)}>
                            <ShoppingBag size={20} />
                            <span className="badge">{cartCount}</span>
                        </button>
                    )}

                    {/* Avatar with dropdown */}
                    <div className="avatar-wrap" onClick={() => setShowUserMenu(v => !v)}>
                        <div className="avatar">{firstName[0].toUpperCase()}</div>
                        <AnimatePresence>
                            {showUserMenu && (
                                <motion.div
                                    className="user-dropdown"
                                    initial={{ opacity: 0, scale: 0.9, y: -6 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <div className="dropdown-name">{user.name || 'Guest'}</div>
                                    <div className="dropdown-phone">{user.phone}</div>
                                    <button className="dropdown-logout" onClick={handleLogout}>
                                        <LogOut size={14} /> Sign out
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* ── LIVE ORDER TRACKER ── */}
            <AnimatePresence>
                {activeOrder && (
                    <motion.div
                        key="tracker"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="order-tracker-detailed"
                    >
                        <div className="tracker-top">
                            <div className="tracker-header">
                                <div className="pulse-dot" />
                                <span>LIVE ORDER</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="bill-req-btn"
                                    onClick={handleRequestBill}
                                >
                                    🧾 Bill
                                </button>
                            </div>
                        </div>

                        <div className="tracker-progress">
                            {[
                                { icon: '🍳', label: 'Preparing', statuses: ['PREPARING','READY','SERVED','PAID'] },
                                { icon: '🛎️', label: 'Ready', statuses: ['READY','SERVED','PAID'] },
                                { icon: '🍽️', label: 'Served', statuses: ['SERVED','PAID'] },
                            ].map((step, i) => (
                                <div key={i} className={`step ${step.statuses.includes(activeOrder.status?.toUpperCase()) ? 'active' : ''}`}>
                                    <div className="step-icon">{step.icon}</div>
                                    <span>{step.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="tracker-status-text">
                            {activeOrder.status?.toUpperCase() === 'PREPARING' && "🍳 Cooking  •  Takes ~15-20 mins"}
                            {activeOrder.status?.toUpperCase() === 'READY' && "🛎️ Ready  •  Being brought to your table"}
                            {activeOrder.status?.toUpperCase() === 'SERVED' && "🍽️ Served  •  Enjoy your meal!"}
                            {activeOrder.status?.toUpperCase() === 'PAID' && "✅ Paid  •  Thank you for visiting!"}
                            {!['PREPARING','READY','SERVED','PAID'].includes(activeOrder.status?.toUpperCase()) && `Status: ${activeOrder.status}`}
                        </div>
                        <div className="tracker-items-list-embed">
                            {activeOrder.items?.map((it, idx) => (
                                <div key={idx} className="embed-item-row">
                                    <div className="embed-item-name">{it.quantity}x {(i18n.language === 'ta' && (it.tamilName || it.menuItem?.tamilName)) ? (it.tamilName || it.menuItem?.tamilName) : it.name}</div>
                                    <span style={{ fontSize: '9px' }} className={`item-status-pill ${it.status?.toLowerCase() || 'preparing'}`}>{it.status || 'PREPARING'}</span>
                                </div>
                            ))}
                        </div>
                        <div className="embedded-bill-wrap">
                            <div className="bill-summary" style={{ marginBottom: 0, marginTop: '20px' }}>
                                <div className="bill-row"><span>Subtotal</span><span>₹{activeOrder.subtotal?.toFixed(2)}</span></div>
                                <div className="bill-row"><span>GST</span><span>₹{activeOrder.taxAmount?.toFixed(2)}</span></div>
                                <div className="bill-row total"><span>Total to Pay</span><span>₹{activeOrder.total?.toFixed(2)}</span></div>
                            </div>
                            {activeOrder.status?.toUpperCase() !== 'PAID' && (
                                <button className="confirm-order-btn" style={{ marginTop: '16px' }} onClick={handleRequestBill} disabled={orderStatus === 'submitting'}>
                                    {orderStatus === 'submitting' ? 'Notifying Cashier...' : `Request Bill • ₹${activeOrder.total?.toFixed(2)}`}
                                </button>
                            )}
                            {activeOrder.status?.toUpperCase() === 'PAID' && (
                                <button className="confirm-order-btn" style={{ marginTop: '16px', background: '#4ADE80', color: '#000', boxShadow: '0 10px 32px rgba(74,222,128,0.3)' }} disabled>
                                    Payment Complete ✓
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SEARCH & CATEGORIES ── */}
            <div className="sticky-controls">
                <div className="search-box">
                    <Search size={18} color="rgba(255,255,255,0.35)" />
                    <input
                        type="text"
                        placeholder={t('customer.search_placeholder', 'Search dishes…')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ color: 'rgba(255,255,255,0.4)' }}>
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="categories">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat === 'All' ? t('customer.all', 'All') : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── MENU GRID ── */}
            <main className="menu-grid">
                <AnimatePresence mode="popLayout">
                    {filteredItems.length > 0 ? filteredItems.map(item => (
                        <motion.div
                            layout
                            key={item.id || item._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="menu-card"
                            onClick={() => setSelectedItem(item)}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        >
                            <div className="item-image">
                                <img src={getDishImage(item)} alt={item.name} loading="lazy" />
                                {item.isRecommended && (
                                    <div className="recommended-badge">
                                        <Star size={9} fill="currentColor" /> BEST
                                    </div>
                                )}
                                <div className="item-price">₹{item.price}</div>
                            </div>
                            <div className="item-info">
                                <div className="item-header">
                                    <span className={`veg-dot ${item.type?.toLowerCase() === 'veg' ? 'veg' : 'non-veg'}`} />
                                    <h3>{(i18n.language === 'ta' && item.tamilName) ? item.tamilName : item.name}</h3>
                                </div>
                                {item.description && <p className="item-desc">{item.description}</p>}
                                <div className="item-footer">
                                    <div className="meta"><Clock size={13} /> 15m</div>
                                    {cart.find(i => i._id === item._id) ? (
                                        <div className="qty-control" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => removeFromCart(item._id)}><Minus size={15} /></button>
                                            <span>{cart.find(i => i._id === item._id).quantity}</span>
                                            <button onClick={() => addToCart(item)}><Plus size={15} /></button>
                                        </div>
                                    ) : (
                                        <button className="add-btn" onClick={e => { e.stopPropagation(); addToCart(item); }}>
                                            <Plus size={17} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="empty-state"
                        >
                            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🍽️</div>
                            <h3>No Dishes Found</h3>
                            <p>No {selectedCategory !== 'All' ? selectedCategory : ''} items available right now.</p>
                            {selectedCategory !== 'All' && (
                                <button className="retry-btn" onClick={() => setSelectedCategory('All')}>
                                    Show All
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* ── BOTTOM CART BAR ── */}
            <AnimatePresence>
                {cartCount > 0 && (
                    <motion.div
                        className="cart-bar"
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        <div className="cart-content">
                            <div className="cart-summary">
                                <div className="bag-icon">
                                    <ShoppingBag size={24} />
                                    <span className="cart-count">{cartCount}</span>
                                </div>
                                <div className="total-text">
                                    <span className="total-label">Total</span>
                                    <span className="total-amt">₹{cartTotal}</span>
                                </div>
                            </div>
                            <button className="checkout-btn" onClick={() => setShowCart(true)}>
                                Review Order <ChevronRight size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MODALS ── */}
            <AnimatePresence>
                {selectedItem && (
                    <ItemModal
                        item={selectedItem}
                        onClose={() => setSelectedItem(null)}
                        onAdd={addToCart}
                        cart={cart}
                        lang={i18n.language}
                        addons={getRecommendedAddons()}
                    />
                )}
                {showCart && (
                    <CartModal
                        cart={cart}
                        onClose={() => setShowCart(false)}
                        onUpdateQty={(item, delta) => delta > 0 ? addToCart(item) : removeFromCart(item._id)}
                        onConfirm={() => { setShowCart(false); handlePlaceOrder(); }}
                        total={cartTotal}
                        orderNotes={orderNotes}
                        setOrderNotes={setOrderNotes}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        lang={i18n.language}
                    />
                )}
                {showActiveOrderModal && activeOrder && (
                    <ActiveOrderModal order={activeOrder} onClose={() => setShowActiveOrderModal(false)} lang={i18n.language} />
                )}
                {orderStatus === 'success' && (
                    <SuccessModal onClose={() => setOrderStatus(null)} name={firstName} />
                )}
            </AnimatePresence>
        </div>
    );
}

/* ═══════════════════════════════════════
   ITEM MODAL
═══════════════════════════════════════ */
function ItemModal({ item, onClose, onAdd, cart, lang, addons }) {
    const inCart = cart.find(i => i._id === item._id);
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                className="item-modal"
                onClick={e => e.stopPropagation()}
            >
                <button className="close-btn" onClick={onClose}><X size={18} /></button>
                <div className="modal-hero">
                    <img src={getDishImage(item)} alt={item.name} />
                    <div className="modal-hero-gradient" />
                    {item.isRecommended && (
                        <div className="modal-bestseller"><Star size={11} fill="currentColor" /> BESTSELLER</div>
                    )}
                </div>
                <div className="modal-content">
                    <div className="modal-header">
                        <div>
                            <div className="modal-name-row">
                                <span className={`veg-dot ${item.type?.toLowerCase() === 'veg' ? 'veg' : 'non-veg'}`} />
                                <h2>{(lang === 'ta' && item.tamilName) ? item.tamilName : item.name}</h2>
                            </div>
                            {item.description && (
                                <p className="modal-desc">{(lang === 'ta' && item.tamilDescription) ? item.tamilDescription : item.description}</p>
                            )}
                        </div>
                        <div className="modal-price">₹{item.price}</div>
                    </div>

                    <div className="modal-stats">
                        <div className="stat"><Star size={14} color="#FFD700" fill="#FFD700" /> 4.8</div>
                        <div className="stat"><Clock size={14} /> 20 mins</div>
                        <div className="stat">{item.type === 'veg' ? '🌿 Veg' : '🥩 Non-Veg'}</div>
                    </div>

                    {addons.length > 0 && (
                        <div className="modal-addons">
                            <h3>🔥 Recommended Extras</h3>
                            <div className="addons-row">
                                {addons.map(addon => (
                                    <div key={addon._id} className="addon-pill" onClick={() => onAdd(addon)}>
                                        <div className="addon-img"><img src={getDishImage(addon)} alt={addon.name} /></div>
                                        <div className="addon-name">{(lang === 'ta' && addon.tamilName) ? addon.tamilName : addon.name}</div>
                                        <div className="addon-price">+₹{addon.price}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button className="modal-add-btn" onClick={() => { onAdd(item); onClose(); }}>
                        {inCart ? `Add Another  (+₹${item.price})` : `Add to Order  •  ₹${item.price}`}
                        <Plus size={20} />
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════
   CART MODAL
═══════════════════════════════════════ */
function CartModal({ cart, onClose, onUpdateQty, onConfirm, total, orderNotes, setOrderNotes, paymentMethod, setPaymentMethod, lang }) {
    const tax = total * 0.05;
    const finalTotal = total + tax;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                className="cart-modal"
                onClick={e => e.stopPropagation()}
            >
                <div className="cart-modal-header">
                    <div>
                        <h2>Your Order</h2>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{cart.length} item{cart.length > 1 ? 's' : ''}</p>
                    </div>
                    <button className="close-btn-inline" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="cart-items-list">
                    {cart.map(item => (
                        <div key={item._id} className="cart-item-row">
                            <div className="cart-item-img">
                                <img src={getDishImage(item)} alt={item.name} />
                            </div>
                            <div className="cart-item-info">
                                <h3>{(lang === 'ta' && item.tamilName) ? item.tamilName : item.name}</h3>
                                <p>₹{item.price} each</p>
                            </div>
                            <div className="qty-control">
                                <button onClick={() => onUpdateQty(item, -1)}><Minus size={14} /></button>
                                <span>{item.quantity}</span>
                                <button onClick={() => onUpdateQty(item, 1)}><Plus size={14} /></button>
                            </div>
                            <div className="cart-item-subtotal">₹{item.price * item.quantity}</div>
                        </div>
                    ))}
                </div>

                <div className="order-notes-section">
                    <label>Special Requests</label>
                    <textarea
                        value={orderNotes}
                        onChange={e => setOrderNotes(e.target.value)}
                        placeholder="e.g. less spicy, no onions, extra sauce…"
                    />
                </div>

                <div className="payment-method-section">
                    <label>Payment Method</label>
                    <div className="payment-options">
                        {[['CASH', '💵'], ['CARD', '💳'], ['UPI', '📱']].map(([m, icon]) => (
                            <button key={m} className={`pay-opt ${paymentMethod === m ? 'active' : ''}`} onClick={() => setPaymentMethod(m)}>
                                {icon} {m}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bill-summary">
                    <div className="bill-row"><span>Item Total</span><span>₹{total}</span></div>
                    <div className="bill-row"><span>GST (5%)</span><span>₹{tax.toFixed(2)}</span></div>
                    <div className="bill-row total"><span>To Pay</span><span>₹{finalTotal.toFixed(2)}</span></div>
                </div>

                <button className="confirm-order-btn" onClick={onConfirm}>
                    Place Order • ₹{finalTotal.toFixed(2)}
                </button>
            </motion.div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════
   SUCCESS MODAL
═══════════════════════════════════════ */
function SuccessModal({ onClose, name }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="success-modal"
                onClick={e => e.stopPropagation()}
            >
                <div className="success-icon-ring">
                    <CheckCircle2 size={64} color="#4ADE80" strokeWidth={1.5} />
                </div>
                <h2>Order Placed! 🎉</h2>
                <p>Hang tight {name}, our chef is working on your meal!</p>
                <button className="modal-add-btn" style={{ marginTop: '8px' }} onClick={onClose}>Got it!</button>
            </motion.div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════
   ACTIVE ORDER MODAL
═══════════════════════════════════════ */
function ActiveOrderModal({ order, onClose, lang }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                className="cart-modal"
                onClick={e => e.stopPropagation()}
            >
                <div className="cart-modal-header">
                    <div>
                        <h2>Order #{order.orderNumber}</h2>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{order.tableNumber}</p>
                    </div>
                    <button className="close-btn-inline" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="cart-items-list">
                    {order.items?.map((item, idx) => (
                        <div key={item._id || idx} className="cart-item-row">
                            <div className="cart-item-info">
                                <h3>{(lang === 'ta' && (item.tamilName || item.menuItem?.tamilName)) ? (item.tamilName || item.menuItem?.tamilName) : item.name}</h3>
                                <p>Qty: {item.quantity}</p>
                                <span className={`item-status-pill ${item.status?.toLowerCase()}`}>{item.status || 'PREPARING'}</span>
                            </div>
                            <div className="cart-item-subtotal">₹{item.price * item.quantity}</div>
                        </div>
                    ))}
                </div>
                <div className="bill-summary">
                    <div className="bill-row"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
                    <div className="bill-row"><span>GST</span><span>₹{order.taxAmount}</span></div>
                    <div className="bill-row total"><span>Total</span><span>₹{order.total}</span></div>
                </div>
                <div className="order-status-banner">Status: <strong>{order.status}</strong></div>
            </motion.div>
        </motion.div>
    );
}
