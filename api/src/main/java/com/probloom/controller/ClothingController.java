package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.ClothingVariant;
import com.probloom.model.entity.User;
import com.probloom.service.ClothingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clothing")
@RequiredArgsConstructor
public class ClothingController {

    private final ClothingService clothingService;
    private final CurrentUserResolver resolver;

    // ── Products ──────────────────────────────────────────────────────────────

    @GetMapping("/products")
    public ResponseEntity<?> getProducts() {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Products fetched", clothingService.getProducts(restaurant));
    }

    @PostMapping("/products")
    public ResponseEntity<?> createProduct(@RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Product created", clothingService.createProduct(restaurant, body));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable Long id,
                                           @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Product updated", clothingService.updateProduct(id, restaurant, body));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable Long id) {
        User restaurant = resolver.getRestaurantOwner();
        clothingService.deleteProduct(id, restaurant);
        return ok("Product deactivated successfully", null);
    }

    // ── Variants ──────────────────────────────────────────────────────────────

    @GetMapping("/products/{productId}/variants")
    public ResponseEntity<?> getVariants(@PathVariable Long productId) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Variants fetched", clothingService.getVariantsForProduct(productId, restaurant));
    }

    @GetMapping("/variants")
    public ResponseEntity<?> getAllVariants(@RequestParam(required = false) String q) {
        User restaurant = resolver.getRestaurantOwner();
        List<ClothingVariant> variants;
        if (q != null && !q.isBlank()) {
            variants = clothingService.searchVariants(restaurant, q);
        } else {
            variants = clothingService.getAllVariants(restaurant);
        }
        return ok("Variants fetched", variants);
    }

    @GetMapping("/variants/low-stock")
    public ResponseEntity<?> getLowStock() {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Low stock variants", clothingService.getLowStockVariants(restaurant));
    }

    @PostMapping("/products/{productId}/variants")
    public ResponseEntity<?> createVariant(@PathVariable Long productId,
                                           @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Variant created", clothingService.createVariant(productId, restaurant, body));
    }

    @PutMapping("/variants/{id}")
    public ResponseEntity<?> updateVariant(@PathVariable Long id,
                                           @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Variant updated", clothingService.updateVariant(id, restaurant, body));
    }

    @PostMapping("/variants/{id}/restock")
    public ResponseEntity<?> restock(@PathVariable Long id,
                                     @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Stock restocked", clothingService.restock(id, restaurant, body));
    }

    @PostMapping("/variants/{id}/transfer")
    public ResponseEntity<?> transfer(@PathVariable Long id,
                                      @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Stock transferred to main", clothingService.transfer(id, restaurant, body));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Clothing stats fetched", clothingService.getStats(restaurant));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
