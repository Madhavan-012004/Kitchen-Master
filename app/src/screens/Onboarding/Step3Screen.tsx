import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { authAPI } from '../../api/auth';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

export default function Step3Screen({ navigation }: any) {
    const { user, updateUser } = useAuthStore();
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const iconScale = useRef(new Animated.Value(0.5)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
            Animated.spring(iconScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const handleFinish = async () => {
        try {
            const res = await authAPI.completeOnboarding(3, {});
            updateUser(res.data.data.user);
        } catch (error) { console.error(error); }
    };

    const achievements = [
        { icon: 'checkmark-circle', label: 'Account created', color: colors.success || '#00D68F' },
        { icon: 'checkmark-circle', label: 'AI tools activated', color: colors.success || '#00D68F' },
        { icon: 'checkmark-circle', label: 'Ready to take orders', color: colors.success || '#00D68F' },
    ];

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <View style={themedStyles.bgOrb} />

            <Animated.View style={[themedStyles.heroContainer, { opacity: fadeAnim }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <LinearGradient colors={[colors.success || '#00D68F', colors.success || '#00B377']} style={themedStyles.heroCircle}>
                        <Ionicons name="rocket" size={56} color={colors.white} />
                    </LinearGradient>
                </Animated.View>

                {user?.restaurantName && (
                    <Animated.View style={[themedStyles.nameTag, { opacity: fadeAnim }]}>
                        <Text style={themedStyles.nameTagText}>🎉 {user.restaurantName} is ready!</Text>
                    </Animated.View>
                )}
            </Animated.View>

            <Animated.View style={[themedStyles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={themedStyles.dots}>
                    <View style={themedStyles.dot} />
                    <View style={themedStyles.dot} />
                    <View style={[themedStyles.dot, themedStyles.activeDot, { backgroundColor: colors.success || '#00D68F' }]} />
                </View>

                <Text style={themedStyles.title}>Ready to Serve! 🚀</Text>
                <Text style={themedStyles.desc}>
                    Welcome to <Text style={{color: colors.primary}}>P</Text>ro<Text style={{color: colors.primary}}>B</Text>loom. Start by adding your menu items, set up your inventory, and let AI handle the rest.
                </Text>

                <View style={themedStyles.achievementList}>
                    {achievements.map((a, i) => (
                        <View key={i} style={themedStyles.achievementRow}>
                            <Ionicons name={a.icon as any} size={20} color={a.color} />
                            <Text style={themedStyles.achievementText}>{a.label}</Text>
                        </View>
                    ))}
                </View>

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity style={themedStyles.nextBtn} onPress={handleFinish} activeOpacity={0.85}>
                        <LinearGradient colors={[colors.success || '#00D68F', colors.success || '#00B377']} style={themedStyles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={themedStyles.nextBtnText}>Launch Dashboard</Text>
                            <Ionicons name="rocket" size={20} color={colors.white} />
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    bgOrb: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: (colors.success || '#00D68F') + '14', top: -150, right: -100 },
    heroContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
    heroCircle: {
        width: 140, height: 140, borderRadius: 70,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.success || '#00D68F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 40, elevation: 20,
    },
    nameTag: {
        backgroundColor: (colors.success || '#00D68F') + '26', paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: Radius.round, borderWidth: 1, borderColor: (colors.success || '#00D68F') + '4D',
    },
    nameTagText: { ...Typography.buttonSm, color: colors.success || '#00D68F' },
    bottomSheet: {
        backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: Spacing.xxl, paddingTop: Spacing.xxxl, borderTopWidth: 1, borderTopColor: colors.border,
    },
    dots: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    activeDot: { width: 28, borderRadius: 4 },
    title: { ...Typography.h2, color: colors.textPrimary, marginBottom: Spacing.md },
    desc: { ...Typography.body1, color: colors.textSecondary, lineHeight: 26, marginBottom: Spacing.xl },
    achievementList: { gap: 12, marginBottom: Spacing.xl },
    achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    achievementText: { ...Typography.body1, color: colors.textPrimary },
    nextBtn: { borderRadius: Radius.round, overflow: 'hidden', ...Shadows.green },
    nextBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    nextBtnText: { ...Typography.button, color: colors.white },
});
