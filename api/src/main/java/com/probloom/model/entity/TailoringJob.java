package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tailoring_jobs",
    indexes = {
        @Index(name = "idx_tailoring_restaurant", columnList = "restaurant_id"),
        @Index(name = "idx_tailoring_token", columnList = "restaurant_id,token_number"),
        @Index(name = "idx_tailoring_phone", columnList = "restaurant_id,customer_phone"),
        @Index(name = "idx_tailoring_status", columnList = "restaurant_id,status")
    }
)
public class TailoringJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @JsonIgnore
    private User restaurant;

    @Column(name = "token_number", nullable = false)
    private String tokenNumber;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_phone", nullable = false)
    private String customerPhone;

    @Column(name = "material_description", columnDefinition = "TEXT")
    private String materialDescription;

    @Column(name = "measurements", columnDefinition = "TEXT")
    private String measurements;

    @Column(name = "special_notes", columnDefinition = "TEXT")
    private String specialNotes;

    @Column(name = "work_type")
    private String workType;

    @Column(name = "items", columnDefinition = "TEXT")
    private String items;

    @Column(name = "pieces")
    private Integer pieces = 1;

    @Column(name = "delivery_date")
    private LocalDate deliveryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TailoringStatus status = TailoringStatus.IN_PROGRESS;

    @Column(name = "total_amount")
    private Double totalAmount = 0.0;

    @Column(name = "advance_paid")
    private Double advancePaid = 0.0;

    @Column(name = "assigned_tailor")
    private String assignedTailor;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    @JsonIgnore
    private User createdBy;

    @JsonProperty("createdByName")
    public String getCreatedByName() { return createdBy != null ? createdBy.getName() : "System"; }

    @JsonProperty("balanceDue")
    public Double getBalanceDue() {
        if (totalAmount == null || advancePaid == null) return 0.0;
        return totalAmount - advancePaid;
    }

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum TailoringStatus {
        RECEIVED, IN_PROGRESS, READY, DELIVERED, CANCELLED
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getRestaurant() { return restaurant; }
    public void setRestaurant(User restaurant) { this.restaurant = restaurant; }
    public String getTokenNumber() { return tokenNumber; }
    public void setTokenNumber(String tokenNumber) { this.tokenNumber = tokenNumber; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    public String getMaterialDescription() { return materialDescription; }
    public void setMaterialDescription(String materialDescription) { this.materialDescription = materialDescription; }
    public String getMeasurements() { return measurements; }
    public void setMeasurements(String measurements) { this.measurements = measurements; }
    public String getSpecialNotes() { return specialNotes; }
    public void setSpecialNotes(String specialNotes) { this.specialNotes = specialNotes; }
    public String getItems() { return items; }
    public void setItems(String items) { this.items = items; }
    public String getWorkType() { return workType; }
    public void setWorkType(String workType) { this.workType = workType; }
    public Integer getPieces() { return pieces; }
    public void setPieces(Integer pieces) { this.pieces = pieces; }
    public LocalDate getDeliveryDate() { return deliveryDate; }
    public void setDeliveryDate(LocalDate deliveryDate) { this.deliveryDate = deliveryDate; }
    public TailoringStatus getStatus() { return status; }
    public void setStatus(TailoringStatus status) { this.status = status; }
    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
    public Double getAdvancePaid() { return advancePaid; }
    public void setAdvancePaid(Double advancePaid) { this.advancePaid = advancePaid; }
    public String getAssignedTailor() { return assignedTailor; }
    public void setAssignedTailor(String assignedTailor) { this.assignedTailor = assignedTailor; }
    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
