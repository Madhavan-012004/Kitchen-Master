package com.probloom.service;

import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Service
public class LocalNLPEngine {

    public enum Intent {
        EMPLOYEE_PERFORMANCE,
        PRODUCT_SALES_SUMMARY,
        GENERAL_SALES,
        INVENTORY_CHECK,
        EMPLOYEE_COUNT,
        MENU_SUMMARY,
        UNKNOWN
    }

    public static class ParsedQuery {
        public Intent intent = Intent.UNKNOWN;
        public LocalDateTime startDate;
        public LocalDateTime endDate;
        public String periodLabel = "All Time";
        public String targetEmployee = null;
        public String targetProduct = null;
    }

    public ParsedQuery parse(String input) {
        ParsedQuery result = new ParsedQuery();
        if (input == null || input.trim().isEmpty()) {
            return result;
        }

        String normalized = normalize(input);

        // 1. Extract Dates
        extractDates(normalized, result);

        // 2. Map Intents based on Keyword scoring
        result.intent = detectIntent(normalized);

        return result;
    }

    private String normalize(String input) {
        String s = input.toLowerCase().trim();
        // Remove punctuation
        s = s.replaceAll("[^a-z0-9\\s]", "");
        // Map common synonyms
        s = s.replace("staff", "employee").replace("worker", "employee").replace("waiter", "employee");
        s = s.replace("best", "high").replace("top", "high").replace("greatest", "high").replace("highest", "high");
        s = s.replace("revenue", "sales").replace("earn", "sales").replace("make", "sales").replace("sold", "sales").replace("sell", "sales");
        s = s.replace("item", "product").replace("dish", "product").replace("food", "product");
        return s;
    }

    private void extractDates(String text, ParsedQuery result) {
        LocalDate today = LocalDate.now();
        if (text.contains("yesterday")) {
            result.startDate = LocalDateTime.of(today.minusDays(1), LocalTime.MIN);
            result.endDate = LocalDateTime.of(today.minusDays(1), LocalTime.MAX);
            result.periodLabel = "Yesterday";
        } else if (text.contains("week") || text.contains("last 7 days")) {
            result.startDate = LocalDateTime.of(today.minusWeeks(1), LocalTime.MIN);
            result.endDate = LocalDateTime.of(today, LocalTime.MAX);
            result.periodLabel = "The Last 7 Days";
        } else if (text.contains("month")) {
            result.startDate = LocalDateTime.of(today.withDayOfMonth(1), LocalTime.MIN);
            result.endDate = LocalDateTime.of(today, LocalTime.MAX);
            result.periodLabel = "This Month";
        } else if (text.contains("year")) {
            result.startDate = LocalDateTime.of(today.withDayOfYear(1), LocalTime.MIN);
            result.endDate = LocalDateTime.of(today, LocalTime.MAX);
            result.periodLabel = "This Year";
        } else if (text.contains("today")) {
            result.startDate = LocalDateTime.of(today, LocalTime.MIN);
            result.endDate = LocalDateTime.of(today, LocalTime.MAX);
            result.periodLabel = "Today";
        } else {
            // Default to past 30 days for open-ended queries to avoid massive queries
            result.startDate = LocalDateTime.of(today.minusDays(30), LocalTime.MIN);
            result.endDate = LocalDateTime.of(today, LocalTime.MAX);
            result.periodLabel = "The Last 30 Days";
        }
    }

    private Intent detectIntent(String text) {
        int employeePerfScore = score(text, "employee", "high", "performance", "sales");
        int productSalesScore = score(text, "product", "sales", "what", "which");
        int generalSalesScore = score(text, "sales", "total", "how much", "report");
        int inventoryScore = score(text, "stock", "inventory", "available", "left");
        int employeeCountScore = score(text, "employee", "how many", "count", "active");
        int menuSummaryScore = score(text, "menu", "category", "price", "average");

        int max = Math.max(employeePerfScore, Math.max(productSalesScore, Math.max(generalSalesScore, 
                  Math.max(inventoryScore, Math.max(employeeCountScore, menuSummaryScore)))));

        if (max < 2) return Intent.UNKNOWN; // Threshold

        if (max == employeePerfScore) return Intent.EMPLOYEE_PERFORMANCE;
        if (max == productSalesScore) return Intent.PRODUCT_SALES_SUMMARY;
        if (max == generalSalesScore) return Intent.GENERAL_SALES;
        if (max == inventoryScore) return Intent.INVENTORY_CHECK;
        if (max == employeeCountScore) return Intent.EMPLOYEE_COUNT;
        if (max == menuSummaryScore) return Intent.MENU_SUMMARY;

        return Intent.UNKNOWN;
    }

    private int score(String text, String... keywords) {
        int score = 0;
        for (String kw : keywords) {
            if (text.contains(kw)) score++;
        }
        return score;
    }
}
