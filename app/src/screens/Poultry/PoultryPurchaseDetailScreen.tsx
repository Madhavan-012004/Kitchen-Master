import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../../api/client';
import { useAppTheme } from '../../theme';

export default function PoultryPurchaseDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const purchase = route.params?.purchase;
    const [loading, setLoading] = useState(false);

    if (!purchase) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ color: '#f1f5f9' }}>No purchase data found.</Text>
            </SafeAreaView>
        );
    }

    const rate = purchase.qty > 0 ? (purchase.amount / purchase.qty).toFixed(2) : (purchase.amount / purchase.wt).toFixed(2);
    const qtyOrWt = purchase.qty > 0 ? `${purchase.qty} pcs` : `${purchase.wt} kg`;

    const handlePay = async () => {
        setLoading(true);
        try {
            const billId = purchase._id || purchase.id;
            // Mark bill as paid by updating the bill's payment status via PUT
            await apiClient.put(`/poultry/bills/${billId}`, {
                paymentStatus: 'PAID',
                paymentMethod: 'CASH',
            });
            Alert.alert('Success', 'Payment successful!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.warn('Payment API error:', error);
            Alert.alert('Error', 'Payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Purchase Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Item:</Text>
                        <Text style={styles.infoValue}>{purchase.item}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Date:</Text>
                        <Text style={styles.infoValue}>{purchase.date}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Bill No:</Text>
                        <Text style={styles.infoValue}>{purchase.billNo}</Text>
                    </View>
                </View>

                {/* Bill Table */}
                <View style={styles.tableCard}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableCol, { flex: 2 }]}>Item</Text>
                        <Text style={styles.tableCol}>Qty/Wt</Text>
                        <Text style={styles.tableCol}>Rate</Text>
                        <Text style={[styles.tableCol, { textAlign: 'right' }]}>Amount</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 2, color: '#f1f5f9' }]}>{purchase.item}</Text>
                        <Text style={styles.tableCell}>{qtyOrWt}</Text>
                        <Text style={styles.tableCell}>₹{rate}</Text>
                        <Text style={[styles.tableCell, { textAlign: 'right', color: '#f1f5f9', fontWeight: 'bold' }]}>₹{purchase.amount}</Text>
                    </View>
                </View>

                {/* Summary */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>₹{purchase.amount}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Discount</Text>
                        <Text style={styles.summaryValue}>₹0.00</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₹{purchase.amount}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Paid</Text>
                        <Text style={styles.summaryValue}>₹{purchase.isPaid ? purchase.amount : 0}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Pending</Text>
                        <Text style={[styles.summaryValue, !purchase.isPaid && styles.pendingValue]}>
                            ₹{purchase.isPaid ? 0 : purchase.amount}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Pay Button */}
            {!purchase.isPaid && (
                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={styles.payBtn}
                        onPress={handlePay}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text style={styles.payBtnText}>PAY ₹{purchase.amount}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#f1f5f9',
    },
    content: {
        padding: 16,
    },
    infoCard: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        color: '#94a3b8',
        fontSize: 14,
    },
    infoValue: {
        color: '#f1f5f9',
        fontSize: 14,
        fontWeight: '500',
    },
    tableCard: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        paddingBottom: 8,
        marginBottom: 12,
    },
    tableCol: {
        flex: 1,
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tableCell: {
        flex: 1,
        color: '#94a3b8',
        fontSize: 13,
    },
    summaryCard: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    summaryLabel: {
        color: '#94a3b8',
        fontSize: 14,
    },
    summaryValue: {
        color: '#f1f5f9',
        fontSize: 14,
    },
    totalRow: {
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#334155',
        paddingVertical: 12,
        marginVertical: 4,
    },
    totalLabel: {
        color: '#f1f5f9',
        fontSize: 16,
        fontWeight: 'bold',
    },
    totalValue: {
        color: '#C6F53D',
        fontSize: 16,
        fontWeight: 'bold',
    },
    pendingValue: {
        color: '#ef4444',
        fontWeight: 'bold',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
    payBtn: {
        backgroundColor: '#3b82f6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    payBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
