import React, { useState, useEffect, useCallback } from 'react';
import './PrinterSettingsModal.css';
import {
    testPrint,
    listOsPrinters,
    isIMinAvailable,
    getPrinterSettings,
} from '../api/printerUtils';
import api from '../api/client';

// Detect which BT backend is available at render time (matches printerUtils.js priority)
function getBluetoothBackend() {
    if (window.BluetoothPrintBridge) return 'native';
    if (window.bluetoothSerial) return 'cordova';
    if (navigator.bluetooth) return 'web';
    return null;
}

/**
 * PrinterSettingsModal
 *
 * Supports: iMin Built-in (D1) | Network IP | USB | Default OS | Bluetooth
 *
 * Props:
 *  isOpen   — boolean
 *  onClose  — fn()
 *  onSaved  — fn(updatedUser) called after settings are saved
 */
export default function PrinterSettingsModal({ isOpen, onClose, onSaved }) {
    const initialSettings = getPrinterSettings();

    const [connectionType, setConnectionType] = useState(initialSettings.connectionType || 'network');
    const [kitchenIp, setKitchenIp] = useState(initialSettings.kitchenPrinterIp || '');
    const [counterIp, setCounterIp] = useState(initialSettings.counterPrinterIp || '');
    const [billPrinterName, setBillPrinterName] = useState(initialSettings.billPrinterName || '');
    const [kotPrinterName, setKotPrinterName] = useState(initialSettings.kotPrinterName || '');
    const [btAddress, setBtAddress] = useState(initialSettings.btPrinterAddress || '');
    const [iminPaperWidth, setIminPaperWidth] = useState(initialSettings.iminPaperWidth || 58);
    const [scaleDeviceName, setScaleDeviceName] = useState(initialSettings.usbScaleDeviceName || '');

    const [osPrinters, setOsPrinters] = useState([]);
    const [loadingPrinters, setLoadingPrinters] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [testLoading, setTestLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);

    const [pairedDevices, setPairedDevices] = useState([]);

    const iminAvailable = isIMinAvailable();

    useEffect(() => {
        // Fetch native paired devices immediately
        if (window.BluetoothPrintBridge && window.BluetoothPrintBridge.getPairedDevices) {
            try { setPairedDevices(JSON.parse(window.BluetoothPrintBridge.getPairedDevices())); } catch (e) { }
        } else if (window.bluetoothSerial) {
            window.bluetoothSerial.list(
                list => setPairedDevices(list.map(d => ({ name: d.name || 'Unknown', address: d.address || d.id }))),
                () => { }
            );
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const s = getPrinterSettings();
        setConnectionType(s.connectionType || 'network');
        setKitchenIp(s.kitchenPrinterIp || '');
        setCounterIp(s.counterPrinterIp || '');
        setBillPrinterName(s.billPrinterName || '');
        setKotPrinterName(s.kotPrinterName || '');
        setBtAddress(s.btPrinterAddress || '');
        setIminPaperWidth(s.iminPaperWidth || 58);
        setScaleDeviceName(s.usbScaleDeviceName || '');
        setTestResult(null);
    }, [isOpen]);

    const fetchOsPrinters = useCallback(async () => {
        setLoadingPrinters(true);
        if (window.UsbPrintBridge && window.UsbPrintBridge.getConnectedDevices) {
            try {
                const nativeUsbList = JSON.parse(window.UsbPrintBridge.getConnectedDevices());
                setOsPrinters(nativeUsbList.map(p => p.name));
            } catch (e) {
                console.warn('Native USB Printer fetch failed:', e);
                setOsPrinters([]);
            }
        } else {
            const list = await listOsPrinters();
            setOsPrinters(list);
        }
        setLoadingPrinters(false);
    }, []);

    useEffect(() => {
        if (isOpen && (connectionType === 'usb' || connectionType === 'default')) {
            fetchOsPrinters();
        }
    }, [isOpen, connectionType, fetchOsPrinters]);

    const handleTestPrint = async () => {
        setTestLoading(true);
        setTestResult(null);
        const result = await testPrint(connectionType, {
            printerIp: counterIp || kitchenIp,
            printerName: billPrinterName,
            btAddress,
        });
        setTestResult(result);
        setTestLoading(false);
    };

    const handleSave = async () => {
        setSaveLoading(true);
        setTestResult(null);
        try {
            const payload = {
                printerConnectionType: connectionType,
                kitchenPrinterIp: kitchenIp,
                counterPrinterIp: counterIp,
                billPrinterName,
                kotPrinterName,
                btPrinterAddress: btAddress,
                iminPaperWidth,
                usbScaleDeviceName: scaleDeviceName,
            };
            const res = await api.put('auth/profile', payload);
            const updatedUser = res.data?.data || res.data;
            // Update session storage for specific printer preferences
            localStorage.setItem('km_printer_settings', JSON.stringify(payload));

            // Also merge with km_user for backwards compatibility if needed
            const stored = JSON.parse(localStorage.getItem('km_user') || '{}');
            const merged = { ...stored, ...payload };
            localStorage.setItem('km_user', JSON.stringify(merged));

            if (onSaved) onSaved(merged);
            setTestResult({ success: true, message: 'Printer settings saved locally!' });
        } catch (e) {
            setTestResult({ success: false, message: e.response?.data?.message || e.message });
        }
        setSaveLoading(false);
    };

    if (!isOpen) return null;

    const CONNECTION_TYPES = [
        {
            value: 'imin_builtin',
            label: 'Built-in (iMin D1)',
            icon: '🖨️',
            desc: 'Use the tablet\'s built-in 58mm thermal printer directly',
            badge: iminAvailable ? '✅ Available' : '⚠️ APK only',
            badgeOk: iminAvailable,
        },
        {
            value: 'network',
            label: 'Network / WiFi IP',
            icon: '🌐',
            desc: 'Connect to a thermal printer via IP address on port 9100',
        },
        {
            value: 'usb',
            label: 'USB Printer',
            icon: '🔌',
            desc: window.UsbPrintBridge
                ? 'Use a local USB Thermal Printer mapped directly to this tablet\'s OTG port'
                : 'Use a USB-connected printer registered in the OS on the server machine',
        },
        {
            value: 'default',
            label: 'Default OS Printer',
            icon: '🖥️',
            desc: 'Use the default printer configured in the OS (server machine)',
        },
        {
            value: 'bluetooth',
            label: '3-inch Bluetooth Printer',
            icon: '📶',
            desc: getBluetoothBackend() === 'cordova'
                ? 'Standard 3-inch (48-char layout) via native Bluetooth (ProBloom APK)'
                : 'Standard 3-inch BT thermal printer (requires Chrome/Edge or ProBloom APK)',
        },
        {
            value: 'mini_bt',
            label: '2-inch Mini Bluetooth Printer',
            icon: '🔵',
            desc: '2-inch compact Bluetooth thermal printer (32-char width layout)',
            badge: getBluetoothBackend() ? '✅ BT Available' : '⚠️ No BT found',
            badgeOk: !!getBluetoothBackend(),
        },
    ];

    return (
        <div className="psm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="psm-modal">
                {/* Header */}
                <div className="psm-header">
                    <div className="psm-header-left">
                        <span className="psm-header-icon">🖨️</span>
                        <div>
                            <h2 className="psm-title">Printer Settings</h2>
                            <p className="psm-subtitle">iMin D1 &amp; all connection types</p>
                        </div>
                    </div>
                    <button className="psm-close" onClick={onClose}>✕</button>
                </div>

                <div className="psm-body">
                    {/* ── Section 1: Connection Type ── */}
                    <div className="psm-section">
                        <h3 className="psm-section-title">Connection Type</h3>
                        <div className="psm-type-grid">
                            {CONNECTION_TYPES.map(ct => (
                                <button
                                    key={ct.value}
                                    className={`psm-type-card ${connectionType === ct.value ? 'active' : ''}`}
                                    onClick={() => setConnectionType(ct.value)}
                                >
                                    <span className="psm-type-icon">{ct.icon}</span>
                                    <span className="psm-type-label">{ct.label}</span>
                                    {ct.badge && (
                                        <span className={`psm-type-badge ${ct.badgeOk ? 'ok' : 'warn'}`}>
                                            {ct.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <p className="psm-type-desc">
                            {CONNECTION_TYPES.find(c => c.value === connectionType)?.desc}
                        </p>
                    </div>

                    {/* ── Section 2: Connection-specific fields ── */}

                    {connectionType === 'imin_builtin' && (
                        <div className="psm-section">
                            <h3 className="psm-section-title">iMin Built-in Printer</h3>
                            {iminAvailable ? (
                                <div className="psm-notice success">
                                    ✅ iMin SDK detected — built-in printer is ready to use.
                                </div>
                            ) : (
                                <div className="psm-notice warning">
                                    ⚠️ iMin SDK not detected. This feature works only inside the <strong>ProBloom APK</strong> on the iMin D1 device.
                                </div>
                            )}
                            <div className="psm-field">
                                <label>Paper Width</label>
                                <div className="psm-radio-row">
                                    {[58, 80].map(w => (
                                        <label key={w} className="psm-radio">
                                            <input
                                                type="radio"
                                                value={w}
                                                checked={iminPaperWidth === w}
                                                onChange={() => setIminPaperWidth(w)}
                                            />
                                            <span>{w}mm</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {connectionType === 'network' && (
                        <div className="psm-section">
                            <h3 className="psm-section-title">Network Printer IPs</h3>
                            <div className="psm-notice info">
                                Enter the IP address of the thermal printer on your local WiFi network. Default port is 9100.
                            </div>
                            <div className="psm-field-group">
                                <div className="psm-field">
                                    <label>Counter / Bill Printer IP</label>
                                    <input
                                        className="psm-input"
                                        type="text"
                                        placeholder="e.g. 192.168.1.101"
                                        value={counterIp}
                                        onChange={e => setCounterIp(e.target.value)}
                                    />
                                </div>
                                <div className="psm-field">
                                    <label>Kitchen KOT Printer IP</label>
                                    <input
                                        className="psm-input"
                                        type="text"
                                        placeholder="e.g. 192.168.1.102"
                                        value={kitchenIp}
                                        onChange={e => setKitchenIp(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {(connectionType === 'usb' || connectionType === 'default') && (
                        <div className="psm-section">
                            <h3 className="psm-section-title">
                                {connectionType === 'usb' ? 'USB Printers' : 'OS Default Printer'}
                            </h3>
                            <div className="psm-notice info">
                                {window.UsbPrintBridge && connectionType === 'usb'
                                    ? <span>These printers are mapped natively to your <strong>Android Tablet's USB port</strong>.</span>
                                    : <span>These printers are managed by the <strong>server machine's OS</strong> (not the tablet).</span>}
                            </div>

                            {connectionType === 'usb' && (
                                <>
                                    <div className="psm-printers-toolbar">
                                        <button
                                            className="psm-btn-sm"
                                            onClick={fetchOsPrinters}
                                            disabled={loadingPrinters}
                                        >
                                            {loadingPrinters ? '⏳ Refreshing...' : '🔄 Refresh List'}
                                        </button>
                                        <span className="psm-printer-count">
                                            {osPrinters.length} printer{osPrinters.length !== 1 ? 's' : ''} found
                                        </span>
                                    </div>

                                    {osPrinters.length > 0 && (
                                        <div className="psm-field-group">
                                            <div className="psm-field">
                                                <label>Bill / Receipt Printer</label>
                                                <select
                                                    className="psm-select"
                                                    value={billPrinterName}
                                                    onChange={e => setBillPrinterName(e.target.value)}
                                                >
                                                    <option value="">-- Select Printer --</option>
                                                    {osPrinters.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="psm-field">
                                                <label>Kitchen KOT Printer (optional)</label>
                                                <select
                                                    className="psm-select"
                                                    value={kotPrinterName}
                                                    onChange={e => setKotPrinterName(e.target.value)}
                                                >
                                                    <option value="">-- Same as Bill Printer --</option>
                                                    {osPrinters.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div className="psm-field" style={{ marginTop: '15px' }}>
                                        <label>USB Weighing Scale (Android App Only)</label>
                                        <select
                                            className="psm-select"
                                            value={scaleDeviceName}
                                            onChange={e => setScaleDeviceName(e.target.value)}
                                        >
                                            <option value="">-- Auto-Detect Scale --</option>
                                            {osPrinters.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                        <span className="psm-field-hint">Select the specific USB serial scale if auto-detect fails.</span>
                                    </div>
                                </>
                            )}

                            {connectionType === 'default' && (
                                <div className="psm-notice success">
                                    The server's default OS printer will be used automatically. No configuration needed.
                                </div>
                            )}
                        </div>
                    )}

                    {connectionType === 'bluetooth' && (
                        <div className="psm-section">
                            <h3 className="psm-section-title">Bluetooth Printer</h3>
                            {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova') ? (
                                <div className="psm-notice success">
                                    ✅ Native Bluetooth detected (ProBloom APK). Enter the address of your already-paired printer below.
                                </div>
                            ) : getBluetoothBackend() === 'web' ? (
                                <div className="psm-notice info">
                                    Web Bluetooth is used to connect from the browser to a BT thermal printer.
                                    Requires Chrome/Edge on Android or desktop.
                                </div>
                            ) : (
                                <div className="psm-notice warning">
                                    ⚠️ No Bluetooth backend found. Please use the ProBloom APK on the iMin device, or open this in Chrome/Edge.
                                </div>
                            )}
                            <div className="psm-field">
                                <label>Bluetooth Device Address
                                    {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova') ? ' (required)' : ' (optional)'}
                                </label>
                                {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova') && pairedDevices.length > 0 ? (
                                    <select
                                        className="psm-select"
                                        value={btAddress}
                                        onChange={e => setBtAddress(e.target.value)}
                                        style={{ marginBottom: '10px' }}
                                    >
                                        <option value="">-- Select Saved Printer --</option>
                                        {pairedDevices.map(d => (
                                            <option key={d.address} value={d.address}>
                                                {d.name} ({d.address})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="psm-input"
                                        type="text"
                                        placeholder="e.g. 00:11:22:33:44:55"
                                        value={btAddress}
                                        onChange={e => setBtAddress(e.target.value)}
                                    />
                                )}
                                <span className="psm-field-hint">
                                    {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova')
                                        ? 'Select from your previously paired Android devices.'
                                        : 'Leave blank — the browser will show a device picker when printing.'}
                                </span>
                            </div>
                        </div>
                    )}

                    {connectionType === 'mini_bt' && (
                        <div className="psm-section">
                            <h3 className="psm-section-title">Mini Bluetooth Printer (2-inch)</h3>
                            <div className="psm-notice info">
                                🔵 Compact 2-inch thermal printer. Bills print shop name, contact number, and GST number (if applicable) from Company Profile. No staff name is printed.
                            </div>
                            {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova') ? (
                                <div className="psm-notice success">
                                    ✅ Native Bluetooth detected (ProBloom APK). Enter the printer's MAC address below.
                                </div>
                            ) : getBluetoothBackend() === 'web' ? (
                                <div className="psm-notice info">
                                    Web Bluetooth will be used — a device picker will appear on first print.
                                </div>
                            ) : (
                                <div className="psm-notice warning">
                                    ⚠️ No Bluetooth backend found. Use the ProBloom APK or Chrome/Edge browser.
                                </div>
                            )}
                            <div className="psm-field">
                                <label>Bluetooth Device Address
                                    {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova') ? ' (required)' : ' (optional)'}
                                </label>
                                {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova') && pairedDevices.length > 0 ? (
                                    <select
                                        className="psm-select"
                                        value={btAddress}
                                        onChange={e => setBtAddress(e.target.value)}
                                        style={{ marginBottom: '10px' }}
                                    >
                                        <option value="">-- Select Saved Printer --</option>
                                        {pairedDevices.map(d => (
                                            <option key={d.address} value={d.address}>
                                                {d.name} ({d.address})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        className="psm-input"
                                        type="text"
                                        placeholder="e.g. 00:11:22:33:44:55"
                                        value={btAddress}
                                        onChange={e => setBtAddress(e.target.value)}
                                    />
                                )}
                                <span className="psm-field-hint">
                                    {(getBluetoothBackend() === 'native' || getBluetoothBackend() === 'cordova')
                                        ? 'Select from your previously paired Android devices.'
                                        : 'Leave blank — the browser will show a device picker when printing.'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ── Test Result ── */}
                    {testResult && (
                        <div className={`psm-result ${testResult.success ? 'success' : 'error'}`}>
                            {testResult.success ? '✅' : '❌'} {testResult.message}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="psm-footer">
                    <button
                        className="psm-btn-test"
                        onClick={handleTestPrint}
                        disabled={testLoading}
                    >
                        {testLoading ? '⏳ Testing...' : '🧪 Test Print'}
                    </button>
                    <div className="psm-footer-right">
                        <button className="psm-btn-cancel" onClick={onClose}>Cancel</button>
                        <button
                            className="psm-btn-save"
                            onClick={handleSave}
                            disabled={saveLoading}
                        >
                            {saveLoading ? 'Saving...' : '💾 Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
