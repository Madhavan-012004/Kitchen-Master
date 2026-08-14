package com.probloom.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.webkit.JavascriptInterface;

import java.util.HashMap;

public class UsbPrintBridge {

    private static final String ACTION_USB_PERMISSION = "com.probloom.app.USB_PERMISSION";
    
    private final Context context;
    private final UsbManager usbManager;
    private UsbDeviceConnection connection;
    private UsbEndpoint outEndpoint;
    private UsbInterface activeInterface;
    private UsbDevice currentDevice;

    public UsbPrintBridge(Context context) {
        this.context = context;
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    @JavascriptInterface
    public String getConnectedDevices() {
        HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
        StringBuilder json = new StringBuilder("[");
        boolean first = true;
        for (UsbDevice device : deviceList.values()) {
            boolean isPrinter = false;
            int interfaceCount = device.getInterfaceCount();
            for (int i = 0; i < interfaceCount; i++) {
                UsbInterface intf = device.getInterface(i);
                if (intf.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER || intf.getInterfaceClass() == 255) {
                    isPrinter = true;
                    break;
                }
            }
            
            // Filter out common non-printers just in case
            if (device.getVendorId() == 0x22b8) continue; // Motorola
            if (device.getVendorId() == 0x05c6) continue; // Qualcomm SoC

            String name = device.getProductName();
            if (name == null || name.isEmpty()) {
                name = "USB Printer " + device.getVendorId() + ":" + device.getProductId();
            }
            name = name.replace("\"", "\\\"");

            if (!first) json.append(",");
            json.append("{\"name\":\"").append(name)
                .append("\",\"address\":\"").append(device.getDeviceName()).append("\"}");
            first = false;
        }
        json.append("]");
        return json.toString();
    }

    @JavascriptInterface
    public String connect(String deviceName) {
        try {
            disconnect();
            
            HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
            currentDevice = deviceList.get(deviceName);
            
            if (currentDevice == null) {
                return "error:Printer not found or disconnected: " + deviceName;
            }

            if (!usbManager.hasPermission(currentDevice)) {
                // Return explicitly that permission is needed so frontend can ask user to retry
                PendingIntent permissionIntent = PendingIntent.getBroadcast(context, 0, new Intent(ACTION_USB_PERMISSION), PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                usbManager.requestPermission(currentDevice, permissionIntent);
                return "error:Requesting USB Permissions. Please accept the prompt and try again.";
            }

            // Find printer interface
            activeInterface = null;
            for (int i = 0; i < currentDevice.getInterfaceCount(); i++) {
                UsbInterface intf = currentDevice.getInterface(i);
                if (intf.getInterfaceClass() == UsbConstants.USB_CLASS_PRINTER) {
                    activeInterface = intf;
                    break;
                }
                if (intf.getInterfaceClass() == 255) {
                    activeInterface = intf; // fallback for vendor specific
                }
            }
            if (activeInterface == null && currentDevice.getInterfaceCount() > 0) {
                activeInterface = currentDevice.getInterface(0);
            }

            if (activeInterface == null) {
                return "error:Could not find suitable USB interface on this printer.";
            }

            // Find bulk OUT endpoint
            outEndpoint = null;
            for (int i = 0; i < activeInterface.getEndpointCount(); i++) {
                UsbEndpoint ep = activeInterface.getEndpoint(i);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    outEndpoint = ep;
                    break;
                }
            }

            if (outEndpoint == null) {
                return "error:Could not find bulk OUT endpoint on this printer.";
            }

            connection = usbManager.openDevice(currentDevice);
            if (connection == null) {
                return "error:Could not open connection to USB Printer.";
            }
            
            connection.claimInterface(activeInterface, true);
            return "ok";
        } catch (Exception e) {
            return "error:Connection failed: " + e.getMessage();
        }
    }

    @JavascriptInterface
    public String print(String text) {
        if (connection == null || outEndpoint == null) return "error:Not connected";
        try {
            byte[] bytes = text.getBytes("UTF-8");
            return performBulkTransfer(bytes);
        } catch (Exception e) {
            return "error:Print failed: " + e.getMessage();
        }
    }

    @JavascriptInterface
    public String printHex(String hex) {
        if (connection == null || outEndpoint == null) return "error:Not connected";
        try {
            String[] parts = hex.trim().split("\\s+");
            byte[] bytes = new byte[parts.length];
            for (int i = 0; i < parts.length; i++) {
                bytes[i] = (byte) Integer.parseInt(parts[i], 16);
            }
            return performBulkTransfer(bytes);
        } catch (Exception e) {
            return "error:Print Hex failed: " + e.getMessage();
        }
    }

    private String performBulkTransfer(byte[] data) {
        if (connection == null || outEndpoint == null) return "error:Not connected";
        
        int offset = 0;
        int maxPacketSize = Math.max(16384, outEndpoint.getMaxPacketSize());
        
        while (offset < data.length) {
            int length = Math.min(data.length - offset, maxPacketSize);
            byte[] chunk = new byte[length];
            System.arraycopy(data, offset, chunk, 0, length);
            
            int result = connection.bulkTransfer(outEndpoint, chunk, length, 3000);
            if (result < 0) {
                return "error:Bulk transfer failed with code " + result;
            }
            offset += length;
        }
        return "ok";
    }

    @JavascriptInterface
    public boolean isConnected() {
        return connection != null;
    }

    @JavascriptInterface
    public void disconnect() {
        if (connection != null) {
            if (activeInterface != null) {
                connection.releaseInterface(activeInterface);
            }
            connection.close();
        }
        connection = null;
        outEndpoint = null;
        activeInterface = null;
        currentDevice = null;
    }
}
