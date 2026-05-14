package com.probloom.repository;

import com.probloom.model.entity.ProductionBatch;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductionBatchRepository extends JpaRepository<ProductionBatch, Long> {
    List<ProductionBatch> findByRestaurantOrderByCreatedAtDesc(User restaurant);
}
