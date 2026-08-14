package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "poultry_clients", indexes = @Index(name = "idx_poultry_clients_restaurant", columnList = "restaurant_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PoultryClient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private User restaurant;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 30)
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "default_discount")
    @Builder.Default
    private Double defaultDiscount = 0.0;

    @Column(name = "pending_amount")
    @Builder.Default
    private Double pendingAmount = 0.0;

    @Column(name = "total_purchase")
    @Builder.Default
    private Double totalPurchase = 0.0;

    @Column(name = "last_purchase")
    private LocalDate lastPurchase;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
