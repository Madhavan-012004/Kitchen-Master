import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, ChevronRight, Utensils, Zap, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import './Welcome.css';

export default function Welcome() {
    const { restaurantId, tableNumber } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [restaurant, setRestaurant] = useState(null);

    // Load restaurant info for personalized branding
    useEffect(() => {
        const fetchRestaurant = async () => {
            try {
                const res = await api.get(`/auth/public/${restaurantId}`);
                if (res.data?.data) setRestaurant(res.data.data);
            } catch (e) {
                // Silently fail — we'll show generic brand
            }
        };
        fetchRestaurant();

        // If already logged in, skip to menu
        const token = localStorage.getItem('km_token');
        const user = JSON.parse(localStorage.getItem('km_user') || '{}');
        if (token && user?.phone) {
            navigate(`/menu/${restaurantId}/${tableNumber}`, { replace: true });
        }
    }, [restaurantId, tableNumber]);

    const tableLabel = tableNumber === 'Takeaway'
        ? '🛵 Takeaway Order'
        : `🪑 Table ${tableNumber}`;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimName = name.trim();
        const cleanPhone = phone.replace(/\D/g, '');

        if (!trimName || trimName.length < 2) {
            setError('Please enter your full name.');
            return;
        }
        if (cleanPhone.length < 10) {
            setError('Please enter a valid 10-digit phone number.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/direct-login', {
                phone: cleanPhone,
                name: trimName,
            });
            localStorage.setItem('km_token', res.data.data.token);
            const userData = { ...res.data.data.user, name: trimName };
            localStorage.setItem('km_user', JSON.stringify(userData));
            navigate(`/menu/${restaurantId}/${tableNumber}`, { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to connect. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const toggleLang = (lang) => {
        i18n.changeLanguage(lang);
        localStorage.setItem('customerLanguage', lang);
    };

    const containerVariants = {
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 28 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
    };

    return (
        <div className="welcome-page">
            {/* Animated Background */}
            <div className="welcome-bg" />
            <div className="welcome-gradient" />

            {/* Floating colour orbs */}
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />

            {/* Top Brand */}
            <motion.div
                className="welcome-top-brand"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="brand-logo-ring">🍽️</div>
                <div className="brand-name">
                    {restaurant?.restaurantName
                        ? restaurant.restaurantName
                        : <><span>Pro</span>Bloom</>
                    }
                </div>
                <div className="brand-tagline">Premium Dining Experience</div>
            </motion.div>

            {/* Bottom Sheet */}
            <motion.div
                className="welcome-card"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ delay: 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="welcome-card-handle" />

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* Language Toggle */}
                    <motion.div variants={itemVariants} className="welcome-lang-toggle">
                        <button
                            className={`lang-btn-sm ${i18n.language !== 'ta' ? 'active' : ''}`}
                            onClick={() => toggleLang('en')}
                        >
                            🌐 English
                        </button>
                        <button
                            className={`lang-btn-sm ${i18n.language === 'ta' ? 'active' : ''}`}
                            onClick={() => toggleLang('ta')}
                        >
                            🌐 தமிழ்
                        </button>
                    </motion.div>

                    {/* Table Badge */}
                    <motion.div variants={itemVariants} className="welcome-table-badge">
                        <span className="dot" />
                        {tableLabel}
                    </motion.div>

                    {/* Headline */}
                    <motion.h1 variants={itemVariants} className="welcome-headline">
                        {t('welcome.headline', "Welcome! Let's")} <br />
                        <span className="highlight">
                            {t('welcome.headline2', 'get you started')}
                        </span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="welcome-subline">
                        {t('welcome.subline', 'Tell us your name and number to place orders, track status, and request your bill — all from this screen.')}
                    </motion.p>

                    {/* Feature Pills */}
                    <motion.div variants={itemVariants} className="welcome-features">
                        <span className="feature-pill"><span className="pill-icon">⚡</span> Instant orders</span>
                        <span className="feature-pill"><span className="pill-icon">📍</span> Live tracking</span>
                        <span className="feature-pill"><span className="pill-icon">🧾</span> Request bill</span>
                    </motion.div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <motion.div variants={itemVariants} className="welcome-form">
                            {/* Name */}
                            <div className="input-field-wrap">
                                <span className="input-icon"><User size={18} /></span>
                                <input
                                    id="welcome-name"
                                    className="welcome-input"
                                    type="text"
                                    placeholder={t('welcome.name_placeholder', 'Your full name')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                />
                            </div>

                            {/* Phone */}
                            <div className="input-field-wrap">
                                <span className="input-icon"><Phone size={18} /></span>
                                <span className="phone-prefix">+91</span>
                                <input
                                    id="welcome-phone"
                                    className="welcome-input phone-input"
                                    type="tel"
                                    inputMode="numeric"
                                    placeholder={t('welcome.phone_placeholder', '10-digit mobile number')}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    autoComplete="tel"
                                />
                            </div>
                        </motion.div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    className="welcome-error"
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    style={{ marginBottom: '16px' }}
                                >
                                    ⚠️ {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            variants={itemVariants}
                            type="submit"
                            id="welcome-submit"
                            className="welcome-cta"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                        >
                            {loading
                                ? <span className="cta-spinner" />
                                : <>
                                    {t('welcome.cta', 'View Menu & Order')}
                                    <ChevronRight size={22} strokeWidth={2.5} />
                                </>
                            }
                        </motion.button>
                    </form>

                    <motion.p variants={itemVariants} className="welcome-footer-note">
                        🔒 {t('welcome.privacy', 'Your number is only used to serve your order. We never share it.')}
                    </motion.p>
                </motion.div>
            </motion.div>
        </div>
    );
}
