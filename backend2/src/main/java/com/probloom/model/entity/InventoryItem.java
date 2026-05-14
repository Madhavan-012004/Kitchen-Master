package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.*;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "inventory_items",
    indexes = {
        @Index(name = "idx_inventory_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_inventory_restaurant_name", columnList = "restaurant_id,name"),
        @Index(name = "idx_inventory_restaurant_barcode", columnList = "restaurant_id,barcode")
    }
)
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private User restaurant;

    @Column(nullable = false)
    private String name;
    
    @Column
    private String barcode;

    @Column
    private String category = "General";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Unit unit = Unit.KG;

    @Column(name = "current_stock", nullable = false)
    private Double currentStock = 0.0;

    @Column(name = "low_stock_threshold", nullable = false)
    private Double lowStockThreshold = 1.0;

    @Column(name = "cost_per_unit")
    private Double costPerUnit = 0.0;

    @Column
    private Double price = 0.0;

    @Column(name = "is_billiable")
    private Boolean isBilliable = true;

    @Column(name = "supplier_name")
    private String supplierName;

    @Column(name = "supplier_phone")
    private String supplierPhone;

    @Column(name = "batch_no")
    private String batchNo;

    @Column(name = "exp_date")
    private String expDate;

    @Column(name = "hsn_code")
    private String hsnCode;

    @Column(name = "manufacturer")
    private String manufacturer;

    @Column(name = "pack_size")
    private String packSize;

    @Column(name = "pack_multiplier")
    private Integer packMultiplier = 1;

    @Column(name = "gst_percent")
    private Double gstPercent = 0.0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_restocked_at")
    private LocalDateTime lastRestockedAt;

    @OneToMany(mappedBy = "inventoryItem", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<StockMovement> stockMovements = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getRestaurant() { return restaurant; }
    public void setRestaurant(User restaurant) { this.restaurant = restaurant; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Unit getUnit() { return unit; }
    public void setUnit(Unit unit) { this.unit = unit; }
    public Double getCurrentStock() { return currentStock; }
    public void setCurrentStock(Double currentStock) { this.currentStock = currentStock; }
    public Double getLowStockThreshold() { return lowStockThreshold; }
    public void setLowStockThreshold(Double lowStockThreshold) { this.lowStockThreshold = lowStockThreshold; }
    public Double getCostPerUnit() { return costPerUnit; }
    public void setCostPerUnit(Double costPerUnit) { this.costPerUnit = costPerUnit; }
    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }
    public Boolean getIsBilliable() { return isBilliable; }
    public void setIsBilliable(Boolean isBilliable) { this.isBilliable = isBilliable; }
    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }
    public String getSupplierPhone() { return supplierPhone; }
    public void setSupplierPhone(String supplierPhone) { this.supplierPhone = supplierPhone; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public LocalDateTime getLastRestockedAt() { return lastRestockedAt; }
    public void setLastRestockedAt(LocalDateTime lastRestockedAt) { this.lastRestockedAt = lastRestockedAt; }
    
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getExpDate() { return expDate; }
    public void setExpDate(String expDate) { this.expDate = expDate; }
    public String getHsnCode() { return hsnCode; }
    public void setHsnCode(String hsnCode) { this.hsnCode = hsnCode; }
    public String getManufacturer() { return manufacturer; }
    public void setManufacturer(String manufacturer) { this.manufacturer = manufacturer; }
    public String getPackSize() { return packSize; }
    public void setPackSize(String packSize) { this.packSize = packSize; }
    public Integer getPackMultiplier() { return packMultiplier; }
    public void setPackMultiplier(Integer packMultiplier) { this.packMultiplier = packMultiplier; }
    public Double getGstPercent() { return gstPercent; }
    public void setGstPercent(Double gstPercent) { this.gstPercent = gstPercent; }

    public List<StockMovement> getStockMovements() { return stockMovements; }
    public void setStockMovements(List<StockMovement> stockMovements) { this.stockMovements = stockMovements; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public boolean isLowStock() {
        return currentStock <= lowStockThreshold;
    }

    public enum Unit {
        KG, G, LITRE, ML, PIECE, DOZEN, PACK, BOTTLE
    }

    public static InventoryItemBuilder builder() { return new InventoryItemBuilder(); }
    public static class InventoryItemBuilder {
        private InventoryItem item = new InventoryItem();
        public InventoryItemBuilder restaurant(User r) { item.setRestaurant(r); return this; }
        public InventoryItemBuilder name(String n) { item.setName(n); return this; }
        public InventoryItemBuilder barcode(String b) { item.setBarcode(b); return this; }
        public InventoryItemBuilder category(String c) { item.setCategory(c); return this; }
        public InventoryItemBuilder unit(Unit u) { item.setUnit(u); return this; }
        public InventoryItemBuilder currentStock(Double s) { item.setCurrentStock(s); return this; }
        public InventoryItemBuilder lowStockThreshold(Double t) { item.setLowStockThreshold(t); return this; }
        public InventoryItemBuilder costPerUnit(Double c) { item.setCostPerUnit(c); return this; }
        public InventoryItemBuilder price(Double p) { item.setPrice(p); return this; }
        public InventoryItemBuilder isBilliable(Boolean b) { item.setIsBilliable(b); return this; }
        public InventoryItemBuilder supplierName(String n) { item.setSupplierName(n); return this; }
        public InventoryItemBuilder supplierPhone(String p) { item.setSupplierPhone(p); return this; }
        public InventoryItemBuilder manufacturer(String m) { item.setManufacturer(m); return this; }
        public InventoryItemBuilder packSize(String s) { item.setPackSize(s); return this; }
        public InventoryItemBuilder packMultiplier(Integer m) { item.setPackMultiplier(m); return this; }
        public InventoryItemBuilder gstPercent(Double g) { item.setGstPercent(g); return this; }
        public InventoryItemBuilder batchNo(String b) { item.setBatchNo(b); return this; }
        public InventoryItemBuilder expDate(String e) { item.setExpDate(e); return this; }
        public InventoryItemBuilder hsnCode(String h) { item.setHsnCode(h); return this; }
        public InventoryItemBuilder isActive(Boolean i) { item.setIsActive(i); return this; }
        public InventoryItem build() { return item; }
    }
}
