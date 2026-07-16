package com.probloom.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "attendance",
    indexes = {
        @Index(name = "idx_attendance_employee_date", columnList = "employee_id,date")
    }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty("_id")
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER) // Changed to EAGER to ensure it's loaded for REST responses
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonProperty("employeeId")
    private User employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurant_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User restaurant;

    @Column(nullable = false, length = 10)
    private String date; // YYYY-MM-DD

    @Column(name = "check_in_time", nullable = false)
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @Column(name = "total_hours")
    @Builder.Default
    private Double totalHours = 0.0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AttendanceStatus status = AttendanceStatus.ACTIVE;

    @Column(name = "last_ping_time")
    private LocalDateTime lastPingTime;

    @Column(name = "disconnected_at")
    private LocalDateTime disconnectedAt;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum AttendanceStatus {
        ACTIVE, COMPLETED, DISCONNECTED
    }
}
