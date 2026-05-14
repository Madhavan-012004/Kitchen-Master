package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.ProductionBatch;
import com.probloom.model.entity.User;
import com.probloom.service.ProductionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/production")
@RequiredArgsConstructor
public class ProductionController {

    private final ProductionService productionService;
    private final CurrentUserResolver resolver;

    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Production history fetched", productionService.getProductionHistory(restaurant));
    }

    @PostMapping("/check")
    public ResponseEntity<?> checkFeasibility(@RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        Long menuItemId = Long.valueOf(body.get("menuItemId").toString());
        Double quantity = Double.valueOf(body.get("quantity").toString());
        
        return ok("Feasibility check completed", productionService.checkProductionFeasibility(restaurant, menuItemId, quantity));
    }

    @PostMapping("/start")
    public ResponseEntity<?> startProduction(@RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        User performer = resolver.getCurrentUser();
        Long menuItemId = Long.valueOf(body.get("menuItemId").toString());
        Double quantity = Double.valueOf(body.get("quantity").toString());

        ProductionBatch batch = productionService.startProduction(restaurant, performer, menuItemId, quantity);
        return ok("Production batch completed successfully", batch);
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
