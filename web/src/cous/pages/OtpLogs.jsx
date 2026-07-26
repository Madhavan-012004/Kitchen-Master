import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, RefreshCw, Clock, Smartphone } from 'lucide-react';
import api from '../api/client';

export default function OtpLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            const res = await api.get('/auth/otp/logs');
            setLogs(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={styles.container}>
            <div className="glass" style={styles.header}>
                <Shield color="var(--primary)" size={32} />
                <h1 style={styles.title}>OTP Monitor</h1>
                <p style={styles.subtitle}>Real-time Debug Logs</p>
                <button onClick={fetchLogs} style={styles.refreshBtn}>
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div style={styles.list}>
                <AnimatePresence>
                    {logs.map((log, i) => (
                        <motion.div 
                            key={log.time}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="premium-card"
                            style={styles.card}
                        >
                            <div style={styles.cardHeader}>
                                <Smartphone size={18} color="var(--primary)" />
                                <span style={styles.phone}>{log.phone}</span>
                            </div>
                            <div style={styles.otpWrapper}>
                                <span style={styles.otpLabel}>CODE</span>
                                <span style={styles.otp}>{log.otp}</span>
                            </div>
                            <div style={styles.timeWrapper}>
                                <Clock size={12} />
                                <span>{new Date(log.time).toLocaleTimeString()}</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {logs.length === 0 && !loading && (
                    <div style={styles.empty}>No OTPs generated yet.</div>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        background: '#0F0F0F',
        padding: '24px',
        color: '#fff'
    },
    header: {
        padding: '32px',
        borderRadius: '24px',
        textAlign: 'center',
        position: 'relative',
        marginBottom: '32px'
    },
    title: { fontSize: '24px', fontWeight: '800', marginTop: '16px' },
    subtitle: { color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' },
    refreshBtn: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        padding: '10px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
        color: '#fff'
    },
    list: { display: 'flex', flexDirection: 'column', gap: '16px' },
    card: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderLeft: '4px solid var(--primary)'
    },
    cardHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
    phone: { fontWeight: '700', fontSize: '18px' },
    otpWrapper: {
        background: 'rgba(255,255,255,0.05)',
        padding: '12px 20px',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    otpLabel: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: '800' },
    otp: { fontSize: '24px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '4px' },
    timeWrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        color: 'var(--text-muted)'
    },
    empty: { textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }
};
