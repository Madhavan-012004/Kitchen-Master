import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';

const { width } = Dimensions.get('window');

type LockScreenState = 'checking' | 'setup_pin' | 'confirm_pin' | 'unlock';

export default function AppLockScreen() {
    const { setUnlocked, logout, user } = useAuthStore();

    const [screenState, setScreenState] = useState<LockScreenState>('checking');
    const [savedMpin, setSavedMpin] = useState<string | null>(null);

    const [pin, setPin] = useState('');
    const [setupPin, setSetupPin] = useState('');
    const [errorText, setErrorText] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        checkInitialState();
    }, []);

    const checkInitialState = async () => {
        try {
            const mpin = await SecureStore.getItemAsync('km_mpin');
            if (mpin && mpin.length === 4) {
                setSavedMpin(mpin);
                setScreenState('unlock');
                attemptBiometricUnlock();
            } else {
                setScreenState('setup_pin');
            }
        } catch (error) {
            setScreenState('setup_pin');
        }
    };

    const attemptBiometricUnlock = async () => {
        setIsAuthenticating(true);
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (hasHardware && isEnrolled) {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Unlock ProBloom POS',
                    fallbackLabel: 'Use MPIN',
                    disableDeviceFallback: false,
                });

                if (result.success) {
                    setUnlocked(true);
                }
            }
        } catch (error) {
            console.warn('Biometric error', error);
        } finally {
            setIsAuthenticating(false);
        }
    };

    const handlePress = (num: string) => {
        if (pin.length < 4) {
            setErrorText('');
            setPin(prev => {
                const newPin = prev + num;
                if (newPin.length === 4) {
                    setTimeout(() => processPin(newPin), 50);
                }
                return newPin;
            });
        }
    };

    const handleBackspace = () => {
        if (pin.length > 0) {
            setPin(prev => prev.slice(0, -1));
            setErrorText('');
        }
    };

    const processPin = async (currentPin: string) => {
        if (screenState === 'unlock') {
            if (currentPin === savedMpin) {
                setUnlocked(true);
            } else {
                setErrorText('Incorrect MPIN');
                setPin(''); // Reset for retry
            }
        } else if (screenState === 'setup_pin') {
            setSetupPin(currentPin);
            setPin('');
            setScreenState('confirm_pin');
        } else if (screenState === 'confirm_pin') {
            if (currentPin === setupPin) {
                try {
                    await SecureStore.setItemAsync('km_mpin', currentPin);
                    setUnlocked(true);
                } catch (e) {
                    setErrorText('Failed to save MPIN');
                    setPin('');
                }
            } else {
                setErrorText('MPINs do not match. Try again.');
                setPin('');
                setSetupPin('');
                setScreenState('setup_pin');
            }
        }
    };

    const handleLogout = () => {
        logout();
    };

    if (screenState === 'checking') {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#10b981" />
            </SafeAreaView>
        );
    }

    const renderHeader = () => {
        if (screenState === 'unlock') return `Welcome Back, ${user?.name?.split(' ')[0] || 'User'}`;
        if (screenState === 'setup_pin') return 'Set up your MPIN';
        if (screenState === 'confirm_pin') return 'Confirm your MPIN';
        return '';
    };

    const renderSubTitle = () => {
        if (screenState === 'unlock') return 'Enter your 4-digit MPIN or use Biometrics';
        if (screenState === 'setup_pin') return 'Create a 4-digit PIN for quick access';
        if (screenState === 'confirm_pin') return 'Re-enter the PIN to confirm';
        return '';
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topSection}>
                <View style={styles.iconContainer}>
                    <Ionicons name="lock-closed" size={32} color="#10b981" />
                </View>
                <Text style={styles.title}>{renderHeader()}</Text>
                <Text style={styles.subtitle}>{renderSubTitle()}</Text>

                <View style={styles.dotsContainer}>
                    {[1, 2, 3, 4].map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                pin.length > index ? styles.dotFilled : null,
                                errorText ? styles.dotError : null
                            ]}
                        />
                    ))}
                </View>

                <Text style={styles.errorText}>{errorText}</Text>
            </View>

            <View style={styles.keypadSection}>
                <View style={styles.row}>
                    {['1', '2', '3'].map(num => (
                        <TouchableOpacity key={num} style={styles.keypadButton} onPress={() => handlePress(num)}>
                            <Text style={styles.keypadText}>{num}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.row}>
                    {['4', '5', '6'].map(num => (
                        <TouchableOpacity key={num} style={styles.keypadButton} onPress={() => handlePress(num)}>
                            <Text style={styles.keypadText}>{num}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.row}>
                    {['7', '8', '9'].map(num => (
                        <TouchableOpacity key={num} style={styles.keypadButton} onPress={() => handlePress(num)}>
                            <Text style={styles.keypadText}>{num}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.row}>
                    {screenState === 'unlock' ? (
                        <TouchableOpacity style={styles.keypadButton} onPress={attemptBiometricUnlock} disabled={isAuthenticating}>
                            <Ionicons name="finger-print" size={28} color="#f8fafc" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.keypadButtonEmpty} />
                    )}
                    <TouchableOpacity style={styles.keypadButton} onPress={() => handlePress('0')}>
                        <Text style={styles.keypadText}>0</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.keypadButton} onPress={handleBackspace}>
                        <Ionicons name="backspace-outline" size={26} color="#f8fafc" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.bottomSection}>
                <TouchableOpacity style={styles.switchAccountBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#94a3b8" />
                    <Text style={styles.switchAccountText}>Switch Account / Logout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
    },
    topSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 40,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 30,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        height: 20,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: '#334155',
        backgroundColor: 'transparent',
    },
    dotFilled: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    dotError: {
        borderColor: '#ef4444',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 13,
        marginTop: 20,
        height: 20,
    },
    keypadSection: {
        paddingHorizontal: 30,
        paddingBottom: 40,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 24,
    },
    keypadButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    keypadButtonEmpty: {
        width: 72,
        height: 72,
    },
    keypadText: {
        fontSize: 28,
        fontWeight: '500',
        color: '#f8fafc',
    },
    bottomSection: {
        paddingBottom: 40,
        alignItems: 'center',
    },
    switchAccountBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
    },
    switchAccountText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
    },
});
