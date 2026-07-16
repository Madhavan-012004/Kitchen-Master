package com.probloom.service;

import com.probloom.model.entity.TailoringJob;
import com.probloom.model.entity.TailoringJob.TailoringStatus;
import com.probloom.model.entity.User;
import com.probloom.model.entity.Orders;
import com.probloom.model.entity.OrderItem;
import com.probloom.repository.TailoringJobRepository;
import com.probloom.repository.OrdersRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.annotation.PostConstruct;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@SuppressWarnings("null")
public class TailoringService {

    private final TailoringJobRepository jobRepo;
    private final JdbcTemplate jdbcTemplate;
    @Autowired
    private OrdersRepository ordersRepo;

    @Autowired
    public TailoringService(TailoringJobRepository jobRepo, JdbcTemplate jdbcTemplate) {
        this.jobRepo = jobRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void dropCheckConstraint() {
        try {
            jdbcTemplate.execute("ALTER TABLE tailoring_jobs DROP CONSTRAINT IF EXISTS tailoring_jobs_status_check;");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ── Token Generation ───────────────────────────────────────────────────────
    // Format: T-YYYYMMDD-001 (sequence resets per day per restaurant)
    private synchronized String generateToken(User restaurant) {
        LocalDate today = LocalDate.now();
        String dateStr = today.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = jobRepo.countTodayJobsByRestaurant(restaurant, today, dateStr);
        return String.format("T-%s-%03d", dateStr, count + 1);
    }

    private void recordTailoringPayment(User restaurant, User createdBy, TailoringJob job, double amount,
            String typeSuffix, String description) {
        if (amount <= 0)
            return;
        Orders order = new Orders();
        order.setRestaurant(restaurant);
        order.setCreatedBy(createdBy);
        order.setOrderNumber(job.getTokenNumber() + typeSuffix);
        order.setTokenNumber(job.getTokenNumber());
        order.setTableNumber("Tailoring");
        order.setOrderType(Orders.OrderType.TAKEAWAY);
        order.setStatus(Orders.OrderStatus.PAID);
        order.setPaymentStatus(Orders.PaymentStatus.PAID);
        order.setPaymentMethod(Orders.PaymentMethod.CASH);
        order.setCustomerName(job.getCustomerName());
        order.setCustomerPhone(job.getCustomerPhone());
        order.setSubtotal(amount);
        order.setTotal(amount);

        OrderItem item = new OrderItem();
        item.setOrder(order);
        item.setName("Tailoring: " + job.getWorkType() + " - " + description);
        item.setCategory("Tailor");
        item.setQuantity(1.0);
        item.setPrice(amount);
        item.setStatus(OrderItem.ItemStatus.SERVED);
        item.setAddedBy(createdBy);
        item.setAddedByName(createdBy != null ? createdBy.getName() : "System");

        order.getItems().add(item);
        ordersRepo.save(order);
    }

    // ── Jobs ───────────────────────────────────────────────────────────────────

    public List<TailoringJob> getAllJobs(User restaurant) {
        return jobRepo.findByRestaurantOrderByCreatedAtDesc(restaurant);
    }

    public List<TailoringJob> getJobsByStatus(User restaurant, TailoringStatus status) {
        return jobRepo.findByRestaurantAndStatusOrderByCreatedAtDesc(restaurant, status);
    }

    public TailoringJob getJobById(Long id, User restaurant) {
        return jobRepo.findById(id)
                .filter(j -> j.getRestaurant().getId().equals(restaurant.getId()))
                .orElseThrow(() -> new RuntimeException("Tailoring job not found"));
    }

    public TailoringJob getJobByToken(User restaurant, String token) {
        return jobRepo.findByRestaurantAndTokenNumber(restaurant, token)
                .orElseThrow(() -> new RuntimeException("Token not found: " + token));
    }

    public List<TailoringJob> getJobsByPhone(User restaurant, String phone) {
        return jobRepo.findByRestaurantAndCustomerPhoneOrderByCreatedAtDesc(restaurant, phone);
    }

    @Transactional
    public TailoringJob createJob(User restaurant, User createdBy, Map<String, Object> body) {
        TailoringJob job = new TailoringJob();
        job.setRestaurant(restaurant);
        job.setCreatedBy(createdBy);
        job.setTokenNumber(generateToken(restaurant));
        job.setCustomerName((String) body.get("customerName"));
        job.setCustomerPhone((String) body.get("customerPhone"));
        job.setMaterialDescription((String) body.get("materialDescription"));
        job.setMeasurements((String) body.get("measurements"));
        job.setSpecialNotes((String) body.get("specialNotes"));
        job.setAssignedTailor((String) body.get("assignedTailor"));
        if (body.get("workType") != null)
            job.setWorkType((String) body.get("workType"));
        if (body.get("pieces") != null)
            job.setPieces(((Number) body.get("pieces")).intValue());
        if (body.get("items") != null) {
            // Can be sent as a stringified JSON array
            if (body.get("items") instanceof String) {
                job.setItems((String) body.get("items"));
            } else {
                try {
                    job.setItems(
                            new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(body.get("items")));
                } catch (Exception e) {
                    job.setItems("[]");
                }
            }
        }
        if (body.get("deliveryDate") != null) {
            job.setDeliveryDate(LocalDate.parse((String) body.get("deliveryDate")));
        }
        if (body.get("totalAmount") != null)
            job.setTotalAmount(((Number) body.get("totalAmount")).doubleValue());

        double advance = 0.0;
        if (body.get("advancePaid") != null) {
            advance = ((Number) body.get("advancePaid")).doubleValue();
            job.setAdvancePaid(advance);
        }

        TailoringJob savedJob = jobRepo.save(job);

        if (advance > 0) {
            recordTailoringPayment(restaurant, createdBy, savedJob, advance, "-ADV", "Advance Payment");
        }

        return savedJob;
    }

    @Transactional
    public TailoringJob updateStatus(Long id, User restaurant, String statusStr) {
        TailoringJob job = getJobById(id, restaurant);
        TailoringStatus newStatus = TailoringStatus.valueOf(statusStr.toUpperCase());
        job.setStatus(newStatus);
        if (newStatus == TailoringStatus.DELIVERED) {
            job.setDeliveredAt(LocalDateTime.now());
        }
        return jobRepo.save(job);
    }

    @Transactional
    public TailoringJob deliverJob(Long id, User restaurant, Map<String, Object> body) {
        TailoringJob job = getJobById(id, restaurant);
        job.setStatus(TailoringStatus.DELIVERED);
        job.setDeliveredAt(LocalDateTime.now());

        double balance = 0.0;
        if (body != null && body.get("amountCollected") != null) {
            balance = ((Number) body.get("amountCollected")).doubleValue();
            job.setAdvancePaid((job.getAdvancePaid() != null ? job.getAdvancePaid() : 0.0) + balance);
        }

        TailoringJob savedJob = jobRepo.save(job);

        if (balance > 0) {
            // we pass createdBy as null here or fetch the user if possible. The controller
            // currently doesn't pass createdBy for deliverJob
            recordTailoringPayment(restaurant, null, savedJob, balance, "-BAL", "Balance Payment");
        }

        return savedJob;
    }

    public Map<String, Object> getStats(User restaurant) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", jobRepo.findByRestaurantOrderByCreatedAtDesc(restaurant).size());
        stats.put("received", jobRepo.countByRestaurantAndStatus(restaurant, TailoringStatus.RECEIVED));
        stats.put("in_progress", jobRepo.countByRestaurantAndStatus(restaurant, TailoringStatus.IN_PROGRESS));
        stats.put("ready", jobRepo.countByRestaurantAndStatus(restaurant, TailoringStatus.READY));
        stats.put("delivered", jobRepo.countByRestaurantAndStatus(restaurant, TailoringStatus.DELIVERED));
        stats.put("cancelled", jobRepo.countByRestaurantAndStatus(restaurant, TailoringStatus.CANCELLED));
        return stats;
    }
}
