package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "clothing_products",
    indexes = {
        @Index(name = "idx_clothing_product_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_clothing_product_brand", columnList = "restaurant_id,brand")
    }
)
public class ClothingProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private User restaurant;

    @Column(nullable = false)
    private String brand;

    @Column(name = "material_type", nullable = false)
    private String materialType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "base_price")
    private Double basePrice = 0.0;

    @Column(name = "gst_percent")
    private Double gstPercent = 5.0;

    @Column(name = "hsn_code")
    private String hsnCode;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @OneToMany(mappedBy = "clothingProduct", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<ClothingVariant> variants = new ArrayList<>();

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
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }
    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Double getBasePrice() { return basePrice; }
    public void setBasePrice(Double basePrice) { this.basePrice = basePrice; }
    public Double getGstPercent() { return gstPercent; }
    public void setGstPercent(Double gstPercent) { this.gstPercent = gstPercent; }
    public String getHsnCode() { return hsnCode; }
    public void setHsnCode(String hsnCode) { this.hsnCode = hsnCode; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public List<ClothingVariant> getVariants() { return variants; }
    public void setVariants(List<ClothingVariant> variants) { this.variants = variants; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static ClothingProductBuilder builder() { return new ClothingProductBuilder(); }
    public static class ClothingProductBuilder {
        private ClothingProduct p = new ClothingProduct();
        public ClothingProductBuilder restaurant(User r) { p.setRestaurant(r); return this; }
        public ClothingProductBuilder brand(String b) { p.setBrand(b); return this; }
        public ClothingProductBuilder materialType(String m) { p.setMaterialType(m); return this; }
        public ClothingProductBuilder description(String d) { p.setDescription(d); return this; }
        public ClothingProductBuilder basePrice(Double bp) { p.setBasePrice(bp); return this; }
        public ClothingProductBuilder gstPercent(Double g) { p.setGstPercent(g); return this; }
        public ClothingProductBuilder hsnCode(String h) { p.setHsnCode(h); return this; }
        public ClothingProduct build() { return p; }
    }
}
