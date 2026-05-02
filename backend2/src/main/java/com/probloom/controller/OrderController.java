package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.Orders;
import com.probloom.model.entity.User;
import com.probloom.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.lang.NonNull;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final CurrentUserResolver resolver;
    private final com.probloom.repository.UserRepository userRepository;

    @PostMapping("/public")
    public ResponseEntity<?> createPublic(@RequestBody @NonNull Map<String, Object> body) {
        try {
            Object ridObj = body.get("restaurantId");
            if (ridObj == null) throw new RuntimeException("Restaurant ID is missing");
            
            Long restaurantId;
            if (ridObj instanceof Number) {
                restaurantId = Objects.requireNonNull(((Number) ridObj).longValue());
            } else {
                restaurantId = Long.valueOf(ridObj.toString());
            }

            java.util.Optional<User> restaurantOpt = userRepository.findById(Objects.requireNonNull(restaurantId));
            if (restaurantOpt.isEmpty()) {
                throw new com.probloom.exception.ResourceNotFoundException("Restaurant not found (ID: " + restaurantId + ")");
            }
            User restaurant = Objects.requireNonNull(restaurantOpt.get());
            
            Orders order = orderService.create(restaurant, null, body);
            return ok("Order received", order);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid Restaurant ID format"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PatchMapping("/public/{id}/bill-request")
    public ResponseEntity<?> requestBillPublic(@PathVariable("id") @NonNull Long id) {
        try {
            return ok("Bill requested", orderService.requestBillPublic(id));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/public/active")
    public ResponseEntity<?> getActivePublic(
            @RequestParam("restaurantId") @NonNull Long restaurantId,
            @RequestParam("tableNumber") @NonNull String tableNumber) {
        try {
            java.util.Optional<User> restaurantOpt = userRepository.findById(restaurantId);
            if (restaurantOpt.isEmpty()) {
                throw new com.probloom.exception.ResourceNotFoundException("Restaurant not found");
            }
            User restaurant = Objects.requireNonNull(restaurantOpt.get());
            
            List<Orders> orders = orderService.getActiveOrdersByTable(restaurant, tableNumber);
            return ok("Active orders fetched", orders);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getActive() {
        User restaurant = resolver.getRestaurantOwner();
        List<Orders> orders = orderService.getActiveOrders(restaurant);
        return ok("Active orders fetched", Map.of("orders", orders, "count", orders.size()));
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAll() {
        User restaurant = resolver.getRestaurantOwner();
        List<Orders> orders = orderService.getAllOrders(restaurant);
        return ok("All orders fetched", Map.of("orders", orders, "count", orders.size()));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(
            @RequestParam(name = "date", required = false) String date,
            @RequestParam(name = "status", required = true, defaultValue = "All") String status,
            @RequestParam(name = "orderType", required = false) String orderType,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {
        try {
            User restaurant = resolver.getRestaurantOwner();
            List<Orders> orders = orderService.getFilteredHistory(restaurant, date, status, orderType, limit);
            List<Orders> resultList = new java.util.ArrayList<>(orders != null ? orders : java.util.Collections.emptyList());
            
            Map<String, Object> data = new java.util.HashMap<>();
            data.put("orders", resultList);
            data.put("count", resultList.size());
            
            return ok("Order history fetched", data);
        } catch (Exception e) {
            e.printStackTrace(); // This prints to server log
            Map<String, Object> errorBody = new java.util.HashMap<>();
            errorBody.put("success", false);
            errorBody.put("message", "Internal Server Error: " + e.getMessage());
            return ResponseEntity.status(500).body(errorBody);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable("id") Long id) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Order fetched", orderService.getById(restaurant, id));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        User creator = resolver.getCurrentUser();
        Orders order = orderService.create(restaurant, creator, body);
        return ok("Order created", order);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        Orders order = orderService.update(restaurant, id, body);
        return ok("Order updated", order);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Order status updated", orderService.updateStatus(restaurant, id, (String) body.get("status")));
    }

    @PatchMapping("/{id}/notes")
    public ResponseEntity<?> appendNotes(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Order notes appended", orderService.appendNotes(restaurant, id, (String) body.get("notes")));
    }

    @PatchMapping("/{orderId}/items/{itemId}/status")
    public ResponseEntity<?> updateItemStatus(@PathVariable("orderId") Long orderId, @PathVariable("itemId") Long itemId, @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Item status updated", orderService.updateItemStatus(restaurant, orderId, itemId, (String) body.get("status")));
    }

    @PatchMapping("/{orderId}/items/{itemId}/ready-partial")
    public ResponseEntity<?> markItemReadyPartial(@PathVariable("orderId") Long orderId, @PathVariable("itemId") Long itemId) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Item partially marked ready", orderService.markItemReadyPartial(restaurant, orderId, itemId));
    }

    @SuppressWarnings("unchecked")
    @PatchMapping("/{orderId}/items/status")
    public ResponseEntity<?> updateMultipleItemsStatus(@PathVariable("orderId") Long orderId, @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        List<Object> rawIds = (List<Object>) body.get("itemIds");
        List<Long> itemIds = rawIds.stream().map(id -> {
            if (id instanceof Number) return ((Number) id).longValue();
            return Long.parseLong(id.toString());
        }).collect(java.util.stream.Collectors.toList());
        
        return ok("Items status updated", orderService.updateMultipleItemsStatus(restaurant, orderId, itemIds, (String) body.get("status")));
    }

    @PatchMapping("/{id}/payment")
    public ResponseEntity<?> updatePayment(@PathVariable("id") @NonNull Long id, @RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Payment updated", orderService.updatePayment(restaurant, id, (String) body.get("paymentMethod"), (String) body.get("paymentStatus")));
    }

    @PostMapping("/{id}/bill-request")
    public ResponseEntity<?> requestBill(@PathVariable("id") Long id) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Bill requested", orderService.requestBill(restaurant, id));
    }

    @PatchMapping("/{id}/print")
    public ResponseEntity<?> markAsPrinted(@PathVariable("id") Long id) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Order marked as printed", orderService.markAsPrinted(restaurant, id));
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/{id}/split")
    public ResponseEntity<?> split(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        List<Object> rawIds = (List<Object>) body.get("itemIds");
        List<Long> itemIds = rawIds.stream().map(itemId -> {
            if (itemId instanceof Number) return ((Number) itemId).longValue();
            return Long.parseLong(itemId.toString());
        }).collect(java.util.stream.Collectors.toList());
        
        String newTableNumber = (String) body.get("newTableNumber");
        return ok("Order split successfully", orderService.split(restaurant, id, itemIds, newTableNumber));
    }

    @PostMapping("/combine-tables")
    public ResponseEntity<?> combineTables(@RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        String sourceTable = (String) body.get("sourceTable");
        String targetTable = (String) body.get("targetTable");
        Object targetIdObj = body.get("targetOrderId");
        
        Long targetOrderId = null;
        if (targetIdObj != null) {
            if (targetIdObj instanceof Number) {
                targetOrderId = ((Number) targetIdObj).longValue();
            } else {
                targetOrderId = Long.valueOf(targetIdObj.toString());
            }
        }
        
        Integer covers = (body.get("covers") != null) ? Integer.valueOf(body.get("covers").toString()) : null;
        
        return ok("Tables combined successfully", orderService.combineTables(restaurant, sourceTable, targetOrderId, targetTable, covers));
    }

    @PostMapping("/{id}/combine")
    public ResponseEntity<?> combine(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        Object targetIdObj = body.get("targetOrderId");
        String targetTable = (String) body.get("targetTable");
        
        Long targetOrderId = null;
        if (targetIdObj != null) {
            if (targetIdObj instanceof Number) {
                targetOrderId = ((Number) targetIdObj).longValue();
            } else {
                targetOrderId = Long.valueOf(targetIdObj.toString());
            }
        }
        Integer covers = (body.get("covers") != null) ? Integer.valueOf(body.get("covers").toString()) : null;
        
        return ok("Orders combined successfully", orderService.combine(restaurant, id, targetOrderId, targetTable, covers));
    }

    @PostMapping("/{id}/uncombine-table")
    public ResponseEntity<?> uncombineTable(@PathVariable("id") @NonNull Long id, @RequestBody Map<String, String> body) {
        String tableNumber = body.get("tableNumber");
        return ok("Table uncombined successfully", orderService.uncombineTable(id, tableNumber));
    }

    @PostMapping("/sync")
    public ResponseEntity<?> syncOfflineOrder(@RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        User creator = resolver.getCurrentUser();
        Orders order = orderService.create(restaurant, creator, body);
        return ok("Order synced", Map.of("order", order, "synced", true));
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
