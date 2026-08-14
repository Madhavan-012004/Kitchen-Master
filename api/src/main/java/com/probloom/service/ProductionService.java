package com.probloom.service;

import com.probloom.model.entity.*;
import com.probloom.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ProductionService {

    private final ProductionBatchRepository productionBatchRepository;
    private final MenuItemRepository menuItemRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final StockMovementRepository stockMovementRepository;

    public Map<String, Object> checkProductionFeasibility(User restaurant, Long menuItemId, Double quantity) {
        Long safeItemId = Objects.requireNonNull(menuItemId, "Menu Item ID must not be null");

        MenuItem menuItem = menuItemRepository.findById(safeItemId)
                .orElseThrow(() -> new RuntimeException("Menu Item not found"));

        if (!menuItem.getRestaurant().getId().equals(restaurant.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        List<Map<String, Object>> ingredientStatuses = new ArrayList<>();
        boolean canProduce = true;
        double totalMaterialCost = 0.0;

        for (ItemIngredient ingredient : menuItem.getIngredients()) {
            InventoryItem invItem = ingredient.getInventoryItem();
            double requiredQty = ingredient.getQuantityUsed() * quantity;
            double currentStock = invItem.getCurrentStock();
            double cost = invItem.getCostPerUnit() != null ? invItem.getCostPerUnit() * requiredQty : 0.0;

            Map<String, Object> status = new HashMap<>();
            status.put("ingredientName", invItem.getName());
            status.put("requiredQty", requiredQty);
            status.put("currentStock", currentStock);
            status.put("unit", invItem.getUnit().name());
            status.put("cost", cost);

            if (currentStock >= requiredQty) {
                status.put("status", "OK");
            } else {
                status.put("status", "SHORT");
                canProduce = false;
            }

            totalMaterialCost += cost;
            ingredientStatuses.add(status);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("canProduce", canProduce);
        result.put("ingredients", ingredientStatuses);
        result.put("totalMaterialCost", totalMaterialCost);
        result.put("unitCost", quantity > 0 ? totalMaterialCost / quantity : 0);

        return result;
    }

    @Transactional

    public ProductionBatch startProduction(User restaurant, User creator, Long menuItemId, Double quantity) {
        Long safeItemId = Objects.requireNonNull(menuItemId, "Menu Item ID must not be null");

        MenuItem menuItem = menuItemRepository.findById(safeItemId)
                .orElseThrow(() -> new RuntimeException("Menu Item not found"));

        if (!menuItem.getRestaurant().getId().equals(restaurant.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        // 1. Check Feasibility
        Map<String, Object> feasibility = checkProductionFeasibility(restaurant, menuItemId, quantity);
        if (!(Boolean) feasibility.get("canProduce")) {
            throw new RuntimeException("Insufficient raw materials for production run.");
        }

        double totalMaterialCost = (Double) feasibility.get("totalMaterialCost");

        // 2. Deduct Raw Materials
        for (ItemIngredient ingredient : menuItem.getIngredients()) {
            InventoryItem invItem = ingredient.getInventoryItem();
            double requiredQty = ingredient.getQuantityUsed() * quantity;

            invItem.setCurrentStock(Math.max(0.0, invItem.getCurrentStock() - requiredQty));
            inventoryItemRepository.save(invItem);

            StockMovement movement = new StockMovement();
            movement.setInventoryItem(invItem);
            movement.setRestaurant(restaurant);
            movement.setType(StockMovement.MovementType.DEDUCT);
            movement.setQuantity(requiredQty);
            movement.setReason("Production Run: " + menuItem.getName());
            movement.setPerformedBy(creator);
            stockMovementRepository.save(movement);
        }

        // 3. Create Production Batch
        ProductionBatch batch = ProductionBatch.builder()
                .restaurant(restaurant)
                .menuItem(menuItem)
                .quantityProduced(quantity)
                .materialCost(totalMaterialCost)
                .status(ProductionBatch.BatchStatus.COMPLETED)
                .createdBy(creator)
                .build();

        return productionBatchRepository.save(batch);
    }

    public List<ProductionBatch> getProductionHistory(User restaurant) {
        return productionBatchRepository.findByRestaurantOrderByCreatedAtDesc(restaurant);
    }
}
