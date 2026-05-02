import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ChevronRight, Loader2 } from 'lucide-react';
import api from '../api/client';

export default function Login() {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    const onSignup = async (e) => {
        if (e) e.preventDefault();
        
        // Basic 10-digit validation
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            setError("Please enter a valid 10-digit phone number");
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Direct Login without OTP
            const res = await api.post('/auth/direct-login', { phone: cleanPhone });
            
            localStorage.setItem('km_token', res.data.data.token);
            localStorage.setItem('km_user', JSON.stringify(res.data.data.user));
            
            const params = new URLSearchParams(location.search);
            const redirect = params.get('redirect') || '/';
            navigate(redirect);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to log in. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page" style={styles.container}>
            <div style={styles.overlay}></div>
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass"
                style={styles.card}
            >
                <div style={styles.header}>
                    <h1 style={styles.title}><span style={{color: '#ff6b00'}}>P</span>ro<span style={{color: '#ff6b00'}}>B</span>loom</h1>
                    <p style={styles.subtitle}>Instant Ordering</p>
                </div>

                <form onSubmit={onSignup} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Phone Number</label>
                        <div style={styles.inputWrapper}>
                            <Phone size={20} style={styles.icon} />
                            <input 
                                type="tel" 
                                placeholder="Enter 10-digit number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                style={styles.input}
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    {error && <p style={styles.error}>{error}</p>}

                    <button type="submit" disabled={loading} style={styles.button}>
                        {loading ? <Loader2 className="animate-spin" /> : <>Start Ordering <ChevronRight size={20} /></>}
                    </button>
                </form>

                <div style={styles.footer}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
                        By continuing, you agree to our Terms
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

const styles = {
    container: {
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'url("https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '20px'
    },
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)'
    },
    card: {
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        borderRadius: '24px',
        textAlign: 'center',
    },
    header: { marginBottom: '40px' },
    title: { fontSize: '32px', fontWeight: '800', color: '#fff', marginBottom: '8px' },
    subtitle: { color: 'var(--text-muted)', fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase' },
    form: { display: 'flex', flexDirection: 'column', gap: '24px' },
    inputGroup: { textAlign: 'left' },
    label: { color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' },
    info: { color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' },
    inputWrapper: {
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '0 16px',
        height: '56px',
        transition: 'border-color 0.3s'
    },
    icon: { color: 'var(--primary)', marginRight: '12px' },
    input: {
        flex: 1,
        background: 'none',
        border: 'none',
        color: '#fff',
        fontSize: '18px',
        letterSpacing: '1px'
    },
    button: {
        background: 'var(--primary)',
        color: '#fff',
        height: '56px',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: '0 8px 20px rgba(255, 77, 77, 0.3)'
    },
    error: { color: '#FF4D4D', fontSize: '13px', marginTop: '8px' },
    backBtn: {
        alignSelf: 'flex-start',
        color: 'var(--text-muted)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '-10px'
    }
};
