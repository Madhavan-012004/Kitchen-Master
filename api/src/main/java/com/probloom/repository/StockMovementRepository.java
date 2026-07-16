package com.probloom.repository;

import com.probloom.model.entity.StockMovement;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM StockMovement sm WHERE sm.restaurant = :restaurant")
    void deleteByRestaurant(@org.springframework.data.repository.query.Param("restaurant") User restaurant);

    @Query("SELECT sm FROM StockMovement sm JOIN FETCH sm.inventoryItem LEFT JOIN FETCH sm.performedBy WHERE sm.restaurant = :restaurant ORDER BY sm.movementTimestamp DESC")
    List<StockMovement> findByRestaurantOrderByMovementTimestampDesc(@Param("restaurant") User restaurant);

    @Query("SELECT sm FROM StockMovement sm JOIN FETCH sm.inventoryItem LEFT JOIN FETCH sm.performedBy WHERE sm.inventoryItem.id = :itemId ORDER BY sm.movementTimestamp DESC")
    List<StockMovement> findByInventoryItem_IdOrderByMovementTimestampDesc(@Param("itemId") Long itemId);

    @Query("SELECT sm FROM StockMovement sm JOIN FETCH sm.inventoryItem LEFT JOIN FETCH sm.performedBy WHERE sm.restaurant = :restaurant AND sm.type = :type AND sm.movementTimestamp BETWEEN :start AND :end ORDER BY sm.movementTimestamp DESC")
    List<StockMovement> findByRestaurantAndTypeAndMovementTimestampBetweenOrderByMovementTimestampDesc(
            @Param("restaurant") User restaurant, 
            @Param("type") StockMovement.MovementType type, 
            @Param("start") java.time.LocalDateTime start, 
            @Param("end") java.time.LocalDateTime end);

    @Query("SELECT sm FROM StockMovement sm JOIN FETCH sm.inventoryItem LEFT JOIN FETCH sm.performedBy WHERE sm.restaurant = :restaurant AND sm.inventoryItem.isActive = true AND sm.movementTimestamp BETWEEN :start AND :end ORDER BY sm.movementTimestamp DESC")
    List<StockMovement> findByRestaurantAndMovementTimestampBetweenOrderByMovementTimestampDesc(
            @Param("restaurant") User restaurant, 
            @Param("start") java.time.LocalDateTime start, 
            @Param("end") java.time.LocalDateTime end);
}
