package com.probloom.model.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "item_ingredients")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private MenuItem menuItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private InventoryItem inventoryItem;

    @Column(name = "inventory_item_name")
    private String inventoryItemName;

    @Column(name = "quantity_used", nullable = false)
    private Double quantityUsed;

    @Column
    private String unit;
}
