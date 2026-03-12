import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme';

import { useAuthStore } from '../store/useAuthStore';
import { BlurView } from 'expo-blur';

// Screens
import TablesScreen from '../screens/POS/TablesScreen';
import BillingScreen from '../screens/POS/BillingScreen';
import CheckoutScreen from '../screens/POS/CheckoutScreen';
import OrderHistoryScreen from '../screens/POS/OrderHistoryScreen';
import MenuListScreen from '../screens/Menu/MenuListScreen';
import EditMenuItemScreen from '../screens/Menu/EditMenuItemScreen';
import InventoryScreen from '../screens/Inventory/InventoryScreen';
import AddInventoryScreen from '../screens/Inventory/AddInventoryScreen';
import AnalyticsScreen from '../screens/Analytics/AnalyticsScreen';
import AIToolsScreen from '../screens/AI/AIToolsScreen';
import ProfileScreen from '../screens/Settings/ProfileScreen';
import EmployeeManagementScreen from '../screens/Settings/EmployeeManagementScreen';
import AppSettingsScreen from '../screens/Settings/AppSettingsScreen';
import HelpSupportScreen from '../screens/Settings/HelpSupportScreen';
import KitchenOrdersScreen from '../screens/Kitchen/KitchenOrdersScreen';

const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();
const POSStack = createNativeStackNavigator();
const InventoryStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function POSNavigator() {
    return (
        <POSStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Tables">
            <POSStack.Screen name="Tables" component={TablesScreen} />
            <POSStack.Screen name="Billing" component={BillingScreen} />
            <POSStack.Screen name="Checkout" component={CheckoutScreen} />
            <POSStack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        </POSStack.Navigator>
    );
}

function InventoryNavigator() {
    return (
        <InventoryStack.Navigator screenOptions={{ headerShown: false }}>
            <InventoryStack.Screen name="InventoryList" component={InventoryScreen} />
            <InventoryStack.Screen name="AddInventory" component={AddInventoryScreen} />
        </InventoryStack.Navigator>
    );
}

function MenuNavigator() {
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuList" component={MenuListScreen} />
            <MenuStack.Screen name="EditMenuItem" component={EditMenuItemScreen} />
        </MenuStack.Navigator>
    );
}

const KitchenStack = createNativeStackNavigator();

function KitchenNavigator() {
    return (
        <KitchenStack.Navigator screenOptions={{ headerShown: false }}>
            <KitchenStack.Screen name="KitchenOrders" component={KitchenOrdersScreen} />
        </KitchenStack.Navigator>
    );
}

const tabIcons: Record<string, { active: any; inactive: any }> = {
    POS: { active: 'receipt', inactive: 'receipt-outline' },
    Menu: { active: 'restaurant', inactive: 'restaurant-outline' },
    Kitchen: { active: 'bonfire', inactive: 'bonfire-outline' },
    Inventory: { active: 'cube', inactive: 'cube-outline' },
    Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline' },
    'AI Tools': { active: 'sparkles', inactive: 'sparkles-outline' },
};

function TabBarBackground() {
    return (
        <BlurView
            intensity={40}
            tint="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: 35, overflow: 'hidden' }]}
        />
    );
}

function ProfileNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileScreen" component={ProfileScreen} />
            <ProfileStack.Screen name="EmployeeManagement" component={EmployeeManagementScreen} />
            <ProfileStack.Screen name="AppSettings" component={AppSettingsScreen} />
            <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} />
        </ProfileStack.Navigator>
    );
}

export default function MainTabs() {
    const { user } = useAuthStore();
    const role = user?.role || 'owner';

    const canSeeTab = (tabName: string) => {
        if (role === 'owner' || role === 'manager') return true;
        if (role === 'waiter') return ['POS', 'Menu', 'Profile'].includes(tabName);
        if (role === 'inventory') return ['Inventory', 'Menu', 'Profile'].includes(tabName);
        if (role === 'kitchen') return ['Kitchen', 'Profile'].includes(tabName);
        if (role === 'biller') return ['POS', 'Profile'].includes(tabName);
        return false;
    };

    const getTabBarVisibility = (route: any) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? '';
        const hiddenRoutes = ['AddInventory', 'EmployeeManagement', 'AppSettings', 'HelpSupport', 'EditMenuItem', 'MenuDigitizer', 'OrderHistory'];
        if (hiddenRoutes.includes(routeName)) {
            return 'none';
        }
        return 'flex';
    };

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarBackground: TabBarBackground,
                tabBarStyle: {
                    display: getTabBarVisibility(route),
                    position: 'absolute',
                    backgroundColor: 'rgba(19, 23, 43, 0.85)',
                    borderTopWidth: 0,
                    height: 65,
                    paddingBottom: 0,
                    paddingTop: 0,
                    bottom: Platform.OS === 'ios' ? 34 : 20,
                    left: 20,
                    right: 20,
                    borderRadius: 33,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.5,
                    shadowRadius: 15,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textMuted,
                tabBarLabelStyle: { display: 'none' }, // Disable labels for a cleaner pill button look
                tabBarIcon: ({ color, focused }) => {
                    const iconSet = tabIcons[route.name] || { active: 'person', inactive: 'person-outline' };
                    return (
                        <View style={focused ? styles.activeIconWrapper : styles.iconWrapper}>
                            {focused && (
                                <View style={styles.activeGlow} />
                            )}
                            <Ionicons
                                name={focused ? iconSet.active : iconSet.inactive}
                                size={focused ? 24 : 22}
                                color={color}
                            />
                        </View>
                    );
                },
            })}
        >
            {canSeeTab('POS') && <Tab.Screen name="POS" component={POSNavigator} options={{ title: 'POS' }} />}
            {canSeeTab('Kitchen') && <Tab.Screen name="Kitchen" component={KitchenNavigator} options={{ title: 'KOT' }} />}
            {canSeeTab('Menu') && <Tab.Screen name="Menu" component={MenuNavigator} />}
            {canSeeTab('Inventory') && <Tab.Screen name="Inventory" component={InventoryNavigator} />}
            {canSeeTab('Analytics') && <Tab.Screen name="Analytics" component={AnalyticsScreen} />}
            {canSeeTab('AI Tools') && <Tab.Screen name="AI Tools" component={AIToolsScreen} />}
            <Tab.Screen name="Profile" component={ProfileNavigator} />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    iconWrapper: {
        width: 40,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeIconWrapper: {
        width: 48,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 107, 53, 0.12)',
        borderRadius: 12,
    },
    activeGlow: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 107, 53, 0.15)',
    },
});
