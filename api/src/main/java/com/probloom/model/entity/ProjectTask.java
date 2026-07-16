package com.probloom.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "project_tasks")
public class ProjectTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    // e.g. "todo", "in_progress", "done"
    @Column
    @Builder.Default
    private String status = "todo";
    
    // "high", "medium", "low"
    @Column
    @Builder.Default
    private String priority = "medium";
    
    @Column(name = "assignee_id")
    private String assigneeId;
    
    @Column(name = "assignee_name")
    private String assigneeName;
    
    @Column(name = "created_by_id")
    private Long createdById;
    
    @Column(name = "created_by_name")
    private String createdByName;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
