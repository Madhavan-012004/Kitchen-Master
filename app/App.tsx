import 'react-native-url-polyfill/auto'; // Must be first
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';

import Navigation from './src/navigation/RootNavigator';
import { getPaperTheme } from './src/theme';
import { useAuthStore } from './src/store/useAuthStore';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AttendanceHeartbeat from './src/components/AttendanceHeartbeat';

function AppContent() {
    const { theme, isDark } = useTheme();
    return (
        <PaperProvider theme={getPaperTheme(isDark)}>
            <Navigation />
            <AttendanceHeartbeat />
            <StatusBar style={isDark ? "light" : "dark"} />
            <Toast />
        </PaperProvider>
    );
}

export default function App() {
    const { loadStoredAuth } = useAuthStore();

    const [fontsLoaded, fontError] = useFonts({
        Inter_400Regular,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    const [isForceReady, setIsForceReady] = useState(false);

    useEffect(() => {
        console.log("Starting auth load...");
        async function prepare() {
            try {
                await loadStoredAuth();
                console.log("Auth load finished.");
            } catch (e) {
                console.warn(e);
            }
        }
        prepare();

        // FAILSAFE: Force the app to show after 3 seconds no matter what
        const emergencyTimer = setTimeout(() => {
            console.log("Failsafe timer triggered: Forcing app to render");
            setIsForceReady(true);
        }, 3000);

        return () => clearTimeout(emergencyTimer);
    }, []);

    const isAppReady = fontsLoaded || fontError || isForceReady;

    useEffect(() => {
        if (isAppReady) {
            console.log("App is ready, hiding splash screen");
            SplashScreen.hideAsync().catch(() => { });
        }
    }, [isAppReady]);

    if (!isAppReady) {
        return null;
    }

    return (
        <GestureHandlerRootView style={styles.root}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <AppContent />
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
});
