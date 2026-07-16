package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;
import com.probloom.model.entity.InventoryItem;
import com.probloom.service.InventoryService;
import com.probloom.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final AiService aiService;
    private final CurrentUserResolver resolver;

    @PostMapping("/ocr-scan")
    public ResponseEntity<?> ocrScan(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) throws Exception {
        String contentType = file.getContentType();
        List<Map<String, Object>> data;

        String originalName = file.getOriginalFilename();
        if (contentType != null && (contentType.equals("text/csv") || (originalName != null && originalName.endsWith(".csv")))) {
            data = inventoryService.parseInvoiceCsv(file.getBytes());
        } else {
            data = aiService.analyzeInvoiceImage(file.getBytes(), contentType != null ? contentType : "image/jpeg");
        }

        return ok("Invoice parsed successfully", data);
    }

    @PostMapping("/import-csv")
    public ResponseEntity<?> importCsv(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) throws Exception {
        User restaurant = resolver.getRestaurantOwner();
        int count = inventoryService.importCsv(restaurant, file);
        return ok("Inventory imported successfully", Map.of("imported", count));
    }

    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        List<InventoryItem> items = inventoryService.getAll(restaurant);
        return ok("Inventory fetched", Map.of("items", items, "count", items.size()));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<?> getLowStock(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        List<InventoryItem> items = inventoryService.getLowStock(restaurant);
        return ok("Low stock items", Map.of("items", items, "count", items.size()));
    }

    @GetMapping("/movements")
    public ResponseEntity<?> getMovements(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        return ok("Inventory movements fetched", inventoryService.getMovements(restaurant));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable("id") @NonNull Long id) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Inventory item fetched", inventoryService.getById(restaurant, id));
    }

    @GetMapping("/barcode/{barcode}")
    public ResponseEntity<?> getByBarcode(@PathVariable("barcode") @NonNull String barcode) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Inventory item fetched by barcode", inventoryService.getByBarcode(restaurant, barcode));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Inventory item created", inventoryService.create(restaurant, body));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Inventory item updated", inventoryService.update(restaurant, id, body));
    }

    @PostMapping("/{id}/adjust")
    public ResponseEntity<?> adjustStock(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        User performer = resolver.getCurrentUser();
        return ok("Stock adjusted", inventoryService.adjustStock(restaurant, id, body, performer));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") @NonNull Long id) {
        User restaurant = resolver.getRestaurantOwner();
        inventoryService.delete(restaurant, id);
        return ok("Inventory item deleted", null);
    }

    @PostMapping("/bulk-update")
    public ResponseEntity<?> bulkUpdate(@RequestBody List<Map<String, Object>> body) {
        User restaurant = resolver.getRestaurantOwner();
        User performer = resolver.getCurrentUser();
        return ok("Bulk update successful", inventoryService.bulkUpdate(restaurant, body, performer));
    }

    @PostMapping("/scan-intake")
    public ResponseEntity<?> scanIntake(@RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        User performer = resolver.getCurrentUser();
        String barcode = Objects.requireNonNull((String) body.get("barcode"));

        Double amount = dataToDouble(body.getOrDefault("amount", 1.0));
        return ok("Scanner intake successful", inventoryService.incrementStockByBarcode(restaurant, barcode, amount, performer));
    }

    @PutMapping("/categories/rename")
    public ResponseEntity<?> renameCategory(@RequestBody @NonNull Map<String, String> body) {
        User restaurant = resolver.getRestaurantOwner();
        String oldName = body.get("oldName");
        String newName = body.get("newName");
        inventoryService.renameCategory(restaurant, oldName, newName);
        return ok("Category renamed successfully", null);
    }

    @DeleteMapping("/categories")
    public ResponseEntity<?> deleteCategory(@RequestParam("name") @NonNull String name) {
        User restaurant = resolver.getRestaurantOwner();
        inventoryService.deleteCategory(restaurant, name);
        return ok("Category deleted successfully", null);
    }

    @DeleteMapping("/movements")
    public ResponseEntity<?> clearMovements() {
        User restaurant = resolver.getRestaurantOwner();
        inventoryService.clearMovements(restaurant);
        return ok("Activity log cleared successfully!", null);
    }

    @PostMapping("/bulk-add")
    public ResponseEntity<?> bulkAdd(@RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        inventoryService.bulkAdd(restaurant, body);
        return ok("Wholesale invoice imported successfully!", null);
    }


    private Double dataToDouble(Object obj) {
        if (obj == null) return 0.0;
        return Double.valueOf(obj.toString());
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
