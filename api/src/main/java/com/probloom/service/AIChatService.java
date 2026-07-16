package com.probloom.service;

import com.probloom.model.entity.*;
import com.probloom.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AIChatService {

    private final OrdersRepository orderRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final LocalNLPEngine nlpEngine;

    public Map<String, Object> processQuery(String query, User restaurant) {
        LocalNLPEngine.ParsedQuery parsed = nlpEngine.parse(query);
        Map<String, Object> response = new HashMap<>();

        try {
            switch (parsed.intent) {
                case EMPLOYEE_PERFORMANCE:
                    return getEmployeePerformanceResponse(restaurant, parsed.startDate, parsed.endDate,
                            parsed.periodLabel);
                case PRODUCT_SALES_SUMMARY:
                    return getProductSalesResponse(restaurant, parsed.startDate, parsed.endDate, parsed.periodLabel);
                case GENERAL_SALES:
                    return getSalesResponse(restaurant, parsed.startDate, parsed.endDate, parsed.periodLabel);
                case INVENTORY_CHECK:
                    return getInventoryResponse(query, restaurant);
                case EMPLOYEE_COUNT:
                    return getEmployeeCountResponse(restaurant);
                case MENU_SUMMARY:
                    return getMenuSummaryResponse(restaurant);
                case UNKNOWN:
                default:
                    response.put("answer",
                            "I am your ProBloom Local AI Engine. I can help you with:\n- **Employee Performance** (e.g. 'Which employee has high performance today?')\n- **Product Sales** (e.g. 'What products have we sold this week?')\n- **General Sales** (e.g. 'Show me the revenue for this month')\n- **Inventory** (e.g. 'Check stock levels')");
                    response.put("type", "text");
                    return response;
            }
        } catch (Exception e) {
            response.put("answer", "I encountered an error processing your request. Please try rephrasing.");
            response.put("type", "text");
            return response;
        }
    }

    private Map<String, Object> getEmployeePerformanceResponse(User restaurant, LocalDateTime start, LocalDateTime end,
            String periodLabel) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start,
                end);
        Map<String, Double> revenueByEmployee = new HashMap<>();
        Map<String, Integer> ordersByEmployee = new HashMap<>();

        for (Orders o : orders) {
            if (o.getStatus() == Orders.OrderStatus.CANCELLED)
                continue;
            String empName = (o.getCreatedBy() != null && o.getCreatedBy().getName() != null)
                    ? o.getCreatedBy().getName()
                    : "System";
            if (o.getWaiterName() != null && !o.getWaiterName().isEmpty()) {
                empName = o.getWaiterName();
            }
            revenueByEmployee.put(empName, revenueByEmployee.getOrDefault(empName, 0.0) + o.getTotal());
            ordersByEmployee.put(empName, ordersByEmployee.getOrDefault(empName, 0) + 1);
        }

        if (revenueByEmployee.isEmpty()) {
            return Map.of("answer", "I could not find any employee performance data for " + periodLabel + ".", "type",
                    "text");
        }

        String bestEmployee = "";
        double maxRev = -1;
        for (Map.Entry<String, Double> e : revenueByEmployee.entrySet()) {
            if (e.getValue() > maxRev) {
                maxRev = e.getValue();
                bestEmployee = e.getKey();
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("### 🏆 Employee Performance (").append(periodLabel).append(")\n\n");
        sb.append("The top performing employee is **").append(bestEmployee)
                .append("** with a total generated revenue of **₹").append(String.format("%.2f", maxRev))
                .append("**.\n\n");
        sb.append("| Employee Name | Orders Handled | Total Revenue |\n");
        sb.append("| :--- | :--- | :--- |\n");

        revenueByEmployee.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .forEach(e -> {
                    sb.append("| ").append(e.getKey()).append(" | ").append(ordersByEmployee.get(e.getKey()))
                            .append(" | ₹").append(String.format("%.2f", e.getValue())).append(" |\n");
                });

        return Map.of("answer", sb.toString(), "type", "employee_performance");
    }

    private Map<String, Object> getProductSalesResponse(User restaurant, LocalDateTime start, LocalDateTime end,
            String periodLabel) {
        List<Orders> orders = orderRepository.findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(restaurant, start,
                end);
        Map<String, Double> productQty = new HashMap<>();
        Map<String, Double> productRev = new HashMap<>();

        for (Orders o : orders) {
            if (o.getStatus() == Orders.OrderStatus.CANCELLED)
                continue;
            for (com.probloom.model.entity.OrderItem item : o.getItems()) {
                productQty.put(item.getName(), productQty.getOrDefault(item.getName(), 0.0) + item.getQuantity());
                productRev.put(item.getName(),
                        productRev.getOrDefault(item.getName(), 0.0) + (item.getPrice() * item.getQuantity()));
            }
        }

        if (productQty.isEmpty()) {
            return Map.of("answer", "No products were sold during " + periodLabel + ".", "type", "text");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("### 📦 Product Sales Summary (").append(periodLabel).append(")\n\n");
        sb.append("| Product Name | Quantity Sold | Revenue Generated |\n");
        sb.append("| :--- | :--- | :--- |\n");

        productQty.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .limit(10) // Show top 10 to avoid massive lists
                .forEach(e -> {
                    sb.append("| ").append(e.getKey()).append(" | ").append(e.getValue()).append(" | ₹")
                            .append(String.format("%.2f", productRev.get(e.getKey()))).append(" |\n");
                });

        return Map.of("answer", sb.toString(), "type", "product_sales");
    }

    private Map<String, Object> getSalesResponse(User restaurant, LocalDateTime start, LocalDateTime end,
            String periodLabel) {
        Double total = orderRepository.sumRevenueByRestaurantAndDateRange(restaurant, start, end);
        Long count = orderRepository.countOrdersByRestaurantAndDateRange(restaurant, start, end);
        double safeTotal = (total != null) ? total : 0.0;
        long safeCount = (count != null) ? count : 0L;

        String ans = String.format(
                "Based on the data for **%s**, your establishment generated a gross revenue of **₹%.2f**, accumulated across a total of **%d** completed orders.",
                periodLabel, safeTotal, safeCount);
        return Map.of("answer", ans, "data", Map.of("total", safeTotal, "count", safeCount), "type", "sales");
    }

    private Map<String, Object> getInventoryResponse(String query, User restaurant) {
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        long lowStockCount = items.stream().filter(InventoryItem::isLowStock).count();
        return Map.of("answer",
                String.format("Your inventory contains **%d** items. **%d** items are currently running low on stock.",
                        items.size(), lowStockCount),
                "type", "inventory_summary");
    }

    private Map<String, Object> getEmployeeCountResponse(User restaurant) {
        return Map.of("answer",
                "To track specific employee counts accurately, please refer to the Workforce or Employee Management section.",
                "type", "text");
    }

    private Map<String, Object> getMenuSummaryResponse(User restaurant) {
        return Map.of("answer", "To see detailed menu analytics, please view the Menu Management dashboard.", "type",
                "text");
    }
}
