package com.probloom.service;

import com.probloom.model.entity.*;
import com.probloom.repository.CustomerRepository;
import com.probloom.repository.WhatsAppCampaignRepository;
import com.probloom.repository.WhatsAppMessageLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.logging.Logger;

/**
 * 
 * WhatsApp Delivery Service — handles all WhatsApp message sending.
 *
 * Currently operates in MOCK mode (logs to console).
 * To wire up a real provider (Twilio, Meta API, etc.), replace the
 * sendViaProvider() method with actual HTTP calls.
 */
@Service
public class WhatsAppDeliveryService {

    private static final Logger log = Logger.getLogger(WhatsAppDeliveryService.class.getName());

    @Autowired
    private WhatsAppMessageLogRepository messageLogRepo;

    @Autowired
    private WhatsAppCampaignRepository campaignRepo;

    @Autowired
    private CustomerRepository customerRepo;

    @Autowired
    private PdfGeneratorService pdfGeneratorService;

    // ─── Invoice Sending ──────────────────────────────────────────────────

    /**
     * Called asynchronously after a bill is generated.
     * Runs in a background thread so billing is never slowed down.
     */
    @Async
    public void sendInvoiceAsync(Orders order, User shop) {
        String phone = resolveWhatsappNumber(order.getCustomerPhone());
        if (phone == null || phone.isBlank()) {
            log.warning("[WhatsApp] Invoice NOT sent — no phone for order " + order.getOrderNumber());
            return;
        }

        String messageBody = pdfGeneratorService.buildInvoiceMessageBody(order, shop);
        WhatsAppMessageLog logEntry = new WhatsAppMessageLog();
        logEntry.setRestaurant(shop);
        logEntry.setRecipientName(order.getCustomerName());
        logEntry.setRecipientNumber(phone);
        logEntry.setOrderNumber(order.getOrderNumber());
        logEntry.setMessageType(WhatsAppMessageLog.MessageType.INVOICE);

        try {
            sendViaProvider(phone, messageBody);
            logEntry.setStatus(WhatsAppMessageLog.DeliveryStatus.DELIVERED);
            log.info("[WhatsApp] ✅ Invoice sent to " + phone + " for order " + order.getOrderNumber());
        } catch (Exception e) {
            logEntry.setStatus(WhatsAppMessageLog.DeliveryStatus.FAILED);
            logEntry.setErrorMessage(e.getMessage());
            log.severe("[WhatsApp] ❌ Failed to send invoice to " + phone + " — " + e.getMessage());
        }

        messageLogRepo.save(logEntry);
    }

    // ─── Promotional Campaign Sending ──────────────────────────────────

    /**
     * Sends a promotional campaign to a filtered audience asynchronously.
     */
    @Async
    public void sendCampaignAsync(WhatsAppCampaign campaign, User shop) {
        campaign.setStatus(WhatsAppCampaign.CampaignStatus.IN_PROGRESS);
        campaignRepo.save(campaign);

        List<Customer> audience = resolveAudience(shop, campaign.getAudienceFilter());
        int sent = 0, failed = 0;

        for (Customer customer : audience) {
            if (Boolean.FALSE.equals(customer.getWhatsappConsent()))
                continue;

            String phone = resolveWhatsappNumber(
                    customer.getWhatsappNumber() != null ? customer.getWhatsappNumber() : customer.getPhone());
            if (phone == null) {
                failed++;
                continue;
            }

            String body = buildPromoMessage(campaign, shop, customer);
            WhatsAppMessageLog logEntry = new WhatsAppMessageLog();
            logEntry.setRestaurant(shop);
            logEntry.setRecipientName(customer.getName());
            logEntry.setRecipientNumber(phone);
            logEntry.setMessageType(WhatsAppMessageLog.MessageType.PROMOTION);

            try {
                sendViaProvider(phone, body);
                logEntry.setStatus(WhatsAppMessageLog.DeliveryStatus.DELIVERED);
                sent++;
            } catch (Exception e) {
                logEntry.setStatus(WhatsAppMessageLog.DeliveryStatus.FAILED);
                logEntry.setErrorMessage(e.getMessage());
                failed++;
            }
            messageLogRepo.save(logEntry);
        }

        campaign.setSentCount(sent);
        campaign.setFailedCount(failed);
        campaign.setStatus(WhatsAppCampaign.CampaignStatus.COMPLETED);
        campaign.setCompletedAt(LocalDateTime.now());
        campaignRepo.save(campaign);

        log.info("[WhatsApp] 📢 Campaign '" + campaign.getCampaignName() + "' complete — sent:" + sent + " failed:"
                + failed);
    }

    // ─── Provider Integration (MOCK) ────────────────────────────────────

    /**
     * Replace this method body with a real HTTP call to your WhatsApp Business API
     * provider.
     * e.g., Twilio, Meta Cloud API, 2Factor, etc.
     */
    private void sendViaProvider(String phone, String message) {
        // MOCK IMPLEMENTATION — logs to console
        log.info("=== [WHATSAPP MOCK] ===");
        log.info("TO: " + phone);
        log.info("MESSAGE:\n" + message);
        log.info("======================");
        // In production: httpClient.post(apiUrl, Map.of("to", phone, "body", message))
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private List<Customer> resolveAudience(User shop, String filter) {
        // For now, all customers with consent. Can segment by filter in future.
        return customerRepo.findByRestaurant(shop);
    }

    private String resolveWhatsappNumber(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank())
            return null;
        String digits = rawPhone.replaceAll("[^0-9+]", "");
        if (!digits.startsWith("+"))
            digits = "+91" + digits;
        return digits;
    }

    private String buildPromoMessage(WhatsAppCampaign campaign, User shop, Customer customer) {
        String template = campaign.getMessageTemplate();
        if (template == null)
            template = "🎉 Special offer from {SHOP_NAME}!";

        return template
                .replace("{SHOP_NAME}", shop.getRestaurantName())
                .replace("{CUSTOMER_NAME}", customer.getName() != null ? customer.getName() : "Valued Customer")
                .replace("{SHOP_ADDRESS}", shop.getAddress() != null ? shop.getAddress() : "")
                .replace("{OFFER_PERCENTAGE}",
                        campaign.getOfferPercentage() != null ? campaign.getOfferPercentage().toString() : "")
                .replace("{EXPIRY_DATE}", campaign.getExpiryDate() != null ? campaign.getExpiryDate() : "");
    }
}
