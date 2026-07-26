import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, StatusBar, Alert, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

const getRolesForMode = (mode: string) => {
    if (mode === 'clothing') return ['manager', 'biller', 'inventory', 'tailor'];
    if (mode === 'supermarket') return ['manager', 'biller', 'inventory'];
    return ['manager', 'waiter', 'kitchen', 'inventory', 'biller'];
};

export default function EmployeeManagementScreen({ navigation }: any) {
    const { colors, gradients, isDark } = useAppTheme();
    const themedStyles = React.useMemo(() => createStyles(colors, gradients, isDark), [colors, gradients, isDark]);
    const { user } = useAuthStore();
    const ROLES = React.useMemo(() => getRolesForMode(user?.preferredPosMode || 'restaurant'), [user?.preferredPosMode]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formVisible, setFormVisible] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter', assignedTables: [] as string[] });

    const getAlreadyAssignedTables = (excludeId?: string | null) => {
        const assigned = new Set<string>();
        employees.forEach(emp => {
            const empId = emp._id || emp.id;
            if (excludeId && empId === excludeId) return;
            if (emp.role === 'waiter' && Array.isArray(emp.assignedTables)) {
                emp.assignedTables.forEach((t: string) => assigned.add(t));
            }
        });
        return assigned;
    };

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await authAPI.getEmployees();
            setEmployees(res.data.data.employees || []);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to load employees');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateEmployee = async () => {
        if (!form.name || !form.email || !form.role) {
            return Alert.alert('Error', 'Please fill in required fields.');
        }

        setIsSaving(true);
        try {
            const payload: any = {
                name: form.name,
                email: form.email,
                role: form.role,
                assignedTables: form.role === 'waiter' ? form.assignedTables : []
            };

            // Only send password if creating new or if password field is filled during edit
            if (form.password) {
                payload.password = form.password;
            } else if (!editId) {
                Alert.alert('Error', 'Password is required for new employees.');
                setIsSaving(false);
                return;
            }

            if (editId) {
                await authAPI.updateEmployee(editId, payload);
                Alert.alert('Success', 'Employee account updated!');
            } else {
                await authAPI.registerEmployee(payload);
                Alert.alert('Success', 'Employee account created!');
            }

            setForm({ name: '', email: '', password: '', role: 'waiter', assignedTables: [] });
            setEditId(null);
            setFormVisible(false);
            loadEmployees(); // Reload list
        } catch (error: any) {
            Alert.alert('Registration Failed', error.response?.data?.message || 'Something went wrong.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderEmployeeCard = ({ item }: { item: any }) => (
        <View style={themedStyles.employeeCard}>
            <View style={themedStyles.employeeHeader}>
                <View style={themedStyles.employeeAvatar}>
                    <Text style={themedStyles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={themedStyles.employeeInfo}>
                    <Text style={themedStyles.employeeName}>{item.name}</Text>
                    <Text style={themedStyles.employeeEmail}>{item.email}</Text>
                </View>
                <View style={[themedStyles.roleBadge, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '33' }]}>
                    <Text style={[themedStyles.roleText, { color: colors.primary }]}>{item.role.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                    style={themedStyles.editBtn}
                    onPress={() => {
                        setForm({
                            name: item.name,
                            email: item.email,
                            password: '', // Blank by default when editing
                            role: item.role,
                            assignedTables: Array.isArray(item.assignedTables) ? item.assignedTables : []
                        });
                        setEditId(item._id);
                        setFormVisible(true);
                    }}
                >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                </TouchableOpacity>
            </View>
            {item.role === 'waiter' && item.assignedTables && item.assignedTables.length > 0 && (
                <View style={themedStyles.tablesWrap}>
                    <Text style={themedStyles.tablesLabel}>Assigned Tables:</Text>
                    <Text style={themedStyles.tablesText}>{item.assignedTables.join(', ')}</Text>
                </View>
            )}
        </View>
    );

    return (
        <LinearGradient colors={gradients.background} style={themedStyles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
            <SafeAreaView style={themedStyles.safe} edges={['top']}>
                {/* Header */}
                <View style={themedStyles.header}>
                    <TouchableOpacity style={themedStyles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={themedStyles.headerTitle}>Staff Management</Text>
                    <TouchableOpacity style={themedStyles.addBtnHeader} onPress={() => {
                        setForm({ name: '', email: '', password: '', role: 'waiter', assignedTables: [] });
                        setEditId(null);
                        setFormVisible(!formVisible);
                    }}>
                        <Ionicons name={formVisible ? "close" : "add"} size={24} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {formVisible ? (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={themedStyles.formContainer}>
                            <View style={themedStyles.formCard}>
                                <Text style={themedStyles.sectionTitle}>{editId ? 'Edit Staff Member' : 'Add New Staff Member'}</Text>

                                <Text style={themedStyles.label}>Full Name</Text>
                                <View style={themedStyles.inputWrap}>
                                    <Ionicons name="person-outline" size={20} color={colors.textMuted} style={themedStyles.inputIcon} />
                                    <TextInput style={themedStyles.input} placeholderTextColor={colors.textMuted} placeholder="Staff Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
                                </View>

                                <Text style={themedStyles.label}>Email Address</Text>
                                <View style={themedStyles.inputWrap}>
                                    <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={themedStyles.inputIcon} />
                                    <TextInput style={themedStyles.input} placeholderTextColor={colors.textMuted} placeholder="staff@restaurant.com" keyboardType="email-address" value={form.email} autoCapitalize="none" onChangeText={(t) => setForm({ ...form, email: t })} />
                                </View>

                                <Text style={themedStyles.label}>Account Password {editId && '(Optional)'}</Text>
                                <View style={themedStyles.inputWrap}>
                                    <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={themedStyles.inputIcon} />
                                    <TextInput style={themedStyles.input} placeholderTextColor={colors.textMuted} placeholder={editId ? "Leave blank to keep same" : "Create a password"} secureTextEntry value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} />
                                </View>

                                <Text style={themedStyles.label}>Assign Role</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={themedStyles.roleChips}>
                                    {ROLES.map((r) => (
                                        <TouchableOpacity key={r} style={[themedStyles.chip, form.role === r && themedStyles.chipActive]} onPress={() => setForm({ ...form, role: r })}>
                                            <Text style={[themedStyles.chipText, form.role === r && themedStyles.chipTextActive]}>{r.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                {form.role === 'waiter' && (
                                    <>
                                        <Text style={themedStyles.label}>Assign Tables</Text>
                                        <View style={themedStyles.tableGrid}>
                                            {(() => {
                                                const alreadyAssigned = getAlreadyAssignedTables(editId);
                                                return Array.from({ length: 20 }, (_, i) => `Table ${i + 1}`).map(t => {
                                                    const isSelected = form.assignedTables.includes(t);
                                                    const isAssignedToOther = alreadyAssigned.has(t);
                                                    
                                                    // Strictly do not show if assigned to someone else
                                                    if (isAssignedToOther) return null;

                                                    return (
                                                        <TouchableOpacity
                                                            key={t}
                                                            style={[
                                                                themedStyles.tableGridBtn,
                                                                isSelected && themedStyles.tableGridBtnActive
                                                            ]}
                                                            onPress={() => {
                                                                setForm(prev => {
                                                                    const current = prev.assignedTables;
                                                                    return {
                                                                        ...prev,
                                                                        assignedTables: current.includes(t)
                                                                            ? current.filter(x => x !== t)
                                                                            : [...current, t]
                                                                    };
                                                                });
                                                            }}
                                                        >
                                                            <Text style={[
                                                                themedStyles.tableGridText,
                                                                isSelected && themedStyles.tableGridTextActive
                                                            ]}>
                                                                {t.replace('Table ', '')}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                });
                                            })()}
                                        </View>
                                    </>
                                )}

                                <TouchableOpacity style={themedStyles.saveBtn} onPress={handleCreateEmployee} disabled={isSaving}>
                                    <LinearGradient colors={gradients.primary} style={themedStyles.saveGradient}>
                                        {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={themedStyles.saveBtnText}>{editId ? 'Save Changes' : 'Create Account'}</Text>}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                ) : (
                    <View style={themedStyles.listContainer}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                        ) : employees.length === 0 ? (
                            <View style={themedStyles.emptyWrap}>
                                <Ionicons name="people-outline" size={60} color={colors.textMuted} />
                                <Text style={themedStyles.emptyText}>No staff members added yet.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={employees}
                                keyExtractor={(item) => item._id}
                                renderItem={renderEmployeeCard}
                                contentContainerStyle={{ paddingBottom: 100 }}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

const createStyles = (colors: any, gradients: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    addBtnHeader: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
    headerTitle: { ...Typography.h3, color: colors.textPrimary },
    listContainer: { flex: 1, paddingHorizontal: Spacing.lg },
    employeeCard: {
        backgroundColor: colors.card, borderRadius: Radius.lg, padding: Spacing.md,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border, ...Shadows.sm
    },
    employeeHeader: { flexDirection: 'row', alignItems: 'center' },
    employeeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '26', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { ...Typography.h4, color: colors.primary },
    employeeInfo: { flex: 1 },
    employeeName: { ...Typography.body1, color: colors.textPrimary, fontWeight: '600' },
    employeeEmail: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round, borderWidth: 1 },
    roleText: { ...Typography.caption, fontWeight: '700', fontSize: 10 },
    editBtn: { marginLeft: 10, padding: 8, backgroundColor: colors.primary + '1A', borderRadius: Radius.round },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: '30%' },
    emptyText: { ...Typography.body1, color: colors.textMuted },
    formContainer: { padding: Spacing.lg },
    formCard: {
        backgroundColor: colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: colors.border, ...Shadows.md
    },
    sectionTitle: { ...Typography.h4, color: colors.textPrimary, marginBottom: Spacing.lg },
    label: { ...Typography.body2, color: colors.textSecondary, marginBottom: 8, marginTop: Spacing.md },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass, borderRadius: Radius.md,
        borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 50
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: colors.textPrimary, ...Typography.body1 },
    roleChips: { flexDirection: 'row', marginBottom: Spacing.xl, marginTop: 4 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.round,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
        marginRight: 8, height: 40, justifyContent: 'center'
    },
    chipActive: { backgroundColor: colors.primary + '26', borderColor: colors.primary },
    chipText: { ...Typography.buttonSm, color: colors.textMuted },
    chipTextActive: { color: colors.primary },
    saveBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.md },
    saveGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { ...Typography.h5, color: colors.white },
    tablesWrap: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
    tablesLabel: { ...Typography.body2, color: colors.textSecondary },
    tablesText: { ...Typography.body2, color: colors.primary, fontWeight: '600' },
    tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.xs },
    tableGridBtn: {
        width: 44, height: 44, borderRadius: Radius.md,
        backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
        justifyContent: 'center', alignItems: 'center'
    },
    tableGridBtnActive: { backgroundColor: colors.primary + '26', borderColor: colors.primary },
    tableGridText: { ...Typography.buttonSm, color: colors.textSecondary },
    tableGridTextActive: { color: colors.primary, fontWeight: '700' },
});
