package com.probloom.repository;

import com.probloom.model.entity.Orders;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrdersRepository extends JpaRepository<Orders, Long> {
    boolean existsByRestaurantIdAndOrderNumber(Long restaurantId, String orderNumber);
    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant AND o.status NOT IN :statuses ORDER BY o.createdAt DESC")
    List<Orders> findByRestaurantAndStatusNotInOrderByCreatedAtDesc(@Param("restaurant") User restaurant, @Param("statuses") List<Orders.OrderStatus> statuses);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant AND o.status = :status ORDER BY o.createdAt DESC")
    List<Orders> findByRestaurantAndStatusOrderByCreatedAtDesc(@Param("restaurant") User restaurant, @Param("status") Orders.OrderStatus status);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant ORDER BY o.createdAt DESC")
    List<Orders> findByRestaurantOrderByCreatedAtDesc(@Param("restaurant") User restaurant);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant AND o.tableNumber = :tableNumber AND o.status NOT IN :statuses ORDER BY o.createdAt DESC")
    List<Orders> findByRestaurantAndTableNumberAndStatusNotInOrderByCreatedAtDesc(@Param("restaurant") User restaurant, @Param("tableNumber") String tableNumber, @Param("statuses") List<Orders.OrderStatus> statuses);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant AND o.id = :id")
    Optional<Orders> findByRestaurantAndId(@Param("restaurant") User restaurant, @Param("id") Long id);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.id = :id")
    Optional<Orders> findByIdWithItems(@Param("id") Long id);

    Optional<Orders> findByOfflineId(@Param("offlineId") String offlineId);

    @Query(value = "SELECT MAX(CAST(NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '') AS bigint)) " +
                   "FROM orders WHERE restaurant_id = :restaurantId", nativeQuery = true)
    Long findMaxOrderNumberSeq(@Param("restaurantId") Long restaurantId);

    @Query("SELECT o.orderNumber FROM Orders o WHERE o.restaurant.id = :restaurantId AND o.orderNumber LIKE :prefix%")
    List<String> findOrderNumbersByPrefix(@Param("restaurantId") Long restaurantId, @Param("prefix") String prefix);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant AND o.createdAt BETWEEN :from AND :to ORDER BY o.createdAt DESC")
    List<Orders> findByRestaurantAndCreatedAtBetweenOrderByCreatedAtDesc(
            @Param("restaurant") User restaurant, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant IN :restaurants AND o.createdAt BETWEEN :from AND :to ORDER BY o.createdAt DESC")
    List<Orders> findByRestaurantInAndCreatedAtBetweenOrderByCreatedAtDesc(
            @Param("restaurants") List<User> restaurants, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT SUM(o.total) FROM Orders o WHERE o.restaurant = :restaurant AND o.status != 'CANCELLED' AND o.createdAt BETWEEN :from AND :to")
    Double sumRevenueByRestaurantAndDateRange(@Param("restaurant") User restaurant, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("SELECT COUNT(o) FROM Orders o WHERE o.restaurant = :restaurant AND o.status != 'CANCELLED' AND o.createdAt BETWEEN :from AND :to")
    Long countOrdersByRestaurantAndDateRange(@Param("restaurant") User restaurant, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query(value = "SELECT MAX(CAST(NULLIF(regexp_replace(token_number, '[^0-9]', '', 'g'), '') AS bigint)) " +
                   "FROM orders WHERE restaurant_id = :restaurantId AND created_at >= :startOfDay", nativeQuery = true)
    Long findMaxTokenNumberToday(@Param("restaurantId") Long restaurantId, @Param("startOfDay") LocalDateTime startOfDay);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.restaurant = :restaurant AND o.waitingWaiterAck = true ORDER BY o.createdAt ASC")
    List<Orders> findPendingWaiterAck(@Param("restaurant") User restaurant);

    @Query("SELECT DISTINCT o FROM Orders o LEFT JOIN FETCH o.items WHERE o.createdBy = :waiter AND o.status = :status ORDER BY o.createdAt DESC")
    List<Orders> findByCreatedByAndStatusOrderByCreatedAtDesc(@Param("waiter") User waiter, @Param("status") Orders.OrderStatus status);
}
