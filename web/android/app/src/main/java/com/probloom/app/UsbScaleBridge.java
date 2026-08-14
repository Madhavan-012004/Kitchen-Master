package com.probloom.app;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.os.Handler;
import android.os.Looper;

import com.hoho.android.usbserial.driver.UsbSerialDriver;
import com.hoho.android.usbserial.driver.UsbSerialPort;
import com.hoho.android.usbserial.driver.UsbSerialProber;
import com.hoho.android.usbserial.util.SerialInputOutputManager;

import java.util.List;
import java.io.IOException;
import java.util.HashMap;
import android.app.PendingIntent;
import android.content.Intent;

public class UsbScaleBridge {
    private static final String TAG = "UsbScaleBridge";
    private Context context;
    private WebView webView;
    private UsbSerialPort port;
    private SerialInputOutputManager usbIoManager;

    public UsbScaleBridge(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
    }

    @JavascriptInterface
    public String getConnectedDevices() {
        try {
            UsbManager manager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
            HashMap<String, UsbDevice> deviceList = manager.getDeviceList();
            StringBuilder json = new StringBuilder("[");
            boolean first = true;
            for (UsbDevice device : deviceList.values()) {
                String name = device.getProductName();
                if (name == null || name.isEmpty()) {
                    name = "USB Device " + device.getVendorId() + ":" + device.getProductId();
                }
                name = name.replace("\"", "\\\"");
                if (!first) json.append(",");
                json.append("{\"name\":\"").append(name).append("\",\"address\":\"").append(device.getDeviceName()).append("\"}");
                first = false;
            }
            json.append("]");
            return json.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    @JavascriptInterface
    public String connect(int baudRate, String deviceAddress) {
        try {
            UsbManager manager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
            
            UsbDevice selectedDevice = null;
            if (deviceAddress != null && !deviceAddress.isEmpty()) {
                HashMap<String, UsbDevice> allDevices = manager.getDeviceList();
                selectedDevice = allDevices.get(deviceAddress);
                if (selectedDevice == null) {
                    return "error:Scale device not found: " + deviceAddress;
                }
            }
            
            List<UsbSerialDriver> availableDrivers = UsbSerialProber.getDefaultProber().findAllDrivers(manager);
            
            UsbSerialDriver targetDriver = null;
            if (selectedDevice != null) {
                // Find driver matching specific device
                for (UsbSerialDriver d : availableDrivers) {
                    if (d.getDevice().getDeviceName().equals(selectedDevice.getDeviceName())) {
                        targetDriver = d;
                        break;
                    }
                }
                if (targetDriver == null) {
                    return "error:Selected USB device is not recognized as a serial port.";
                }
            } else {
                if (availableDrivers.isEmpty()) {
                    return "error:No USB Serial drivers found connected.";
                }
                // Auto-detect fallback
                for (UsbSerialDriver d : availableDrivers) {
                    String name = "";
                    if(d.getDevice().getProductName() != null) name = d.getDevice().getProductName().toLowerCase();
                    if (!name.contains("printer") && !name.contains("thermal")) {
                        targetDriver = d;
                        break;
                    }
                }
                if (targetDriver == null) targetDriver = availableDrivers.get(0);
                selectedDevice = targetDriver.getDevice();
            }

            if (!manager.hasPermission(selectedDevice)) {
                PendingIntent permissionIntent = PendingIntent.getBroadcast(context, 0, new Intent("com.probloom.app.USB_PERMISSION"), PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                manager.requestPermission(selectedDevice, permissionIntent);
                return "error:Requesting USB Permissions. Please accept the prompt and try again.";
            }

            android.hardware.usb.UsbDeviceConnection connection = manager.openDevice(targetDriver.getDevice());
            if (connection == null) {
                return "error:Cannot open USB connection. Device in use or permission denied.";
            }

            port = targetDriver.getPorts().get(0);
            port.open(connection);
            port.setParameters(baudRate, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE);
            port.setDTR(true);
            
            usbIoManager = new SerialInputOutputManager(port, new SerialInputOutputManager.Listener() {
                @Override
                public void onNewData(byte[] data) {
                    final String str = new String(data);
                    new Handler(Looper.getMainLooper()).post(() -> {
                        String payload = str.replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r");
                        webView.evaluateJavascript("if(window.onScaleData) window.onScaleData('" + payload + "');", null);
                    });
                }

                @Override
                public void onRunError(Exception e) {
                    Log.e(TAG, "Scale read error: " + e.getMessage());
                }
            });
            java.util.concurrent.Executors.newSingleThreadExecutor().submit(usbIoManager);
            return "ok";
        } catch (Exception e) {
            Log.e(TAG, "Failed to connect to scale: " + e.getMessage());
            return "error:" + e.getMessage();
        }
    }
    
    @JavascriptInterface
    public void disconnect() {
        if (usbIoManager != null) {
            usbIoManager.stop();
            usbIoManager = null;
        }
        if (port != null) {
            try {
                port.close();
            } catch (IOException e) {
                Log.e(TAG, "Close error: " + e.getMessage());
            }
            port = null;
        }
    }
}
