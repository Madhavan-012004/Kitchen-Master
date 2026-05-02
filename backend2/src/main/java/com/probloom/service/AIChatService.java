package com.probloom.service;

import com.probloom.model.entity.*;
import com.probloom.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AIChatService {

    private final OrdersRepository orderRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final AnalyticsService analyticsService;

    public Map<String, Object> processQuery(String query, User restaurant) {
        String lowerQuery = query.toLowerCase();
        Map<String, Object> response = new HashMap<>();
        
        // 1. Sales / Revenue Intents
        if (containsAny(lowerQuery, "sale", "revenue", "earn", "income", "how much")) {
            return getSalesResponse(lowerQuery, restaurant);
        }
        
        // 2. Popular / Best Seller Intents
        if (containsAny(lowerQuery, "popular", "best seller", "most sold", "top item", "dish")) {
            return getPopularityResponse(restaurant);
        }
        
        // 3. Stock / Inventory Intents
        if (containsAny(lowerQuery, "stock", "inventory", "available", "left", "many")) {
            return getInventoryResponse(lowerQuery, restaurant);
        }

        response.put("answer", "I apologize, but I am unable to process that specific inquiry. As your ProBloom Assistant, I specialize in actionable insights. Please feel free to inquire about **Daily Revenue Reporting**, **High-Performing Dishes**, or **Inventory Stock Levels**.");
        response.put("type", "text");
        return response;
    }

    private Map<String, Object> getSalesResponse(String query, User restaurant) {
        LocalDateTime start;
        String periodText;

        if (query.contains("today")) {
            start = LocalDate.now().atStartOfDay();
            periodText = "today";
        } else if (query.contains("yesterday")) {
            start = LocalDate.now().minusDays(1).atStartOfDay();
            periodText = "yesterday";
        } else {
            start = LocalDate.now().minusDays(7).atStartOfDay();
            periodText = "the last 7 days";
        }

        LocalDateTime end = LocalDateTime.now();
        Double total = orderRepository.sumRevenueByRestaurantAndDateRange(restaurant, start, end);
        Long count = orderRepository.countOrdersByRestaurantAndDateRange(restaurant, start, end);

        Map<String, Object> res = new HashMap<>();
        res.put("answer", String.format("Based on the data for **%s**, your establishment generated a gross revenue of **₹%.2f**, accumulated across a total of **%d** completed orders. This represents a solid operational volume.", periodText, (total != null ? total : 0.0), count));
        res.put("data", Map.of("total", total, "count", count));
        res.put("type", "sales");
        return res;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getPopularityResponse(User restaurant) {
        Map<String, Object> analytics = analyticsService.getSalesAnalytics(List.of(restaurant), "30d", null, null);
        List<Map<String, Object>> topItems = (List<Map<String, Object>>) analytics.get("topItems");
        
        Map<String, Object> res = new HashMap<>();
        if (topItems != null && !topItems.isEmpty()) {
            String topDish = (String) topItems.get(0).get("_id");
            res.put("answer", String.format("According to recent sales metrics, your highest-performing item is **'%s'**. Another notable driver of transaction volume is **%s**. Maximizing the visibility of these items is highly recommended.", 
                topDish, topItems.size() > 1 ? "'" + topItems.get(1).get("_id") + "'" : "other selections"));
        } else {
            res.put("answer", "There is currently insufficient transactional data in the system to accurately identify top-selling items. Continued operational usage will immediately enable this analytical insight.");
        }
        res.put("type", "popularity");
        return res;
    }

    private Map<String, Object> getInventoryResponse(String query, User restaurant) {
        List<InventoryItem> items = inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
        
        // Check for specific item
        for (InventoryItem item : items) {
            if (query.contains(item.getName().toLowerCase())) {
                return Map.of(
                    "answer", String.format("A real-time check indicates the current on-hand inventory for **%s** is strictly tracked at **%.1f %s**.", item.getName(), item.getCurrentStock(), item.getUnit()),
                    "type", "inventory_item"
                );
            }
        }

        long lowStockCount = items.stream().filter(InventoryItem::isLowStock).count();
        Map<String, Object> res = new HashMap<>();
        res.put("answer", String.format("Your comprehensive inventory catalog contains **%d** distinct items. Please be advised that **%d** of these items have triggered a low-stock alert and require immediate attention for procurement.", items.size(), lowStockCount));
        res.put("type", "inventory_summary");
        return res;
    }

    private boolean containsAny(String query, String... keywords) {
        return Arrays.stream(keywords).anyMatch(query::contains);
    }
}
