import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import './CustomerMenu.css';

export default function CustomerMenu() {
    const { restaurantId, tableNumber } = useParams();
    const [restaurant, setRestaurant] = useState(null);
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'veg', 'non-veg'
    const [selectedItem, setSelectedItem] = useState(null);
    const [cart, setCart] = useState(() => {
        const savedCart = localStorage.getItem(`cart-${restaurantId}-${tableNumber}`);
        return savedCart ? JSON.parse(savedCart) : [];
    });
    const [loading, setLoading] = useState(true);
    const [activeOrder, setActiveOrder] = useState(null);
    const [socket, setSocket] = useState(null);
    const [fatalError, setFatalError] = useState(null);
    const [orderStatus, setOrderStatus] = useState(null); // 'submitting', 'success', 'error'

    // Load cart from localStorage when restaurantId/tableNumber changes
    useEffect(() => {
        const savedCart = localStorage.getItem(`cart-${restaurantId}-${tableNumber}`);
        if (savedCart) {
            setCart(JSON.parse(savedCart));
        } else {
            setCart([]);
        }
    }, [restaurantId, tableNumber]);

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (restaurantId && tableNumber) {
            localStorage.setItem(`cart-${restaurantId}-${tableNumber}`, JSON.stringify(cart));
        }
    }, [cart, restaurantId, tableNumber]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Menu, Categories & Restaurant in parallel
                const [menuRes, catRes, restRes] = await Promise.allSettled([
                    axios.get(`/api/menu/public/${restaurantId}`),
                    axios.get(`/api/menu/public/${restaurantId}/categories`),
                    axios.get(`/api/auth/public/${restaurantId}`)
                ]);

                // Handle Menu Response
                if (menuRes.status === 'fulfilled') {
                    const rawItems = menuRes.value.data.data.items || [];
                    const sanitizedItems = rawItems.map(item => ({
                        ...item,
                        _id: item._id || item.id,
                        imageUrl: item.imageUrl || item.image || item.image_url
                    }));
                    setItems(sanitizedItems);
                } else {
                    console.error("Menu fetch failed", menuRes.reason);
                    const status = menuRes.reason.response?.status;
                    if (status === 404) {
                        setFatalError("Restaurant not found or Menu not published yet.");
                    } else if (status === 500) {
                        setFatalError("Server error (500) while loading menu.");
                    } else {
                        setFatalError("Could not load menu. Status: " + (status || 'Unknown'));
                    }
                }

                // Handle Categories
                if (catRes.status === 'fulfilled') {
                    setCategories(['All', ...(catRes.value.data.data.categories || [])]);
                }

                // Handle Restaurant Info
                if (restRes.status === 'fulfilled') {
                    setRestaurant(restRes.value.data.data);
                }

            } catch (err) {
                console.error("Critical failure fetching menu", err);
                setFatalError("Network Error: Could not connect to server.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [restaurantId]);

    useEffect(() => {
        // 🔌 Dynamic Socket Connection (Works on Mobile!)
        const host = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        const newSocket = io(`${protocol}://${host}:9092`); 
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('🔌 Connected LIVE to Restaurant');
            newSocket.emit('join', `table-${restaurantId}-${tableNumber}`);
        });

        newSocket.on('kot:statusUpdate', (data) => {
            setActiveOrder(prev => ({ ...prev, status: data.status }));
        });

        return () => newSocket.close();
    }, [restaurantId, tableNumber]);

    const isAcTable = React.useMemo(() => {
        if (!tableNumber || !restaurant?.acTables) return false;
        const tableNumStr = tableNumber.replace('Table ', '').trim();
        const acTableList = restaurant.acTables.split(',').map(s => s.trim());
        return acTableList.includes(tableNumStr);
    }, [tableNumber, restaurant?.acTables]);
    
    const acMarkup = isAcTable ? (restaurant?.acChargePercentage || 20) : 0;
    
    const getEffectivePrice = (basePrice) => {
        if (!acMarkup) return basePrice;
        return basePrice + (basePrice * acMarkup / 100);
    };

    const addToCart = (item) => {
        const effectivePrice = getEffectivePrice(item.price);
        setCart(prev => {
            const existing = prev.find(i => i._id === item._id);
            if (existing) {
                return prev.map(i => i._id === item._id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, price: effectivePrice, quantity: 1, notes: '' }];
        });
    };

    const removeFromCart = (itemId) => {
        setCart(prev => {
            const existing = prev.find(i => i._id === itemId);
            if (!existing) return prev;
            if (existing.quantity > 1) {
                return prev.map(i => i._id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i._id !== itemId);
        });
    };

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [orderNotes, setOrderNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [orderExtraCharges, setOrderExtraCharges] = useState([]);

    const updateQty = (itemId, delta) => {
        setCart(prev => {
            const item = prev.find(i => i._id === itemId);
            if (!item) return prev;
            if (item.quantity + delta <= 0) {
                return prev.filter(i => i._id !== itemId);
            }
            return prev.map(i => i._id === itemId ? { ...i, quantity: i.quantity + delta } : i);
        });
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = restaurant?.taxRate || 5; // Default 5% if not set
    const taxAmount = (subtotal * taxRate) / 100;
    const extraChargesTotal = orderExtraCharges.reduce((sum, c) => sum + c.amount, 0);
    const cartTotal = subtotal + taxAmount + extraChargesTotal;

    const [placedOrderId, setPlacedOrderId] = useState(null);

    const handlePlaceOrder = async () => {
        setOrderStatus('submitting');
        try {
            const res = await axios.post('/api/orders/public', {
                restaurantId,
                tableNumber: `Table ${tableNumber}`,
                items: cart.map(i => ({
                    menuItemId: i._id,
                    quantity: i.quantity,
                    notes: i.notes || ''
                })),
                notes: orderNotes,
                extraCharges: orderExtraCharges,
                paymentMethod,
                subtotal,
                taxAmount,
                total: cartTotal
            });
            const newOrder = res.data.data.order;
            setPlacedOrderId(newOrder._id);
            setOrderStatus('success');
            setCart([]);
            localStorage.removeItem(`cart-${restaurantId}-${tableNumber}`);
            setShowReviewModal(false);
            
            // Join the specific order room for updates
            if (socket) {
                socket.emit('join', `order-${newOrder._id}`);
            }
        } catch (err) {
            console.error("Order failed", err);
            setOrderStatus('error');
        }
    };

    const handleRequestBill = async () => {
        if (!placedOrderId) return;
        try {
            await axios.patch(`/api/orders/public/${placedOrderId}/bill-request`);
            alert("Bill requested! A waiter will be with you shortly.");
        } catch (err) {
            console.error("Bill request failed", err);
            alert("Could not request bill. Please call a waiter.");
        }
    };

    const renderSkeleton = () => (
        <div className="skeleton-grid">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-card">
                    <div className="skeleton-text">
                        <div className="skeleton-line title"></div>
                        <div className="skeleton-line desc"></div>
                        <div className="skeleton-line price"></div>
                    </div>
                    <div className="skeleton-img"></div>
                </div>
            ))}
        </div>
    );

    if (loading) return (
        <div className="ultimate-customer-web loading-state">
            <header className="premium-header">
                <div className="hero-section skeleton"></div>
            </header>
            <main className="menu-container">
                {renderSkeleton()}
            </main>
        </div>
    );

    const filteredItems = (items || []).filter(item => {
        if (!item) return false;
        try {
            const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
            const matchesSearch = (item.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) || 
                                 (item.description || "").toLowerCase().includes((searchQuery || "").toLowerCase());
            const matchesFilter = filter === 'all' || 
                                 (filter === 'veg' && item.isVeg) || 
                                 (filter === 'non-veg' && !item.isVeg);
            return matchesCategory && matchesSearch && matchesFilter;
        } catch (e) {
            return false;
        }
    });

    if (fatalError) {
        return (
            <div className="fatal-error-screen">
                <div className="error-card">
                    <div className="error-icon">⚠️</div>
                    <h2>Connection Error</h2>
                    <p>{fatalError}</p>
                    <button onClick={() => window.location.reload()} className="btn-primary">Try Again</button>
                </div>
            </div>
        );
    }

    if (orderStatus === 'success') {
        return (
            <div className="order-success-overlay">
                <div className="success-content">
                    <div className="success-icon">✅</div>
                    <h2>Order Placed!</h2>
                    <p>Your items are being prepared for <strong>Table {tableNumber}</strong>.</p>
                    <button onClick={() => setOrderStatus(null)} className="btn-primary">Order More</button>
                </div>
            </div>
        );
    }

    const getRecommendedAddons = () => {
        // Find items in 'Starters', 'Beverages', or 'Sides' categories, excluding the current selectedItem
        const addonCategories = ['Starters', 'Beverages', 'Sides', 'Extra', 'Add-ons', 'Tiffin & Dosa'];
        return items.filter(item => 
            item._id !== selectedItem?._id && 
            (addonCategories.includes(item.category) || item.isRecommended) &&
            item.isAvailable
        ).slice(0, 6); // Limit to 6 recommendations
    };

    return (
        <div className="ultimate-customer-web">
            <header className="premium-header">
                <div className="hero-section">
                    <div className="overlay"></div>
                    <div className="hero-content">
                        <span className="premium-tag">PREMIUM DINING</span>
                        <h1 className="restaurant-name">{restaurant?.restaurantName || restaurant?.name || 'Loading...'}</h1>
                        <div className="table-info">
                            <span className="pulse"></span>
                            Table No. {tableNumber}
                            <button className="small-refresh" onClick={() => window.location.reload()}>🔄</button>
                        </div>
                    </div>
                </div>

                <div className="control-bar">
                    <div className="search-bar-modern">
                        <i className="search-icon">🔍</i>
                        <input 
                            type="text" 
                            placeholder="What would you like to eat?" 
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="diet-toggle">
                        <button className={`toggle-btn ${filter === 'veg' ? 'active' : ''}`} onClick={() => setFilter(filter === 'veg' ? 'all' : 'veg')}>
                            <span className="dot veg"></span> Veg Only
                        </button>
                    </div>
                </div>

                <nav className="category-nav">
                    {categories.map(cat => (
                        <button 
                            key={cat} 
                            className={`nav-item ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="menu-container">
                {filteredItems.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🍱</div>
                        <h3>Delicious things are coming!</h3>
                        <p>We couldn't find any dishes in this category. Try switching to "All".</p>
                        <button className="btn-secondary" onClick={() => {
                            setSelectedCategory('All');
                            setFilter('all');
                            setSearchQuery('');
                        }}>Clear Filters</button>
                    </div>
                ) : (
                    <div className="food-list">
                        {filteredItems.map(item => (
                            <div key={item._id} className="food-card" onClick={() => setSelectedItem(item)}>
                                <div className="food-info">
                                    <div className="badges">
                                        <span className={`type-tag ${item.isVeg ? 'veg' : 'non-veg'}`}></span>
                                        {item.isRecommended && <span className="premium-badge">CHEF'S PICK</span>}
                                    </div>
                                    <h3>{item.name}</h3>
                                    <p className="description">{item.description}</p>
                                    <div className="price-row">
                                        <span className="currency">₹</span>
                                        <span className="amount">{getEffectivePrice(item.price)}</span>
                                        <button className="quick-add" onClick={(e) => {
                                            e.stopPropagation();
                                            addToCart(item);
                                        }}>
                                            <span>ADD</span>
                                            <i className="plus">+</i>
                                        </button>
                                    </div>
                                </div>
                                {item.imageUrl && (
                                    <div className="food-image">
                                        <img src={item.imageUrl} alt={item.name} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {selectedItem && (
                <div className="dish-modal-overlay" onClick={() => setSelectedItem(null)}>
                    <div className="dish-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-top">
                            {selectedItem.imageUrl ? (
                                <img src={selectedItem.imageUrl} className="full-img" alt={selectedItem.name} />
                            ) : (
                                <div className="img-placeholder">🍽️</div>
                            )}
                            <button className="close-circle" onClick={() => setSelectedItem(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="top-row">
                                <span className={`type-tag ${selectedItem.isVeg ? 'veg' : 'non-veg'}`}></span>
                                <h2>{selectedItem.name}</h2>
                            </div>
                            <p className="full-desc">{selectedItem.description}</p>

                            <div className="recommended-section">
                                <h3>Complete Your Meal</h3>
                                <div className="addons-scroll">
                                    {getRecommendedAddons().map(addon => (
                                        <div key={addon._id} className="addon-card">
                                            <div className="addon-img">
                                                {addon.imageUrl ? <img src={addon.imageUrl} alt={addon.name} /> : <span>🍴</span>}
                                            </div>
                                            <div className="addon-info">
                                                <h4>{addon.name}</h4>
                                                <div className="addon-price-row">
                                                    <span>₹{getEffectivePrice(addon.price)}</span>
                                                    <button className="addon-add-btn" onClick={() => addToCart(addon)}>+ ADD</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="modal-action">
                                <span className="price">₹{getEffectivePrice(selectedItem.price)}</span>
                                <button className="main-add-btn" onClick={() => {
                                    addToCart(selectedItem);
                                    setSelectedItem(null);
                                }}>
                                    Add to My Order
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showReviewModal && (
                <div className="review-modal-overlay" onClick={() => setShowReviewModal(false)}>
                    <div className="review-modal" onClick={e => e.stopPropagation()}>
                        <div className="review-header">
                            <h2>Review My Order</h2>
                            <button className="close-btn" onClick={() => setShowReviewModal(false)}>✕</button>
                        </div>
                        
                        <div className="review-body">
                            <div className="review-details">
                                <span className="table-badge">Table {tableNumber}</span>
                                <span className="item-count">{cart.length} items</span>
                            </div>

                            <div className="review-items-list">
                                {cart.map(item => (
                                    <div key={item._id} className="review-item">
                                        <div className="ri-info">
                                            <span className="ri-name">{item.name}</span>
                                            <span className="ri-price">₹{item.price * item.quantity}</span>
                                        </div>
                                        <div className="ri-actions">
                                            <div className="qty-picker">
                                                <button onClick={() => updateQty(item._id, -1)}>−</button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQty(item._id, 1)}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="order-notes-section">
                                <label>Special Instructions</label>
                                <textarea 
                                    placeholder="Less spicy, extra lemons..." 
                                    value={orderNotes}
                                    onChange={(e) => setOrderNotes(e.target.value)}
                                />
                            </div>

                            <div className="payment-method-section">
                                <label>Payment Method</label>
                                <div className="payment-options">
                                    {['cash', 'card', 'upi'].map(m => (
                                        <button 
                                            key={m} 
                                            className={`pay-opt ${paymentMethod === m ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod(m)}
                                        >
                                            {m === 'cash' ? '💵 Cash' : m === 'card' ? '💳 Card' : '📱 UPI'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="payment-method-section" style={{ marginTop: '15px' }}>
                                <label>Extra Services</label>
                                <div className="payment-options">
                                    <button 
                                        className={`pay-opt ${orderExtraCharges.some(c => c.name === 'Parcel Charge') ? 'active' : ''}`}
                                        onClick={() => {
                                            if (orderExtraCharges.some(c => c.name === 'Parcel Charge')) {
                                                setOrderExtraCharges(prev => prev.filter(c => c.name !== 'Parcel Charge'));
                                            } else {
                                                setOrderExtraCharges(prev => [...prev, { name: 'Parcel Charge', amount: 20 }]);
                                            }
                                        }}
                                    >
                                        🛍️ Packing / Parcel (+₹20)
                                    </button>
                                </div>
                            </div>

                            <div className="bill-summary">
                                <div className="bill-row">
                                    <span>Subtotal</span>
                                    <span>₹{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="bill-row">
                                    <span>Tax ({taxRate}%)</span>
                                    <span>₹{taxAmount.toFixed(2)}</span>
                                </div>
                                {orderExtraCharges.length > 0 && (
                                    <div className="bill-row">
                                        <span>Extra Charges</span>
                                        <span>₹{extraChargesTotal.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="bill-row total">
                                    <span>Total Amount</span>
                                    <span>₹{cartTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="review-footer">
                            <button 
                                className="confirm-order-btn" 
                                onClick={handlePlaceOrder}
                                disabled={orderStatus === 'submitting'}
                            >
                                {orderStatus === 'submitting' ? 'Placing Order...' : `Confirm & Place Order • ₹${cartTotal.toFixed(0)}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {orderStatus === 'success' && (
                <div className="order-success-overlay">
                    <div className="success-content">
                        <div className="success-icon">✅</div>
                        <h2>Order Placed!</h2>
                        <p>Your items are being prepared for <strong>Table {tableNumber}</strong>.</p>
                        <button onClick={() => setOrderStatus(null)} className="btn-primary">Order More</button>
                    </div>
                </div>
            )}

            {activeOrder && (
                <div className="live-tracker">
                    <div className="tracker-top">
                        <div className="tracker-header">
                            <span className="dot-pulse"></span>
                            LIVE TRACKER
                        </div>
                        {placedOrderId && (
                            <button className="bill-req-btn" onClick={handleRequestBill}>
                                🧾 Request Bill
                            </button>
                        )}
                    </div>
                    <div className="tracker-body">
                        <div className="order-progress">
                            <div className={`step ${['PREPARING', 'READY', 'SERVED', 'PAID'].includes(activeOrder.status) ? 'active' : ''}`}>
                                <div className="step-icon">🍳</div>
                                <span>Preparing</span>
                            </div>
                            <div className={`step ${['READY', 'SERVED', 'PAID'].includes(activeOrder.status) ? 'active' : ''}`}>
                                <div className="step-icon">🛎️</div>
                                <span>Ready</span>
                            </div>
                            <div className={`step ${['SERVED', 'PAID'].includes(activeOrder.status) ? 'active' : ''}`}>
                                <div className="step-icon">🍽️</div>
                                <span>Served</span>
                            </div>
                        </div>
                        <p className="status-text">Your Order is <strong>{activeOrder.status || 'PREPARING'}</strong></p>
                    </div>
                </div>
            )}

            {cart.length > 0 && !showReviewModal && (
                <div className="floating-cart">
                    <div className="cart-left" onClick={() => setShowReviewModal(true)}>
                        <span className="count">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
                        <span className="total">₹{cartTotal.toFixed(0)}</span>
                    </div>
                    <button className="checkout-btn" onClick={() => setShowReviewModal(true)}>
                        <span>REVIEW ORDER</span>
                        <i className="arrow">→</i>
                    </button>
                </div>
            )}
        </div>
    );
}
