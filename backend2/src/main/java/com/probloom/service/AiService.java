package com.probloom.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.probloom.model.entity.MenuItem;
import com.probloom.model.entity.User;
import com.probloom.repository.MenuItemRepository;
import com.probloom.repository.OrdersRepository;
import com.probloom.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.lang.NonNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import java.util.*;
import java.util.stream.Collectors;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AiService {

    @Value("${app.gemini.api-key}")
    private String geminiApiKey;

    @Value("${app.gemini.model}")
    private String geminiModel;

    @Value("${app.gemini.api-url}")
    private String geminiApiUrl;

    private final MenuItemRepository menuItemRepository;
    private final OrdersRepository ordersRepository;
    private final UserRepository userRepository;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    /**
     * Calls Gemini API for image parsing or voice decoding (if needed by other modules).
     * The Chatbot now uses a Local Knowledge Engine completely bypassing external APIs.
     */
    private String callGemini(List<Map<String, Object>> parts) {
        if (geminiApiUrl == null) throw new RuntimeException("Gemini API URL is not configured");
        WebClient client = webClientBuilder.baseUrl(geminiApiUrl).build();

        Map<String, Object> content = Map.of("parts", parts);
        Map<String, Object> body = Map.of("contents", List.of(content));

        Map<?, ?> response = client.post()
                .uri("/{model}:generateContent?key={key}", geminiModel, geminiApiKey)
                .contentType(Objects.requireNonNull(MediaType.APPLICATION_JSON))
                .bodyValue(Objects.requireNonNull(body))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null) throw new RuntimeException("Empty response from Gemini");

        List<?> candidates = (List<?>) response.get("candidates");
        if (candidates == null || candidates.isEmpty()) throw new RuntimeException("No AI response generated");

        Map<?, ?> candidate = (Map<?, ?>) candidates.get(0);
        Map<?, ?> responseContent = (Map<?, ?>) candidate.get("content");
        List<?> responseParts = (List<?>) responseContent.get("parts");
        return ((Map<?, ?>) responseParts.get(0)).get("text").toString().trim();
    }

    private String extractJson(String text, boolean isArray) {
        if (isArray) {
            int start = text.indexOf('[');
            int end = text.lastIndexOf(']');
            if (start != -1 && end != -1 && start < end) {
                return text.substring(start, end + 1);
            }
        } else {
            int start = text.indexOf('{');
            int end = text.lastIndexOf('}');
            if (start != -1 && end != -1 && start < end) {
                return text.substring(start, end + 1);
            }
        }
        return text.replaceAll("```json\\n?", "").replaceAll("```\\n?", "").trim();
    }

    public List<Map<String, Object>> digitizeMenuFromImage(byte[] imageBytes, String mimeType) {
        String prompt = "You are a professional restaurant menu data extractor. Analyze the image and extract items into JSON.";
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        parts.add(Map.of("inline_data", Map.of("mime_type", mimeType, "data", base64Image)));

        String text = callGemini(parts);
        String json = extractJson(text, true);
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to decode the menu.");
        }
    }

    public List<Map<String, Object>> analyzeInvoiceImage(byte[] imageBytes, String mimeType) {
        String prompt =
            "You are an expert FMCG wholesale invoice data extraction engine. " +
            "Carefully analyze the provided invoice image and extract every line item from the product table.\n\n" +

            "The invoice table columns are (in order from left to right):\n" +
            "  S.No | Material Description | HSN Code | Cas/EA (Cases = Box number) | Pcs (Pieces = Quantity) | MRP (Maximum Retail Price = Selling Rate) | Rate (Buying/Purchase Rate) | Free Qty (Free pieces given) | Dis. Amt (Discount Amount) | SGST (State GST amount) | CGST (Central GST amount) | Total Amt (Line total amount)\n\n" +

            "Rules:\n" +
            "- 'Cas' or 'Cases' or 'EA' = number of boxes/cases (field: cases)\n" +
            "- 'Pcs' = number of individual pieces = quantity (field: qty)\n" +
            "- 'MRP' = selling rate / maximum retail price (field: mrp)\n" +
            "- 'Rate' = buying price / purchase cost per unit (field: costPerUnit)\n" +
            "- 'Free Qty' or 'Free' = free pieces given at no cost (field: free)\n" +
            "- 'Dis. Amt' or 'Discount' = monetary discount amount (field: discount)\n" +
            "- 'SGST' = State GST tax amount in rupees (field: sgst)\n" +
            "- 'CGST' = Central GST tax amount in rupees (field: cgst)\n" +
            "- 'Total Amt' = final line total amount in rupees (field: totalAmount)\n" +
            "- If any field is missing or zero, use 0 (number), not null.\n" +
            "- Extract the supplier name, invoice number, invoice date, and grand total from the invoice header/footer.\n\n" +

            "Return ONLY a valid JSON object in this exact structure — no markdown, no extra text:\n" +
            "{\n" +
            "  \"supplier\": \"supplier name here\",\n" +
            "  \"invoiceNo\": \"invoice number here\",\n" +
            "  \"invoiceDate\": \"date here\",\n" +
            "  \"invoiceTotalAmount\": 0.00,\n" +
            "  \"items\": [\n" +
            "    {\n" +
            "      \"sNo\": 1,\n" +
            "      \"name\": \"Material Description\",\n" +
            "      \"hsnCode\": \"21050000\",\n" +
            "      \"cases\": 6,\n" +
            "      \"qty\": 144,\n" +
            "      \"mrp\": 10.00,\n" +
            "      \"costPerUnit\": 8.38,\n" +
            "      \"free\": 0,\n" +
            "      \"discount\": 0.00,\n" +
            "      \"sgst\": 30.17,\n" +
            "      \"cgst\": 30.17,\n" +
            "      \"totalAmount\": 1267.20\n" +
            "    }\n" +
            "  ]\n" +
            "}";

        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", prompt));
        parts.add(Map.of("inline_data", Map.of("mime_type", mimeType, "data", base64Image)));

        String text = callGemini(parts);
        String json = extractJson(text, false); // object-level extraction
        try {
            Map<String, Object> result = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            // Return items list; wrap the full envelope as the first element for compatibility
            // The controller returns List<Map> so we wrap the full response as a single-element list
            // and let the frontend detect the 'items' key
            List<Map<String, Object>> envelope = new ArrayList<>();
            envelope.add(result);
            return envelope;
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse invoice data from image. Raw: " + text.substring(0, Math.min(200, text.length())));
        }
    }

    public Map<String, Object> parseVoiceOrder(String transcribedText, List<Map<String, Object>> availableItems) {
        String prompt = "Parse this order into JSON: " + transcribedText;
        String text = callGemini(List.of(Map.of("text", prompt)));
        String json = extractJson(text, false);
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse voice order");
        }
    }

    public List<Map<String, Object>> getUpsellSuggestions(List<Map<String, Object>> cartItems, List<Map<String, Object>> allMenuItems, List<Map<String, Object>> topPairs) {
        String prompt = "Suggest 3 upsell items in JSON.";
        String text = callGemini(List.of(Map.of("text", prompt)));
        String json = extractJson(text, true);
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse upsell suggestions");
        }
    }

    public List<Map<String, Object>> forecastInventoryNeeds(List<Map<String, Object>> lowStockItems, List<Map<String, Object>> salesSummary) {
        String prompt = "Forecast inventory needs in JSON.";
        String text = callGemini(List.of(Map.of("text", prompt)));
        String json = extractJson(text, true);
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse inventory forecast");
        }
    }

    /**
     * Advanced Local AI Reasoning Engine (No External APIs)
     */
    public String chatWithAi(String prompt, @NonNull Map<String, Object> context) {
        if (prompt == null || prompt.trim().isEmpty()) return "How can I help you today?";
        String input = prompt.toLowerCase().trim();
        
        Object resObj = context.get("restaurant");
        if (!(resObj instanceof User)) {
            return "Context missing: Restaurant information is required for analysis.";
        }
        User restaurant = (User) resObj;

        // 1. GREETINGS & SMALL TALK
        if (input.matches(".*\\b(hi|hello|hey|greetings|good morning|good afternoon|good evening)\\b.*")) {
            return "Greetings! I am the **ProBloom Assistant**, your local advanced restaurant AI. \n\nI process all your queries directly on your server, ensuring ultra-fast and 100% private responses without any external APIs. \n\nI can deeply analyze:\n- Sales & Revenue metrics (Today, Yesterday, Last Week)\n- Menu structuring & Top categories\n- Employee workforce tracking\n\nWhat data can I fetch for you right now?";
        }

        // 2. EMPLOYEES / WORKFORCE (Parsing specific roles)
        if (input.contains("employee") || input.contains("staff") || input.contains("worker") || input.contains("team") || input.contains("waiter") || input.contains("manager")) {
            List<User> employees = userRepository.findByParentOwnerAndIsActiveTrue(restaurant);
            if (employees.isEmpty()) {
                return "You currently have no active team members registered in the system. You can add staff members from the **Employees** dashboard.";
            }

            Map<User.Role, Long> roleCounts = employees.stream().collect(Collectors.groupingBy(User::getRole, Collectors.counting()));
            
            // Check if asking for specific role (e.g., "how many waiters do i have?")
            for (User.Role r : User.Role.values()) {
                if (input.contains(r.name().toLowerCase())) {
                    long count = roleCounts.getOrDefault(r, 0L);
                    return "You currently have **" + count + " active " + r.name() + "(s)** registered in your system.";
                }
            }

            StringBuilder sb = new StringBuilder();
            sb.append("### 👥 Real-time Workforce Analysis\n\n");
            sb.append("Here is your restaurant's active staff distribution:\n\n");
            sb.append("| Role Profile | Active Count |\n");
            sb.append("| :--- | :--- |\n");
            roleCounts.forEach((role, count) -> sb.append("| ").append(role.name()).append(" | **").append(count).append("** |\n"));
            sb.append("\n**Total Active Workforce:** ").append(employees.size()).append(" members.");
            return sb.toString();
        }

        // 3. MENU / CATEGORIES / PRICING
        if (input.contains("menu") || input.contains("category") || input.contains("item") || input.contains("dish") || input.contains("price") || input.contains("food")) {
            List<MenuItem> items = menuItemRepository.findByRestaurantOrderBySortOrderAsc(restaurant);
            if (items.isEmpty()) return "Your digital menu catalog is currently empty. Please configure it in the Menu Management module.";

            Map<String, Long> categoryCounts = items.stream().collect(Collectors.groupingBy(MenuItem::getCategory, Collectors.counting()));
            OptionalDouble avgPrice = items.stream().mapToDouble(MenuItem::getPrice).average();

            StringBuilder sb = new StringBuilder();
            sb.append("### 📑 Live Menu Intelligence\n\n");
            sb.append("I have scanned your menu database. Here are the key metrics:\n\n");
            sb.append("- **Total Active Items:** ").append(items.size()).append("\n");
            sb.append("- **Total Categories:** ").append(categoryCounts.size()).append("\n");
            if (avgPrice.isPresent()) {
                sb.append("- **Average Item Price:** ₹").append(String.format("%.2f", avgPrice.getAsDouble())).append("\n\n");
            }
            sb.append("#### Category Distribution\n");
            sb.append("| Menu Category | Item Count |\n| :--- | :--- |\n");
            categoryCounts.forEach((cat, count) -> sb.append("| ").append(cat).append(" | **").append(count).append("** |\n"));
            return sb.toString();
        }

        // 4. SALES / REVENUE (Advanced Date Processing)
        if (input.contains("sales") || input.contains("revenue") || input.contains("report") || input.contains("earn") || input.contains("make") || input.contains("sold")) {
            LocalDateTime start;
            LocalDateTime end = LocalDateTime.now();
            String periodLabel;

            if (input.contains("yesterday")) {
                start = LocalDateTime.of(LocalDate.now().minusDays(1), LocalTime.MIN);
                end = LocalDateTime.of(LocalDate.now().minusDays(1), LocalTime.MAX);
                periodLabel = "Yesterday";
            } else if (input.contains("week")) {
                start = LocalDateTime.of(LocalDate.now().minusWeeks(1), LocalTime.MIN);
                periodLabel = "The Last 7 Days";
            } else if (input.contains("month")) {
                start = LocalDateTime.of(LocalDate.now().withDayOfMonth(1), LocalTime.MIN);
                periodLabel = "This Month";
            } else if (input.contains("year")) {
                start = LocalDateTime.of(LocalDate.now().withDayOfYear(1), LocalTime.MIN);
                periodLabel = "This Year";
            } else {
                start = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
                periodLabel = "Today";
            }
            
            Double revenue = ordersRepository.sumRevenueByRestaurantAndDateRange(restaurant, start, end);
            Long orderCount = ordersRepository.countOrdersByRestaurantAndDateRange(restaurant, start, end);
            
            if (orderCount == null || orderCount == 0) {
                return String.format("A scan of the local transaction ledger reveals **no completed orders** for %s.", periodLabel);
            }

            StringBuilder sb = new StringBuilder();
            sb.append(String.format("### 📊 Financial Query: %s\n\n", periodLabel));
            sb.append("Here is the requested locally-generated data:\n\n");
            sb.append("| Financial Metric | Calculated Value |\n| :--- | :--- |\n");
            sb.append("| **Gross Revenue** | ₹").append(String.format("%.2f", revenue != null ? revenue : 0.0)).append(" |\n");
            sb.append("| **Total Orders** | ").append(orderCount).append(" |\n");
            sb.append("| **Average Order Value** | ₹").append(String.format("%.2f", (revenue != null && orderCount > 0) ? (revenue / orderCount) : 0.0)).append(" |\n");
            return sb.toString();
        }

        // 5. HELP COMMAND
        if (input.contains("help") || input.contains("what can you do") || input.contains("features") || input.contains("how to")) {
            return "**System Capabilities (Local AI Engine)**\n\n" +
                   "I am running a custom deterministic AI locally on your server. I do not use external APIs.\n\n" +
                   "**Try typing these phrases naturally:**\n" +
                   "- *\"How much revenue did we make this month?\"*\n" +
                   "- *\"What is the total number of waiters we have?\"*\n" +
                   "- *\"Analyze my menu and give me the average price.\"*\n" +
                   "- *\"Show me yesterday's sales summary.\"*";
        }

        // 6. DEFAULT HEURISTIC FALLBACK
        return "I am an ultra-fast local AI engine, processing commands securely on your server! Currently, I am programmed to process extensive queries related to:\n\n- **Sales & Revenue** (Today, Yesterday, Week, Month, Year)\n- **Menu & Food Items** (Counts, Categories, Averages)\n- **Employees & Roles** (Staffing distribution)\n\nCould you try rephrasing your request to target one of these data points? For example: *\"How much sales today?\"*";
    }
}
