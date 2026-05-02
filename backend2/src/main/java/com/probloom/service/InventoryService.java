package com.probloom.service;

import com.probloom.exception.BadRequestException;
import com.probloom.exception.ResourceNotFoundException;
import com.probloom.model.entity.InventoryItem;
import com.probloom.model.entity.StockMovement;
import com.probloom.model.entity.User;
import com.probloom.repository.InventoryItemRepository;
import com.probloom.repository.StockMovementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import org.springframework.lang.NonNull;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryItemRepository inventoryItemRepository;
    private final StockMovementRepository stockMovementRepository;
    private final TransactionService transactionService;

    public List<InventoryItem> getAll(@NonNull User restaurant) {
        return inventoryItemRepository.findByRestaurantAndIsActiveTrueOrderByNameAsc(restaurant);
    }

    public List<InventoryItem> getLowStock(@NonNull User restaurant) {
        return inventoryItemRepository.findLowStockItems(restaurant);
    }

    public List<StockMovement> getMovements(@NonNull User restaurant) {
        return stockMovementRepository.findByRestaurantOrderByMovementTimestampDesc(restaurant);
    }

    public InventoryItem getById(@NonNull User restaurant, @NonNull Long id) {
        return inventoryItemRepository.findByRestaurantAndId(restaurant, id)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory item not found"));
    }

    public InventoryItem getByBarcode(@NonNull User restaurant, @NonNull String barcode) {
        return inventoryItemRepository.findByRestaurantAndBarcode(restaurant, barcode)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory item with barcode not found"));
    }

    @Transactional
    @NonNull
    public InventoryItem create(@NonNull User restaurant, @NonNull Map<String, Object> data) {
        Object nameObj = data.get("name");
        String nameStr = (nameObj != null) ? nameObj.toString() : "Unnamed Block";

        InventoryItem item = InventoryItem.builder()
                .restaurant(restaurant)
                .name(nameStr)
                .barcode((String) data.get("barcode"))
                .price(data.containsKey("price") && data.get("price") != null ? Double.valueOf(data.get("price").toString()) : 0.0)
                .isBilliable(!data.containsKey("isBilliable") || data.get("isBilliable") == null || Boolean.valueOf(data.get("isBilliable").toString()))
                .category(data.getOrDefault("category", "General").toString())
                .unit(InventoryItem.Unit.valueOf(data.getOrDefault("unit", "KG").toString().toUpperCase()))
                .currentStock(data.containsKey("currentStock") && data.get("currentStock") != null ? Double.valueOf(data.get("currentStock").toString()) : 0.0)
                .lowStockThreshold(data.containsKey("lowStockThreshold") && data.get("lowStockThreshold") != null ? Double.valueOf(data.get("lowStockThreshold").toString()) : 1.0)
                .costPerUnit(data.containsKey("costPerUnit") && data.get("costPerUnit") != null ? Double.valueOf(data.get("costPerUnit").toString()) : 0.0)
                .supplierName((String) data.get("supplierName"))
                .supplierPhone((String) data.get("supplierPhone"))
                .build();
        

        InventoryItem savedItem = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        
        // Record Initial Expense if cost provided
        if (data.containsKey("recordExpense") && (boolean) data.get("recordExpense") && savedItem.getCostPerUnit() > 0 && savedItem.getCurrentStock() > 0) {
            transactionService.create(restaurant, Objects.requireNonNull(Map.of(
                "amount", savedItem.getCostPerUnit() * savedItem.getCurrentStock(),
                "category", "Inventory Purchase",
                "description", "Initial purchase of " + savedItem.getName(),
                "paymentMethod", data.getOrDefault("paymentMethod", "Cash")
            )));
        }
        
        // Log initial intake if stock > 0
        if (savedItem.getCurrentStock() > 0) {
            StockMovement movement = StockMovement.builder()
                    .restaurant(restaurant)
                    .inventoryItem(savedItem)
                    .type(StockMovement.MovementType.ADD)
                    .quantity(savedItem.getCurrentStock())
                    .reason("Initial stock intake")
                    .build();
            stockMovementRepository.save(Objects.requireNonNull(movement));
        }
        
        return savedItem;
    }

    @Transactional
    @NonNull
    public InventoryItem update(@NonNull User restaurant, @NonNull Long id, @NonNull Map<String, Object> data) {
        InventoryItem item = getById(restaurant, id);
        if (data.containsKey("name")) item.setName((String) data.get("name"));
        if (data.containsKey("barcode")) item.setBarcode((String) data.get("barcode"));
        if (data.containsKey("price")) item.setPrice(Double.valueOf(data.get("price").toString()));
        if (data.containsKey("isBilliable")) item.setIsBilliable(Boolean.valueOf(data.get("isBilliable").toString()));
        if (data.containsKey("category")) item.setCategory((String) data.get("category"));
        if (data.containsKey("unit")) item.setUnit(InventoryItem.Unit.valueOf(data.get("unit").toString().toUpperCase()));
        if (data.containsKey("lowStockThreshold")) item.setLowStockThreshold(Double.valueOf(data.get("lowStockThreshold").toString()));
        if (data.containsKey("costPerUnit")) item.setCostPerUnit(Double.valueOf(data.get("costPerUnit").toString()));

        InventoryItem saved = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        return saved;

    }

    @Transactional
    @NonNull
    public InventoryItem adjustStock(@NonNull User restaurant, @NonNull Long id, @NonNull Map<String, Object> data, User performedBy) {
        String type = (String) data.get("type");
        Double quantity = Double.valueOf(data.get("quantity").toString());
        String reason = (String) data.getOrDefault("reason", "");
        InventoryItem item = getById(restaurant, id);
        StockMovement.MovementType movementType = StockMovement.MovementType.valueOf(type.toUpperCase());

        switch (movementType) {
            case ADD:
                item.setCurrentStock(item.getCurrentStock() + quantity);
                item.setLastRestockedAt(LocalDateTime.now());
                break;
            case DEDUCT:
                if (item.getCurrentStock() < quantity) throw new BadRequestException("Insufficient stock");
                item.setCurrentStock(item.getCurrentStock() - quantity);
                break;
            case ADJUST:
                item.setCurrentStock(quantity);
                break;
        }

        // Record Expenditure if cost provided for ADD movement
        if (movementType == StockMovement.MovementType.ADD && data.containsKey("totalCost")) {
            transactionService.create(restaurant, new java.util.HashMap<>(Map.of(
                "amount", Double.valueOf(data.get("totalCost").toString()),
                "category", "Inventory Purchase",
                "description", "Restock: " + item.getName() + " (" + quantity + " " + item.getUnit() + ")",
                "paymentMethod", data.getOrDefault("paymentMethod", "Cash")
            )));
        }

        StockMovement movement = StockMovement.builder()
                .restaurant(restaurant)
                .inventoryItem(item)
                .type(movementType)
                .quantity(quantity)
                .reason(reason)
                .performedBy(performedBy)
                .build();
        
        stockMovementRepository.save(Objects.requireNonNull(movement));

        InventoryItem savedItem = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        return savedItem;

    }


    @Transactional
    public void delete(@NonNull User restaurant, @NonNull Long id) {
        InventoryItem item = getById(restaurant, id);
        item.setIsActive(false);
        inventoryItemRepository.save(item);
    }

    @Transactional
    @NonNull
    public InventoryItem incrementStockByBarcode(@NonNull User restaurant, @NonNull String barcode, double amount, User performedBy) {
        InventoryItem item = getByBarcode(restaurant, barcode);
        item.setCurrentStock(item.getCurrentStock() + amount);
        item.setLastRestockedAt(LocalDateTime.now());
        
        StockMovement movement = StockMovement.builder()
                .restaurant(restaurant)
                .inventoryItem(item)
                .type(StockMovement.MovementType.ADD)
                .quantity(amount)
                .reason("Rapid Scanner Intake")
                .performedBy(performedBy)
                .build();
        
        stockMovementRepository.save(Objects.requireNonNull(movement));

        InventoryItem savedItem = inventoryItemRepository.save(java.util.Objects.requireNonNull(item));
        return savedItem;

    }

    @Transactional
    public List<InventoryItem> bulkUpdate(User restaurant, List<Map<String, Object>> itemsData, User performedBy) {
        for (Map<String, Object> data : itemsData) {
            Long id = Long.valueOf(data.get("id").toString());
            InventoryItem item = getById(Objects.requireNonNull(restaurant), Objects.requireNonNull(id));
            
            if (data.containsKey("currentStock")) {
                double newStock = Double.valueOf(data.get("currentStock").toString());
                double diff = newStock - item.getCurrentStock();
                
                if (diff != 0) {
                    item.setCurrentStock(newStock);
                    StockMovement movement = StockMovement.builder()
                            .restaurant(restaurant)
                            .inventoryItem(item)
                            .type(diff > 0 ? StockMovement.MovementType.ADD : StockMovement.MovementType.DEDUCT)
                            .quantity(Math.abs(diff))
                            .reason("Bulk Inventory Update")
                            .performedBy(performedBy)
                            .build();
                    stockMovementRepository.save(Objects.requireNonNull(movement));
                }
            }
            
            if (data.containsKey("name")) item.setName((String) data.get("name"));
            if (data.containsKey("price")) item.setPrice(Double.valueOf(data.get("price").toString()));
            if (data.containsKey("costPerUnit")) item.setCostPerUnit(Double.valueOf(data.get("costPerUnit").toString()));
            
            inventoryItemRepository.save(Objects.requireNonNull(item));
        }
        return getAll(Objects.requireNonNull(restaurant));
    }
}
