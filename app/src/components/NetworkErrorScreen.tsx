import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, Dimensions, StatusBar, TextInput,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetworkStore } from '../store/useNetworkStore';
import { useTheme } from '../context/ThemeContext';
import NetInfo from '@react-native-community/netinfo';
import { getApiBaseUrl, saveServerUrl, resetServerUrl } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COUNTDOWN_START = 8;
const { width } = Dimensions.get('window');

const ERROR_META: Record<string, { label: string; icon: string; tip: string }> = {
    no_internet: {
        label: 'No Internet Detected',
        icon: 'wifi-off',
        tip: 'Trying to connect… Check your Wi-Fi or mobile data.',
    },
    timeout: {
        label: 'Connection Timed Out',
        icon: 'timer-off-outline',
        tip: 'Fetching the PROBLOOM API… The server is taking longer than expected.',
    },
    server_down: {
        label: 'Backend Unreachable',
        icon: 'server-off',
        tip: 'Attempting to connect to the PROBLOOM backend API. Retrying automatically…',
    },
    server_error: {
        label: 'API Returned an Error',
        icon: 'alert-circle-outline',
        tip: 'The PROBLOOM server responded with an error. Trying to reconnect…',
    },
};

export default function NetworkErrorScreen() {
    const { isOffline, errorType, statusCode, setOffline, setOnline } = useNetworkStore();
    const { colors, isDark } = useTheme();
    const [countdown, setCountdown] = useState(COUNTDOWN_START);
    const [isRetrying, setIsRetrying] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [newUrl, setNewUrl] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');

    // Animations
    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const slideAnim  = useRef(new Animated.Value(40)).current;
    const pulseAnim  = useRef(new Animated.Value(1)).current;
    const spinAnim   = useRef(new Animated.Value(0)).current;
    const ring1Anim  = useRef(new Animated.Value(1)).current;
    const ring2Anim  = useRef(new Animated.Value(1)).current;
    const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseRef   = useRef<Animated.CompositeAnimation | null>(null);
    const ringRef    = useRef<Animated.CompositeAnimation | null>(null);

    // Slide-in / slide-out
    useEffect(() => {
        if (isOffline) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
            ]).start();
            startPulse();
            startRings();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 40, duration: 280, useNativeDriver: true }),
            ]).start();
            pulseRef.current?.stop();
            ringRef.current?.stop();
        }
    }, [isOffline]);

    // Icon pulse
    const startPulse = () => {
        pulseRef.current?.stop();
        pulseRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
            ])
        );
        pulseRef.current.start();
    };

    // Pulse rings
    const startRings = () => {
        ringRef.current?.stop();
        const makeRing = (anim: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(anim, { toValue: 1.8, duration: 1600, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 1.0, duration: 0, useNativeDriver: true }),
                ])
            );
        ringRef.current = Animated.parallel([makeRing(ring1Anim, 0), makeRing(ring2Anim, 800)]);
        ringRef.current.start();
    };

    // Spinner for loading state
    useEffect(() => {
        if (isRetrying) {
            Animated.loop(
                Animated.timing(spinAnim, { toValue: 1, duration: 700, useNativeDriver: true })
            ).start();
        } else {
            spinAnim.setValue(0);
        }
    }, [isRetrying]);

    // Auto-retry countdown
    useEffect(() => {
        if (!isOffline) return;
        setCountdown(COUNTDOWN_START);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    triggerRetry();
                    return COUNTDOWN_START;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isOffline]);

    // Load current URL for display
    useEffect(() => {
        getApiBaseUrl().then(url => {
            setCurrentUrl(url);
            setNewUrl(url.replace('/api', ''));
        });
    }, [isOffline]);

    const handleSaveUrl = async () => {
        if (!newUrl.trim()) return;
        await saveServerUrl(newUrl);
        const updated = await getApiBaseUrl();
        setCurrentUrl(updated);
        setShowSettings(false);
        triggerRetry();
    };

    const handleResetUrl = async () => {
        await resetServerUrl();
        const updated = await getApiBaseUrl();
        setCurrentUrl(updated);
        setNewUrl(updated.replace('/api', ''));
        setShowSettings(false);
        triggerRetry();
    };

    // Proactive background health check (runs on mount and every 12s)
    useEffect(() => {
        let bgInterval: ReturnType<typeof setInterval>;

        const checkHealthBg = async () => {
            // First check if device has internet at all
            const state = await NetInfo.fetch();
            if (state.isConnected === false) {
                if (!useNetworkStore.getState().isOffline) {
                    setOffline('no_internet');
                }
                return;
            }

            try {
                const base = await getApiBaseUrl();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const res = await fetch(`${base}/status`, {
                    method: 'GET',
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                
                if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) {
                    // Server is up
                    if (useNetworkStore.getState().isOffline) {
                        setOnline();
                    }
                } else if (res.status >= 500) {
                    // Server is returning 5xx
                    if (!useNetworkStore.getState().isOffline) {
                        setOffline('server_error', res.status);
                    }
                }
            } catch (e: any) {
                // Fetch failed (network error or timeout)
                console.log('[PROBLOOM] Health Check Failed:', e?.message || e);
                if (!useNetworkStore.getState().isOffline) {
                    const isTimeout = e?.name === 'TimeoutError' || e?.message?.includes('timeout');
                    setOffline(isTimeout ? 'timeout' : 'no_internet');
                }
            }
        };

        // Run immediately on mount
        checkHealthBg();

        // Run every 12s in the background
        bgInterval = setInterval(checkHealthBg, 12000);

        return () => clearInterval(bgInterval);
    }, []);

    const triggerRetry = useCallback(async () => {
        if (isRetrying) return;
        setIsRetrying(true);
        if (timerRef.current) clearInterval(timerRef.current);
        try {
            const base = await getApiBaseUrl();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(`${base}/status`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) {
                setOnline();
            }
        } catch (e: any) {
            console.log('[PROBLOOM] Manual Retry Failed:', e?.message || e);
            // Still offline
        } finally {
            setIsRetrying(false);
            setCountdown(COUNTDOWN_START);
        }
    }, [isRetrying]);

    if (!isOffline) return null;

    const meta = ERROR_META[errorType ?? 'server_down'] ?? ERROR_META.server_down;
    const spinInterpolate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const accent = '#C6F53D';  // Neon lime — matches web theme

    return (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
            <StatusBar barStyle="light-content" backgroundColor="rgba(8,19,18,0.98)" />
            <LinearGradient
                colors={['rgba(8,19,18,0.97)', 'rgba(10,24,22,0.99)']}
                style={StyleSheet.absoluteFill}
            />

            {/* Background glow circles */}
            <View style={[styles.bgGlow, styles.bgGlow1]} />
            <View style={[styles.bgGlow, styles.bgGlow2]} />

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <Animated.View style={[styles.panel, { transform: [{ translateY: slideAnim }] }]}>
                    {/* Top accent line */}
                    <LinearGradient
                        colors={['transparent', accent, 'transparent']}
                        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                        style={styles.topStrip}
                    />

                    {showSettings ? (
                        <View style={styles.settingsArea}>
                            <Text style={styles.settingsTitle}>Server Configuration</Text>
                            <Text style={styles.settingsSubtitle}>Enter your computer's IP address (e.g., 192.168.1.5:8080)</Text>
                            
                            <TextInput
                                style={styles.input}
                                value={newUrl}
                                onChangeText={setNewUrl}
                                placeholder="http://192.168.1.5:8080"
                                placeholderTextColor="#6B8A87"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <View style={styles.settingsBtns}>
                                <TouchableOpacity 
                                    style={styles.resetBtn} 
                                    onPress={handleResetUrl}
                                >
                                    <Text style={styles.resetBtnText}>Reset to Auto</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.cancelBtn} 
                                    onPress={() => setShowSettings(false)}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity 
                                style={styles.saveBtnFull} 
                                onPress={handleSaveUrl}
                            >
                                <Text style={styles.saveBtnText}>Save & Connect</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* Icon with rings */}
                            <View style={styles.iconArea}>
                                <Animated.View style={[styles.ring, styles.ring1, {
                                    transform: [{ scale: ring1Anim }],
                                    opacity: ring1Anim.interpolate({ inputRange: [1, 1.8], outputRange: [0.25, 0] }),
                                }]} />
                                <Animated.View style={[styles.ring, styles.ring2, {
                                    transform: [{ scale: ring2Anim }],
                                    opacity: ring2Anim.interpolate({ inputRange: [1, 1.8], outputRange: [0.15, 0] }),
                                }]} />
                                <Animated.View style={[styles.iconBg, { transform: [{ scale: pulseAnim }] }]}>
                                    <MaterialCommunityIcons name={meta.icon as any} size={44} color={accent} />
                                    {/* Error X badge */}
                                    <View style={styles.xBadge}>
                                        <MaterialCommunityIcons name="close" size={10} color="#fff" />
                                    </View>
                                </Animated.View>
                            </View>

                            {/* Status chip */}
                            <View style={styles.chip}>
                                <View style={styles.chipDot} />
                                <Text style={styles.chipText}>{meta.label}</Text>
                                {statusCode && (
                                    <View style={styles.codeTag}>
                                        <Text style={styles.codeTagText}>{statusCode}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Title & description */}
                            <Text style={styles.title}>Connecting to Backend API…</Text>
                            <Text style={styles.subtitle}>{meta.tip}</Text>

                            {/* Target URL Info */}
                            <View style={styles.urlInfo}>
                                <Text style={styles.urlLabel}>Target:</Text>
                                <Text style={styles.urlText} numberOfLines={1}>{currentUrl || 'Locating...'}</Text>
                            </View>

                            {/* Retry row */}
                            <View style={styles.retryRow}>
                                <TouchableOpacity
                                    style={[styles.retryBtn, isRetrying && styles.retryBtnLoading]}
                                    onPress={triggerRetry}
                                    disabled={isRetrying}
                                    activeOpacity={0.8}
                                >
                                    {isRetrying ? (
                                        <>
                                            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                                                <MaterialCommunityIcons name="loading" size={18} color={accent} />
                                            </Animated.View>
                                            <Text style={[styles.retryBtnText, { color: accent }]}>Fetching API…</Text>
                                        </>
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="refresh" size={18} color="#0F1D1B" />
                                            <Text style={styles.retryBtnText}>Fetch Again</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Countdown badge */}
                                {!isRetrying && (
                                    <View style={styles.cdBadge}>
                                        <Text style={[styles.cdNum, { color: accent }]}>{countdown}</Text>
                                        <Text style={styles.cdLabel}>sec</Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity 
                                style={styles.settingsLink}
                                onPress={() => setShowSettings(true)}
                            >
                                <MaterialCommunityIcons name="cog" size={14} color={accent} />
                                <Text style={styles.settingsLinkText}>Change Server IP</Text>
                            </TouchableOpacity>

                            {/* Auto-retry note */}
                            <Text style={styles.autoNote}>
                                Fetching API every {COUNTDOWN_START}s • Waiting for backend…
                            </Text>
                        </>
                    )}

                    {/* Brand */}
                    <View style={styles.brand}>
                        <View style={styles.brandDot} />
                        <Text style={styles.brandText}>PROBLOOM</Text>
                        <View style={styles.brandDot} />
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Animated.View>
    );
}

const ACCENT = '#C6F53D';
const DANGER = '#ef4444';
const PANEL_BG = '#0F1D1B';
const BORDER = 'rgba(198,245,61,0.15)';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bgGlow: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.06,
    },
    bgGlow1: {
        width: 350, height: 350,
        top: -80, left: -80,
        backgroundColor: ACCENT,
    },
    bgGlow2: {
        width: 250, height: 250,
        bottom: -60, right: -40,
        backgroundColor: ACCENT,
    },
    panel: {
        backgroundColor: PANEL_BG,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 24,
        padding: 32,
        width: Math.min(400, width - 40),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.7,
        shadowRadius: 32,
        elevation: 20,
    },
    topStrip: {
        position: 'absolute',
        top: 0, left: '15%', right: '15%',
        height: 2,
        borderRadius: 1,
    },
    /* Icon */
    iconArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        width: 100, height: 100,
    },
    ring: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: ACCENT,
    },
    ring1: { width: 88, height: 88 },
    ring2: { width: 110, height: 110 },
    iconBg: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(198,245,61,0.06)',
        borderWidth: 1.5,
        borderColor: 'rgba(198,245,61,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    xBadge: {
        position: 'absolute',
        top: 4, right: 4,
        width: 18, height: 18,
        borderRadius: 9,
        backgroundColor: DANGER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    /* Chip */
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.22)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 16,
    },
    chipDot: {
        width: 6, height: 6,
        borderRadius: 3,
        backgroundColor: DANGER,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '700',
        color: DANGER,
        letterSpacing: 0.4,
    },
    codeTag: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    codeTagText: { fontSize: 10, color: '#fca5a5' },
    /* Text */
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.4,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 13,
        color: '#B0BFBD',
        lineHeight: 20,
        textAlign: 'center',
        maxWidth: 280,
        marginBottom: 16,
    },
    urlInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 20,
        width: '100%',
        justifyContent: 'center',
    },
    urlLabel: {
        fontSize: 10,
        color: '#6B8A87',
        fontWeight: '700',
        marginRight: 6,
    },
    urlText: {
        fontSize: 11,
        color: ACCENT,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    settingsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
        paddingVertical: 5,
    },
    settingsLinkText: {
        fontSize: 12,
        color: ACCENT,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    /* Settings Area */
    settingsArea: {
        width: '100%',
        alignItems: 'center',
    },
    settingsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 8,
    },
    settingsSubtitle: {
        fontSize: 12,
        color: '#B0BFBD',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 18,
    },
    input: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        color: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    settingsBtns: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginBottom: 12,
    },
    resetBtn: {
        flex: 1.2,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(198,245,61,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(198,245,61,0.2)',
    },
    resetBtnText: {
        color: ACCENT,
        fontWeight: '700',
        fontSize: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    cancelBtnText: {
        color: '#6B8A87',
        fontWeight: '700',
    },
    saveBtnFull: {
        width: '100%',
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: ACCENT,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnText: {
        color: '#0F1D1B',
        fontWeight: '700',
    },
    /* Retry */
    retryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 12,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: ACCENT,
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 13,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    retryBtnLoading: {
        backgroundColor: 'rgba(198,245,61,0.15)',
    },
    retryBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F1D1B',
        letterSpacing: 0.2,
    },
    /* Countdown badge */
    cdBadge: {
        width: 52, height: 52,
        borderRadius: 26,
        borderWidth: 2,
        borderColor: 'rgba(198,245,61,0.25)',
        backgroundColor: 'rgba(198,245,61,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cdNum: {
        fontSize: 16,
        fontWeight: '800',
    },
    cdLabel: {
        fontSize: 9,
        color: '#6B8A87',
        fontWeight: '600',
        marginTop: -2,
    },
    /* Footer */
    autoNote: {
        fontSize: 11,
        color: '#6B8A87',
        marginBottom: 18,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandDot: {
        width: 3, height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(198,245,61,0.3)',
    },
    brandText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6B8A87',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
