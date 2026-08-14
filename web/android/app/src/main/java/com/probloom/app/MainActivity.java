package com.probloom.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int BT_PERMISSION_REQUEST = 301;
    private final BluetoothPrintBridge bluetoothPrintBridge = new BluetoothPrintBridge();
    private UsbPrintBridge usbPrintBridge;
    private UsbScaleBridge usbScaleBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        usbPrintBridge = new UsbPrintBridge(this);
        usbScaleBridge = new UsbScaleBridge(this, getBridge().getWebView());
        requestBluetoothPermissions();
        setupWebViewBridge();
    }

    /**
     * Request Bluetooth permissions at runtime (required for Android 12+ / API
     * 31+).
     */
    private void requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ requires BLUETOOTH_CONNECT and BLUETOOTH_SCAN
            String[] perms = {
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.BLUETOOTH_SCAN
            };
            boolean allGranted = true;
            for (String p : perms) {
                if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (!allGranted) {
                ActivityCompat.requestPermissions(this, perms, BT_PERMISSION_REQUEST);
            }
        } else {
            // Android 11 and below — BLUETOOTH + ACCESS_FINE_LOCATION
            String[] perms = {
                    Manifest.permission.BLUETOOTH,
                    Manifest.permission.ACCESS_FINE_LOCATION
            };
            boolean allGranted = true;
            for (String p : perms) {
                if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            if (!allGranted) {
                ActivityCompat.requestPermissions(this, perms, BT_PERMISSION_REQUEST);
            }
        }
    }

    /**
     * Inject the BluetoothPrintBridge Java interface into the Capacitor WebView.
     * After this, JavaScript can call window.BluetoothPrintBridge.connect(...),
     * etc.
     * Also overrides the WebChromeClient to auto-grant WebView permission requests.
     */
    private void setupWebViewBridge() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // Inject native BT & USB bridges — available as window.X in JS
            webView.addJavascriptInterface(bluetoothPrintBridge, "BluetoothPrintBridge");
            webView.addJavascriptInterface(usbPrintBridge, "UsbPrintBridge");
            webView.addJavascriptInterface(usbScaleBridge, "UsbScaleBridge");

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    // Auto-grant all WebView permission requests (Bluetooth, camera, mic, etc.)
                    request.grant(request.getResources());
                }

                @Override
                public void onGeolocationPermissionsShowPrompt(
                        String origin, GeolocationPermissions.Callback callback) {
                    callback.invoke(origin, true, false);
                }
            });
        }
    }
}
