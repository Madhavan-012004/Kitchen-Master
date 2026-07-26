import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAppTheme, Typography, Spacing, Radius, Shadows } from '../../theme';

interface ReportViewerProps {
    reportId: string;
    reportData: any;
    loading: boolean;
}

export default function ReportViewer({ reportId, reportData, loading }: ReportViewerProps) {
    const { colors, isDark } = useAppTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Fetching Report Data...</Text>
            </View>
        );
    }

    if (!reportData) return null;

    const renderTable = (headers: string[], dataRows: any[][]) => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableContainer}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    {headers.map((h, i) => (
                        <Text key={i} style={[styles.tableHeaderCell, { width: 120 }]}>{h}</Text>
                    ))}
                </View>
                {dataRows.map((row, rIdx) => (
                    <View key={rIdx} style={styles.tableRow}>
                        {row.map((cell, cIdx) => (
                            <Text key={cIdx} style={[styles.tableCell, { width: 120 }]}>{String(cell ?? '-')}</Text>
                        ))}
                    </View>
                ))}
            </View>
        </ScrollView>
    );

    const renderSummaryCards = (items: { label: string, value: string }[]) => (
        <View style={styles.summaryGrid}>
            {items.map((item, idx) => (
                <View key={idx} style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>{item.label}</Text>
                    <Text style={styles.summaryValue}>{item.value}</Text>
                </View>
            ))}
        </View>
    );

    switch (reportId) {
        case 'sales-summary':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([
                        { label: 'Gross Sales', value: `₹${parseFloat(Number(reportData?.summary?.totalRevenue || 0).toFixed(2)).toLocaleString('en-IN')}` },
                        { label: 'Total Orders', value: String(reportData?.summary?.totalOrders || 0) },
                        { label: 'Income', value: `₹${parseFloat(Number(reportData?.income || 0).toFixed(2))}` },
                        { label: 'Expense', value: `₹${parseFloat(Number(reportData?.expense || 0).toFixed(2))}` }
                    ])}
                </View>
            );
        case 'sales-report':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([{ label: 'Total Revenue', value: `₹${reportData?.totalRevenue?.toLocaleString() || 0}` }])}
                    {renderTable(
                        ['Order #', 'Date', 'Customer', 'Total', 'Status'],
                        reportData?.sales?.map((s: any) => [
                            s.orderNumber, new Date(s.date).toLocaleDateString(), s.customer || '-', `₹${s.total?.toLocaleString()}`, s.status
                        ]) || []
                    )}
                </View>
            );
        case 'sales-gst-report':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([
                        { label: 'Total (incl. GST)', value: `₹${reportData?.totalRevenue?.toLocaleString() || 0}` },
                        { label: 'Base Revenue', value: `₹${reportData?.totalBaseRevenue?.toLocaleString() || 0}` },
                        { label: 'GST Collected', value: `₹${reportData?.totalTaxCollected?.toLocaleString() || 0}` }
                    ])}
                    {renderTable(
                        ['Order #', 'Date', 'Customer', 'Base Amt', 'GST Amt', 'Total'],
                        reportData?.sales?.map((s: any) => {
                            const tax = s.taxAmount || 0;
                            const base = s.baseAmount ?? (s.total - tax);
                            return [s.orderNumber, new Date(s.date).toLocaleDateString(), s.customer || '-', `₹${base.toFixed(2)}`, `₹${tax.toFixed(2)}`, `₹${s.total?.toFixed(2)}`];
                        }) || []
                    )}
                </View>
            );
        case 'sales-non-gst-report':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([{ label: 'Total Revenue', value: `₹${reportData?.totalRevenue?.toLocaleString() || 0}` }])}
                    {renderTable(
                        ['Order #', 'Date', 'Customer', 'Payment', 'Total'],
                        reportData?.sales?.map((s: any) => [s.orderNumber, new Date(s.date).toLocaleDateString(), s.customer || '-', s.payment || '-', `₹${s.total?.toLocaleString()}`]) || []
                    )}
                </View>
            );
        case 'end-day-report':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([
                        { label: 'Total Sales Today', value: `₹${reportData?.totalSales?.toLocaleString() || 0}` },
                        { label: 'Total Orders', value: String(reportData?.orderCount || 0) }
                    ])}
                    <Text style={styles.sectionTitle}>Payment Modes Breakdown</Text>
                    {renderSummaryCards(Object.entries(reportData?.payments || {}).map(([mode, val]) => ({
                        label: mode, value: `₹${Number(val).toLocaleString()}`
                    })))}
                </View>
            );
        case 'category-item-wise':
        case 'item-wise-sales':
            return (
                <View style={styles.container}>
                    {renderTable(
                        ['Item Name', 'Qty Sold', 'Total Revenue'],
                        reportData?.items?.map((item: any) => [item.name, item.quantity, `₹${item.revenue?.toLocaleString()}`]) || []
                    )}
                </View>
            );
        case 'income-expense':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([
                        { label: 'Total Income', value: `₹${reportData?.totalIncome?.toLocaleString() || 0}` },
                        { label: 'Total Expense', value: `₹${reportData?.totalExpense?.toLocaleString() || 0}` }
                    ])}
                    {renderTable(
                        ['Date', 'Description', 'Type', 'Amount'],
                        reportData?.transactions?.map((t: any) => [new Date(t.date).toLocaleDateString(), t.description, t.type, `₹${t.amount?.toLocaleString()}`]) || []
                    )}
                </View>
            );
        case 'stock-report':
        case 'recipe-stock':
        case 'total-inventory-valuation':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([{ label: 'Total Stock Value', value: `₹${reportData?.totalValue?.toLocaleString('en-IN') || reportData?.totalStockValue || 0}` }])}
                    {renderTable(
                        ['Item Name', 'Category', 'Current Stock', 'Cost/Unit'],
                        reportData?.items?.map((item: any) => [item.name, item.category, `${item.currentStock} ${item.unit}`, `₹${item.costPerUnit}`]) || []
                    )}
                </View>
            );
        case 'purchase-item-stock':
        case 'purchase-recipe-stock':
            return (
                <View style={styles.container}>
                    {renderTable(
                        ['Date', 'Item', 'Quantity', 'By'],
                        reportData?.purchases?.map((p: any) => [new Date(p.createdAt).toLocaleDateString(), p.inventoryItem?.name, `${p.quantity} ${p.inventoryItem?.unit}`, p.createdBy?.name || 'System']) || []
                    )}
                </View>
            );
        case 'cashier-wise-sales':
            return (
                <View style={styles.container}>
                    {renderTable(
                        ['Cashier Name', 'Total Sales'],
                        Object.entries(reportData?.cashiers || {}).map(([name, val]) => [name, `₹${Number(val).toLocaleString()}`])
                    )}
                </View>
            );
        case 'cancelled-item-summary':
            return (
                <View style={styles.container}>
                    {renderSummaryCards([
                        { label: 'Cancelled Count', value: String(reportData?.count || 0) },
                        { label: 'Total Loss', value: `₹${reportData?.totalLoss?.toLocaleString() || 0}` }
                    ])}
                    {renderTable(
                        ['Order #', 'Date', 'Amount'],
                        reportData?.cancelledOrders?.map((o: any) => [o.orderNumber, new Date(o.createdAt).toLocaleDateString(), `₹${o.total?.toLocaleString()}`]) || []
                    )}
                </View>
            );
        default:
            return (
                <View style={styles.container}>
                    <Text style={styles.placeholderText}>Detailed on-screen preview for this report is coming soon. You can still download it via the Export button.</Text>
                </View>
            );
    }
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        marginTop: Spacing.md,
        marginBottom: Spacing.xl
    },
    loadingContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        ...Typography.body2,
        color: colors.textSecondary,
        marginTop: Spacing.md
    },
    sectionTitle: {
        ...Typography.h5,
        color: colors.textPrimary,
        marginTop: Spacing.lg,
        marginBottom: Spacing.md
    },
    placeholderText: {
        ...Typography.body1,
        color: colors.textSecondary,
        textAlign: 'center',
        padding: Spacing.xl
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.lg
    },
    summaryCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: colors.card,
        padding: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: colors.border
    },
    summaryLabel: {
        ...Typography.caption,
        color: colors.textSecondary,
        marginBottom: 4
    },
    summaryValue: {
        ...Typography.h4,
        color: colors.textPrimary,
        fontWeight: 'bold'
    },
    tableContainer: {
        backgroundColor: colors.card,
        borderRadius: Radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    tableHeaderRow: {
        backgroundColor: colors.background
    },
    tableHeaderCell: {
        ...Typography.body2,
        fontWeight: 'bold',
        color: colors.textPrimary,
        padding: Spacing.sm,
    },
    tableCell: {
        ...Typography.body2,
        color: colors.textSecondary,
        padding: Spacing.sm,
    }
});
