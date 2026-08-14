import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getPrinterSettings, printBill as thermalPrintBill } from '../api/printerUtils.js';

export default function PoultryMobilePOS() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // States
    const [step, setStep] = useState(1); // 1: Clients, 2: Cart/Menu
    const [clients, setClients] = useState([]);
    const [menu, setMenu] = useState([]);
    const [selectedClient, setSelectedClient] = useState(''); // '' means Walk-in

    const [cart, setCart] = useState([]);

    // UI states
    const [showMenuSheet, setShowMenuSheet] = useState(false);
    const [activeMenuItem, setActiveMenuItem] = useState(null); // Item being configured

    // Calculator states
    const [calcTarget, setCalcTarget] = useState('qty'); // 'qty' or 'amount'
    const [calcVal, setCalcVal] = useState('');
    const [saving, setSaving] = useState(false);

    // USB scale
    const [scaleConnected, setScaleConnected] = useState(false);
    const [scaleWeight, setScaleWeight] = useState(0);

    // Initial Load
    useEffect(() => {
        const load = () => {
            fetchClients();
            fetchMenu();
        };
        load();
        const intervalId = setInterval(load, 5000);
        return () => clearInterval(intervalId);
    }, []);

    const fetchClients = async () => {
        try {
            const res = await api.get('/poultry_clients');
            if (res.data.success) {
                setClients(res.data.data.filter(c => c.isActive));
            }
        } catch (err) {
            console.error("Failed to load clients", err);
        }
    };

    const fetchMenu = async () => {
        try {
            const res = await api.get('/menu');
            if (res.data.success && res.data.data.menuItems) {
                const available = res.data.data.menuItems.filter(m => m.isAvailable && m.category === 'Poultry');
                setMenu(available);
            }
        } catch (err) {
            console.error("Failed to load menu", err);
        }
    };

    // Derived client data
    const activeClientObj = selectedClient ? clients.find(c => c._id === selectedClient) : null;
    const clientName = activeClientObj ? activeClientObj.name : 'Walk-in Customer';

    const getActiveRate = (baseRate) => {
        if (!activeClientObj) return baseRate;
        const dT = activeClientObj.discountType || 'none';
        const dV = activeClientObj.discountValue || 0;
        let r = baseRate;
        if (dT === 'percentage') {
            r = baseRate - (baseRate * (dV / 100));
        } else if (dT === 'fixed') {
            r = baseRate - dV;
        }
        return Math.max(0, r);
    };

    // Calculate dynamic values for the active modal item
    const modalRate = activeMenuItem ? getActiveRate(activeMenuItem.price || activeMenuItem.sellingPrice) : 0;

    const derivedQty = calcTarget === 'qty' ? (parseFloat(calcVal) || 0) : ((parseFloat(calcVal) || 0) / (modalRate || 1));
    const derivedAmt = calcTarget === 'amount' ? (parseFloat(calcVal) || 0) : ((parseFloat(calcVal) || 0) * modalRate);

    const handleConfirmItem = () => {
        if (!activeMenuItem) return;

        const key = activeMenuItem._id || activeMenuItem.id;
        const exists = cart.find(i => i.id === key);

        const finalQty = typeof derivedQty === 'number' ? derivedQty : 0;
        const finalAmt = typeof derivedAmt === 'number' ? derivedAmt : 0;

        if (finalQty <= 0) return;

        setCart(prev => {
            if (exists) {
                return prev.map(i => i.id === key
                    ? { ...i, qty: +(i.qty + finalQty).toFixed(3), amount: +(i.amount + finalAmt).toFixed(2) }
                    : i
                );
            }
            return [...prev, {
                id: key,
                name: activeMenuItem.name,
                qty: +(finalQty.toFixed(3)),
                rate: modalRate,
                baseRate: activeMenuItem.price || activeMenuItem.sellingPrice,
                amount: +(finalAmt.toFixed(2)),
                type: activeMenuItem.type || 'kg',
                buyingPrice: activeMenuItem.buyingPrice || 0,
                menuItemId: key,
                category: activeMenuItem.category,
            }];
        });

        setActiveMenuItem(null);
        setCalcVal('');
        setShowMenuSheet(false);
    };

    const handleGenerateBill = () => {
        if (cart.length === 0) return;
        setSaving(true);

        const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);

        // Generate Pseudo-ID for offline caching
        const prefix = "PLT-";
        const codePart = Math.random().toString(36).substring(2, 6).toUpperCase();
        const datePart = Date.now().toString().slice(-4);
        const billNumber = prefix + codePart + datePart;

        const payload = {
            id: billNumber,
            billNumber,
            tableNumber: 'Takeaway',
            orderType: 'takeaway',
            status: 'PENDING',
            paymentStatus: 'paid', // Instant settle in UI
            subtotal: totalAmount,
            total: totalAmount,
            createdAt: new Date().toISOString(),
            poultryClientId: selectedClient || null,
            customerName: clientName,
            items: cart.map(c => ({
                id: c.id,
                menuItemId: c.menuItemId,
                name: c.name,
                price: c.rate,
                quantity: c.qty,
                status: 'paid',
                buyingPrice: c.buyingPrice || 0
            }))
        };

        // Offline storage
        const existingBills = JSON.parse(localStorage.getItem('poultry_history_bills') || '[]');
        localStorage.setItem('poultry_history_bills', JSON.stringify([payload, ...existingBills]));

        alert('Bill Generated Successfully: ' + billNumber);

        setCart([]);
        setStep(1);
        setSelectedClient('');
        setSaving(false);

        // Sync queue trigger
        if (window.syncPoultryQueue) window.syncPoultryQueue();
    };

    const CartTotal = cart.reduce((sum, c) => sum + c.amount, 0);

    return (
        <div style={{ background: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif', paddingBottom: '90px' }}>

            {/* TOP NAVBAR */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 10 }}>
                {step === 2 && (
                    <button
                        onClick={() => setStep(1)}
                        style={{ background: 'none', border: 'none', fontSize: '24px', marginRight: '16px', color: '#1f2937' }}
                    >
                        ←
                    </button>
                )}
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                    {step === 1 ? 'Select Client' : 'Poultry Checkout'}
                </h1>
            </div>

            {/* STEP 1: CLIENT SELECTION */}
            {step === 1 && (
                <div style={{ padding: '16px' }}>
                    <div
                        onClick={() => { setSelectedClient(''); setStep(2); }}
                        style={{ background: '#fff', border: '2px solid #10b981', padding: '20px', borderRadius: '12px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(16,185,129,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <div>
                            <div style={{ fontWeight: '700', fontSize: '18px', color: '#065f46' }}>Walking Customer</div>
                            <div style={{ color: '#059669', fontSize: '12px', marginTop: '4px' }}>Standard retail prices</div>
                        </div>
                        <div style={{ fontSize: '24px' }}>👤</div>
                    </div>

                    <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', marginTop: '24px' }}>Wholesale Clients</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {clients.map(c => (
                            <div
                                key={c._id}
                                onClick={() => { setSelectedClient(c._id); setStep(2); }}
                                style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}
                            >
                                <div>
                                    <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '16px' }}>{c.name}</div>
                                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{c.phone}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: c.balanceDue > 0 ? '#ef4444' : '#10b981', fontWeight: '700', fontSize: '14px' }}>
                                        Dues: ₹{c.balanceDue.toFixed(2)}
                                    </div>
                                    <div style={{ background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-block', marginTop: '4px', fontWeight: '600' }}>
                                        {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : (c.discountType === 'fixed' ? `₹${c.discountValue} OFF` : 'No Discount')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 2: CART & MENU */}
            {step === 2 && (
                <div>
                    <div style={{ background: '#1e293b', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Billing To</div>
                            <div style={{ fontWeight: '600', fontSize: '15px' }}>{clientName}</div>
                        </div>
                        {selectedClient && activeClientObj && activeClientObj.discountType !== 'none' && (
                            <div style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                                Client Rate Applied
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '16px' }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>🛒</div>
                                <div style={{ color: '#64748b', fontSize: '15px' }}>Cart is empty</div>
                                <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Tap Add Item below to start</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {cart.map(item => (
                                    <div key={item.id} style={{ background: '#fff', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', color: '#1f2937' }}>{item.name}</div>
                                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                                                {item.qty} {item.type} × ₹{item.rate}
                                                {item.rate < item.baseRate && <span style={{ textDecoration: 'line-through', opacity: 0.5, marginLeft: '6px' }}>₹{item.baseRate}</span>}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: '700', color: '#059669', fontSize: '16px', marginRight: '16px' }}>
                                            ₹{item.amount.toFixed(2)}
                                        </div>
                                        <button
                                            onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', width: '32px', height: '32px', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Fixed Bottom Action Bar */}
                    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '16px', display: 'flex', gap: '12px', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', zIndex: 100 }}>
                        <button
                            onClick={() => setShowMenuSheet(true)}
                            style={{ flex: 1, background: '#f1f5f9', color: '#334155', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', fontSize: '15px' }}
                        >
                            + ADD ITEM
                        </button>
                        <button
                            onClick={handleGenerateBill}
                            disabled={cart.length === 0 || saving}
                            style={{ flex: 1.5, background: cart.length > 0 ? '#10b981' : '#cbd5e1', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '700', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <span>CHECKOUT</span>
                            <span style={{ background: 'rgba(0,0,0,0.15)', padding: '2px 8px', borderRadius: '6px' }}>₹{CartTotal.toFixed(2)}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* BOTTOM SHEET MENU */}
            {showMenuSheet && !activeMenuItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#f8fafc', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', height: '75vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Select Item</h2>
                            <button onClick={() => setShowMenuSheet(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '18px', fontSize: '18px' }}>✕</button>
                        </div>
                        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {menu.map(m => (
                                <div
                                    key={m._id}
                                    onClick={() => { setActiveMenuItem(m); setCalcVal(''); }}
                                    style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}
                                >
                                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#1f2937' }}>{m.name}</div>
                                    <div style={{ fontWeight: '700', color: '#059669', fontSize: '15px' }}>
                                        ₹{getActiveRate(m.price || m.sellingPrice).toFixed(2)} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>/ {m.type || 'kg'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CALCULATION / INPUT MODAL */}
            {activeMenuItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#111827' }}>{activeMenuItem.name}</h3>
                                <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Client Rate: <b style={{ color: '#059669' }}>₹{modalRate.toFixed(2)}</b> / {activeMenuItem.type || 'kg'}</div>
                            </div>
                            <button onClick={() => setActiveMenuItem(null)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '18px', fontSize: '18px' }}>✕</button>
                        </div>

                        {/* Toggles */}
                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '6px', marginBottom: '24px' }}>
                            <div
                                onClick={() => { setCalcTarget('qty'); setCalcVal(''); }}
                                style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', background: calcTarget === 'qty' ? '#fff' : 'transparent', color: calcTarget === 'qty' ? '#0f172a' : '#64748b', boxShadow: calcTarget === 'qty' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
                            >Enter Weight</div>
                            <div
                                onClick={() => { setCalcTarget('amount'); setCalcVal(''); }}
                                style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', background: calcTarget === 'amount' ? '#fff' : 'transparent', color: calcTarget === 'amount' ? '#0f172a' : '#64748b', boxShadow: calcTarget === 'amount' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer' }}
                            >Enter Amount</div>
                        </div>

                        {/* Input Area */}
                        <div style={{ position: 'relative', marginBottom: '24px' }}>
                            <input
                                type="number"
                                autoFocus
                                value={calcVal}
                                onChange={e => setCalcVal(e.target.value)}
                                placeholder="0.00"
                                style={{ width: '100%', padding: '16px 20px', fontSize: '24px', fontWeight: '800', border: '2px solid #10b981', borderRadius: '12px', boxSizing: 'border-box', textAlign: 'center', outline: 'none', color: '#0f172a' }}
                            />
                            <div style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#94a3b8' }}>
                                {calcTarget === 'qty' ? (activeMenuItem.type || 'kg') : '₹'}
                            </div>
                        </div>

                        {/* Math Feedback */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Weight {calcTarget === 'amount' && '(Calculated)'}</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: calcTarget === 'qty' ? '#0f172a' : '#3b82f6' }}>{derivedQty.toFixed(3)} {activeMenuItem.type || 'kg'}</div>
                            </div>
                            <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Amount {calcTarget === 'qty' && '(Calculated)'}</div>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: calcTarget === 'amount' ? '#0f172a' : '#10b981' }}>₹{derivedAmt.toFixed(2)}</div>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmItem}
                            disabled={!calcVal || parseFloat(calcVal) <= 0}
                            style={{ width: '100%', padding: '16px', background: calcVal && parseFloat(calcVal) > 0 ? '#10b981' : '#cbd5e1', color: '#fff', fontSize: '16px', fontWeight: '700', border: 'none', borderRadius: '12px' }}
                        >
                            CONFIRM ITEM
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
