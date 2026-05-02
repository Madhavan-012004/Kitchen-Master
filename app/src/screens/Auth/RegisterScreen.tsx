import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Easing, Modal, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { ActivityIndicator } from 'react-native-paper';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');

type FormKey = 'name' | 'email' | 'password' | 'restaurantName' | 'phone' | 'address';

interface FieldDef {
    icon: string;
    label: string;
    field: FormKey;
    placeholder: string;
    keyboardType?: any;
    secure?: boolean;
    autoCapitalize?: any;
}

export default function RegisterScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const [form, setForm] = useState({ 
        name: '', email: '', password: '', 
        restaurantName: '', phone: '', 
        address: '', latitude: null as number | null, longitude: null as number | null 
    });
    const [showPw, setShowPw] = useState(false);
    const [isLoadingLoc, setIsLoadingLoc] = useState(false);
    const [focused, setFocused] = useState<FormKey | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [useBackupMap, setUseBackupMap] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [pendingCoords, setPendingCoords] = useState<{ latitude: number, longitude: number } | null>(null);
    const mapRef = useRef<MapView>(null);
    const webViewRef = useRef<WebView>(null);
    const [mapRegion, setMapRegion] = useState({
        latitude: 12.9716, 
        longitude: 77.5946,
        latitudeDelta: 0.015,
        longitudeDelta: 0.012,
    });
    const { register, isLoading, error, clearError } = useAuthStore();

    const FIELDS: FieldDef[] = [
        { icon: 'person', label: 'Your Name', field: 'name', placeholder: 'John Doe', autoCapitalize: 'words' },
        { icon: 'restaurant', label: 'Restaurant Name', field: 'restaurantName', placeholder: 'My Restaurant', autoCapitalize: 'words' },
        { icon: 'mail', label: 'Email Address', field: 'email', placeholder: 'you@restaurant.com', keyboardType: 'email-address', autoCapitalize: 'none' },
        { icon: 'call', label: 'Phone Number', field: 'phone', placeholder: '+91 9876543210', keyboardType: 'phone-pad', autoCapitalize: 'none' },
        { icon: 'lock-closed', label: 'Password', field: 'password', placeholder: 'Min. 6 characters', secure: true, autoCapitalize: 'none' },
    ];

    // ─── Animations ─────────────────────────────────────────────────────────
    const entranceAnim = useRef(new Animated.Value(0)).current;
    const orb1Anim = useRef(new Animated.Value(0)).current;
    const orb2Anim = useRef(new Animated.Value(0)).current;
    const btnScaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(entranceAnim, {
            toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }).start();

        const floatAnim = (value: Animated.Value, duration: number, delay: number = 0) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(value, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                    Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
                ])
            ).start();
        };

        floatAnim(orb1Anim, 9000);
        floatAnim(orb2Anim, 11000, 1500);
    }, []);

    const set = (key: FormKey, val: string) => setForm(f => ({ ...f, [key]: val }));

    const handleRegister = async () => {
        if (!form.name || !form.email || !form.password || !form.restaurantName) return;

        Animated.sequence([
            Animated.timing(btnScaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(btnScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start();

        try { await register(form); } catch (_) { }
    };

    const handlePickLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            alert('Permission to access location was denied');
            return;
        }

        setIsLoadingLoc(true);
        setShowMap(true);

        try {
            const lastLoc = await Location.getLastKnownPositionAsync({});
            if (lastLoc) {
                setMapRegion(r => ({ ...r, latitude: lastLoc.coords.latitude, longitude: lastLoc.coords.longitude }));
            }

            const location = await Location.getCurrentPositionAsync({ 
                accuracy: Location.Accuracy.Balanced,
            });
            
            setMapRegion(r => ({
                ...r,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            }));
            
            setPendingCoords({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });

            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.012,
                }, 1000);
            }
        } catch (err) {
            console.log('Location fetch failed');
        } finally {
            setIsLoadingLoc(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const results = await Location.geocodeAsync(searchQuery);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                const newRegion = {
                    ...mapRegion,
                    latitude,
                    longitude,
                };
                setMapRegion(newRegion);
                setPendingCoords({ latitude, longitude });
                
                if (mapRef.current) {
                    mapRef.current.animateToRegion(newRegion, 1000);
                }
            } else {
                alert('No results found for this address.');
            }
        } catch (err) {
            alert('Error searching for location.');
        } finally {
            setIsSearching(false);
        }
    };

    const updateMarker = (coords: { latitude: number, longitude: number }) => {
        setPendingCoords(coords);
    };

    const handleConfirmSelection = async () => {
        if (!pendingCoords) return;
        
        const coords = pendingCoords;
        setForm(f => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
        setShowMap(false);
        
        try {
            const [result] = await Location.reverseGeocodeAsync(coords);
            if (result) {
                const addr = [result.name, result.street, result.city, result.region, result.postalCode]
                    .filter(Boolean)
                    .join(', ');
                set('address', addr);
            }
        } catch (_) {}
    };

    const isFormValid = !!(form.name && form.email && form.password.length >= 6 && form.restaurantName);

    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const orb1Y = orb1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });
    const orb2X = orb2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });

    return (
        <View style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <LinearGradient colors={gradients.background} style={StyleSheet.absoluteFillObject} />

            <Animated.View style={[themedStyles.orb, themedStyles.orbTopLeft, { transform: [{ translateY: orb1Y }] }]} />
            <Animated.View style={[themedStyles.orb, themedStyles.orbBottomRight, { transform: [{ translateX: orb2X }] }]} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={themedStyles.flex}>
                <ScrollView contentContainerStyle={themedStyles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                    <Animated.View style={[themedStyles.contentWrapper, { opacity: entranceAnim, transform: [{ translateY }] }]}>

                        <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                        </TouchableOpacity>

                        <View style={themedStyles.header}>
                            <LinearGradient colors={gradients.primary} style={themedStyles.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                <Ionicons name="rocket" size={28} color={colors.white} />
                            </LinearGradient>
                            <Text style={themedStyles.title}>Create Account</Text>
                            <Text style={themedStyles.subtitle}>Start managing your restaurant the modern way.</Text>
                        </View>

                        <View style={themedStyles.glassContainer}>
                            <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={themedStyles.glassBlur}>

                                {error && (
                                    <View style={themedStyles.errorBanner}>
                                        <Ionicons name="warning" size={18} color={colors.error} />
                                        <Text style={themedStyles.errorText}>{error}</Text>
                                        <TouchableOpacity onPress={clearError}>
                                            <Ionicons name="close" size={16} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {FIELDS.map(f => (
                                    <View key={f.field} style={themedStyles.formGroup}>
                                        <Text style={themedStyles.label}>{f.label}{f.field !== 'phone' ? ' *' : ''}</Text>
                                        <View style={[themedStyles.inputWrapper, focused === f.field && themedStyles.inputWrapperFocused]}>
                                            <Ionicons name={f.icon as any} size={18} color={focused === f.field ? colors.primary : colors.textMuted} style={themedStyles.inputIcon} />
                                            <TextInput
                                                style={themedStyles.input}
                                                value={form[f.field]}
                                                onChangeText={v => set(f.field, v)}
                                                placeholder={f.placeholder}
                                                placeholderTextColor={colors.textMuted}
                                                keyboardType={f.keyboardType || 'default'}
                                                autoCapitalize={f.autoCapitalize || 'sentences'}
                                                secureTextEntry={f.secure && !showPw}
                                                autoCorrect={false}
                                                onFocus={() => setFocused(f.field)}
                                                onBlur={() => setFocused(null)}
                                            />
                                            {f.secure && (
                                                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={themedStyles.eyeBtn}>
                                                    <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}

                                {/* Location Section */}
                                <View style={themedStyles.formGroup}>
                                    <Text style={themedStyles.label}>Restaurant Location</Text>
                                    <TouchableOpacity 
                                        style={[themedStyles.locationBtn, form.latitude ? themedStyles.locationBtnActive : null]} 
                                        onPress={handlePickLocation}
                                        disabled={isLoadingLoc}
                                    >
                                        {isLoadingLoc ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Ionicons 
                                                name={form.latitude ? "location" : "location-outline"} 
                                                size={20} 
                                                color={form.latitude ? colors.primary : colors.textMuted} 
                                            />
                                        )}
                                        <Text style={[themedStyles.locationBtnText, form.latitude ? themedStyles.locationBtnTextActive : null]}>
                                            {isLoadingLoc ? "Fetching Location..." : form.latitude ? "Location Selected" : "Pin on Map"}
                                        </Text>
                                        {!isLoadingLoc && form.latitude && <Ionicons name="checkmark-circle" size={18} color={colors.success} />}
                                    </TouchableOpacity>
                                    
                                    {form.address ? (
                                        <Text style={themedStyles.addressDisplay} numberOfLines={2}>{form.address}</Text>
                                    ) : null}
                                </View>

                                <Animated.View style={{ transform: [{ scale: btnScaleAnim }], marginTop: Spacing.xl }}>
                                    <TouchableOpacity
                                        style={[themedStyles.primaryBtn, (!isFormValid || isLoading) && themedStyles.primaryBtnDisabled]}
                                        onPress={handleRegister}
                                        disabled={isLoading || !isFormValid}
                                        activeOpacity={0.9}
                                    >
                                        <LinearGradient
                                            colors={(!isFormValid) ? [colors.primary + '80', colors.primary + '80'] : gradients.primary}
                                            style={StyleSheet.absoluteFillObject}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        />
                                        <Text style={themedStyles.primaryBtnText}>{isLoading ? 'Creating...' : 'Create Account'}</Text>
                                        {!isLoading && <Ionicons name="arrow-forward" size={18} color={colors.white} style={{ marginLeft: 8 }} />}
                                    </TouchableOpacity>
                                </Animated.View>

                            </BlurView>
                        </View>

                        <View style={themedStyles.footer}>
                            <Text style={themedStyles.footerText}>Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                                <Text style={themedStyles.footerLink}> Sign In</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={showMap} animationType="fade" transparent={false}>
                <View style={themedStyles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={themedStyles.map}
                        initialRegion={{ latitude: pendingCoords?.latitude || 12.9716, longitude: pendingCoords?.longitude || 77.5946, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                        onPress={e => setPendingCoords(e.nativeEvent.coordinate)}
                        showsUserLocation={true}
                    >
                        <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
                         {form.latitude && form.longitude && !pendingCoords && (
                            <Marker coordinate={{ latitude: form.latitude, longitude: form.longitude }} pinColor={colors.primary} />
                        )}
                         {pendingCoords && (
                            <Marker coordinate={pendingCoords} draggable onDragEnd={(e) => updateMarker(e.nativeEvent.coordinate)} />
                        )}
                        {!form.latitude && !pendingCoords && (
                            <Marker coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }} opacity={0.5} />
                        )}
                    </MapView>
                    
                    <View style={themedStyles.mapOverlay}>
                        <TouchableOpacity style={themedStyles.mapCloseBtn} onPress={() => {
                            setShowMap(false);
                            setSearchQuery('');
                        }}>
                            <Ionicons name="close" size={24} color={colors.white} />
                        </TouchableOpacity>

                        <View style={themedStyles.searchBarWrapper}>
                            <View style={themedStyles.searchBar}>
                                <Ionicons name="search" size={18} color={colors.textMuted} style={themedStyles.searchIcon} />
                                <TextInput
                                    style={themedStyles.searchInput}
                                    placeholder="Search address"
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    onSubmitEditing={handleSearch}
                                    returnKeyType="search"
                                />
                            </View>
                        </View>
                        
                        <TouchableOpacity style={themedStyles.recenterBtn} onPress={handlePickLocation}>
                            <Ionicons name="locate" size={24} color={colors.white} />
                        </TouchableOpacity>
                    </View>

                    {pendingCoords && (
                        <View style={themedStyles.mapFooter}>
                            <TouchableOpacity style={themedStyles.confirmBtn} onPress={handleConfirmSelection}>
                                <LinearGradient colors={gradients.primary} style={themedStyles.confirmBtnGradient}>
                                    <Text style={themedStyles.confirmBtnText}>Confirm Location</Text>
                                    <Ionicons name="checkmark" size={20} color={colors.white} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background[0] },
    flex: { flex: 1 },
    orb: { position: 'absolute', width: width * 1.5, height: width * 1.5, borderRadius: width * 0.75, opacity: 0.12 },
    orbTopLeft: { backgroundColor: colors.primary, top: -width * 0.5, left: -width * 0.5 },
    orbBottomRight: { backgroundColor: colors.accentBlue || '#4C8EFF', bottom: -width * 0.5, right: -width * 0.5 },
    scrollContent: { flexGrow: 1, padding: Spacing.xl, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
    contentWrapper: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingBottom: Spacing.xxxl },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xxl },
    header: { marginBottom: Spacing.xxxl },
    iconCircle: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.primary },
    title: { ...Typography.h1, color: colors.textPrimary, marginBottom: Spacing.xs, letterSpacing: -0.5 },
    subtitle: { ...Typography.body1, color: colors.textSecondary },
    glassContainer: { borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...Shadows.lg },
    glassBlur: { padding: Spacing.xxl },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.error + '26', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.error + '4D', marginBottom: Spacing.xl, gap: 10 },
    errorText: { flex: 1, ...Typography.body2, color: colors.error },
    formGroup: { marginBottom: Spacing.lg },
    label: { ...Typography.overline, color: colors.textSecondary, marginBottom: Spacing.sm, letterSpacing: 1.5 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 56, backgroundColor: colors.glass, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.lg },
    inputWrapperFocused: { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '66' },
    inputIcon: { marginRight: Spacing.md },
    input: { flex: 1, ...Typography.body1, color: colors.textPrimary, height: '100%' },
    eyeBtn: { padding: Spacing.sm, marginRight: -Spacing.sm },
    primaryBtn: { height: 56, borderRadius: Radius.md, overflow: 'hidden', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...Shadows.primary },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { ...Typography.button, color: colors.white, letterSpacing: 0.5 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxxl },
    footerText: { ...Typography.body1, color: colors.textSecondary },
    footerLink: { ...Typography.body1, color: colors.textPrimary, fontWeight: '600' },
    locationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glass, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: Spacing.md, gap: 12, height: 56 },
    locationBtnActive: { backgroundColor: colors.primary + '1A', borderColor: colors.primary },
    locationBtnText: { ...Typography.body1, color: colors.textMuted, flex: 1 },
    locationBtnTextActive: { color: colors.textPrimary, fontWeight: '600' },
    addressDisplay: { ...Typography.caption, color: colors.textSecondary, marginTop: Spacing.xs, paddingHorizontal: Spacing.xs },
    mapContainer: { flex: 1, backgroundColor: colors.background[0] },
    map: { flex: 1 },
    mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: Spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
    searchBarWrapper: { flex: 1, marginHorizontal: Spacing.md },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    searchIcon: { marginRight: Spacing.xs },
    searchInput: { flex: 1, ...Typography.body2, color: colors.white, height: '100%' },
    mapCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    recenterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    mapFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl },
    confirmBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadows.lg },
    confirmBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
    confirmBtnText: { ...Typography.button, color: colors.white, fontSize: 16 }
});
