package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;
import com.probloom.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.lang.NonNull;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;
    private final CurrentUserResolver resolver;


    @GetMapping
    public ResponseEntity<?> getAll(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User restaurant = resolver.resolveSingleRestaurant(xRestaurantId);
        return ok("Transactions fetched", transactionService.getAll(restaurant));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody @NonNull Map<String, Object> body) {
        User restaurant = resolver.getRestaurantOwner();
        return ok("Transaction record created", transactionService.create(restaurant, body));
    }

    @DeleteMapping("/wipe")
    public ResponseEntity<?> wipe() {
        User restaurant = resolver.getRestaurantOwner();
        transactionService.wipe(restaurant);
        return ok("Transaction ledger wiped", null);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") @NonNull Long id) {
        User restaurant = resolver.getRestaurantOwner();
        transactionService.delete(restaurant, id);
        return ok("Transaction deleted", null);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable("id") @NonNull Long id, @RequestBody Map<String, String> body) {
        User restaurant = resolver.getRestaurantOwner();
        String status = body.get("status");
        return ok("Transaction status updated", transactionService.updatePaymentStatus(restaurant, id, java.util.Objects.requireNonNull(status)));
    }

    private ResponseEntity<Map<String, Object>> ok(String message, Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", message);
        if (data != null) body.put("data", data);
        return ResponseEntity.ok(body);
    }
}
