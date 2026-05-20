package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Maps a Stakeholder user to one or more restaurant owner accounts.
 * A single stakeholder (identified by phone) can hold shares in multiple restaurants.
 */
@Entity
@Table(
    name = "stakeholder_mappings",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_stakeholder_restaurant",
        columnNames = {"stakeholder_id", "restaurant_id"}
    ),
    indexes = {
        @Index(name = "idx_sm_stakeholder", columnList = "stakeholder_id"),
        @Index(name = "idx_sm_restaurant", columnList = "restaurant_id")
    }
)
public class StakeholderMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The stakeholder (investor / silent partner) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stakeholder_id", nullable = false)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    @JsonIgnore
    private User stakeholder;

    /** The restaurant owner (licence holder) whose data this stakeholder can view */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    @JsonIgnore
    private User restaurant;

    /** Optional: percentage share held by this stakeholder in this restaurant */
    @Column(name = "share_percentage")
    private Double sharePercentage = 0.0;

    /** Whether this stakeholder is currently active / not removed */
    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false)
    private LocalDateTime assignedAt;

    // ── Getters & Setters ────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getStakeholder() { return stakeholder; }
    public void setStakeholder(User stakeholder) { this.stakeholder = stakeholder; }

    public User getRestaurant() { return restaurant; }
    public void setRestaurant(User restaurant) { this.restaurant = restaurant; }

    public Double getSharePercentage() { return sharePercentage; }
    public void setSharePercentage(Double sharePercentage) { this.sharePercentage = sharePercentage; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
}
