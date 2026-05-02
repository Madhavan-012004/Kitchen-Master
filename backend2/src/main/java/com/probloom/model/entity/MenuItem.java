package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "menu_items",
    indexes = {
        @Index(name = "idx_menu_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_menu_category", columnList = "restaurant_id,category"),
        @Index(name = "idx_menu_available", columnList = "restaurant_id,is_available")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MenuItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User restaurant;

    @Column(nullable = false)
    private String name;

    @Column(name = "tamil_name")
    private String tamilName;

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String description = "";

    @Column(name = "tamil_description", columnDefinition = "TEXT")
    private String tamilDescription;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private Double price;

    @Column(name = "tax_rate")
    @Builder.Default
    private Double taxRate = 0.0;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "is_available")
    @Builder.Default
    private Boolean isAvailable = true;

    @Column(name = "is_veg")
    @Builder.Default
    private Boolean isVeg = false;

    @Column(name = "preparation_time")
    @Builder.Default
    private Integer preparationTime = 10;

    @Column(name = "sort_order")
    @Builder.Default
    private Integer sortOrder = 0;

    @ElementCollection
    @CollectionTable(name = "menu_item_tags", joinColumns = @JoinColumn(name = "menu_item_id"))
    @Column(name = "tag")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @OneToMany(mappedBy = "menuItem", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ItemIngredient> ingredients = new ArrayList<>();

    @Column(name = "order_count")
    @Builder.Default
    private Long orderCount = 0L;

    @Column(name = "is_recommended")
    @Builder.Default
    private Boolean isRecommended = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
