package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "clothing_variants",
    indexes = {
        @Index(name = "idx_clothing_variant_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_clothing_variant_product", columnList = "clothing_product_id"),
        @Index(name = "idx_clothing_variant_sku", columnList = "restaurant_id,sku"),
        @Index(name = "idx_clothing_variant_barcode", columnList = "restaurant_id,barcode")
    }
)
public class ClothingVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clothing_product_id", nullable = false)
    @JsonIgnore
    private ClothingProduct clothingProduct;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private User restaurant;

    @Column(nullable = false)
    private String color;

    @Column
    private String size;

    @Column(unique = true)
    private String sku;

    @Column
    private String barcode;

    @Column(name = "main_stock", nullable = false)
    private Integer mainStock = 0;

    @Column(name = "sub_stock", nullable = false)
    private Integer subStock = 0;

    @Column(name = "low_stock_threshold")
    private Integer lowStockThreshold = 2;

    @Column(name = "cost_price")
    private Double costPrice = 0.0;

    @Column(name = "selling_price")
    private Double sellingPrice = 0.0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_restocked_at")
    private LocalDateTime lastRestockedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @JsonProperty("productId")
    public Long getProductId() { return clothingProduct != null ? clothingProduct.getId() : null; }

    @JsonProperty("brand")
    public String getBrand() { return clothingProduct != null ? clothingProduct.getBrand() : null; }

    @JsonProperty("materialType")
    public String getMaterialType() { return clothingProduct != null ? clothingProduct.getMaterialType() : null; }

    public boolean isLowStock() { return mainStock <= lowStockThreshold; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ClothingProduct getClothingProduct() { return clothingProduct; }
    public void setClothingProduct(ClothingProduct clothingProduct) { this.clothingProduct = clothingProduct; }
    public User getRestaurant() { return restaurant; }
    public void setRestaurant(User restaurant) { this.restaurant = restaurant; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getSize() { return size; }
    public void setSize(String size) { this.size = size; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }
    public Integer getMainStock() { return mainStock; }
    public void setMainStock(Integer mainStock) { this.mainStock = mainStock; }
    public Integer getSubStock() { return subStock; }
    public void setSubStock(Integer subStock) { this.subStock = subStock; }
    public Integer getLowStockThreshold() { return lowStockThreshold; }
    public void setLowStockThreshold(Integer lowStockThreshold) { this.lowStockThreshold = lowStockThreshold; }
    public Double getCostPrice() { return costPrice; }
    public void setCostPrice(Double costPrice) { this.costPrice = costPrice; }
    public Double getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(Double sellingPrice) { this.sellingPrice = sellingPrice; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public LocalDateTime getLastRestockedAt() { return lastRestockedAt; }
    public void setLastRestockedAt(LocalDateTime lastRestockedAt) { this.lastRestockedAt = lastRestockedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static ClothingVariantBuilder builder() { return new ClothingVariantBuilder(); }
    public static class ClothingVariantBuilder {
        private ClothingVariant v = new ClothingVariant();
        public ClothingVariantBuilder clothingProduct(ClothingProduct p) { v.setClothingProduct(p); return this; }
        public ClothingVariantBuilder restaurant(User r) { v.setRestaurant(r); return this; }
        public ClothingVariantBuilder color(String c) { v.setColor(c); return this; }
        public ClothingVariantBuilder size(String s) { v.setSize(s); return this; }
        public ClothingVariantBuilder sku(String s) { v.setSku(s); return this; }
        public ClothingVariantBuilder barcode(String b) { v.setBarcode(b); return this; }
        public ClothingVariantBuilder mainStock(Integer m) { v.setMainStock(m); return this; }
        public ClothingVariantBuilder subStock(Integer s) { v.setSubStock(s); return this; }
        public ClothingVariantBuilder costPrice(Double c) { v.setCostPrice(c); return this; }
        public ClothingVariantBuilder sellingPrice(Double s) { v.setSellingPrice(s); return this; }
        public ClothingVariant build() { return v; }
    }
}
