package com.probloom.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.probloom.model.entity.*;
import com.probloom.repository.*;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final OrdersRepository orderRepository;
    private final TransactionRepository transactionRepository;
    private final StockMovementRepository stockMovementRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ============================================================
    //  COLOUR PALETTE (shared across PDF, Word, JSON)
    // ============================================================
    private static final Color BRAND_DARK   = new Color(30,  41,  59);   // #1e293b
    private static final Color BRAND_ACCENT = new Color(37, 99, 235);    // #2563eb (blue)
    private static final Color HEADER_BG    = new Color(37, 99, 235);    // table header blue
    private static final Color ROW_ALT      = new Color(241, 245, 249);  // #f1f5f9 alt row
    private static final Color SEPARATOR    = new Color(203, 213, 225);  // #cbd5e1
    private static final Color TEXT_MUTED   = new Color(100, 116, 139);  // #64748b


    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final DateTimeFormatter DT_FMT    = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    // ============================================================
    //  PDF ENTRY POINT
    // ============================================================
    public byte[] generateReportPDF(String reportType, User restaurant, LocalDateTime start, LocalDateTime end) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 40, 40, 60, 60);
        PdfWriter writer = PdfWriter.getInstance(document, out);
        writer.setPageEvent(new PdfPageEventHelper() {
            @Override
            public void onEndPage(PdfWriter w, Document d) {
                addFooter(w, d, restaurant);
            }
        });
        document.open();

        addProfessionalHeader(document, writer, reportType, restaurant, start, end);
        addReportContent(document, reportType, restaurant, start, end);

        document.close();
        return out.toByteArray();
    }

    private void addReportContent(Document document, String reportType, User restaurant, LocalDateTime start, LocalDateTime end) {
        switch (reportType) {
            case "sales-summary":   addSalesSummaryContent(document, restaurant, start, end); break;
            case "sales-report":    addSalesReportContent(document, restaurant, start, end); break;
            case "sales-gst-report": addSalesGstReportContent(document, restaurant, start, end, true); break;
            case "sales-non-gst-report": addSalesGstReportContent(document, restaurant, start, end, false); break;
            case "monthly-day-wise": addMonthlyDayWiseContent(document, restaurant, start, end); break;
            case "end-day-report":  addEndDayReportContent(document, restaurant); break;
            case "category-item-wise":
            case "item-wise-sales": addItemWiseSalesContent(document, restaurant, start, end); break;
            case "income-expense":  addIncomeExpenseContent(document, restaurant, start, end); break;
            case "stock-report":
            case "total-inventory-valuation": addInventoryValuationContent(document, restaurant); break;
            case "purchase-item-stock": addPurchaseReportContent(document, restaurant, start, end); break;
            case "cashier-wise-sales": addCashierSalesReportContent(document, restaurant, start, end); break;
            case "cancelled-item-summary": addCancelledReportContent(document, restaurant, start, end); break;
            case "gst-ledger-report": addLedgerReportContent(document, restaurant, start, end); break;
            case "expenditure-report": addExpenditureReportContent(document, restaurant, start, end); break;
            case "purchase-gst-report": addPurchaseGstReportContent(document, restaurant, start, end, true); break;
            case "purchase-non-gst-report": addPurchaseGstReportContent(document, restaurant, start, end, false); break;
            default:
                document.add(new Paragraph("Report type '" + reportType + "' is not yet available.", getFont(10, false, TEXT_MUTED)));
        }
    }

    // ============================================================
    //  PDF: PROFESSIONAL HEADER
    // ============================================================
    private void addProfessionalHeader(Document document, PdfWriter writer, String reportType, User restaurant, LocalDateTime start, LocalDateTime end) {
        try {
            // Top accent bar
            PdfContentByte cb = writer.getDirectContent();
            cb.setColorFill(BRAND_ACCENT);
            cb.rectangle(document.left(), document.top() + 15, document.right() - document.left(), 8);
            cb.fill();

            // Restaurant name — big and bold
            Paragraph name = new Paragraph(restaurant.getRestaurantName().toUpperCase(), getFont(22, true, BRAND_DARK));
            name.setAlignment(Element.ALIGN_CENTER);
            name.setSpacingAfter(4);
            document.add(name);

            // Restaurant details line
            StringBuilder details = new StringBuilder();
            if (restaurant.getAddress() != null && !restaurant.getAddress().isBlank())
                details.append(restaurant.getAddress());
            if (restaurant.getPhone() != null && !restaurant.getPhone().isBlank())
                details.append("  |  ☎ ").append(restaurant.getPhone());
            if (restaurant.getEmail() != null && !restaurant.getEmail().isBlank())
                details.append("  |  ✉ ").append(restaurant.getEmail());

            if (details.length() > 0) {
                Paragraph detailsP = new Paragraph(details.toString(), getFont(9, false, TEXT_MUTED));
                detailsP.setAlignment(Element.ALIGN_CENTER);
                document.add(detailsP);
            }

            // GST number (highlighted)
            if (restaurant.getGstNumber() != null && !restaurant.getGstNumber().isBlank()) {
                Paragraph gst = new Paragraph("GSTIN: " + restaurant.getGstNumber(), getFont(10, true, BRAND_ACCENT));
                gst.setAlignment(Element.ALIGN_CENTER);
                gst.setSpacingAfter(6);
                document.add(gst);
            }

            // Separator line
            drawDivider(document, SEPARATOR);

            // Report title box
            PdfPTable titleBox = new PdfPTable(1);
            titleBox.setWidthPercentage(100);
            PdfPCell titleCell = new PdfPCell();
            titleCell.setBackgroundColor(BRAND_ACCENT);
            titleCell.setPadding(10);
            titleCell.setBorder(Rectangle.NO_BORDER);
            String title = reportType.replace("-", " ").replace("_", " ").toUpperCase();
            titleCell.setPhrase(new Phrase(title, getFont(13, true, Color.WHITE)));
            titleCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            titleBox.addCell(titleCell);
            titleBox.setSpacingBefore(8);
            titleBox.setSpacingAfter(4);
            document.add(titleBox);

            // Period & generated timestamp
            if (start != null && end != null) {
                PdfPTable meta = new PdfPTable(2);
                meta.setWidthPercentage(100);
                meta.setSpacingAfter(12);

                addMetaCell(meta, "Report Period", start.format(DATE_FMT) + " — " + end.format(DATE_FMT));
                addMetaCell(meta, "Generated On", LocalDateTime.now().format(DT_FMT));
                document.add(meta);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to build PDF header", e);
        }
    }

    private void addMetaCell(PdfPTable table, String label, String value) {
        PdfPCell cell = new PdfPCell();
        cell.setBorderColor(SEPARATOR);
        cell.setPadding(5);
        Phrase phrase = new Phrase();
        phrase.add(new Chunk(label + ": ", getFont(8, true, TEXT_MUTED)));
        phrase.add(new Chunk(value, getFont(9, false, BRAND_DARK)));
        cell.setPhrase(phrase);
        table.addCell(cell);
    }

    private void addFooter(PdfWriter writer, Document document, User restaurant) {
        try {
            PdfContentByte cb = writer.getDirectContent();
            // Bottom line
            cb.setColorStroke(SEPARATOR);
            cb.setLineWidth(0.5f);
            cb.moveTo(document.left(), document.bottom() - 5);
            cb.lineTo(document.right(), document.bottom() - 5);
            cb.stroke();

            // Footer text
            Font footerFont = getFont(7, false, TEXT_MUTED);
            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("© " + LocalDate.now().getYear() + " " + restaurant.getRestaurantName() + " — Confidential", footerFont),
                    document.left(), document.bottom() - 15, 0);
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase("Page " + writer.getPageNumber(), footerFont),
                    document.right(), document.bottom() - 15, 0);
        } catch (Exception ignored) {}
    }

    // ============================================================
    //  PDF: CONTENT SECTIONS
    // ============================================================
    private void addSalesReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);

        addSectionTitle(document, "Order Details");
        PdfPTable table = createStyledTable(5, 10, 15, 20, 15, 10);
        addHeaderRow(table, "Order #", "Date & Time", "Customer", "Payment", "Total (₹)");

        double grandTotal = 0;
        for (int i = 0; i < orders.size(); i++) {
            Orders o = orders.get(i);
            boolean alt = i % 2 == 0;
            addDataRow(table, alt, o.getOrderNumber(),
                    o.getCreatedAt().format(DT_FMT),
                    o.getCustomerName() != null ? o.getCustomerName() : "Walk-in",
                    o.getPaymentMethod().toString(),
                    "₹" + String.format("%,.2f", o.getTotal()));
            if (o.getStatus() != Orders.OrderStatus.CANCELLED) grandTotal += o.getTotal();
        }
        document.add(table);

        addKeyValueSummary(document, "Total Revenue (excl. cancelled)", String.format("₹%,.2f", grandTotal));
    }

    private void addSalesGstReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end, boolean withGst) {
        List<Orders> all = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        
        List<Orders> filtered = all.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED && o.getItems() != null && (withGst ? (o.getPrintWithGst() != Boolean.FALSE && o.getItems().stream().anyMatch(item -> {
            if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) return false;
            double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
            return rate > 0.0;
        })) : (o.getPrintWithGst() == Boolean.FALSE || o.getItems().stream().anyMatch(item -> {
            if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) return false;
            double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
            return rate == 0.0;
        })))).toList();

        double totalRevenue = 0.0;
        double totalTax = 0.0;
        
        for (Orders o : filtered) {
            double orderBase = 0.0;
            double orderTax = 0.0;
            boolean treatAsNonGst = o.getPrintWithGst() == Boolean.FALSE;
            for (OrderItem item : o.getItems()) {
                if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) continue;
                double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                if (withGst) {
                    if (rate > 0.0 && !treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        double itemBase = itemTotal / (1.0 + rate / 100.0);
                        double itemTax = itemTotal - itemBase;
                        orderBase += itemBase;
                        orderTax += itemTax;
                    }
                } else {
                    if (rate == 0.0 || treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        orderBase += itemTotal;
                    }
                }
            }
            double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal()) : 0.0;
            double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
            double orderExtra = 0.0;
            if (o.getExtraCharges() != null) {
                orderExtra = o.getExtraCharges().stream().mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
            }
            double orderTotal = orderBase + orderTax + orderExtra - orderDiscount;
            
            totalRevenue += orderTotal;
            totalTax += orderTax;
        }
        
        double baseRevenue  = totalRevenue - totalTax;

        String title = withGst ? "Sales Report — With GST" : "Sales Report — Without GST";
        addSectionTitle(document, title);
        addKeyValueSummary(document, "Total Revenue", String.format("₹%,.2f", totalRevenue));
        if (withGst) {
            addKeyValueSummary(document, "Base Revenue (excl. GST)", String.format("₹%,.2f", baseRevenue));
            addKeyValueSummary(document, "Total GST Collected", String.format("₹%,.2f", totalTax));
            addKeyValueSummary(document, "  CGST (50%)", String.format("₹%,.2f", totalTax / 2));
            addKeyValueSummary(document, "  SGST (50%)", String.format("₹%,.2f", totalTax / 2));
        }

        PdfPTable table = withGst
                ? createStyledTable(6, 15, 18, 20, 12, 17, 18)
                : createStyledTable(5, 15, 18, 25, 12, 30);

        if (withGst) {
            addHeaderRow(table, "Order #", "Date", "Customer", "Payment", "Base Amt (₹)", "GST Amt (₹)");
        } else {
            addHeaderRow(table, "Order #", "Date", "Customer", "Payment", "Total (₹)");
        }

        for (int i = 0; i < filtered.size(); i++) {
            Orders o = filtered.get(i);
            double orderBase = 0.0;
            double orderTax = 0.0;
            boolean treatAsNonGst = o.getPrintWithGst() == Boolean.FALSE;
            for (OrderItem item : o.getItems()) {
                if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) continue;
                double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                if (withGst) {
                    if (rate > 0.0 && !treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        double itemBase = itemTotal / (1.0 + rate / 100.0);
                        double itemTax = itemTotal - itemBase;
                        orderBase += itemBase;
                        orderTax += itemTax;
                    }
                } else {
                    if (rate == 0.0 || treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        orderBase += itemTotal;
                    }
                }
            }
            double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal()) : 0.0;
            double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
            double orderExtra = 0.0;
            if (o.getExtraCharges() != null) {
                orderExtra = o.getExtraCharges().stream().mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
            }
            double orderTotal = orderBase + orderTax + orderExtra - orderDiscount;

            if (withGst) {
                addDataRow(table, i % 2 == 0,
                        o.getOrderNumber(),
                        o.getCreatedAt().format(DATE_FMT),
                        o.getCustomerName() != null ? o.getCustomerName() : "Walk-in",
                        o.getPaymentMethod().toString(),
                        String.format("₹%,.2f", orderBase + orderExtra - orderDiscount),
                        String.format("₹%,.2f", orderTax));
            } else {
                addDataRow(table, i % 2 == 0,
                        o.getOrderNumber(),
                        o.getCreatedAt().format(DATE_FMT),
                        o.getCustomerName() != null ? o.getCustomerName() : "Walk-in",
                        o.getPaymentMethod().toString(),
                        String.format("₹%,.2f", orderTotal));
            }
        }
        document.add(table);
    }

    private void addSalesSummaryContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        List<Transaction> transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);

        double grossSales  = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(Orders::getTotal).sum();
        double totalTax    = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(o -> o.getTaxAmount() != null ? o.getTaxAmount() : 0.0).sum();
        double cgst        = totalTax / 2;
        double sgst        = totalTax / 2;
        double netSales    = grossSales - totalTax;
        double totalIncome = transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.INCOME).mapToDouble(Transaction::getAmount).sum();
        double totalExpense= transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).mapToDouble(Transaction::getAmount).sum();
        long   orderCount  = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).count();

        addSectionTitle(document, "Financial Summary");
        PdfPTable table = createStyledTable(2, 60, 40);
        addHeaderRow(table, "Metric", "Amount (₹)");

        String[][] rows = {
            {"Gross Sales",       String.format("₹%,.2f", grossSales)},
            {"Net Sales (Pre-Tax)", String.format("₹%,.2f", netSales)},
            {"Total GST",         String.format("₹%,.2f", totalTax)},
            {"  ↳ CGST (50%)",    String.format("₹%,.2f", cgst)},
            {"  ↳ SGST (50%)",    String.format("₹%,.2f", sgst)},
            {"Total Orders",      String.valueOf(orderCount)},
            {"Avg. Order Value",  orderCount > 0 ? String.format("₹%,.2f", grossSales / orderCount) : "—"},
            {"Other Income",      String.format("₹%,.2f", totalIncome)},
            {"Other Expenses",    String.format("₹%,.2f", totalExpense)},
            {"Net Profit (est.)", String.format("₹%,.2f", grossSales + totalIncome - totalExpense)},
        };

        for (int i = 0; i < rows.length; i++) {
            addDataRow(table, i % 2 == 0, rows[i][0], rows[i][1]);
        }
        document.add(table);
    }

    private void addMonthlyDayWiseContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);

        Map<String, Double> dailyRevenue = new TreeMap<>();
        Map<String, Integer> dailyOrders = new TreeMap<>();
        Map<String, Integer> itemSales = new HashMap<>();

        for (Orders o : orders) {
            if (o.getStatus() == Orders.OrderStatus.CANCELLED) continue;
            String dateKey = o.getCreatedAt().toLocalDate().format(DATE_FMT);
            dailyRevenue.merge(dateKey, o.getTotal() != null ? o.getTotal() : 0.0, (a, b) -> a + b);
            dailyOrders.merge(dateKey, 1, (a, b) -> a + b);
            for (OrderItem item : o.getItems()) {
                itemSales.merge(item.getName(), item.getQuantity() != null ? item.getQuantity() : 0, (a, b) -> a + b);
            }
        }

        addSectionTitle(document, "Day-Wise Revenue Breakdown");
        PdfPTable table = createStyledTable(3, 40, 30, 30);
        addHeaderRow(table, "Date", "Orders", "Revenue (₹)");
        int i = 0;
        for (Map.Entry<String, Double> e : dailyRevenue.entrySet()) {
            addDataRow(table, i++ % 2 == 0, e.getKey(), String.valueOf(dailyOrders.getOrDefault(e.getKey(), 0)), String.format("₹%,.2f", e.getValue()));
        }
        document.add(table);

        addSectionTitle(document, "Top Selling Items");
        PdfPTable itemTable = createStyledTable(2, 70, 30);
        addHeaderRow(itemTable, "Item Name", "Qty Sold");
        int j = 0;
        List<Map.Entry<String,Integer>> sortedItems = new ArrayList<>(itemSales.entrySet());
        sortedItems.sort(Map.Entry.<String,Integer>comparingByValue().reversed());
        for (Map.Entry<String, Integer> e : sortedItems.stream().limit(20).toList()) {
            addDataRow(itemTable, j++ % 2 == 0, e.getKey(), String.valueOf(e.getValue()));
        }
        document.add(itemTable);
    }

    private void addEndDayReportContent(Document document, User restaurant) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDateTime.now();
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);

        double total  = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(Orders::getTotal).sum();
        double tax    = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(o -> o.getTaxAmount() != null ? o.getTaxAmount() : 0.0).sum();
        Map<String, Double> payments = new LinkedHashMap<>();
        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED)
                .forEach(o -> payments.merge(o.getPaymentMethod().toString(), o.getTotal(), (a, b) -> a + b));

        addSectionTitle(document, "Today's Business Summary — " + LocalDate.now().format(DATE_FMT));

        PdfPTable summary = createStyledTable(2, 60, 40);
        addHeaderRow(summary, "Metric", "Value");
        addDataRow(summary, true,  "Total Revenue",    String.format("₹%,.2f", total));
        addDataRow(summary, false, "Total Tax (GST)",  String.format("₹%,.2f", tax));
        addDataRow(summary, true,  "Net Revenue",      String.format("₹%,.2f", total - tax));
        addDataRow(summary, false, "Total Orders",     String.valueOf(orders.size()));
        document.add(summary);

        addSectionTitle(document, "Payment Mode Breakdown");
        PdfPTable payTable = createStyledTable(2, 60, 40);
        addHeaderRow(payTable, "Payment Mode", "Amount (₹)");
        int i = 0;
        for (Map.Entry<String, Double> e : payments.entrySet()) {
            addDataRow(payTable, i++ % 2 == 0, e.getKey(), String.format("₹%,.2f", e.getValue()));
        }
        document.add(payTable);
    }

    private void addItemWiseSalesContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        Map<String, Integer> sales = new LinkedHashMap<>();
        Map<String, Double>  revenue = new LinkedHashMap<>();

        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o ->
            o.getItems().forEach(i -> {
                sales.merge(i.getName(), i.getQuantity(), (a, b) -> a + b);
                revenue.merge(i.getName(), i.getQuantity() * i.getPrice(), (a, b) -> a + b);
            })
        );

        List<Map.Entry<String,Integer>> sorted = new ArrayList<>(sales.entrySet());
        sorted.sort(Map.Entry.<String,Integer>comparingByValue().reversed());

        addSectionTitle(document, "Item-Wise Sales Report");
        PdfPTable table = createStyledTable(3, 50, 20, 30);
        addHeaderRow(table, "Item Name", "Qty Sold", "Revenue (₹)");
        int i = 0;
        for (Map.Entry<String,Integer> e : sorted) {
            addDataRow(table, i++ % 2 == 0, e.getKey(), String.valueOf(e.getValue()), String.format("₹%,.2f", revenue.getOrDefault(e.getKey(), 0.0)));
        }
        document.add(table);
    }

    private void addIncomeExpenseContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Transaction> transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
        double totalIncome  = transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.INCOME).mapToDouble(Transaction::getAmount).sum();
        double totalExpense = transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).mapToDouble(Transaction::getAmount).sum();

        addSectionTitle(document, "Income & Expense Statement");
        PdfPTable table = createStyledTable(4, 20, 35, 20, 25);
        addHeaderRow(table, "Date", "Description", "Type", "Amount (₹)");
        for (int i = 0; i < transactions.size(); i++) {
            Transaction t = transactions.get(i);
            addDataRow(table, i % 2 == 0,
                    t.getDate().format(DATE_FMT),
                    t.getDescription(),
                    t.getType().toString(),
                    String.format("₹%,.2f", t.getAmount()));
        }
        document.add(table);

        addKeyValueSummary(document, "Total Income", String.format("₹%,.2f", totalIncome));
        addKeyValueSummary(document, "Total Expense", String.format("₹%,.2f", totalExpense));
        addKeyValueSummary(document, "Net Balance", String.format("₹%,.2f", totalIncome - totalExpense));
    }

    private void addPurchaseReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<StockMovement> movements = stockMovementRepository
                .findByRestaurantAndTypeAndMovementTimestampBetweenOrderByMovementTimestampDesc(
                        restaurant, StockMovement.MovementType.ADD, start, end);

        addSectionTitle(document, "Purchase / Stock-In Report");
        PdfPTable table = createStyledTable(4, 20, 40, 20, 20);
        addHeaderRow(table, "Date", "Item", "Quantity", "Performed By");
        for (int i = 0; i < movements.size(); i++) {
            StockMovement m = movements.get(i);
            addDataRow(table, i % 2 == 0,
                    m.getTimestamp().format(DT_FMT),
                    m.getInventoryItem().getName(),
                    m.getQuantity() + " " + m.getInventoryItem().getUnit(),
                    m.getPerformedBy() != null ? m.getPerformedBy().getName() : "System");
        }
        document.add(table);
    }

    private void addCashierSalesReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        Map<String, Double> sales  = new LinkedHashMap<>();
        Map<String, Long>   counts = new LinkedHashMap<>();
        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o -> {
            String name = o.getCreatedBy() != null ? o.getCreatedBy().getName() : "System";
            sales.merge(name, o.getTotal(), (a, b) -> a + b);
            counts.merge(name, 1L, (a, b) -> a + b);
        });

        addSectionTitle(document, "Cashier-Wise Sales Report");
        PdfPTable table = createStyledTable(3, 40, 25, 35);
        addHeaderRow(table, "Cashier Name", "Orders", "Total Sales (₹)");
        int i = 0;
        for (Map.Entry<String, Double> e : sales.entrySet()) {
            addDataRow(table, i++ % 2 == 0, e.getKey(), String.valueOf(counts.get(e.getKey())), String.format("₹%,.2f", e.getValue()));
        }
        document.add(table);
    }

    private void addCancelledReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        List<Orders> cancelled = orders.stream().filter(o -> o.getStatus() == Orders.OrderStatus.CANCELLED).toList();
        double totalLoss = cancelled.stream().mapToDouble(Orders::getTotal).sum();

        addSectionTitle(document, "Cancelled Orders Summary");
        addKeyValueSummary(document, "Total Cancelled Orders", String.valueOf(cancelled.size()));
        addKeyValueSummary(document, "Total Potential Loss", String.format("₹%,.2f", totalLoss));

        PdfPTable table = createStyledTable(3, 25, 45, 30);
        addHeaderRow(table, "Order #", "Date & Time", "Amount (₹)");
        for (int i = 0; i < cancelled.size(); i++) {
            Orders o = cancelled.get(i);
            addDataRow(table, i % 2 == 0, o.getOrderNumber(), o.getCreatedAt().format(DT_FMT), String.format("₹%,.2f", o.getTotal()));
        }
        document.add(table);
    }

    private void addExpenditureReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Transaction> transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
        List<Transaction> expenses = transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).toList();
        double totalExpense = expenses.stream().mapToDouble(Transaction::getAmount).sum();

        addSectionTitle(document, "Detailed Expenditure Report");
        addKeyValueSummary(document, "Total Expenses", String.format("₹%,.2f", totalExpense));

        PdfPTable table = createStyledTable(4, 20, 35, 20, 25);
        addHeaderRow(table, "Date", "Description", "Category", "Amount (₹)");
        for (int i = 0; i < expenses.size(); i++) {
            Transaction t = expenses.get(i);
            addDataRow(table, i % 2 == 0,
                    t.getDate().format(DATE_FMT),
                    t.getDescription(),
                    t.getCategory() != null ? t.getCategory() : "-",
                    String.format("₹%,.2f", t.getAmount()));
        }
        document.add(table);
    }

    private void addPurchaseGstReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end, boolean withGst) {
        List<Transaction> allExpenses = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end)
                .stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).toList();

        List<Transaction> filtered = withGst
                ? allExpenses.stream().filter(t -> t.getGstAmount() != null && t.getGstAmount() > 0).toList()
                : allExpenses.stream().filter(t -> t.getGstAmount() == null || t.getGstAmount() == 0.0).toList();

        double totalAmount = filtered.stream().mapToDouble(Transaction::getAmount).sum();
        double totalGst    = filtered.stream().mapToDouble(t -> t.getGstAmount() != null ? t.getGstAmount() : 0.0).sum();
        double baseAmount  = totalAmount - totalGst;

        String title = withGst ? "Purchase Report — With GST" : "Purchase Report — Without GST";
        addSectionTitle(document, title);
        addKeyValueSummary(document, "Total Purchases", String.format("₹%,.2f", totalAmount));
        if (withGst) {
            addKeyValueSummary(document, "Base Amount (excl. GST)", String.format("₹%,.2f", baseAmount));
            addKeyValueSummary(document, "Total GST", String.format("₹%,.2f", totalGst));
        }

        int cols = withGst ? 5 : 4;
        PdfPTable table = withGst
                ? createStyledTable(cols, 18, 30, 18, 17, 17)
                : createStyledTable(cols, 20, 40, 20, 20);

        if (withGst) {
            addHeaderRow(table, "Date", "Description", "Invoice #", "Base Amt (₹)", "GST Amt (₹)");
        } else {
            addHeaderRow(table, "Date", "Description", "Category", "Amount (₹)");
        }

        for (int i = 0; i < filtered.size(); i++) {
            Transaction t = filtered.get(i);
            double gst  = t.getGstAmount() != null ? t.getGstAmount() : 0.0;
            double base = t.getAmount() - gst;
            if (withGst) {
                addDataRow(table, i % 2 == 0,
                        t.getDate().format(DATE_FMT),
                        t.getDescription(),
                        t.getInvoiceNumber() != null ? t.getInvoiceNumber() : "-",
                        String.format("₹%,.2f", base),
                        String.format("₹%,.2f", gst));
            } else {
                addDataRow(table, i % 2 == 0,
                        t.getDate().format(DATE_FMT),
                        t.getDescription(),
                        t.getCategory() != null ? t.getCategory() : "-",
                        String.format("₹%,.2f", t.getAmount()));
            }
        }
        document.add(table);
    }

    private void addInventoryValuationContent(Document document, User restaurant) {
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        double totalStockValue = items.stream()
                .mapToDouble(i -> (i.getCurrentStock() != null ? i.getCurrentStock() : 0.0) * (i.getCostPerUnit() != null ? i.getCostPerUnit() : 0.0)).sum();

        addSectionTitle(document, "Inventory Valuation Report (As-of " + LocalDate.now().format(DATE_FMT) + ")");
        addKeyValueSummary(document, "Total Active Items", String.valueOf(items.size()));
        addKeyValueSummary(document, "Total Stock Value (at Cost)", String.format("₹%,.2f", totalStockValue));

        PdfPTable table = createStyledTable(4, 40, 15, 20, 25);
        addHeaderRow(table, "Item Name", "Unit", "Current Stock", "Cost/Unit (₹)");
        for (int i = 0; i < items.size(); i++) {
            InventoryItem item = items.get(i);
            addDataRow(table, i % 2 == 0,
                    item.getName(),
                    item.getUnit() != null ? item.getUnit().toString() : "-",
                    item.getCurrentStock() != null ? String.format("%.2f", item.getCurrentStock()) : "0.00",
                    item.getCostPerUnit() != null ? String.format("₹%.2f", item.getCostPerUnit()) : "—");
        }
        document.add(table);
    }

    private static class LedgerEntry {
        LocalDateTime date;
        String crDr;
        String particulars;
        String voucherType;
        String voucherNumber;
        double debit;
        double credit;
        public LedgerEntry(LocalDateTime d, String cr, String p, String vt, String vn, double dr, double crAmount) {
            this.date = d; this.crDr = cr; this.particulars = p; this.voucherType = vt; this.voucherNumber = vn; this.debit = dr; this.credit = crAmount;
        }
        public LocalDateTime getDate() { return date; }
    }

    private List<LedgerEntry> getLedgerEntries(User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        List<Transaction> transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
        
        List<LedgerEntry> entries = new ArrayList<>();
        
        for (Orders o : orders) {
            if (o.getStatus() == Orders.OrderStatus.CANCELLED) continue;
            entries.add(new LedgerEntry(
                o.getCreatedAt(),
                "Cr",
                o.getCustomerName() != null && !o.getCustomerName().isBlank() ? o.getCustomerName() : (o.getOrderType() != null ? o.getOrderType().name() : "Walk-in"),
                "Sale",
                o.getOrderNumber(),
                0.0,
                o.getTotal()
            ));
        }
        
        for (Transaction t : transactions) {
            if (t.getType() == Transaction.TransactionType.EXPENSE) {
                entries.add(new LedgerEntry(
                    t.getDate(),
                    "Dr",
                    t.getCategory() != null ? t.getCategory() : t.getDescription(),
                    "Purchase",
                    t.getReferenceId() != null ? t.getReferenceId() : "TXN-" + t.getId(),
                    t.getAmount(),
                    0.0
                ));
            } else if (t.getType() == Transaction.TransactionType.INCOME) {
                entries.add(new LedgerEntry(
                    t.getDate(),
                    "Cr",
                    t.getCategory() != null ? t.getCategory() : t.getDescription(),
                    "Income",
                    t.getReferenceId() != null ? t.getReferenceId() : "TXN-" + t.getId(),
                    0.0,
                    t.getAmount()
                ));
            }
        }
        
        entries.sort(Comparator.comparing(LedgerEntry::getDate));
        return entries;
    }

    private void addLedgerReportContent(Document document, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<LedgerEntry> entries = getLedgerEntries(restaurant, start, end);
        
        addSectionTitle(document, "GST Ledger Report");
        PdfPTable table = createStyledTable(7, 12, 8, 25, 15, 15, 12, 13);
        addHeaderRow(table, "Date", "Cr/Dr", "Particulars", "Voucher Type", "Voucher Number", "Debit (₹)", "Credit (₹)");
        
        double totalDebit = 0;
        double totalCredit = 0;
        
        for (int i = 0; i < entries.size(); i++) {
            LedgerEntry e = entries.get(i);
            addDataRow(table, i % 2 == 0,
                    e.date.format(DATE_FMT),
                    e.crDr,
                    e.particulars,
                    e.voucherType,
                    e.voucherNumber,
                    e.debit > 0 ? String.format("%,.2f", e.debit) : "",
                    e.credit > 0 ? String.format("%,.2f", e.credit) : ""
            );
            totalDebit += e.debit;
            totalCredit += e.credit;
        }
        
        PdfPCell totalLabelCell = new PdfPCell(new Phrase("Closing Balance", getFont(9, true, BRAND_DARK)));
        totalLabelCell.setColspan(5);
        totalLabelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalLabelCell.setPadding(8);
        totalLabelCell.setBorderColor(SEPARATOR);
        table.addCell(totalLabelCell);
        
        PdfPCell debitCell = new PdfPCell(new Phrase(String.format("%,.2f", totalDebit), getFont(9, true, BRAND_DARK)));
        debitCell.setPadding(8);
        debitCell.setBorderColor(SEPARATOR);
        table.addCell(debitCell);
        
        PdfPCell creditCell = new PdfPCell(new Phrase(String.format("%,.2f", totalCredit), getFont(9, true, BRAND_DARK)));
        creditCell.setPadding(8);
        creditCell.setBorderColor(SEPARATOR);
        table.addCell(creditCell);
        
        document.add(table);
    }

    // ============================================================
    //  PDF: TABLE UTILITIES
    // ============================================================
    private PdfPTable createStyledTable(int cols, float... widths) {
        try {
            PdfPTable table = new PdfPTable(cols);
            table.setWidthPercentage(100);
            if (widths.length == cols) {
                table.setWidths(widths);
            }
            table.setSpacingBefore(8);
            table.setSpacingAfter(12);
            return table;
        } catch (DocumentException e) {
            throw new RuntimeException(e);
        }
    }

    private void addHeaderRow(PdfPTable table, String... headers) {
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, getFont(9, true, Color.WHITE)));
            cell.setBackgroundColor(HEADER_BG);
            cell.setPadding(8);
            cell.setBorderColor(HEADER_BG);
            cell.setHorizontalAlignment(Element.ALIGN_LEFT);
            table.addCell(cell);
        }
    }

    private void addDataRow(PdfPTable table, boolean alt, String... values) {
        Color bg = alt ? Color.WHITE : ROW_ALT;
        for (String v : values) {
            PdfPCell cell = new PdfPCell(new Phrase(v, getFont(8, false, BRAND_DARK)));
            cell.setBackgroundColor(bg);
            cell.setPadding(7);
            cell.setBorderColor(SEPARATOR);
            cell.setBorderWidth(0.5f);
            table.addCell(cell);
        }
    }

    private void addSectionTitle(Document document, String title) {
        Paragraph p = new Paragraph(title, getFont(12, true, BRAND_DARK));
        p.setSpacingBefore(16);
        p.setSpacingAfter(4);
        document.add(p);
        drawDivider(document, BRAND_ACCENT);
    }

    private void addKeyValueSummary(Document document, String key, String value) {
        Paragraph p = new Paragraph();
        p.add(new Chunk(key + ":  ", getFont(9, true, TEXT_MUTED)));
        p.add(new Chunk(value, getFont(10, true, BRAND_DARK)));
        p.setSpacingAfter(4);
        document.add(p);
    }

    private void drawDivider(Document document, Color color) {
        try {
            PdfPTable line = new PdfPTable(1);
            line.setWidthPercentage(100);
            line.setSpacingAfter(6);
            PdfPCell cell = new PdfPCell();
            cell.setBorder(Rectangle.BOTTOM);
            cell.setBorderColor(color);
            cell.setBorderWidth(1.5f);
            cell.setPadding(0);
            cell.setFixedHeight(1);
            line.addCell(cell);
            document.add(line);
        } catch (Exception ignored) {}
    }

    private Font getFont(float size, boolean bold, Color color) {
        int style = bold ? Font.BOLD : Font.NORMAL;
        return FontFactory.getFont(FontFactory.HELVETICA, size, style, color);
    }

    // ============================================================
    //  WORD (.docx) GENERATION
    // ============================================================
    public byte[] generateReportWord(String reportType, User restaurant, LocalDateTime start, LocalDateTime end) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            addWordHeader(doc, reportType, restaurant, start, end);
            addWordContent(doc, reportType, restaurant, start, end);
            doc.write(out);
            return out.toByteArray();
        }
    }

    private void addWordHeader(XWPFDocument doc, String reportType, User restaurant, LocalDateTime start, LocalDateTime end) {
        // Restaurant name
        XWPFParagraph title = doc.createParagraph();
        title.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun titleRun = title.createRun();
        titleRun.setText(restaurant.getRestaurantName().toUpperCase());
        titleRun.setBold(true);
        titleRun.setFontSize(18);
        titleRun.setColor("1e293b");

        // Address / Phone / Email
        if (restaurant.getAddress() != null || restaurant.getPhone() != null) {
            XWPFParagraph details = doc.createParagraph();
            details.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun dr = details.createRun();
            StringBuilder sb = new StringBuilder();
            if (restaurant.getAddress() != null) sb.append(restaurant.getAddress());
            if (restaurant.getPhone() != null) sb.append("  |  Tel: ").append(restaurant.getPhone());
            if (restaurant.getEmail() != null) sb.append("  |  ").append(restaurant.getEmail());
            dr.setText(sb.toString());
            dr.setFontSize(9);
            dr.setColor("64748b");
        }

        // GST
        if (restaurant.getGstNumber() != null && !restaurant.getGstNumber().isBlank()) {
            XWPFParagraph gstPara = doc.createParagraph();
            gstPara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun gstRun = gstPara.createRun();
            gstRun.setText("GSTIN: " + restaurant.getGstNumber());
            gstRun.setBold(true);
            gstRun.setFontSize(10);
            gstRun.setColor("2563eb");
        }

        // Separator paragraph
        doc.createParagraph();

        // Report title
        XWPFParagraph rTitle = doc.createParagraph();
        rTitle.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun rtRun = rTitle.createRun();
        rtRun.setText(reportType.replace("-", " ").toUpperCase());
        rtRun.setBold(true);
        rtRun.setFontSize(14);
        rtRun.setColor("2563eb");

        if (start != null && end != null) {
            XWPFParagraph period = doc.createParagraph();
            period.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun pr = period.createRun();
            pr.setText("Period: " + start.format(DATE_FMT) + " → " + end.format(DATE_FMT) + "   |   Generated: " + LocalDateTime.now().format(DT_FMT));
            pr.setFontSize(9);
            pr.setColor("64748b");
        }

        doc.createParagraph(); // Space
    }

    private void addWordContent(XWPFDocument doc, String reportType, User restaurant, LocalDateTime start, LocalDateTime end) {
        switch (reportType) {
            case "sales-summary":
                buildWordSalesSummary(doc, restaurant, start, end); break;
            case "sales-report":
                buildWordSalesReport(doc, restaurant, start, end); break;
            case "sales-gst-report":
                buildWordSalesGstReport(doc, restaurant, start, end, true); break;
            case "sales-non-gst-report":
                buildWordSalesGstReport(doc, restaurant, start, end, false); break;
            case "item-wise-sales":
            case "category-item-wise":
                buildWordItemWise(doc, restaurant, start, end); break;
            case "cashier-wise-sales":
                buildWordCashierReport(doc, restaurant, start, end); break;
            case "cancelled-item-summary":
                buildWordCancelledReport(doc, restaurant, start, end); break;
            case "income-expense":
                buildWordIncomeExpense(doc, restaurant, start, end); break;
            case "stock-report":
            case "total-inventory-valuation":
                buildWordInventory(doc, restaurant); break;
            case "gst-ledger-report":
                buildWordLedgerReport(doc, restaurant, start, end); break;
            case "expenditure-report":
                buildWordExpenditureReport(doc, restaurant, start, end); break;
            case "purchase-gst-report":
                buildWordPurchaseGstReport(doc, restaurant, start, end, true); break;
            case "purchase-non-gst-report":
                buildWordPurchaseGstReport(doc, restaurant, start, end, false); break;
            default:
                XWPFParagraph p = doc.createParagraph();
                p.createRun().setText("Detailed data for '" + reportType + "' is available in PDF or JSON format.");
        }
    }

    private void buildWordSalesSummary(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        double gross = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(Orders::getTotal).sum();
        double tax   = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(o -> o.getTaxAmount() != null ? o.getTaxAmount() : 0.0).sum();
        long count   = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).count();

        String[][] data = {
            {"Gross Sales", String.format("₹%,.2f", gross)},
            {"Total GST", String.format("₹%,.2f", tax)},
            {"  CGST", String.format("₹%,.2f", tax/2)},
            {"  SGST", String.format("₹%,.2f", tax/2)},
            {"Net Sales", String.format("₹%,.2f", gross - tax)},
            {"Total Orders", String.valueOf(count)},
            {"Avg. Order Value", count > 0 ? String.format("₹%,.2f", gross / count) : "—"},
        };
        buildWordTable(doc, new String[]{"Metric", "Value"}, data);
    }

    private void buildWordSalesReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        String[][] data = orders.stream().map(o -> new String[]{
            o.getOrderNumber(),
            o.getCreatedAt().format(DT_FMT),
            o.getCustomerName() != null ? o.getCustomerName() : "Walk-in",
            o.getPaymentMethod().toString(),
            String.format("₹%,.2f", o.getTotal())
        }).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Order #", "Date", "Customer", "Payment", "Total"}, data);
    }

    private void buildWordSalesGstReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end, boolean withGst) {
        List<Orders> all = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        
        List<Orders> filtered = all.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED && o.getItems() != null && (withGst ? (o.getPrintWithGst() != Boolean.FALSE && o.getItems().stream().anyMatch(item -> {
            if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) return false;
            double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
            return rate > 0.0;
        })) : (o.getPrintWithGst() == Boolean.FALSE || o.getItems().stream().anyMatch(item -> {
            if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) return false;
            double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
            return rate == 0.0;
        })))).toList();

        double totalRevenue = 0.0;
        double totalTax = 0.0;

        for (Orders o : filtered) {
            double orderBase = 0.0;
            double orderTax = 0.0;
            boolean treatAsNonGst = o.getPrintWithGst() == Boolean.FALSE;
            for (OrderItem item : o.getItems()) {
                if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) continue;
                double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                if (withGst) {
                    if (rate > 0.0 && !treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        double itemBase = itemTotal / (1.0 + rate / 100.0);
                        double itemTax = itemTotal - itemBase;
                        orderBase += itemBase;
                        orderTax += itemTax;
                    }
                } else {
                    if (rate == 0.0 || treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        orderBase += itemTotal;
                    }
                }
            }
            double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal()) : 0.0;
            double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
            double orderExtra = 0.0;
            if (o.getExtraCharges() != null) {
                orderExtra = o.getExtraCharges().stream().mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
            }
            double orderTotal = orderBase + orderTax + orderExtra - orderDiscount;

            totalRevenue += orderTotal;
            totalTax += orderTax;
        }

        double baseRevenue  = totalRevenue - totalTax;

        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setText((withGst ? "WITH GST" : "WITHOUT GST") + " Sales Report");
        r.setBold(true); r.setFontSize(13);

        XWPFParagraph p2 = doc.createParagraph();
        XWPFRun r2 = p2.createRun();
        String summary = "Total Revenue: " + String.format("₹%,.2f", totalRevenue);
        if (withGst) summary += "   |   Base: " + String.format("₹%,.2f", baseRevenue) + "   |   GST: " + String.format("₹%,.2f", totalTax);
        r2.setText(summary); r2.setBold(true);

        if (withGst) {
            String[][] data = filtered.stream().map(o -> {
                double orderBase = 0.0;
                double orderTax = 0.0;
                boolean treatAsNonGst = o.getPrintWithGst() == Boolean.FALSE;
                for (OrderItem item : o.getItems()) {
                    if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) continue;
                    double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                    if (rate > 0.0 && !treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        double itemBase = itemTotal / (1.0 + rate / 100.0);
                        double itemTax = itemTotal - itemBase;
                        orderBase += itemBase;
                        orderTax += itemTax;
                    }
                }
                double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal()) : 0.0;
                double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
                double orderExtra = 0.0;
                if (o.getExtraCharges() != null) {
                    orderExtra = o.getExtraCharges().stream().mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
                }
                double base = orderBase + orderExtra - orderDiscount;
                return new String[]{
                        o.getOrderNumber(),
                        o.getCreatedAt().format(DT_FMT),
                        o.getCustomerName() != null ? o.getCustomerName() : "Walk-in",
                        o.getPaymentMethod().toString(),
                        String.format("₹%,.2f", base),
                        String.format("₹%,.2f", orderTax)
                };
            }).toArray(String[][]::new);
            buildWordTable(doc, new String[]{"Order #", "Date", "Customer", "Payment", "Base Amt", "GST Amt"}, data);
        } else {
            String[][] data = filtered.stream().map(o -> {
                double orderBase = 0.0;
                boolean treatAsNonGst = o.getPrintWithGst() == Boolean.FALSE;
                for (OrderItem item : o.getItems()) {
                    if (item.getStatus() == OrderItem.ItemStatus.CANCELLED) continue;
                    double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                    if (rate == 0.0 || treatAsNonGst) {
                        double itemTotal = item.getPrice() * item.getQuantity();
                        orderBase += itemTotal;
                    }
                }
                double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal()) : 0.0;
                double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
                double orderExtra = 0.0;
                if (o.getExtraCharges() != null) {
                    orderExtra = o.getExtraCharges().stream().mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
                }
                double orderTotal = orderBase + orderExtra - orderDiscount;
                return new String[]{
                        o.getOrderNumber(),
                        o.getCreatedAt().format(DT_FMT),
                        o.getCustomerName() != null ? o.getCustomerName() : "Walk-in",
                        o.getPaymentMethod().toString(),
                        String.format("₹%,.2f", orderTotal)
                };
            }).toArray(String[][]::new);
            buildWordTable(doc, new String[]{"Order #", "Date", "Customer", "Payment", "Total"}, data);
        }
    }

    private void buildWordItemWise(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        Map<String, Integer> salesMap = new LinkedHashMap<>();
        Map<String, Double>  revMap   = new LinkedHashMap<>();
        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o ->
            o.getItems().forEach(i -> {
                salesMap.merge(i.getName(), i.getQuantity(), (a, b) -> a + b);
                revMap.merge(i.getName(), i.getQuantity() * i.getPrice(), (a, b) -> a + b);
            })
        );
        List<Map.Entry<String,Integer>> sorted = new ArrayList<>(salesMap.entrySet());
        sorted.sort(Map.Entry.<String,Integer>comparingByValue().reversed());
        String[][] data = sorted.stream().map(e -> new String[]{e.getKey(), String.valueOf(e.getValue()), String.format("₹%,.2f", revMap.get(e.getKey()))}).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Item Name", "Qty Sold", "Revenue"}, data);
    }

    private void buildWordCashierReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        Map<String, Double> salesMap = new LinkedHashMap<>();
        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o -> {
            String name = o.getCreatedBy() != null ? o.getCreatedBy().getName() : "System";
            salesMap.merge(name, o.getTotal(), (a, b) -> a + b);
        });
        String[][] data = salesMap.entrySet().stream().map(e -> new String[]{e.getKey(), String.format("₹%,.2f", e.getValue())}).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Cashier Name", "Total Sales"}, data);
    }

    private void buildWordExpenditureReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Transaction> transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
        List<Transaction> expenses = transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).toList();
        double total = expenses.stream().mapToDouble(Transaction::getAmount).sum();

        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setText("Total Expenses: " + String.format("₹%,.2f", total));
        r.setBold(true);

        String[][] data = expenses.stream().map(t -> new String[]{
            t.getDate().format(DATE_FMT),
            t.getDescription(),
            t.getCategory() != null ? t.getCategory() : "-",
            String.format("₹%,.2f", t.getAmount())
        }).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Date", "Description", "Category", "Amount"}, data);
    }

    private void buildWordPurchaseGstReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end, boolean withGst) {
        List<Transaction> all = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end)
                .stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).toList();
        List<Transaction> filtered = withGst
                ? all.stream().filter(t -> t.getGstAmount() != null && t.getGstAmount() > 0).toList()
                : all.stream().filter(t -> t.getGstAmount() == null || t.getGstAmount() == 0.0).toList();

        double totalAmount = filtered.stream().mapToDouble(Transaction::getAmount).sum();
        double totalGst    = filtered.stream().mapToDouble(t -> t.getGstAmount() != null ? t.getGstAmount() : 0.0).sum();
        double baseAmount  = totalAmount - totalGst;

        XWPFParagraph p = doc.createParagraph();
        XWPFRun r = p.createRun();
        r.setText((withGst ? "WITH GST" : "WITHOUT GST") + " Purchase Report");
        r.setBold(true); r.setFontSize(13);

        XWPFParagraph p2 = doc.createParagraph();
        XWPFRun r2 = p2.createRun();
        String summary = "Total: " + String.format("₹%,.2f", totalAmount);
        if (withGst) summary += "   |   Base: " + String.format("₹%,.2f", baseAmount) + "   |   GST: " + String.format("₹%,.2f", totalGst);
        r2.setText(summary); r2.setBold(true);

        if (withGst) {
            String[][] data = filtered.stream().map(t -> {
                double gst = t.getGstAmount() != null ? t.getGstAmount() : 0.0;
                return new String[]{
                        t.getDate().format(DATE_FMT),
                        t.getDescription(),
                        t.getInvoiceNumber() != null ? t.getInvoiceNumber() : "-",
                        String.format("₹%,.2f", t.getAmount() - gst),
                        String.format("₹%,.2f", gst)
                };
            }).toArray(String[][]::new);
            buildWordTable(doc, new String[]{"Date", "Description", "Invoice #", "Base Amt", "GST Amt"}, data);
        } else {
            String[][] data = filtered.stream().map(t -> new String[]{
                    t.getDate().format(DATE_FMT),
                    t.getDescription(),
                    t.getCategory() != null ? t.getCategory() : "-",
                    String.format("₹%,.2f", t.getAmount())
            }).toArray(String[][]::new);
            buildWordTable(doc, new String[]{"Date", "Description", "Category", "Amount"}, data);
        }
    }

    private void buildWordCancelledReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        List<Orders> cancelled = orders.stream().filter(o -> o.getStatus() == Orders.OrderStatus.CANCELLED).toList();
        String[][] data = cancelled.stream().map(o -> new String[]{o.getOrderNumber(), o.getCreatedAt().format(DT_FMT), String.format("₹%,.2f", o.getTotal())}).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Order #", "Date & Time", "Amount"}, data);
    }

    private void buildWordIncomeExpense(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Transaction> transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
        String[][] data = transactions.stream().map(t -> new String[]{t.getDate().format(DATE_FMT), t.getDescription(), t.getType().toString(), String.format("₹%,.2f", t.getAmount())}).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Date", "Description", "Type", "Amount"}, data);
    }

    private void buildWordInventory(XWPFDocument doc, User restaurant) {
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        String[][] data = items.stream().map(i -> new String[]{i.getName(), i.getUnit() != null ? i.getUnit().toString() : "-", String.format("%.2f", i.getCurrentStock() != null ? i.getCurrentStock() : 0.0), i.getCostPerUnit() != null ? String.format("₹%.2f", i.getCostPerUnit()) : "—"}).toArray(String[][]::new);
        buildWordTable(doc, new String[]{"Item Name", "Unit", "Stock", "Cost/Unit"}, data);
    }

    private void buildWordLedgerReport(XWPFDocument doc, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<LedgerEntry> entries = getLedgerEntries(restaurant, start, end);
        String[][] data = new String[entries.size() + 1][7];
        double totalDebit = 0;
        double totalCredit = 0;
        for (int i = 0; i < entries.size(); i++) {
            LedgerEntry e = entries.get(i);
            data[i][0] = e.date.format(DATE_FMT);
            data[i][1] = e.crDr;
            data[i][2] = e.particulars;
            data[i][3] = e.voucherType;
            data[i][4] = e.voucherNumber;
            data[i][5] = e.debit > 0 ? String.format("%,.2f", e.debit) : "";
            data[i][6] = e.credit > 0 ? String.format("%,.2f", e.credit) : "";
            totalDebit += e.debit;
            totalCredit += e.credit;
        }
        data[entries.size()] = new String[] { "", "", "", "", "Closing Balance", String.format("%,.2f", totalDebit), String.format("%,.2f", totalCredit) };
        buildWordTable(doc, new String[]{"Date", "Cr/Dr", "Particulars", "Voucher Type", "Voucher Number", "Debit", "Credit"}, data);
    }

    private void buildWordTable(XWPFDocument doc, String[] headers, String[][] rows) {
        int cols = headers.length;
        XWPFTable table = doc.createTable(rows.length + 1, cols);
        table.setWidth("100%");

        // Header row
        XWPFTableRow header = table.getRow(0);
        for (int c = 0; c < cols; c++) {
            XWPFTableCell cell = header.getCell(c);
            cell.setColor("2563eb");
            XWPFParagraph p = cell.getParagraphs().get(0);
            p.setAlignment(ParagraphAlignment.LEFT);
            XWPFRun run = p.createRun();
            run.setText(headers[c]);
            run.setBold(true);
            run.setColor("FFFFFF");
            run.setFontSize(9);
        }

        // Data rows
        for (int r = 0; r < rows.length; r++) {
            XWPFTableRow row = table.getRow(r + 1);
            String bg = r % 2 == 0 ? "FFFFFF" : "F1F5F9";
            for (int c = 0; c < Math.min(cols, rows[r].length); c++) {
                XWPFTableCell cell = row.getCell(c);
                if (cell == null) cell = row.addNewTableCell();
                cell.setColor(bg);
                XWPFParagraph p = cell.getParagraphs().get(0);
                XWPFRun run = p.createRun();
                run.setText(rows[r][c] != null ? rows[r][c] : "—");
                run.setFontSize(8);
            }
        }

        doc.createParagraph(); // Space after table
    }

    // ============================================================
    //  JSON GENERATION
    // ============================================================
    public byte[] generateReportJson(String reportType, User restaurant, LocalDateTime start, LocalDateTime end) throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("reportType",      reportType);
        payload.put("restaurantName",  restaurant.getRestaurantName());
        payload.put("gstNumber",       restaurant.getGstNumber());
        payload.put("address",         restaurant.getAddress());
        payload.put("phone",           restaurant.getPhone());
        if (start != null) payload.put("periodFrom", start.format(DATE_FMT));
        if (end   != null) payload.put("periodTo",   end.format(DATE_FMT));
        payload.put("generatedAt",     LocalDateTime.now().format(DT_FMT));

        switch (reportType) {
            case "sales-summary":
                buildJsonSalesSummary(payload, restaurant, start, end); break;
            case "sales-report":
                buildJsonSalesReport(payload, restaurant, start, end); break;
            case "item-wise-sales":
            case "category-item-wise":
                buildJsonItemWise(payload, restaurant, start, end); break;
            case "cashier-wise-sales":
                buildJsonCashierReport(payload, restaurant, start, end); break;
            case "income-expense":
                buildJsonIncomeExpense(payload, restaurant, start, end); break;
            case "stock-report":
            case "total-inventory-valuation":
                buildJsonInventory(payload, restaurant); break;
            case "cancelled-item-summary":
                buildJsonCancelled(payload, restaurant, start, end); break;
            case "gst-ledger-report":
                buildJsonLedgerReport(payload, restaurant, start, end); break;
            default:
                payload.put("data", "No structured data available for this report type.");
        }

        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(payload);
    }

    private void buildJsonSalesSummary(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        double gross = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(Orders::getTotal).sum();
        double tax   = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(o -> o.getTaxAmount() != null ? o.getTaxAmount() : 0.0).sum();
        long count   = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).count();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("grossSales", gross);
        summary.put("totalGST",   tax);
        summary.put("cgst",       tax / 2);
        summary.put("sgst",       tax / 2);
        summary.put("netSales",   gross - tax);
        summary.put("orderCount", count);
        summary.put("avgOrderValue", count > 0 ? gross / count : 0);
        p.put("summary", summary);
    }

    private void buildJsonSalesReport(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Orders o : orders) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("orderNumber",   o.getOrderNumber());
            m.put("date",          o.getCreatedAt() != null ? o.getCreatedAt().format(DT_FMT) : null);
            m.put("customer",      o.getCustomerName());
            m.put("table",         o.getTableNumber());
            m.put("paymentMethod", o.getPaymentMethod().toString());
            m.put("subtotal",      o.getSubtotal());
            m.put("taxAmount",     o.getTaxAmount());
            m.put("total",         o.getTotal());
            m.put("status",        o.getStatus().toString());
            list.add(m);
        }
        p.put("orders", list);
        p.put("totalRevenue", orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).mapToDouble(Orders::getTotal).sum());
    }

    private void buildJsonItemWise(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        Map<String, Integer> salesMap = new LinkedHashMap<>();
        Map<String, Double>  revMap   = new LinkedHashMap<>();
        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o ->
            o.getItems().forEach(i -> {
                salesMap.merge(i.getName(), i.getQuantity(), (a, b) -> a + b);
                revMap.merge(i.getName(), i.getQuantity() * i.getPrice(), (a, b) -> a + b);
            })
        );
        List<Map<String, Object>> list = new ArrayList<>();
        salesMap.forEach((name, qty) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("itemName", name); m.put("quantitySold", qty); m.put("revenue", revMap.get(name));
            list.add(m);
        });
        list.sort((a, b) -> ((Integer) b.get("quantitySold")).compareTo((Integer) a.get("quantitySold")));
        p.put("items", list);
    }

    private void buildJsonCashierReport(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        Map<String, Double> s = new LinkedHashMap<>();
        orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o -> s.merge(o.getCreatedBy() != null ? o.getCreatedBy().getName() : "System", o.getTotal(), (a, b) -> a + b));
        p.put("cashierSales", s);
    }

    private void buildJsonIncomeExpense(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Transaction> tx = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
        p.put("transactions", tx);
        p.put("totalIncome",  tx.stream().filter(t -> t.getType() == Transaction.TransactionType.INCOME).mapToDouble(Transaction::getAmount).sum());
        p.put("totalExpense", tx.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).mapToDouble(Transaction::getAmount).sum());
    }

    private void buildJsonInventory(Map<String, Object> p, User restaurant) {
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        double totalVal = items.stream().mapToDouble(i -> (i.getCurrentStock() != null ? i.getCurrentStock() : 0.0) * (i.getCostPerUnit() != null ? i.getCostPerUnit() : 0.0)).sum();
        p.put("items",          items);
        p.put("totalStockValue", totalVal);
        p.put("itemCount",      items.size());
    }

    private void buildJsonCancelled(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start, end);
        List<Orders> cancelled = orders.stream().filter(o -> o.getStatus() == Orders.OrderStatus.CANCELLED).toList();
        p.put("cancelledOrders", cancelled);
        p.put("count",           cancelled.size());
        p.put("totalLoss",       cancelled.stream().mapToDouble(Orders::getTotal).sum());
    }

    private void buildJsonLedgerReport(Map<String, Object> p, User restaurant, LocalDateTime start, LocalDateTime end) {
        List<LedgerEntry> entries = getLedgerEntries(restaurant, start, end);
        List<Map<String, Object>> list = new ArrayList<>();
        double totalDebit = 0;
        double totalCredit = 0;
        for (LedgerEntry e : entries) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.date.toString());
            m.put("crDr", e.crDr);
            m.put("particulars", e.particulars);
            m.put("voucherType", e.voucherType);
            m.put("voucherNumber", e.voucherNumber);
            m.put("debit", e.debit);
            m.put("credit", e.credit);
            list.add(m);
            totalDebit += e.debit;
            totalCredit += e.credit;
        }
        p.put("ledger", list);
        p.put("totalDebit", totalDebit);
        p.put("totalCredit", totalCredit);
    }
}
