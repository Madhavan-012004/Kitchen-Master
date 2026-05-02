package com.probloom.controller;

import com.probloom.model.entity.User;
import com.probloom.service.AIChatService;
import com.probloom.config.CurrentUserResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics/chat")
@RequiredArgsConstructor
public class AIChatController {

    private final AIChatService aiChatService;
    private final CurrentUserResolver resolver;

    @PostMapping
    public ResponseEntity<?> handleChat(@RequestBody Map<String, String> request) {
        User restaurant = resolver.getRestaurantOwner();
        String query = request.get("query");
        
        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query cannot be empty"));
        }

        Map<String, Object> result = aiChatService.processQuery(query, restaurant);
        
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("data", result);
        
        return ResponseEntity.ok(response);
    }
}
