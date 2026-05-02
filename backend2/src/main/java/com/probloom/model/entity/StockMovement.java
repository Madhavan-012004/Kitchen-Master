package com.probloom.model.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"stockMovements", "restaurant"})
    private InventoryItem inventoryItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MovementType type;

    @Column(nullable = false)
    private Double quantity;

    @Column
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Orders order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User performedBy;

    @com.fasterxml.jackson.annotation.JsonProperty("performedByName")
    public String getPerformedByName() {
        return performedBy != null ? performedBy.getName() : "System";
    }

    public User getRestaurant() { return restaurant; }
    public void setRestaurant(User restaurant) { this.restaurant = restaurant; }

    @com.fasterxml.jackson.annotation.JsonProperty("itemName")
    public String getItemName() {
        return inventoryItem != null ? inventoryItem.getName() : "Unknown";
    }

    @Column(name = "movement_timestamp")
    private LocalDateTime movementTimestamp = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public InventoryItem getInventoryItem() { return inventoryItem; }
    public void setInventoryItem(InventoryItem inventoryItem) { this.inventoryItem = inventoryItem; }
    public MovementType getType() { return type; }
    public void setType(MovementType type) { this.type = type; }
    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Orders getOrder() { return order; }
    public void setOrder(Orders order) { this.order = order; }
    public User getPerformedBy() { return performedBy; }
    public void setPerformedBy(User performedBy) { this.performedBy = performedBy; }
    public LocalDateTime getTimestamp() { return movementTimestamp; }
    public void setTimestamp(LocalDateTime movementTimestamp) { this.movementTimestamp = movementTimestamp; }

    public enum MovementType {
        ADD, DEDUCT, ADJUST
    }

    public static StockMovementBuilder builder() { return new StockMovementBuilder(); }
    public static class StockMovementBuilder {
        private StockMovement m = new StockMovement();
        public StockMovementBuilder restaurant(User r) { m.setRestaurant(r); return this; }
        public StockMovementBuilder inventoryItem(InventoryItem i) { m.setInventoryItem(i); return this; }
        public StockMovementBuilder type(MovementType t) { m.setType(t); return this; }
        public StockMovementBuilder quantity(Double q) { m.setQuantity(q); return this; }
        public StockMovementBuilder reason(String r) { m.setReason(r); return this; }
        public StockMovementBuilder order(Orders o) { m.setOrder(o); return this; }
        public StockMovementBuilder performedBy(User p) { m.setPerformedBy(p); return this; }
        public StockMovementBuilder timestamp(LocalDateTime t) { m.setTimestamp(t); return this; }
        public StockMovement build() { return m; }
    }
}
