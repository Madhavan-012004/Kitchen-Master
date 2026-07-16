package com.probloom.repository;

import com.probloom.model.entity.User;
import com.probloom.model.entity.WhatsAppCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WhatsAppCampaignRepository extends JpaRepository<WhatsAppCampaign, Long> {
    List<WhatsAppCampaign> findByRestaurantOrderByCreatedAtDesc(User restaurant);

    long countByRestaurant(User restaurant);
}
