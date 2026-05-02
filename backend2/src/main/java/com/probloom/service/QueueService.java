package com.probloom.service;

import com.corundumstudio.socketio.SocketIOServer;
import com.probloom.model.entity.QueueEntry;
import com.probloom.model.entity.User;
import com.probloom.repository.QueueEntryRepository;
import com.probloom.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.lang.NonNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@Transactional
public class QueueService {

    @Autowired
    private QueueEntryRepository queueRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomerService customerService;

    @Autowired
    private SocketIOServer socketIOServer;

    public List<QueueEntry> getActiveQueue(@NonNull Long restaurantId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        return queueRepository.findByRestaurantIdAndDate(restaurantId, startOfDay);
    }

    public QueueEntry joinQueue(@NonNull Long restaurantId, String customerName, String customerPhone, Integer partySize) {
        User restaurant = userRepository.findById(restaurantId)
            .orElseThrow(() -> new RuntimeException("Restaurant not found"));

        // Upsert customer into the persistent Customer DB
        customerService.createOrUpdateCustomer(Objects.requireNonNull(restaurantId), customerPhone != null ? customerPhone : "", customerName, null);

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        long currentCount = queueRepository.countByRestaurantIdAndDate(restaurantId, startOfDay);
        String token = "T-" + (currentCount + 1);

        QueueEntry entry = new QueueEntry();
        entry.setRestaurant(restaurant);
        entry.setCustomerName(customerName);
        entry.setCustomerPhone(customerPhone);
        entry.setPartySize(partySize);
        entry.setTokenNumber(token);
        entry.setStatus(QueueEntry.QueueStatus.WAITING);


        QueueEntry saved = queueRepository.save(entry);



        // Notify POS and Monitor
        socketIOServer.getRoomOperations(restaurantId.toString()).sendEvent("queue_update", "new_entry");

        return saved;
    }

    public QueueEntry updateQueueStatus(@NonNull Long restaurantId, @NonNull Long entryId, @NonNull QueueEntry.QueueStatus status, String tableNumber) {
        QueueEntry entry = queueRepository.findById(entryId)
            .orElseThrow(() -> new RuntimeException("Waitlist entry not found"));

        if (!entry.getRestaurant().getId().equals(restaurantId)) {
            throw new RuntimeException("Unauthorized");
        }

        entry.setStatus(status);
        if (tableNumber != null && !tableNumber.trim().isEmpty()) {
            entry.setAllocatedTable(tableNumber);
        }


        QueueEntry saved = queueRepository.save(entry);


        socketIOServer.getRoomOperations(restaurantId.toString()).sendEvent("queue_update", "status_change");

        return saved;
    }
}
