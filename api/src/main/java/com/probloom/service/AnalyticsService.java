package com.probloom.service;

import com.probloom.model.entity.*;
import com.probloom.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AnalyticsService {

    private final OrdersRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    private final InventoryItemRepository inventoryItemRepository;
    private final TransactionRepository transactionRepository;
    private final StockMovementRepository stockMovementRepository;
    private final ReportService reportService;

    public Map<String, Object> getReportData(String type, User restaurant, LocalDateTime start, LocalDateTime end) {
        Map<String, Object> data = new LinkedHashMap<>();
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start,
                end);

        switch (type) {
            case "sales-summary":
                data.put("summary", calculateSummary(orders));
                List<Transaction> transactions = transactionRepository
                        .findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
                data.put("income", transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.INCOME)
                        .mapToDouble(Transaction::getAmount).sum());
                data.put("expense",
                        transactions.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE)
                                .mapToDouble(Transaction::getAmount).sum());
                break;

            case "sales-report":
                List<Map<String, Object>> salesList = new ArrayList<>();
                orders.forEach(o -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("orderNumber", o.getOrderNumber());
                    m.put("date", o.getCreatedAt());
                    m.put("customer", o.getCustomerName());
                    m.put("total", o.getTotal());
                    m.put("taxAmount", o.getTaxAmount());
                    m.put("status", o.getStatus());
                    m.put("payment", o.getPaymentMethod());
                    salesList.add(m);
                });
                data.put("sales", salesList);
                data.put("totalRevenue", orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED)
                        .mapToDouble(Orders::getTotal).sum());
                break;

            case "sales-gst-report": {
                List<Orders> gstOrders = orders.stream()
                        .filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED
                                && o.getPrintWithGst() != Boolean.FALSE && o.getItems() != null
                                && o.getItems().stream().anyMatch(item -> {
                                    if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                                        return false;
                                    double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                                    return rate > 0.0;
                                }))
                        .toList();

                double totalGstRevenue = 0.0;
                double totalTaxCollected = 0.0;
                List<Map<String, Object>> gstSalesList = new ArrayList<>();

                for (Orders o : gstOrders) {
                    double orderBase = 0.0;
                    double orderTax = 0.0;
                    for (OrderItem item : o.getItems()) {
                        if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                            continue;
                        double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                        if (rate > 0.0) {
                            double itemTotal = item.getPrice() * item.getQuantity();
                            double itemBase = itemTotal / (1.0 + rate / 100.0);
                            double itemTax = itemTotal - itemBase;
                            orderBase += itemBase;
                            orderTax += itemTax;
                        }
                    }
                    double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal())
                            : 0.0;
                    double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
                    double orderExtra = 0.0;
                    if (o.getExtraCharges() != null) {
                        orderExtra = o.getExtraCharges().stream()
                                .mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
                    }
                    double orderTotal = orderBase + orderTax + orderExtra - orderDiscount;

                    totalGstRevenue += orderTotal;
                    totalTaxCollected += orderTax;

                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("orderNumber", o.getOrderNumber());
                    m.put("date", o.getCreatedAt());
                    m.put("customer", o.getCustomerName());
                    m.put("total", orderTotal);
                    m.put("taxAmount", orderTax);
                    m.put("baseAmount", orderBase + orderExtra - orderDiscount);
                    m.put("payment", o.getPaymentMethod());
                    gstSalesList.add(m);
                }

                data.put("sales", gstSalesList);
                data.put("totalRevenue", totalGstRevenue);
                data.put("totalTaxCollected", totalTaxCollected);
                data.put("totalBaseRevenue", totalGstRevenue - totalTaxCollected);
                break;
            }

            case "sales-non-gst-report": {
                List<Orders> nonGstOrders = orders.stream()
                        .filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED && o.getItems() != null
                                && (o.getPrintWithGst() == Boolean.FALSE || o.getItems().stream().anyMatch(item -> {
                                    if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                                        return false;
                                    double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                                    return rate == 0.0;
                                })))
                        .toList();

                double totalNonGstRevenue = 0.0;
                List<Map<String, Object>> nonGstSalesList = new ArrayList<>();

                for (Orders o : nonGstOrders) {
                    double orderBase = 0.0;
                    boolean treatAsNonGst = o.getPrintWithGst() == Boolean.FALSE;
                    for (OrderItem item : o.getItems()) {
                        if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                            continue;
                        double rate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                        if (rate == 0.0 || treatAsNonGst) {
                            double itemTotal = item.getPrice() * item.getQuantity();
                            orderBase += itemTotal;
                        }
                    }
                    double proportion = o.getSubtotal() != null && o.getSubtotal() > 0 ? (orderBase / o.getSubtotal())
                            : 0.0;
                    double orderDiscount = o.getDiscountAmount() != null ? o.getDiscountAmount() * proportion : 0.0;
                    double orderExtra = 0.0;
                    if (o.getExtraCharges() != null) {
                        orderExtra = o.getExtraCharges().stream()
                                .mapToDouble(com.probloom.model.entity.ExtraCharge::getAmount).sum() * proportion;
                    }
                    double orderTotal = orderBase + orderExtra - orderDiscount;

                    totalNonGstRevenue += orderTotal;

                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("orderNumber", o.getOrderNumber());
                    m.put("date", o.getCreatedAt());
                    m.put("customer", o.getCustomerName());
                    m.put("total", orderTotal);
                    m.put("payment", o.getPaymentMethod());
                    nonGstSalesList.add(m);
                }

                data.put("sales", nonGstSalesList);
                data.put("totalRevenue", totalNonGstRevenue);
                break;
            }

            case "monthly-day-wise":
                Map<String, Double> dailyRev = new TreeMap<>();
                Map<String, Integer> dailyCount = new TreeMap<>();
                orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o -> {
                    String date = o.getCreatedAt().toLocalDate().toString();
                    dailyRev.put(date, dailyRev.getOrDefault(date, 0.0) + o.getTotal());
                    dailyCount.put(date, dailyCount.getOrDefault(date, 0) + 1);
                });
                List<Map<String, Object>> dailySales = new ArrayList<>();
                dailyRev.forEach((d, v) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("date", d);
                    m.put("revenue", v);
                    m.put("orderCount", dailyCount.getOrDefault(d, 0));
                    dailySales.add(m);
                });
                data.put("dailySales", dailySales);
                break;

            case "end-day-report":
                LocalDateTime todayStart = LocalDate.now().atStartOfDay();
                List<Orders> todayOrders = orders.stream().filter(o -> o.getCreatedAt().isAfter(todayStart)).toList();
                data.put("totalSales", todayOrders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED)
                        .mapToDouble(Orders::getTotal).sum());
                data.put("orderCount", todayOrders.size());
                Map<String, Double> payments = new HashMap<>();
                todayOrders
                        .forEach(o -> payments.merge(o.getPaymentMethod().toString(), o.getTotal(), (a, b) -> a + b));
                data.put("payments", payments);
                break;

            case "category-item-wise":
            case "item-wise-sales":
                Map<String, Double> items = new HashMap<>();
                Map<String, Double> itemRevenue = new HashMap<>();
                orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o -> {
                    o.getItems().forEach(i -> {
                        items.merge(i.getName(), i.getQuantity(), (a, b) -> a + b);
                        itemRevenue.merge(i.getName(), i.getQuantity() * i.getPrice(), (a, b) -> a + b);
                    });
                });
                List<Map<String, Object>> itemList = new ArrayList<>();
                items.forEach((name, qty) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", name);
                    m.put("quantity", qty);
                    m.put("revenue", itemRevenue.get(name));
                    itemList.add(m);
                });
                data.put("items", itemList);
                break;

            case "income-expense":
                List<Transaction> trans = transactionRepository
                        .findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
                data.put("transactions", trans);
                data.put("totalIncome", trans.stream().filter(t -> t.getType() == Transaction.TransactionType.INCOME)
                        .mapToDouble(Transaction::getAmount).sum());
                data.put("totalExpense", trans.stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE)
                        .mapToDouble(Transaction::getAmount).sum());
                break;

            case "stock-report":
            case "total-inventory-valuation":
                List<InventoryItem> invItems = inventoryItemRepository
                        .findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
                List<Object[]> soldData = orderItemRepository.sumSoldQuantityByInventoryItemAndRestaurant(restaurant);
                Map<Long, Integer> soldMap = new HashMap<>();
                for (Object[] row : soldData) {
                    if (row[0] != null && row[1] != null) {
                        soldMap.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue());
                    }
                }

                List<Map<String, Object>> stockList = new ArrayList<>();
                double totalVal = 0.0;
                for (InventoryItem i : invItems) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", i.getId());
                    map.put("name", i.getName());
                    map.put("category", i.getCategory());
                    map.put("unit", i.getUnit());
                    map.put("costPerUnit", i.getCostPerUnit());
                    map.put("lowStockThreshold", i.getLowStockThreshold());

                    double currentStock = i.getCurrentStock() != null ? i.getCurrentStock() : 0.0;
                    map.put("currentStock", currentStock);

                    int soldCount = soldMap.getOrDefault(i.getId(), 0);
                    map.put("soldCount", soldCount);
                    map.put("purchasedCount", currentStock + soldCount);

                    totalVal += currentStock * (i.getPrice() != null ? i.getPrice() : 0.0);
                    stockList.add(map);
                }

                data.put("items", stockList);
                data.put("totalValue", totalVal);
                data.put("count", invItems.size());
                break;

            case "purchase-item-stock":
            case "purchase-recipe-stock":
                List<StockMovement> movements = stockMovementRepository
                        .findByRestaurantAndTypeAndMovementTimestampBetweenOrderByMovementTimestampDesc(restaurant,
                                StockMovement.MovementType.ADD, start, end);
                data.put("purchases", movements);
                break;

            case "recipe-stock":
                List<InventoryItem> recipeItems = inventoryItemRepository
                        .findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
                data.put("items", recipeItems);
                data.put("totalValue",
                        recipeItems.stream().mapToDouble(i -> (i.getCurrentStock() != null ? i.getCurrentStock() : 0.0)
                                * (i.getPrice() != null ? i.getPrice() : 0.0)).sum());
                data.put("count", recipeItems.size());
                break;

            case "expiry-date-wise": {
                List<InventoryItem> allItems = inventoryItemRepository
                        .findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
                LocalDate today = LocalDate.now();
                List<Map<String, Object>> expiryList = new ArrayList<>();
                for (InventoryItem inv : allItems) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", inv.getName());
                    m.put("category", inv.getCategory());
                    m.put("currentStock", inv.getCurrentStock());
                    m.put("unit", inv.getUnit());
                    m.put("batchNumber", inv.getBatchNo());
                    String expDateStr = inv.getExpDate();
                    if (expDateStr != null && !expDateStr.isBlank()) {
                        try {
                            LocalDate expDate = LocalDate.parse(expDateStr);
                            long days = java.time.temporal.ChronoUnit.DAYS.between(today, expDate);
                            m.put("expiryDate", expDateStr);
                            m.put("daysUntilExpiry", (int) days);
                        } catch (Exception ex) {
                            m.put("expiryDate", expDateStr);
                            m.put("daysUntilExpiry", null);
                        }
                    } else {
                        m.put("expiryDate", null);
                        m.put("daysUntilExpiry", null);
                    }
                    expiryList.add(m);
                }
                data.put("items", expiryList);
                break;
            }
            case "month-wise-stock-report": {
                List<StockMovement> allMovements = stockMovementRepository
                        .findByRestaurantAndMovementTimestampBetweenOrderByMovementTimestampDesc(restaurant, start,
                                end);

                java.util.Map<String, java.util.Map<String, double[]>> monthItemStats = new java.util.TreeMap<>(); // "YYYY-MM"
                                                                                                                   // ->
                                                                                                                   // "Item
                                                                                                                   // Name"
                                                                                                                   // ->
                                                                                                                   // [Added,
                                                                                                                   // Consumed]

                for (StockMovement sm : allMovements) {
                    java.time.LocalDateTime ts = sm.getTimestamp();
                    String monthStr = ts.getYear() + "-" + String.format("%02d", ts.getMonthValue());
                    String itemName = sm.getInventoryItem().getName() + " (" + sm.getInventoryItem().getUnit() + ")";

                    monthItemStats.putIfAbsent(monthStr, new java.util.TreeMap<>());
                    java.util.Map<String, double[]> itemStats = monthItemStats.get(monthStr);
                    itemStats.putIfAbsent(itemName, new double[] { 0.0, 0.0 });

                    if (sm.getType() == StockMovement.MovementType.ADD) {
                        itemStats.get(itemName)[0] += (sm.getQuantity() != null ? sm.getQuantity() : 0.0);
                    } else if (sm.getType() == StockMovement.MovementType.DEDUCT) {
                        itemStats.get(itemName)[1] += (sm.getQuantity() != null ? sm.getQuantity() : 0.0);
                    }
                }

                List<Map<String, Object>> monthWiseList = new ArrayList<>();
                for (java.util.Map.Entry<String, java.util.Map<String, double[]>> monthEntry : monthItemStats
                        .entrySet()) {
                    for (java.util.Map.Entry<String, double[]> itemEntry : monthEntry.getValue().entrySet()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("month", monthEntry.getKey());
                        row.put("item", itemEntry.getKey());
                        row.put("added", itemEntry.getValue()[0]);
                        row.put("consumed", itemEntry.getValue()[1]);
                        row.put("netChange", itemEntry.getValue()[0] - itemEntry.getValue()[1]);
                        monthWiseList.add(row);
                    }
                }
                data.put("monthWiseStock", monthWiseList);
                break;
            }

            case "hsn-summary": {
                // Aggregate order items by HSN code
                Map<String, Map<String, Object>> hsnMap = new LinkedHashMap<>();
                for (Orders o : orders) {
                    if (o.getStatus() == Orders.OrderStatus.CANCELLED)
                        continue;
                    if (o.getItems() == null)
                        continue;
                    for (OrderItem item : o.getItems()) {
                        if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                            continue;
                        String hsn = item.getHsnCode() != null && !item.getHsnCode().isBlank() ? item.getHsnCode()
                                : "N/A";
                        double taxRate = item.getTaxRate() != null ? item.getTaxRate() : 0.0;
                        double lineTotal = item.getPrice() * item.getQuantity();
                        double base = taxRate > 0 ? lineTotal / (1.0 + taxRate / 100.0) : lineTotal;
                        double totalGst = lineTotal - base;
                        double cgst = totalGst / 2.0;
                        double sgst = totalGst / 2.0;

                        hsnMap.computeIfAbsent(hsn, k -> {
                            Map<String, Object> row = new LinkedHashMap<>();
                            row.put("hsnCode", hsn);
                            row.put("description", item.getName());
                            row.put("qty", 0);
                            row.put("taxableValue", 0.0);
                            row.put("gstRate", taxRate);
                            row.put("cgst", 0.0);
                            row.put("sgst", 0.0);
                            row.put("igst", 0.0);
                            row.put("totalGst", 0.0);
                            return row;
                        });
                        Map<String, Object> row = hsnMap.get(hsn);
                        row.put("qty", ((Number) row.get("qty")).doubleValue() + item.getQuantity());
                        row.put("taxableValue", (double) row.get("taxableValue") + base);
                        row.put("cgst", (double) row.get("cgst") + cgst);
                        row.put("sgst", (double) row.get("sgst") + sgst);
                        row.put("totalGst", (double) row.get("totalGst") + totalGst);
                    }
                }
                data.put("hsnRows", new ArrayList<>(hsnMap.values()));
                break;
            }

            case "expenditure-report":
                List<Transaction> expenses = transactionRepository
                        .findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end)
                        .stream().filter(t -> t.getType() == Transaction.TransactionType.EXPENSE).toList();
                data.put("expenses", expenses);
                data.put("totalExpense", expenses.stream().mapToDouble(Transaction::getAmount).sum());
                break;

            case "purchase-gst-report": {
                // Purchases that have a GST component recorded
                List<Transaction> allExpGst = transactionRepository
                        .findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end)
                        .stream()
                        .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE
                                && t.getGstAmount() != null && t.getGstAmount() > 0)
                        .toList();
                double gstTotal = allExpGst.stream().mapToDouble(Transaction::getAmount).sum();
                double gstTaxTotal = allExpGst.stream()
                        .mapToDouble(t -> t.getGstAmount() != null ? t.getGstAmount() : 0.0).sum();
                double gstBaseTotal = gstTotal - gstTaxTotal;
                data.put("expenses", allExpGst);
                data.put("totalExpense", gstTotal);
                data.put("totalGstAmount", gstTaxTotal);
                data.put("totalBaseAmount", gstBaseTotal);
                break;
            }

            case "purchase-non-gst-report": {
                // Purchases with no GST component
                List<Transaction> allExpNonGst = transactionRepository
                        .findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end)
                        .stream()
                        .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE
                                && (t.getGstAmount() == null || t.getGstAmount() == 0.0))
                        .toList();
                data.put("expenses", allExpNonGst);
                data.put("totalExpense", allExpNonGst.stream().mapToDouble(Transaction::getAmount).sum());
                break;
            }

            case "cashier-wise-sales":
                Map<String, Double> cashierSales = new HashMap<>();
                orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED).forEach(o -> {
                    String name = o.getCreatedBy() != null ? o.getCreatedBy().getName() : "System";
                    cashierSales.merge(name, o.getTotal(), (a, b) -> a + b);
                });
                data.put("cashiers", cashierSales);
                break;

            case "cancelled-item-summary":
                List<Orders> cancelled = orders.stream().filter(o -> o.getStatus() == Orders.OrderStatus.CANCELLED)
                        .toList();
                data.put("cancelledOrders", cancelled);
                data.put("count", cancelled.size());
                data.put("totalLoss", cancelled.stream().mapToDouble(Orders::getTotal).sum());
                break;

            default:
                data.put("message", "General data for " + type);
                data.put("ordersCount", orders.size());
                data.put("revenue", orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED)
                        .mapToDouble(Orders::getTotal).sum());
        }
        return data;
    }

    private Map<String, Object> calculateSummary(List<Orders> orders) {
        double totalRevenue = orders.stream().filter(o -> o.getStatus() != Orders.OrderStatus.CANCELLED)
                .mapToDouble(Orders::getTotal).sum();
        long totalOrders = orders.size();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("totalOrders", totalOrders);
        summary.put("avgOrderValue", totalOrders > 0 ? totalRevenue / totalOrders : 0.0);
        return summary;
    }

    public byte[] downloadReport(String type, String format, User restaurant, LocalDateTime start, LocalDateTime end)
            throws Exception {
        return switch (format.toLowerCase()) {
            case "word", "docx" -> reportService.generateReportWord(type, restaurant, start, end);
            case "json" -> reportService.generateReportJson(type, restaurant, start, end);
            default -> reportService.generateReportPDF(type, restaurant, start, end);
        };
    }

    public Map<String, Object> getDashboard(List<User> restaurants) {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = LocalDate.now().atTime(LocalTime.MAX);
        LocalDateTime weekStart = LocalDate.now().minusDays(6).atStartOfDay();
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        double totalTodayRevenue = 0.0;
        long totalTodayOrders = 0;
        double totalWeekRevenue = 0.0;
        double totalMonthRevenue = 0.0;

        for (User restaurant : restaurants) {
            Double todayRevenue = orderRepository.sumRevenueByRestaurantAndDateRange(restaurant, todayStart, todayEnd);
            Long todayOrders = orderRepository.countOrdersByRestaurantAndDateRange(restaurant, todayStart, todayEnd);
            Double weekRevenue = orderRepository.sumRevenueByRestaurantAndDateRange(restaurant, weekStart, todayEnd);
            Double monthRevenue = orderRepository.sumRevenueByRestaurantAndDateRange(restaurant, monthStart, todayEnd);

            totalTodayRevenue += (todayRevenue != null ? todayRevenue : 0.0);
            totalTodayOrders += (todayOrders != null ? todayOrders : 0L);
            totalWeekRevenue += (weekRevenue != null ? weekRevenue : 0.0);
            totalMonthRevenue += (monthRevenue != null ? monthRevenue : 0.0);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("todayRevenue", totalTodayRevenue);
        result.put("todayOrders", totalTodayOrders);
        result.put("weekRevenue", totalWeekRevenue);
        result.put("monthRevenue", totalMonthRevenue);
        return result;
    }

    public Map<String, Object> getSalesAnalytics(List<User> restaurants, String period, LocalDateTime from,
            LocalDateTime to) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start;
        LocalDateTime end = (to != null) ? to : now;

        String effectivePeriod = period;

        if (from != null) {
            start = from;
            effectivePeriod = "custom";
        } else {
            effectivePeriod = period != null ? period : "7d";
            switch (effectivePeriod) {
                case "1d":
                    start = now.toLocalDate().atStartOfDay();
                    break;
                case "30d":
                    start = now.minusDays(29).toLocalDate().atStartOfDay();
                    break;
                case "90d":
                    start = now.minusDays(89).toLocalDate().atStartOfDay();
                    break;
                case "7d":
                default:
                    start = now.minusDays(6).toLocalDate().atStartOfDay();
                    break;
            }
        }

        List<Orders> orders;
        List<Transaction> transactions;

        if (restaurants.size() == 1) {
            orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurants.get(0), start,
                    end);
            transactions = transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurants.get(0),
                    start, end);
        } else {
            orders = orderRepository.findByRestaurantInAndCreatedAtBetweenOrderByCreatedAtDesc(restaurants, start, end);
            transactions = transactionRepository.findByRestaurantInAndDateBetweenOrderByDateDesc(restaurants, start,
                    end);
        }

        double totalRevenue = 0.0;
        long totalOrders = 0;
        Map<String, Double> dailyRevenue = new TreeMap<>();
        Map<String, Double> dailyExpense = new TreeMap<>();
        Map<String, Double> itemSales = new HashMap<>();
        Map<String, Double> itemRevenue = new HashMap<>();
        Map<String, Double> categoryExpenses = new HashMap<>();

        Map<Long, Double> inventoryCostCache = new HashMap<>();
        double totalCogs = 0.0;

        // Process Orders (Revenue and COGS)
        for (Orders o : orders) {
            if (o.getStatus() == Orders.OrderStatus.CANCELLED)
                continue;

            totalRevenue += o.getTotal();
            totalOrders++;

            boolean isSingleDay = "1d".equals(effectivePeriod) || "custom".equals(effectivePeriod);
            String dateKey = isSingleDay
                    ? String.format("%02d:00", o.getCreatedAt().getHour())
                    : o.getCreatedAt().toLocalDate().toString();
            dailyRevenue.merge(dateKey, o.getTotal(), (a, b) -> a + b);

            for (OrderItem item : o.getItems()) {
                if (item.getStatus() == OrderItem.ItemStatus.CANCELLED)
                    continue;

                itemSales.merge(item.getName(), item.getQuantity(), (a, b) -> a + b);
                itemRevenue.merge(item.getName(), item.getPrice() * item.getQuantity(), (a, b) -> a + b);

                double unitCost = 0.0;
                if (item.getInventoryItemId() != null) {
                    unitCost = inventoryCostCache.computeIfAbsent(item.getInventoryItemId(),
                            id -> inventoryItemRepository.findById(id).map(InventoryItem::getCostPerUnit).orElse(0.0));
                }
                totalCogs += unitCost * item.getQuantity();
            }
        }

        // Process Transactions (Expenses)
        double totalExpense = 0.0;
        for (Transaction t : transactions) {
            if (t.getType() == Transaction.TransactionType.EXPENSE) {
                totalExpense += t.getAmount();
                boolean isSingleDay = "1d".equals(effectivePeriod) || "custom".equals(effectivePeriod);
                String dateKey = isSingleDay
                        ? String.format("%02d:00", t.getDate().getHour())
                        : t.getDate().toLocalDate().toString();
                dailyExpense.merge(dateKey, t.getAmount(), (a, b) -> a + b);
                categoryExpenses.merge(t.getCategory(), t.getAmount(), (a, b) -> a + b);
            }
        }

        // Prepare revenueTrend for Recharts
        List<Map<String, Object>> revenueTrend = new ArrayList<>();
        Set<String> allDates = new TreeSet<>(dailyRevenue.keySet());
        allDates.addAll(dailyExpense.keySet());

        for (String date : allDates) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", date);
            m.put("revenue", dailyRevenue.getOrDefault(date, 0.0));
            m.put("expense", dailyExpense.getOrDefault(date, 0.0));
            m.put("profit", dailyRevenue.getOrDefault(date, 0.0) - dailyExpense.getOrDefault(date, 0.0));
            revenueTrend.add(m);
        }

        // Prepare topItems — ALL products sold, sorted by qty desc, with revenue
        List<Map<String, Object>> topItemsList = new ArrayList<>();
        itemSales.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .forEach(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("_id", e.getKey());
                    m.put("name", e.getKey());
                    m.put("totalQuantity", e.getValue());
                    m.put("totalRevenue", itemRevenue.getOrDefault(e.getKey(), 0.0));
                    topItemsList.add(m);
                });

        // Prepare expenseBreakdown
        List<Map<String, Object>> expenseBreakdown = new ArrayList<>();
        categoryExpenses.forEach((cat, amt) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("name", cat);
            m.put("value", amt);
            expenseBreakdown.add(m);
        });

        double grossProfit = totalRevenue - totalCogs;
        double netProfit = totalRevenue - totalExpense;
        double profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0.0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRevenue", totalRevenue);
        summary.put("totalOrders", totalOrders);
        summary.put("totalExpense", totalExpense);
        summary.put("grossProfit", grossProfit);
        summary.put("netProfit", netProfit);
        summary.put("profitMargin", profitMargin);
        summary.put("avgOrderValue", totalOrders > 0 ? totalRevenue / totalOrders : 0.0);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("revenueByDay", revenueTrend);
        response.put("topItems", topItemsList);
        response.put("expenseBreakdown", expenseBreakdown);

        return response;
    }
}
