import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingStep1 from '../screens/Onboarding/Step1Screen';
import OnboardingStep2 from '../screens/Onboarding/Step2Screen';
import OnboardingStep3 from '../screens/Onboarding/Step3Screen';

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="OnboardingStep1" component={OnboardingStep1} />
            <Stack.Screen name="OnboardingStep2" component={OnboardingStep2} />
            <Stack.Screen name="OnboardingStep3" component={OnboardingStep3} />
        </Stack.Navigator>
    );
}
