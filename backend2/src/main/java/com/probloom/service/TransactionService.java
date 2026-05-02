package com.probloom.service;

import com.probloom.exception.ResourceNotFoundException;
import com.probloom.model.entity.Transaction;
import com.probloom.model.entity.User;
import com.probloom.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.lang.NonNull;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;

    public List<Transaction> getAll(@NonNull User restaurant) {
        return transactionRepository.findByRestaurantOrderByDateDesc(restaurant);
    }

    public List<Transaction> getByDateRange(@NonNull User restaurant, @NonNull LocalDateTime start, @NonNull LocalDateTime end) {
        return transactionRepository.findByRestaurantAndDateBetweenOrderByDateDesc(restaurant, start, end);
    }

    @Transactional
    @NonNull
    public Transaction create(@NonNull User restaurant, @NonNull Map<String, Object> data) {
        Object typeObj = data.getOrDefault("type", "EXPENSE");
        String typeStr = (typeObj != null) ? typeObj.toString().toUpperCase() : "EXPENSE";

        Object categoryObj = data.getOrDefault("category", "General");
        String categoryStr = (categoryObj != null) ? categoryObj.toString() : "General";

        Object amountObj = data.get("amount");
        Double amountVal = (amountObj != null) ? Double.valueOf(amountObj.toString()) : 0.0;

        Object referenceIdObj = data.get("referenceId");
        String referenceIdStr = (referenceIdObj != null) ? referenceIdObj.toString() : null;

        Object dateObj = data.get("date");
        LocalDateTime dateVal = (dateObj != null) ? LocalDateTime.parse(dateObj.toString()) : LocalDateTime.now();

        Transaction transaction = Transaction.builder()
                .restaurant(restaurant)
                .type(Transaction.TransactionType.valueOf(typeStr))
                .category(categoryStr)
                .amount(amountVal)
                .description((String) data.getOrDefault("description", ""))
                .paymentMethod((String) data.getOrDefault("paymentMethod", "Cash"))
                .referenceId(referenceIdStr)
                .date(dateVal)
                .build();
        

        Transaction saved = transactionRepository.save(java.util.Objects.requireNonNull(transaction));
        return saved;

    }

    @Transactional
    public void delete(@NonNull User restaurant, @NonNull Long id) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        
        if (!transaction.getRestaurant().getId().equals(restaurant.getId())) {
            throw new ResourceNotFoundException("Transaction not found for this restaurant");
        }
        
        transactionRepository.delete(transaction);
    }
}
