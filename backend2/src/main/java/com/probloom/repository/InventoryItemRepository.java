package com.probloom.repository;

import com.probloom.model.entity.InventoryItem;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    List<InventoryItem> findByRestaurantAndIsActiveTrueOrderByNameAsc(@Param("restaurant") User restaurant);
    List<InventoryItem> findByRestaurantInAndIsActiveTrueOrderByNameAsc(@Param("restaurants") List<User> restaurants);
    Optional<InventoryItem> findByRestaurantAndId(@Param("restaurant") User restaurant, @Param("id") Long id);
    Optional<InventoryItem> findByRestaurantAndBarcode(@Param("restaurant") User restaurant, @Param("barcode") String barcode);

    @Query("SELECT i FROM InventoryItem i WHERE i.restaurant = :restaurant AND i.isActive = true AND i.currentStock <= i.lowStockThreshold")
    List<InventoryItem> findLowStockItems(@Param("restaurant") User restaurant);
}
