import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

const W = Dimensions.get('window').width;

export default function Step1Screen({ navigation }: any) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const iconScale = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
            Animated.spring(iconScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <LinearGradient colors={['#0A0C18', '#0D0F1A', '#0F1428']} style={styles.container}>
            <View style={styles.bgOrb1} />
            <View style={styles.bgOrb2} />

            <Animated.View style={[styles.heroContainer, { opacity: fadeAnim }]}>
                <Animated.View style={[styles.heroGraphic, { transform: [{ scale: iconScale }] }]}>
                    <LinearGradient colors={['#FF8A5C', '#FF6B35', '#E55A24']} style={styles.heroCircle}>
                        <Ionicons name="flash" size={56} color={Colors.white} />
                    </LinearGradient>
                    <View style={styles.floatingChip1}>
                        <Text style={styles.chipEmoji}>⚡</Text>
                        <Text style={styles.chipText}>0.3s/order</Text>
                    </View>
                    <View style={styles.floatingChip2}>
                        <Text style={styles.chipEmoji}>📱</Text>
                        <Text style={styles.chipText}>Any device</Text>
                    </View>
                </Animated.View>
            </Animated.View>

            <Animated.View style={[styles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.dots}>
                    <View style={[styles.dot, styles.activeDot]} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                </View>

                <Text style={styles.title}>Lightning Fast Billing</Text>
                <Text style={styles.desc}>
                    Turn any phone or tablet into a high-speed POS. No bulky hardware. Orders in seconds, not minutes.
                </Text>

                <View style={styles.featureRow}>
                    {['Intuitive UI', 'Offline Ready', 'Multi-device'].map(f => (
                        <View key={f} style={styles.featureChip}>
                            <Ionicons name="checkmark" size={12} color={Colors.primary} />
                            <Text style={styles.featureText}>{f}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.nextBtn} onPress={() => navigation.navigate('OnboardingStep2')} activeOpacity={0.85}>
                    <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.nextBtnText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => useAuthStore.getState().logout()}>
                    <Text style={styles.skipText}>Sign out / Switch account</Text>
                </TouchableOpacity>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bgOrb1: { position: 'absolute', width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(255,107,53,0.07)', top: -100, right: -100 },
    bgOrb2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(76,142,255,0.05)', bottom: 200, left: -80 },
    heroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    heroGraphic: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    heroCircle: {
        width: 140, height: 140, borderRadius: 70,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20,
    },
    floatingChip1: {
        position: 'absolute', top: -20, right: -80, flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(26,32,64,0.95)', borderRadius: Radius.round,
        paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.glassBorder,
    },
    floatingChip2: {
        position: 'absolute', bottom: -20, left: -90, flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(26,32,64,0.95)', borderRadius: Radius.round,
        paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.glassBorder,
    },
    chipEmoji: { fontSize: 14 },
    chipText: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
    bottomSheet: {
        backgroundColor: 'rgba(19,23,43,0.95)', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: Spacing.xxl, paddingTop: Spacing.xxxl, borderTopWidth: 1, borderTopColor: Colors.glassBorder,
    },
    dots: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
    activeDot: { width: 28, borderRadius: 4, backgroundColor: Colors.primary },
    title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.md },
    desc: { ...Typography.body1, color: Colors.textSecondary, lineHeight: 26, marginBottom: Spacing.xl },
    featureRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xxl, flexWrap: 'wrap' },
    featureChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,107,53,0.1)', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.round, borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)',
    },
    featureText: { ...Typography.caption, color: Colors.primary, fontWeight: '700' },
    nextBtn: { borderRadius: Radius.round, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadows.primary },
    nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    nextBtnText: { ...Typography.button, color: Colors.white },
    skipText: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
});
