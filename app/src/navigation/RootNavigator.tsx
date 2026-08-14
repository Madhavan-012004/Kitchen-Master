import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../context/ThemeContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingStack from './OnboardingStack';
// @ts-ignore
import AppLockScreen from '../screens/Auth/AppLockScreen';
import NetworkErrorScreen from '../components/NetworkErrorScreen';

const RootNavigator = () => {
    const { isAuthenticated, isUnlocked, user } = useAuthStore();

    if (!isAuthenticated) return <AuthStack />;
    if (isAuthenticated && user && !user.onboardingCompleted) return <OnboardingStack />;
    if (isAuthenticated && !isUnlocked) return <AppLockScreen />;
    return <MainTabs />;
};

export default function Navigation() {
    const { isDark, colors } = useTheme();

    // Create a custom theme object for React Navigation
    const navigationTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.textPrimary,
            border: colors.border,
        },
    };

    return (
        <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
            {/* Network error overlay — renders above all navigation screens */}
            <NetworkErrorScreen />
        </NavigationContainer>
    );
}
