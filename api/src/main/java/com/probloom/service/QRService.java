package com.probloom.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.probloom.model.entity.User;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;

@Service
public class QRService {

    public byte[] generateTableQRPDF(User restaurant, String baseUrl) throws Exception {
        return generatePDFForTables(restaurant, baseUrl, null);
    }

    public byte[] generateSingleTableQRPDF(User restaurant, String baseUrl, int tableNumber) throws Exception {
        return generatePDFForTables(restaurant, baseUrl, tableNumber);
    }

    private byte[] generatePDFForTables(User restaurant, String baseUrl, Integer specificTable) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document document = new Document();
        PdfWriter.getInstance(document, baos);
        document.open();

        int totalTables = restaurant.getTotalTables() != null ? restaurant.getTotalTables() : 10;
        String restaurantName = restaurant.getRestaurantName() != null ? restaurant.getRestaurantName() : "Restaurant";
        String restaurantId = restaurant.getId().toString();

        Font headerFont = new Font(Font.HELVETICA, 24, Font.BOLD);
        Font subHeaderFont = new Font(Font.HELVETICA, 18, Font.NORMAL);
        Font footerFont = new Font(Font.HELVETICA, 12, Font.ITALIC);

        int start = (specificTable != null) ? specificTable : 1;
        int end = (specificTable != null) ? specificTable : totalTables;

        for (int i = start; i <= end; i++) {
            if (i > start) {
                document.newPage();
            }

            // Header: Restaurant Name
            Paragraph header = new Paragraph(restaurantName, headerFont);
            header.setAlignment(Element.ALIGN_CENTER);
            header.setSpacingAfter(20);
            document.add(header);

            // Sub-header: Table Number
            Paragraph subHeader = new Paragraph("Table " + i, subHeaderFont);
            subHeader.setAlignment(Element.ALIGN_CENTER);
            subHeader.setSpacingAfter(40);
            document.add(subHeader);

            // QR Code
            String qrUrl = String.format("%s/order/%s/%d", baseUrl, restaurantId, i);
            byte[] qrImageBytes = generateQRCodeImage(qrUrl, 300, 300);
            Image qrImage = Image.getInstance(qrImageBytes);
            qrImage.setAlignment(Element.ALIGN_CENTER);
            qrImage.scaleToFit(300, 300);
            document.add(qrImage);

            // Footer
            Paragraph footer = new Paragraph("\n\nScan to View Menu & Order", footerFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);
        }

        document.close();
        return baos.toByteArray();
    }

    private byte[] generateQRCodeImage(String text, int width, int height) throws Exception {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height);

        ByteArrayOutputStream pngOutputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", pngOutputStream);
        return pngOutputStream.toByteArray();
    }
}
