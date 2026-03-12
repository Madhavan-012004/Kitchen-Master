import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import OnboardingStack from './OnboardingStack';

const RootNavigator = () => {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated) return <AuthStack />;
    if (isAuthenticated && user && !user.onboardingCompleted) return <OnboardingStack />;
    return <MainTabs />;
};

export default function Navigation() {
    return (
        <NavigationContainer>
            <RootNavigator />
        </NavigationContainer>
    );
}
