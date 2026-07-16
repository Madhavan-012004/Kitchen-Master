package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.MenuItem;
import com.probloom.model.entity.User;
import com.probloom.repository.MenuItemRepository;
import com.probloom.service.AiService;
import com.probloom.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final CurrentUserResolver resolver;
    private final MenuItemRepository menuItemRepository;
    private final InventoryService inventoryService;

    @Value("${app.upload.path}")
    private String uploadPath;

    @PostMapping("/menu-digitizer")
    public ResponseEntity<?> digitizeMenu(@RequestParam(name = "menuImage") MultipartFile file) throws IOException {
        String mimeType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
        List<Map<String, Object>> items = aiService.digitizeMenuFromImage(file.getBytes(), mimeType);
        return ok(String.format("Extracted %d menu items. Review and confirm to import.", items.size()),
                Map.of("items", items, "count", items.size()));
    }

    @PostMapping("/voice-kot")
    public ResponseEntity<?> parseVoiceOrder(@RequestBody Map<String, Object> body) {
        String text = (String) body.get("text");
        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Transcribed text is required"));
        }
        User restaurant = resolver.getRestaurantOwner();
        List<MenuItem> menuItems = menuItemRepository.findByRestaurantAndIsAvailableTrueOrderBySortOrderAsc(restaurant);
        List<Map<String, Object>> itemDtos = menuItems.stream().map(m -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", m.getId());
            dto.put("name", m.getName());
            dto.put("price", m.getPrice());
            return dto;
        }).collect(Collectors.toList());
        Map<String, Object> order = aiService.parseVoiceOrder(text, itemDtos);
        return ok("Voice order parsed successfully", Map.of("order", order));
    }

    @PostMapping("/upsell")
    public ResponseEntity<?> getUpsellSuggestions(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cartItems = (List<Map<String, Object>>) body.get("cartItems");
        if (cartItems == null || cartItems.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Cart items are required"));
        }
        User restaurant = resolver.getRestaurantOwner();
        List<MenuItem> allMenuItems = menuItemRepository.findByRestaurantAndIsAvailableTrueOrderBySortOrderAsc(restaurant);
        List<Map<String, Object>> menuDtos = allMenuItems.stream().map(m -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("name", m.getName());
            dto.put("category", m.getCategory());
            return dto;
        }).collect(Collectors.toList());
        List<Map<String, Object>> suggestions = aiService.getUpsellSuggestions(cartItems, menuDtos, List.of());
        return ok("Upsell suggestions ready", Map.of("suggestions", suggestions));
    }

    @GetMapping("/inventory-forecast")
    public ResponseEntity<?> inventoryForecast() {
        User restaurant = resolver.getRestaurantOwner();
        List<Map<String, Object>> lowStock = inventoryService.getLowStock(restaurant).stream().map(item -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("name", item.getName());
            dto.put("currentStock", item.getCurrentStock());
            dto.put("unit", item.getUnit());
            dto.put("lowStockThreshold", item.getLowStockThreshold());
            return dto;
        }).collect(Collectors.toList());

        List<Map<String, Object>> forecast = aiService.forecastInventoryNeeds(lowStock, List.of());
        return ok("Inventory forecast ready", Map.of("forecast", forecast, "lowStockCount", lowStock.size()));
    }

    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> body) {
        String message = (String) body.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Message is required"));
        }
        User restaurant = resolver.getRestaurantOwner();
        Map<String, Object> context = new HashMap<>();
        context.put("restaurant", restaurant);
        
        String response = aiService.chatWithAi(message, context);
        return ok("Assistant response ready", Map.of("response", response));
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("success", true);
        b.put("message", message);
        if (data != null) b.put("data", data);
        return ResponseEntity.ok(b);
    }
}
