package com.probloom.repository;

import com.probloom.model.entity.Transaction;
import com.probloom.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByRestaurantAndDateBetweenOrderByDateDesc(User restaurant, LocalDateTime start, LocalDateTime end);
    List<Transaction> findByRestaurantInAndDateBetweenOrderByDateDesc(List<User> restaurants, LocalDateTime start, LocalDateTime end);
    List<Transaction> findByRestaurantOrderByDateDesc(User restaurant);
    List<Transaction> findByRestaurantAndReferenceId(User restaurant, String referenceId);
    Optional<Transaction> findByRestaurantAndInvoiceNumber(User restaurant, String invoiceNumber);

    @org.springframework.data.jpa.repository.Query("SELECT t.invoiceNumber FROM Transaction t WHERE t.restaurant = :restaurant AND t.invoiceNumber LIKE :prefix%")
    List<String> findInvoiceNumbersByPrefix(@org.springframework.data.repository.query.Param("restaurant") User restaurant, @org.springframework.data.repository.query.Param("prefix") String prefix);
}
