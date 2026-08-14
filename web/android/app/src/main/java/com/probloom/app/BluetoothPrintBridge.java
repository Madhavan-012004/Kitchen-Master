package com.probloom.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.webkit.JavascriptInterface;

import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

/**
 * BluetoothPrintBridge
 *
 * Android JavaScript Interface — exposed as window.BluetoothPrintBridge in the
 * WebView.
 *
 * This allows the ProBloom JS frontend to print to any Bluetooth ESC/POS
 * thermal printer
 * that has been paired with the device at the Android OS level.
 *
 * Usage from JavaScript:
 * window.BluetoothPrintBridge.connect("00:11:22:33:44:55");
 * window.BluetoothPrintBridge.print("Hello\n");
 * window.BluetoothPrintBridge.printHex("1B 40 ..."); // ESC/POS bytes as hex
 * string
 * window.BluetoothPrintBridge.disconnect();
 * window.BluetoothPrintBridge.isConnected(); // returns boolean
 */
public class BluetoothPrintBridge {

    // Standard SPP UUID used by virtually all BT ESC/POS thermal printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket socket;
    private OutputStream outputStream;

    /**
     * Get a JSON string of all currently paired (bonded) Bluetooth devices.
     * 
     * @return JSON string array of { name: '...', address: '...' }
     */
    @JavascriptInterface
    public String getPairedDevices() {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            return "[]";
        }
        StringBuilder json = new StringBuilder("[");
        boolean first = true;
        try {
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                if (!first)
                    json.append(",");
                String name = device.getName();
                if (name == null)
                    name = "Unknown Device";
                // Escape quotes just in case
                name = name.replace("\"", "\\\"");
                json.append("{\"name\":\"").append(name)
                        .append("\",\"address\":\"").append(device.getAddress()).append("\"}");
                first = false;
            }
        } catch (SecurityException ignored) {
            // Android 12+ scan permissions might be missing contextually
        }
        json.append("]");
        return json.toString();
    }

    /**
     * Connect to a paired Bluetooth device by MAC address.
     * Must be called before print() or printHex().
     *
     * @param address MAC address, e.g. "00:11:22:33:44:55"
     * @return empty string on success, error message on failure
     */
    @JavascriptInterface
    public String connect(String address) {
        try {
            disconnect(); // close any existing connection first

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null)
                return "error:Bluetooth adapter not available on this device";
            if (!adapter.isEnabled())
                return "error:Bluetooth is turned off. Please enable Bluetooth and try again.";

            BluetoothDevice device = adapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            adapter.cancelDiscovery();
            socket.connect();
            outputStream = socket.getOutputStream();
            return "ok";
        } catch (IllegalArgumentException e) {
            return "error:Invalid Bluetooth address: " + address;
        } catch (IOException e) {
            return "error:Could not connect to printer at " + address
                    + ". Make sure it is paired, powered on, and in range. (" + e.getMessage() + ")";
        }
    }

    /**
     * Print a text string (UTF-8 encoded as Latin-1 for ESC/POS compatibility).
     *
     * @param text Text to print
     * @return empty string on success, error message on failure
     */
    @JavascriptInterface
    public String print(String text) {
        if (outputStream == null)
            return "error:Not connected. Call connect() first.";
        try {
            // Updated to UTF-8 encoding so multibyte vernacular like Tamil doesn't get
            // corrupted
            byte[] bytes = text.getBytes("UTF-8");
            outputStream.write(bytes);
            outputStream.flush();
            return "ok";
        } catch (IOException e) {
            return "error:Print failed: " + e.getMessage();
        }
    }

    /**
     * Print raw ESC/POS bytes given as a hex string (e.g. "1B 40 1D 56 41 10").
     *
     * @param hex Space-separated hex bytes
     * @return empty string on success, error message on failure
     */
    @JavascriptInterface
    public String printHex(String hex) {
        if (outputStream == null)
            return "error:Not connected. Call connect() first.";
        try {
            String[] parts = hex.trim().split("\\s+");
            byte[] bytes = new byte[parts.length];
            for (int i = 0; i < parts.length; i++) {
                bytes[i] = (byte) Integer.parseInt(parts[i], 16);
            }
            outputStream.write(bytes);
            outputStream.flush();
            return "ok";
        } catch (NumberFormatException e) {
            return "error:Invalid hex string: " + e.getMessage();
        } catch (IOException e) {
            return "error:Print failed: " + e.getMessage();
        }
    }

    /**
     * Check if currently connected to a printer.
     *
     * @return true if connected
     */
    @JavascriptInterface
    public boolean isConnected() {
        return socket != null && socket.isConnected();
    }

    /**
     * Disconnect from the Bluetooth printer.
     */
    @JavascriptInterface
    public void disconnect() {
        try {
            if (outputStream != null) {
                outputStream.close();
                outputStream = null;
            }
            if (socket != null) {
                socket.close();
                socket = null;
            }
        } catch (IOException ignored) {
            // Swallow disconnect errors
        }
    }
}
