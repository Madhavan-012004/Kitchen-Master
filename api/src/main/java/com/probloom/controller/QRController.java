package com.probloom.controller;

import com.probloom.config.CurrentUserResolver;
import com.probloom.model.entity.User;
import com.probloom.service.QRService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/qr")
@RequiredArgsConstructor
public class QRController {

    private final QRService qrService;
    private final CurrentUserResolver resolver;

    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadQRCodePDF(HttpServletRequest request) throws Exception {
        return generateQRResponse(request, null);
    }

    @GetMapping("/download/table/{tableNumber}")
    public ResponseEntity<byte[]> downloadSingleTableQRCodePDF(HttpServletRequest request, @org.springframework.web.bind.annotation.PathVariable("tableNumber") int tableNumber) throws Exception {
        return generateQRResponse(request, tableNumber);
    }

    private ResponseEntity<byte[]> generateQRResponse(HttpServletRequest request, Integer specificTable) throws Exception {
        User restaurant = resolver.getRestaurantOwner();

        // Force HTTPS schema for QR codes because cous_web uses mkcert
        String scheme = "https";
        String serverName = request.getServerName();
        int serverPort = request.getServerPort();
        
        // --- CRITICAL: Always try to find the actual LAN IP for QR codes ---
        // This ensures mobile devices on the same Wi-Fi can connect.
        String lanIp = getLocalIPAddress();
        if (lanIp != null) {
            serverName = lanIp;
        }
        
        // In local development, 'web' is usually on 3000/5173 and 'cous_web' (Customer POS) is on 5174.
        // We want the QR labels to point to the Customer POS app.
        String baseUrl = scheme + "://" + serverName + ":" + (serverPort == 8080 ? 5174 : serverPort);
        
        byte[] pdfBytes;
        String filename;
        
        if (specificTable != null) {
            pdfBytes = qrService.generateSingleTableQRPDF(restaurant, baseUrl, specificTable);
            filename = (restaurant.getRestaurantName() != null ? restaurant.getRestaurantName() : "restaurant")
                    .replaceAll("\\s+", "_") + "_table_" + specificTable + "_qr.pdf";
        } else {
            pdfBytes = qrService.generateTableQRPDF(restaurant, baseUrl);
            filename = (restaurant.getRestaurantName() != null ? restaurant.getRestaurantName() : "restaurant")
                    .replaceAll("\\s+", "_") + "_all_table_qrs.pdf";
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(java.util.Objects.requireNonNull(MediaType.APPLICATION_PDF))
                .body(pdfBytes);
    }

    private String getLocalIPAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            String candidateIp = null;
            
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                String name = iface.getName().toLowerCase();
                
                // Skip virtual/bridge adapters that often cause confusion
                if (iface.isLoopback() || !iface.isUp() || iface.isVirtual()) continue;
                if (name.contains("vbox") || name.contains("vmware") || name.contains("wsl") || name.contains("docker")) continue;

                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr.isLoopbackAddress()) continue;
                    
                    String hostAddr = addr.getHostAddress();
                    // We want IPv4
                    if (hostAddr.contains(".")) {
                        // Check for common LAN ranges
                        if (hostAddr.startsWith("192.168.") || 
                            hostAddr.startsWith("10.") || 
                            hostAddr.startsWith("172.")) {
                            return hostAddr;
                        }
                        // Otherwise keep it as a candidate
                        candidateIp = hostAddr;
                    }
                }
            }
            return candidateIp;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}
