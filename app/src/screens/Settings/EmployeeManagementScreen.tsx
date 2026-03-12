import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
    ActivityIndicator, StatusBar, Alert, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../api/auth';
import { Colors, Typography, Spacing, Radius, Shadows, Gradients } from '../../theme';

const ROLES = ['manager', 'waiter', 'kitchen', 'inventory', 'biller'];

export default function EmployeeManagementScreen({ navigation }: any) {
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [formVisible, setFormVisible] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'waiter', assignedTables: [] as string[] });

    const getAlreadyAssignedTables = () => {
        const assigned = new Set<string>();
        employees.forEach(emp => {
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
        <View style={styles.employeeCard}>
            <View style={styles.employeeHeader}>
                <View style={styles.employeeAvatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{item.name}</Text>
                    <Text style={styles.employeeEmail}>{item.email}</Text>
                </View>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                    style={styles.editBtn}
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
                    <Ionicons name="pencil" size={16} color={Colors.primary} />
                </TouchableOpacity>
            </View>
            {item.role === 'waiter' && item.assignedTables && item.assignedTables.length > 0 && (
                <View style={styles.tablesWrap}>
                    <Text style={styles.tablesLabel}>Assigned Tables:</Text>
                    <Text style={styles.tablesText}>{item.assignedTables.join(', ')}</Text>
                </View>
            )}
        </View>
    );

    return (
        <LinearGradient colors={Gradients.background} style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Staff Management</Text>
                    <TouchableOpacity style={styles.addBtnHeader} onPress={() => {
                        setForm({ name: '', email: '', password: '', role: 'waiter', assignedTables: [] });
                        setEditId(null);
                        setFormVisible(!formVisible);
                    }}>
                        <Ionicons name={formVisible ? "close" : "add"} size={24} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

                {formVisible ? (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={styles.formContainer}>
                            <View style={styles.formCard}>
                                <Text style={styles.sectionTitle}>{editId ? 'Edit Staff Member' : 'Add New Staff Member'}</Text>

                                <Text style={styles.label}>Full Name</Text>
                                <View style={styles.inputWrap}>
                                    <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                                    <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder="Staff Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
                                </View>

                                <Text style={styles.label}>Email Address</Text>
                                <View style={styles.inputWrap}>
                                    <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                                    <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder="staff@restaurant.com" keyboardType="email-address" value={form.email} autoCapitalize="none" onChangeText={(t) => setForm({ ...form, email: t })} />
                                </View>

                                <Text style={styles.label}>Account Password {editId && '(Optional to keep current)'}</Text>
                                <View style={styles.inputWrap}>
                                    <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                                    <TextInput style={styles.input} placeholderTextColor={Colors.textMuted} placeholder={editId ? "Leave blank to keep same" : "Create a password"} secureTextEntry value={form.password} onChangeText={(t) => setForm({ ...form, password: t })} />
                                </View>

                                <Text style={styles.label}>Assign Role</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleChips}>
                                    {ROLES.map((r) => (
                                        <TouchableOpacity key={r} style={[styles.chip, form.role === r && styles.chipActive]} onPress={() => setForm({ ...form, role: r })}>
                                            <Text style={[styles.chipText, form.role === r && styles.chipTextActive]}>{r.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                {form.role === 'waiter' && (
                                    <>
                                        <Text style={styles.label}>Assign Tables</Text>
                                        <View style={styles.tableGrid}>
                                            {Array.from({ length: 20 }, (_, i) => `Table ${i + 1}`).map(t => {
                                                const alreadyAssigned = getAlreadyAssignedTables();
                                                const isSelected = form.assignedTables.includes(t);
                                                const isAssignedToOther = alreadyAssigned.has(t) && !isSelected;
                                                return (
                                                    <TouchableOpacity
                                                        key={t}
                                                        style={[
                                                            styles.tableGridBtn,
                                                            isSelected && styles.tableGridBtnActive,
                                                            isAssignedToOther && styles.tableGridBtnDisabled
                                                        ]}
                                                        disabled={isAssignedToOther}
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
                                                            styles.tableGridText,
                                                            isSelected && styles.tableGridTextActive,
                                                            isAssignedToOther && styles.tableGridTextDisabled
                                                        ]}>
                                                            {t.replace('Table ', '')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </>
                                )}

                                <TouchableOpacity style={styles.saveBtn} onPress={handleCreateEmployee} disabled={isSaving}>
                                    <LinearGradient colors={['#FF8A5C', '#FF6B35']} style={styles.saveGradient}>
                                        {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>{editId ? 'Save Changes' : 'Create Account'}</Text>}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                ) : (
                    <View style={styles.listContainer}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
                        ) : employees.length === 0 ? (
                            <View style={styles.emptyWrap}>
                                <Ionicons name="people-outline" size={60} color={Colors.textMuted} />
                                <Text style={styles.emptyText}>No staff members added yet.</Text>
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

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
    addBtnHeader: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
    headerTitle: { ...Typography.h3, color: Colors.textPrimary },
    listContainer: { flex: 1, paddingHorizontal: Spacing.lg },
    employeeCard: {
        backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
        marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.glassBorder, ...Shadows.sm
    },
    employeeHeader: { flexDirection: 'row', alignItems: 'center' },
    employeeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,107,53,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { ...Typography.h4, color: Colors.primary },
    employeeInfo: { flex: 1 },
    employeeName: { ...Typography.body1, color: Colors.textPrimary, fontWeight: '600' },
    employeeEmail: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
    roleBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.round },
    roleText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '700', fontSize: 10 },
    editBtn: { marginLeft: 10, padding: 8, backgroundColor: 'rgba(255,107,53,0.1)', borderRadius: Radius.round },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: '30%' },
    emptyText: { ...Typography.body1, color: Colors.textMuted },
    formContainer: { padding: Spacing.lg },
    formCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
        borderWidth: 1, borderColor: Colors.glassBorder, ...Shadows.md
    },
    sectionTitle: { ...Typography.h4, color: Colors.textPrimary, marginBottom: Spacing.lg },
    label: { ...Typography.body2, color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.md },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, height: 50
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: Colors.textPrimary, ...Typography.body1 },
    roleChips: { flexDirection: 'row', marginBottom: Spacing.xl, marginTop: 4 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.round,
        backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
        marginRight: 8, height: 40, justifyContent: 'center'
    },
    chipActive: { backgroundColor: 'rgba(255,107,53,0.15)', borderColor: Colors.primary },
    chipText: { ...Typography.buttonSm, color: Colors.textMuted },
    chipTextActive: { color: Colors.primary },
    saveBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.md },
    saveGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { ...Typography.h5, color: Colors.white },
    tablesWrap: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
    tablesLabel: { ...Typography.body2, color: Colors.textSecondary },
    tablesText: { ...Typography.body2, color: Colors.primary, fontWeight: '600' },
    tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.xs },
    tableGridBtn: {
        width: 44, height: 44, borderRadius: Radius.md,
        backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Colors.border,
        justifyContent: 'center', alignItems: 'center'
    },
    tableGridBtnActive: { backgroundColor: 'rgba(255,107,53,0.15)', borderColor: Colors.primary },
    tableGridBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', opacity: 0.5 },
    tableGridText: { ...Typography.buttonSm, color: Colors.textSecondary },
    tableGridTextActive: { color: Colors.primary, fontWeight: '700' },
    tableGridTextDisabled: { color: 'rgba(255,255,255,0.2)' }
});
