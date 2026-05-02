package com.probloom.repository;

import com.probloom.model.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    List<Customer> findByRestaurantId(Long restaurantId);
    Optional<Customer> findByRestaurantIdAndPhone(Long restaurantId, String phone);
}
