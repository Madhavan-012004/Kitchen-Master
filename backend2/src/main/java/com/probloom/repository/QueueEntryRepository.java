package com.probloom.repository;

import com.probloom.model.entity.QueueEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface QueueEntryRepository extends JpaRepository<QueueEntry, Long> {
    
    @Query("SELECT q FROM QueueEntry q WHERE q.restaurant.id = :restaurantId " +
           "AND q.createdAt >= :startOfDay " +
           "ORDER BY q.createdAt ASC")
    List<QueueEntry> findByRestaurantIdAndDate(Long restaurantId, LocalDateTime startOfDay);

    @Query("SELECT COUNT(q) FROM QueueEntry q WHERE q.restaurant.id = :restaurantId " +
           "AND q.createdAt >= :startOfDay")
    long countByRestaurantIdAndDate(Long restaurantId, LocalDateTime startOfDay);
}
