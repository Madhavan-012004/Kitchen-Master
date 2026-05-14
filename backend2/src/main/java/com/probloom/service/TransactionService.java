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
import java.util.Optional;

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

        Object invoiceObj = data.get("invoiceNumber");
        String invoiceStr = (invoiceObj != null) ? invoiceObj.toString() : null;

        Object gstObj = data.get("gstAmount");
        Double gstVal = (gstObj != null) ? Double.valueOf(gstObj.toString()) : null;

        Object discountObj = data.get("discountAmount");
        Double discountVal = (discountObj != null) ? Double.valueOf(discountObj.toString()) : null;

        Object itemCountObj = data.get("itemCount");
        Integer itemCountVal = (itemCountObj != null) ? Integer.valueOf(itemCountObj.toString()) : null;

        Transaction transaction = Transaction.builder()
                .restaurant(restaurant)
                .type(Transaction.TransactionType.valueOf(typeStr))
                .category(categoryStr)
                .amount(amountVal)
                .description((String) data.getOrDefault("description", ""))
                .paymentMethod((String) data.getOrDefault("paymentMethod", "Cash"))
                .paymentStatus((String) data.getOrDefault("paymentStatus", "PAID"))
                .referenceId(referenceIdStr)
                .date(dateVal)
                .invoiceNumber(invoiceStr)
                .gstAmount(gstVal)
                .discountAmount(discountVal)
                .itemCount(itemCountVal)
                .build();

        return transactionRepository.save(java.util.Objects.requireNonNull(transaction));
    }

    /**
     * Creates or updates a single grouped transaction per invoice number.
     * If a transaction for the same restaurant + invoice already exists, update it.
     * Otherwise, create a new one.
     */
    @Transactional
    public Transaction createOrUpdateByInvoice(
            @NonNull User restaurant,
            @NonNull String invoiceNumber,
            double totalAmount,
            double gstAmount,
            double discountAmount,
            int itemCount,
            String description,
            String paymentMethod
    ) {
        Optional<Transaction> existing = transactionRepository.findByRestaurantAndInvoiceNumber(restaurant, invoiceNumber);

        if (existing.isPresent()) {
            Transaction t = existing.get();
            t.setAmount(totalAmount);
            t.setGstAmount(gstAmount);
            t.setDiscountAmount(discountAmount);
            t.setItemCount(itemCount);
            t.setDescription(description);
            t.setPaymentMethod(paymentMethod);
            return transactionRepository.save(t);
        } else {
            Transaction t = Transaction.builder()
                    .restaurant(restaurant)
                    .type(Transaction.TransactionType.EXPENSE)
                    .category("Inventory Purchase")
                    .amount(totalAmount)
                    .gstAmount(gstAmount)
                    .discountAmount(discountAmount)
                    .itemCount(itemCount)
                    .description(description)
                    .paymentMethod(paymentMethod)
                    .invoiceNumber(invoiceNumber)
                    .paymentStatus("PAID")
                    .date(LocalDateTime.now())
                    .build();
            return transactionRepository.save(t);
        }
    }

    /**
     * Updates payment status as a note in description field.
     */
    @Transactional
    public Transaction updatePaymentStatus(@NonNull User restaurant, @NonNull Long id, @NonNull String status) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction not found"));
        if (!transaction.getRestaurant().getId().equals(restaurant.getId())) {
            throw new ResourceNotFoundException("Transaction not found for this restaurant");
        }
        transaction.setPaymentStatus(status.toUpperCase());
        return transactionRepository.save(transaction);
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

    @Transactional
    public void wipe(@NonNull User restaurant) {
        List<Transaction> all = transactionRepository.findByRestaurantOrderByDateDesc(restaurant);
        transactionRepository.deleteAll(all);
    }
}
