package com.probloom.repository;

import com.probloom.model.entity.User;
import com.probloom.model.entity.WhatsAppMessageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WhatsAppMessageLogRepository extends JpaRepository<WhatsAppMessageLog, Long> {

    List<WhatsAppMessageLog> findByRestaurantOrderByCreatedAtDesc(User restaurant);

    long countByRestaurantAndCreatedAtAfter(User restaurant, LocalDateTime since);

    long countByRestaurantAndMessageTypeAndCreatedAtAfter(
            User restaurant,
            WhatsAppMessageLog.MessageType messageType,
            LocalDateTime since);

    long countByRestaurantAndStatusAndCreatedAtAfter(
            User restaurant,
            WhatsAppMessageLog.DeliveryStatus status,
            LocalDateTime since);

    @Query("SELECT COUNT(l) FROM WhatsAppMessageLog l WHERE l.restaurant = :restaurant AND l.status = 'DELIVERED' AND l.createdAt > :since")
    long countDeliveredSince(@Param("restaurant") User restaurant, @Param("since") LocalDateTime since);
}
