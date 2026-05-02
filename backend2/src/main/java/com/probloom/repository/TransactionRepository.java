package com.probloom.repository;

import com.probloom.model.entity.Transaction;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByRestaurantAndDateBetweenOrderByDateDesc(User restaurant, LocalDateTime start, LocalDateTime end);
    List<Transaction> findByRestaurantInAndDateBetweenOrderByDateDesc(List<User> restaurants, LocalDateTime start, LocalDateTime end);
    List<Transaction> findByRestaurantOrderByDateDesc(User restaurant);
}
