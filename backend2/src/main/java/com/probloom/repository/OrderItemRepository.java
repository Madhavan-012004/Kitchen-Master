package com.probloom.repository;

import com.probloom.model.entity.OrderItem;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {
    
    @Modifying
    @Transactional
    @Query("UPDATE OrderItem oi SET oi.menuItem = null WHERE oi.menuItem IN (SELECT m FROM MenuItem m WHERE m.restaurant = :restaurant)")
    void setMenuItemNullByRestaurant(@Param("restaurant") User restaurant);

    @Modifying
    @Transactional
    @Query("UPDATE OrderItem oi SET oi.menuItem = null WHERE oi.menuItem = :menuItem")
    void setMenuItemToNull(@Param("menuItem") com.probloom.model.entity.MenuItem menuItem);
}
