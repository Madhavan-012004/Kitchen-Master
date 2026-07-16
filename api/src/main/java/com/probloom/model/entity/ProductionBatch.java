package com.probloom.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "production_batches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductionBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private MenuItem menuItem;

    @Column(nullable = false)
    private Double quantityProduced;

    @Column(nullable = false)
    private Double materialCost; // The total COGS for this batch

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BatchStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum BatchStatus {
        PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
    }
}
