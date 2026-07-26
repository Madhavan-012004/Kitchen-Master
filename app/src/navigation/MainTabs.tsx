import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { useAttendanceStore } from '../store/useAttendanceStore';
import { useSocket } from '../hooks/useSocket';
import { useNotificationStore } from '../store/useNotificationStore';

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
import ExpenditureScreen from '../screens/Analytics/ExpenditureScreen';
import AIToolsScreen from '../screens/AI/AIToolsScreen';
import ProfileScreen from '../screens/Settings/ProfileScreen';
import EmployeeManagementScreen from '../screens/Settings/EmployeeManagementScreen';
import StaffPerformanceScreen from '../screens/Settings/StaffPerformanceScreen';
import AppSettingsScreen from '../screens/Settings/AppSettingsScreen';
import HelpSupportScreen from '../screens/Settings/HelpSupportScreen';
import KitchenOrdersScreen from '../screens/Kitchen/KitchenOrdersScreen';
import ClothingStockScreen from '../screens/Clothing/ClothingStockScreen';
import TailoringScreen from '../screens/Tailoring/TailoringScreen';
import NewTailoringJobScreen from '../screens/Tailoring/NewTailoringJobScreen';
import TokenLookupScreen from '../screens/Tailoring/TokenLookupScreen';
import WaitersDashboardScreen from '../screens/POS/WaitersDashboardScreen'; // dashboard import
import WaitersCompletedOrdersScreen from '../screens/POS/WaitersCompletedOrdersScreen';

const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();
const POSStack = createNativeStackNavigator();
const InventoryStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const ClothingStack = createNativeStackNavigator();
const TailoringStack = createNativeStackNavigator();

function POSNavigator() {
    return (
        <POSStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Tables">
            <POSStack.Screen name="Tables" component={TablesScreen} />
            <POSStack.Screen name="Order" component={BillingScreen} />
            <POSStack.Screen name="Checkout" component={CheckoutScreen} />
            <POSStack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        </POSStack.Navigator>
    );
}

const DashboardStack = createNativeStackNavigator();
function DashboardNavigator() {
    return (
        <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
            <DashboardStack.Screen name="WaitersDashboard" component={WaitersDashboardScreen} />
            <DashboardStack.Screen name="WaitersCompletedOrders" component={WaitersCompletedOrdersScreen} />
        </DashboardStack.Navigator>
    );
}

function InventoryNavigator() {
    return (
        <InventoryStack.Navigator screenOptions={{ headerShown: false }}>
            <InventoryStack.Screen name="InventoryList" component={InventoryScreen} />
            <InventoryStack.Screen name="AddInventory" component={AddInventoryScreen} />
            <InventoryStack.Screen name="Expenditure" component={ExpenditureScreen} />
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

function ClothingNavigator() {
    return (
        <ClothingStack.Navigator screenOptions={{ headerShown: false }}>
            <ClothingStack.Screen name="ClothingStock" component={ClothingStockScreen} />
        </ClothingStack.Navigator>
    );
}

function TailoringNavigator() {
    return (
        <TailoringStack.Navigator screenOptions={{ headerShown: false }}>
            <TailoringStack.Screen name="TailoringList" component={TailoringScreen} />
            <TailoringStack.Screen name="NewTailoringJob" component={NewTailoringJobScreen} />
            <TailoringStack.Screen name="TokenLookup" component={TokenLookupScreen} />
        </TailoringStack.Navigator>
    );
}

const tabIcons: Record<string, { active: any; inactive: any }> = {
    POS: { active: 'receipt', inactive: 'receipt-outline' },
    Menu: { active: 'restaurant', inactive: 'restaurant-outline' },
    Kitchen: { active: 'bonfire', inactive: 'bonfire-outline' },
    Inventory: { active: 'cube', inactive: 'cube-outline' },
    Analytics: { active: 'bar-chart', inactive: 'bar-chart-outline' },
    'AI Tools': { active: 'sparkles', inactive: 'sparkles-outline' },
    Clothing: { active: 'shirt', inactive: 'shirt-outline' },
    Tailoring: { active: 'cut', inactive: 'cut-outline' },
    Dashboard: { active: 'stats-chart', inactive: 'stats-chart-outline' },
};

function TabBarBackground() {
    const { isDark } = useAppTheme();
    return (
        <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 100}
            tint={isDark ? "dark" : "light"}
            style={[StyleSheet.absoluteFill, { borderRadius: 35, overflow: 'hidden' }]}
        />
    );
}

function ProfileNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
            <ProfileStack.Screen name="EmployeeManagement" component={EmployeeManagementScreen} />
            <ProfileStack.Screen name="StaffPerformance" component={StaffPerformanceScreen} />
            <ProfileStack.Screen name="AppSettings" component={AppSettingsScreen} />
            <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} />
        </ProfileStack.Navigator>
    );
}

export default function MainTabs() {
    const { user } = useAuthStore();
    const { isActive } = useAttendanceStore();
    const isClothingMode = user?.preferredPosMode === 'clothing';
    const isSupermarketMode = user?.preferredPosMode === 'supermarket';
    const isRestaurantMode = user?.preferredPosMode === 'restaurant' || !user?.preferredPosMode;
    const { colors, isDark } = useAppTheme();
    const socket = useSocket();
    const addNotification = useNotificationStore(s => s.addNotification);

    React.useEffect(() => {
        if (!socket) return;

        const handleNotification = (data: any) => {
            if (data.message) {
                addNotification(data.message);
            }
        };

        socket.on('notification:send', handleNotification);
        return () => {
            socket.off('notification:send', handleNotification);
        };
    }, [socket, addNotification]);

    const role = user?.role || 'owner';

    const canSeeTab = (tabName: string) => {
        // Enforce Category (posMode) based visibility first
        if (tabName === 'Kitchen' && !isRestaurantMode) return false;
        if (tabName === 'Clothing' && !isClothingMode) return false;
        if (tabName === 'Tailoring' && !isClothingMode) return false;
        
        // Market POS and Clothing POS do not use the Mobile POS/Menu screens.
        if (isSupermarketMode && ['POS', 'Kitchen', 'Menu', 'Tailoring', 'Clothing'].includes(tabName)) return false;
        if (isClothingMode && ['POS', 'Kitchen', 'Menu', 'Clothing'].includes(tabName)) return false;

        // Owners and stakeholders bypass shift locks
        if (role === 'owner' || role === 'manager') {
            // Managers and Owners don't need Waiter Dashboard
            if (tabName === 'Dashboard') return false; 
            return true;
        }

        if (role === 'stakeholder') {
            return ['Analytics', 'POS', 'Inventory', 'Menu', 'Profile'].includes(tabName);
        }

        // Lock everything except Profile if shift is not active
        if (!isActive && tabName !== 'Profile') {
            return false;
        }

        // Standard role-based access for active employees
        if (role === 'waiter') return ['POS', 'Menu', 'Dashboard', 'Profile'].includes(tabName);
        if (role === 'kitchen') return ['Kitchen', 'Menu', 'Profile'].includes(tabName);
        if (role === 'biller') return ['POS', 'Menu', 'Profile'].includes(tabName);
        if (role === 'inventory') return ['Inventory', 'Clothing', 'Menu', 'Profile'].includes(tabName);
        if (role === 'tailor') return ['Tailoring', 'Profile'].includes(tabName);
        
        return false;
    };

    const getTabBarVisibility = (route: any) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? '';
        const hiddenRoutes = ['AddInventory', 'Expenditure', 'EmployeeManagement', 'AppSettings', 'HelpSupport', 'EditMenuItem', 'MenuDigitizer', 'OrderHistory', 'Checkout', 'Order', 'KitchenOrders', 'NewTailoringJob', 'TokenLookup'];
        if (hiddenRoutes.includes(routeName)) {
            return 'none';
        }
        return 'flex';
    };

    return (
        <Tab.Navigator
            key={`tabs-${user?.preferredPosMode || 'restaurant'}-${role}-${isActive}`}
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarBackground: TabBarBackground,
                tabBarStyle: {
                    display: getTabBarVisibility(route),
                    position: 'absolute',
                    backgroundColor: isDark ? 'rgba(19, 23, 43, 0.85)' : 'rgba(255, 255, 255, 0.85)',
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
                    shadowOpacity: isDark ? 0.5 : 0.1,
                    shadowRadius: 15,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 1,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: { display: 'none' }, // Disable labels for a cleaner pill button look
                tabBarIcon: ({ color, focused }) => {
                    const iconSet = tabIcons[route.name] || { active: 'person', inactive: 'person-outline' };
                    return (
                        <View style={focused ? styles.activeIconWrapper : styles.iconWrapper}>
                            {focused && (
                                <View style={[styles.activeGlow, { backgroundColor: colors.primary + '26' }]} />
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
            {canSeeTab('Dashboard') && <Tab.Screen name="Dashboard" component={DashboardNavigator} options={{ title: 'Dashboard' }} />}
            {canSeeTab('Kitchen') && <Tab.Screen name="Kitchen" component={KitchenNavigator} options={{ title: 'KOT' }} />}
            {canSeeTab('Menu') && <Tab.Screen name="Menu" component={MenuNavigator} />}
            {canSeeTab('Inventory') && <Tab.Screen name="Inventory" component={InventoryNavigator} />}
            {canSeeTab('Analytics') && <Tab.Screen name="Analytics" component={AnalyticsScreen} />}
            {canSeeTab('AI Tools') && <Tab.Screen name="AI Tools" component={AIToolsScreen} />}
            {canSeeTab('Clothing') && <Tab.Screen name="Clothing" component={ClothingNavigator} />}
            {canSeeTab('Tailoring') && <Tab.Screen name="Tailoring" component={TailoringNavigator} />}
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
        backgroundColor: 'rgba(198, 245, 61, 0.12)',
        borderRadius: 12,
    },
    activeGlow: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(198, 245, 61, 0.15)',
    },
});
