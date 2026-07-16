package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.*;
import com.probloom.repository.*;
import com.probloom.service.WhatsAppDeliveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/whatsapp")
@RequiredArgsConstructor
public class WhatsAppController {

    private final CurrentUserResolver resolver;
    private final UserRepository userRepository;
    private final WhatsAppMessageLogRepository messageLogRepo;
    private final WhatsAppCampaignRepository campaignRepo;
    private final WhatsAppDeliveryService whatsAppDeliveryService;

    // ─── Settings ──────────────────────────────────────────────────────

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User shop = resolver.resolveSingleRestaurant(xRestaurantId);
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("whatsappEnabled", shop.getWhatsappEnabled());
        settings.put("whatsappAutoSendInvoice", shop.getWhatsappAutoSendInvoice());
        settings.put("whatsappAutoSendPromos", shop.getWhatsappAutoSendPromos());
        settings.put("whatsappThankYouMessage", shop.getWhatsappThankYouMessage());
        settings.put("whatsappPromoFooter", shop.getWhatsappPromoFooter());
        settings.put("restaurantName", shop.getRestaurantName());
        settings.put("address", shop.getAddress());
        settings.put("phone", shop.getPhone());
        settings.put("gstNumber", shop.getGstNumber());
        return ResponseEntity.ok(settings);
    }

    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId,
            @RequestBody Map<String, Object> body) {
        User shop = resolver.resolveSingleRestaurant(xRestaurantId);

        if (body.containsKey("whatsappEnabled"))
            shop.setWhatsappEnabled(Boolean.valueOf(body.get("whatsappEnabled").toString()));
        if (body.containsKey("whatsappAutoSendInvoice"))
            shop.setWhatsappAutoSendInvoice(Boolean.valueOf(body.get("whatsappAutoSendInvoice").toString()));
        if (body.containsKey("whatsappAutoSendPromos"))
            shop.setWhatsappAutoSendPromos(Boolean.valueOf(body.get("whatsappAutoSendPromos").toString()));
        if (body.containsKey("whatsappThankYouMessage"))
            shop.setWhatsappThankYouMessage(body.get("whatsappThankYouMessage").toString());
        if (body.containsKey("whatsappPromoFooter"))
            shop.setWhatsappPromoFooter(body.get("whatsappPromoFooter").toString());

        userRepository.save(shop);
        return ResponseEntity.ok(Map.of("success", true, "message", "WhatsApp settings saved"));
    }

    // ─── Analytics Dashboard ───────────────────────────────────────────

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User shop = resolver.resolveSingleRestaurant(xRestaurantId);
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();

        long invoicesToday = messageLogRepo.countByRestaurantAndMessageTypeAndCreatedAtAfter(
                shop, WhatsAppMessageLog.MessageType.INVOICE, todayStart);
        long promotionsToday = messageLogRepo.countByRestaurantAndMessageTypeAndCreatedAtAfter(
                shop, WhatsAppMessageLog.MessageType.PROMOTION, todayStart);
        long deliveredToday = messageLogRepo.countDeliveredSince(shop, todayStart);
        long totalSent = messageLogRepo.countByRestaurantAndCreatedAtAfter(shop, todayStart);
        long totalCampaigns = campaignRepo.countByRestaurant(shop);

        double engagementRate = totalSent > 0 ? Math.round((deliveredToday * 100.0 / totalSent) * 10) / 10.0 : 0.0;

        Map<String, Object> analytics = new LinkedHashMap<>();
        analytics.put("invoicesSentToday", invoicesToday);
        analytics.put("promotionsSentToday", promotionsToday);
        analytics.put("messagesDeliveredToday", deliveredToday);
        analytics.put("totalMessagesSentToday", totalSent);
        analytics.put("totalCampaigns", totalCampaigns);
        analytics.put("engagementRate", engagementRate);

        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/logs")
    public ResponseEntity<List<WhatsAppMessageLog>> getLogs(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User shop = resolver.resolveSingleRestaurant(xRestaurantId);
        return ResponseEntity.ok(messageLogRepo.findByRestaurantOrderByCreatedAtDesc(shop));
    }

    // ─── Campaigns ─────────────────────────────────────────────────────

    @GetMapping("/campaigns")
    public ResponseEntity<List<WhatsAppCampaign>> getCampaigns(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId) {
        User shop = resolver.resolveSingleRestaurant(xRestaurantId);
        return ResponseEntity.ok(campaignRepo.findByRestaurantOrderByCreatedAtDesc(shop));
    }

    @PostMapping("/campaigns")
    public ResponseEntity<Map<String, Object>> createAndSendCampaign(
            @RequestHeader(value = "X-Restaurant-Id", required = false) String xRestaurantId,
            @RequestBody Map<String, Object> body) {
        User shop = resolver.resolveSingleRestaurant(xRestaurantId);

        WhatsAppCampaign campaign = new WhatsAppCampaign();
        campaign.setRestaurant(shop);
        campaign.setCampaignName(body.getOrDefault("campaignName", "Unnamed Campaign").toString());
        campaign.setAudienceFilter(body.getOrDefault("audienceFilter", "ALL").toString());
        campaign.setMessageTemplate(body.getOrDefault("messageTemplate", "").toString());
        if (body.get("offerPercentage") != null)
            campaign.setOfferPercentage(Double.valueOf(body.get("offerPercentage").toString()));
        if (body.get("expiryDate") != null)
            campaign.setExpiryDate(body.get("expiryDate").toString());

        WhatsAppCampaign saved = campaignRepo.save(campaign);
        whatsAppDeliveryService.sendCampaignAsync(saved, shop);

        return ResponseEntity
                .ok(Map.of("success", true, "campaignId", saved.getId(), "message", "Campaign queued for delivery"));
    }
}
