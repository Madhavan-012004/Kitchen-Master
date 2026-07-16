package com.probloom.service;

import com.probloom.model.entity.Orders;
import com.probloom.model.entity.OrderItem;
import com.probloom.model.entity.User;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Generates a professional invoice PDF as raw bytes using plain text/HTML-style
 * layout.
 * No external dependency needed — we use a simple approach writing structured
 * text
 * that can be rendered and converted if needed, or we create a real PDF using
 * iText in future.
 * For now, this generates a clean UTF-8 text-based invoice (sent as WhatsApp
 * message body).
 *
 * NOTE: To generate a real binary PDF, add OpenPDF to pom.xml and update this
 * service.
 */
@Service
public class PdfGeneratorService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy hh:mm a");

    /**
     * Builds the WhatsApp invoice message body (text format, phone-friendly).
     */
    public String buildInvoiceMessageBody(Orders order, User shop) {
        StringBuilder sb = new StringBuilder();

        sb.append("🧾 *").append(shop.getRestaurantName()).append("*\n");

        if (shop.getAddress() != null && !shop.getAddress().isBlank()) {
            sb.append("📍 ").append(shop.getAddress()).append("\n");
        }
        if (shop.getPhone() != null && !shop.getPhone().isBlank()) {
            sb.append("📞 ").append(shop.getPhone()).append("\n");
        }
        if (shop.getGstNumber() != null && !shop.getGstNumber().isBlank()) {
            sb.append("GST: ").append(shop.getGstNumber()).append("\n");
        }

        sb.append("\n");
        sb.append("Invoice No: *").append(order.getOrderNumber()).append("*\n");
        if (order.getCreatedAt() != null) {
            sb.append("Date: ").append(order.getCreatedAt().format(DATE_FMT)).append("\n");
        }
        if (order.getCustomerName() != null && !order.getCustomerName().isBlank()) {
            sb.append("Customer: ").append(order.getCustomerName()).append("\n");
        }
        if (order.getTableNumber() != null && !order.getTableNumber().isBlank()) {
            sb.append("Table/Ref: ").append(order.getTableNumber()).append("\n");
        }

        sb.append("\n*Items Purchased:*\n");
        sb.append("─────────────────────\n");

        List<OrderItem> items = order.getItems();
        if (items != null) {
            for (OrderItem item : items) {
                String name = item.getName() != null ? item.getName() : "Item";
                double qty = item.getQuantity() != null ? item.getQuantity() : 1;
                double price = item.getPrice() != null ? item.getPrice() : 0;
                double total = qty * price;

                String qtyStr = (qty == Math.floor(qty)) ? String.valueOf((int) qty) : String.valueOf(qty);
                sb.append(String.format("• %s x%s — ₹%.2f\n", name, qtyStr, total));
            }
        }
        sb.append("─────────────────────\n");

        sb.append(String.format("Subtotal:   ₹%.2f\n", orZero(order.getSubtotal())));
        if (orZero(order.getDiscountAmount()) > 0) {
            sb.append(String.format("Discount:   -₹%.2f\n", order.getDiscountAmount()));
        }
        if (orZero(order.getTaxAmount()) > 0) {
            sb.append(String.format("Tax:        ₹%.2f\n", order.getTaxAmount()));
        }
        sb.append(String.format("*Total:     ₹%.2f*\n", orZero(order.getTotal())));

        if (order.getPaymentMethod() != null) {
            sb.append("Payment:    ").append(order.getPaymentMethod().toString()).append("\n");
        }

        sb.append("\n");
        // Thank you message from shop config
        String thankYou = shop.getWhatsappThankYouMessage();
        if (thankYou == null || thankYou.isBlank()) {
            thankYou = "Thank you for shopping with us! 🙏";
        }
        sb.append(thankYou).append("\n");

        // Promo footer
        String promoFooter = shop.getWhatsappPromoFooter();
        if (promoFooter != null && !promoFooter.isBlank()) {
            sb.append("\n_").append(promoFooter).append("_\n");
        }

        return sb.toString();
    }

    private double orZero(Double val) {
        return val != null ? val : 0.0;
    }
}
