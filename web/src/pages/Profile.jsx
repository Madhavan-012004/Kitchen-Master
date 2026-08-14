import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { usePOSMode } from '../context/POSModeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import api from '../api/client.js';
import PrinterSettingsModal from '../components/PrinterSettingsModal.jsx';
import './Profile.css';
import './WaitlistMonitor.css';  // TV Monitor modal styles

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    const { theme, toggleTheme, accentColor, updateAccentColor } = useTheme();
    const {
        language, setLanguage,
        printLanguage, setPrintLanguage,
        itemNameLanguage, setItemNameLanguage
    } = useLanguage();
    const { setSupermarketMode } = usePOSMode();
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, type: '', text: '' });
    const [showPrinterModal, setShowPrinterModal] = useState(false);

    const canEdit = ['owner', 'manager', 'stakeholder'].includes(user?.role?.toLowerCase());

    // Change Password States
    const [changePasswordData, setChangePasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Form States
    const [formData, setFormData] = useState({
        name: user?.name || '',
        restaurantName: user?.restaurantName || '',
        phone: user?.phone || '',
        address: user?.address || '',
        currency: user?.currency || 'INR',
        gstNumber: user?.gstNumber || '',
        taxRate: user?.taxRate || 5,
        bankName: user?.bankName || '',
        bankAccountName: user?.bankAccountName || '',
        bankAccountNumber: user?.bankAccountNumber || '',
        bankIfsc: user?.bankIfsc || '',
        geofenceRadius: user?.geofenceRadius || 500,
        totalTables: user?.totalTables || 10,
        acTables: user?.acTables || '',
        acChargePercentage: user?.acChargePercentage ?? 20,
        tableMetadata: user?.tableMetadata || {},
        tableCategories: user?.tableCategories || [],

        // Printer Settings
        basicBillTemplate: user?.basicBillTemplate || 'standard',
        billPrinterEnabled: user?.billPrinterEnabled ?? true,
        counterPrinterIp: user?.counterPrinterIp || '',
        kotPrinterEnabled: user?.kotPrinterEnabled ?? true,
        kitchenPrinterIp: user?.kitchenPrinterIp || '',
        categoryPrinterEnabled: user?.categoryPrinterEnabled ?? false,
        autoPrintEnabled: user?.autoPrintEnabled ?? false,
        minPrintPrice: user?.minPrintPrice ?? 0,
        consolidatedReceipt: user?.consolidatedReceipt ?? false,
        reprintKOT: user?.reprintKOT ?? false,
        reprintBill: user?.reprintBill ?? false,
        largeFontKOT: user?.largeFontKOT ?? false,
        itemWiseKOT: user?.itemWiseKOT ?? false,
        printCount: user?.printCount ?? 1,
        printCategoryInBill: user?.printCategoryInBill ?? false,

        // Other Settings
        quickMode: user?.quickMode ?? false,
        manualQuantity: user?.manualQuantity ?? false,
        preferredPosMode: user?.preferredPosMode || 'restaurant',
        menuLayout: user?.menuLayout || 'Side Menu',
        menuColorStyle: user?.menuColorStyle || 'MultiColor',
        menuItemColumnCount: user?.menuItemColumnCount ?? 5,
        lowStockAlert: user?.lowStockAlert ?? true,
        allowNoStockSale: user?.allowNoStockSale ?? true,
        trackCustomerDetail: user?.trackCustomerDetail ?? true,
        enableCustomerPointsPage: user?.enableCustomerPointsPage ?? false,
        stockCategories: user?.stockCategories || 'General,Grocery,Clothing,Pharmacy,Others',

        // Online Order Settings
        onlineAutoAccept: user?.onlineAutoAccept ?? false,
        onlineAutoPrint: user?.onlineAutoPrint ?? false,
        onlinePrintCounter: user?.onlinePrintCounter ?? true,
        onlinePrintKitchen: user?.onlinePrintKitchen ?? true,
        onlineNotification: user?.onlineNotification ?? true,
        onlineStockActivateTime: user?.onlineStockActivateTime ?? false,
        customerOrderMode: user?.customerOrderMode ?? false,

        // WhatsApp Settings
        whatsappCountryCode: user?.whatsappCountryCode || '+91',
        whatsappDetailedBill: user?.whatsappDetailedBill ?? false,
        cloudBackupPath: user?.cloudBackupPath || ''
    });

    const [initialTableMeta, setInitialTableMeta] = useState({});
    const [activeTab, setActiveTab] = useState('profile');
    const [showTVModal, setShowTVModal] = useState(false);
    const [editingCategoryName, setEditingCategoryName] = useState(null);

    const [csvFile, setCsvFile] = useState(null);

    // Stakeholder States
    const [stakeholders, setStakeholders] = useState([]);
    const [stakeholderForm, setStakeholderForm] = useState({ name: '', phone: '', sharePercentage: 50, password: '' });
    const [loadingStakeholders, setLoadingStakeholders] = useState(false);

    const loadStakeholders = async () => {
        if (user?.role !== 'owner') return;
        setLoadingStakeholders(true);
        try {
            const res = await api.get('/stakeholder/list');
            if (res.data.success) {
                setStakeholders(res.data.data.stakeholders || []);
            }
        } catch (err) {
            console.error('Failed to load stakeholders', err);
        } finally {
            setLoadingStakeholders(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'owner') {
            loadStakeholders();
        }
    }, [user?.role]);

    const handleInviteStakeholder = async (e) => {
        e.preventDefault();
        // Validate that total share does not exceed 100%
        const usedShare = (stakeholders || []).reduce((sum, s) => sum + (s.sharePercentage || 0), 0);
        const remainingShare = 100 - usedShare;
        if (stakeholderForm.sharePercentage > remainingShare) {
            showToast('error', `Share exceeds available allocation. Only ${remainingShare.toFixed(1)}% remaining.`);
            return;
        }
        if (stakeholderForm.sharePercentage <= 0) {
            showToast('error', 'Share percentage must be greater than 0.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/stakeholder/invite', stakeholderForm);
            if (res.data.success) {
                showToast('success', 'Stakeholder invited successfully!');
                setStakeholderForm({ name: '', phone: '', sharePercentage: 50, password: '' });
                loadStakeholders();
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Failed to invite stakeholder');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveStakeholder = async (stakeholderId) => {
        if (!window.confirm('Are you sure you want to remove this stakeholder?')) return;
        setLoading(true);
        try {
            const res = await api.delete(`/stakeholder/${stakeholderId}`);
            if (res.data.success) {
                showToast('success', 'Stakeholder removed.');
                loadStakeholders();
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Failed to remove stakeholder');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            const tableMetaParsed = (typeof user.tableMetadata === 'string') ? JSON.parse(user.tableMetadata) : (user.tableMetadata || {});
            setInitialTableMeta(tableMetaParsed);

            const localGst = localStorage.getItem('defaultPrintWithGst');
            const localKot = localStorage.getItem('requireKotBeforeBilling');

            setFormData({
                name: user.name || '',
                restaurantName: user.restaurantName || '',
                phone: user.phone || '',
                address: user.address || '',
                currency: user.currency || 'INR',
                gstNumber: user.gstNumber || '',
                mobile: user.mobile || '',
                email: user.email || '',
                defaultPrintWithGst: localGst !== null ? localGst === 'true' : (user.defaultPrintWithGst !== false),
                requireKotBeforeBilling: localKot !== null ? localKot === 'true' : (user.requireKotBeforeBilling !== false),
                dlNumber: user.dlNumber || '',
                tinNumber: user.tinNumber || '',
                cinNumber: user.cinNumber || '',
                fssaiNumber: user.fssaiNumber || '',
                panNumber: user.panNumber || '',
                bankName: user.bankName || '',
                bankAccountName: user.bankAccountName || '',
                bankAccountNumber: user.bankAccountNumber || '',
                bankIfsc: user.bankIfsc || '',
                taxRate: user.taxRate !== undefined ? user.taxRate : 5,
                pharmacyFontSize: user.pharmacyFontSize || 11,
                geofenceRadius: user.geofenceRadius || 500,
                totalTables: user.totalTables || 10,
                acTables: user.acTables || '',
                acChargePercentage: user.acChargePercentage ?? 20,
                tableMetadata: tableMetaParsed,
                tableCategories: (typeof user.tableCategories === 'string') ? JSON.parse(user.tableCategories) : (user.tableCategories || []),

                // Printer Settings
                basicBillTemplate: user.basicBillTemplate || 'standard',
                billPrinterEnabled: user.billPrinterEnabled ?? true,
                counterPrinterIp: user.counterPrinterIp || '',
                kotPrinterEnabled: user.kotPrinterEnabled ?? true,
                kitchenPrinterIp: user.kitchenPrinterIp || '',
                categoryPrinterEnabled: user.categoryPrinterEnabled ?? false,
                autoPrintEnabled: user.autoPrintEnabled ?? false,
                minPrintPrice: user.minPrintPrice ?? 0,
                consolidatedReceipt: user.consolidatedReceipt ?? false,
                reprintKOT: user.reprintKOT ?? false,
                reprintBill: user.reprintBill ?? false,
                largeFontKOT: user.largeFontKOT ?? false,
                itemWiseKOT: user.itemWiseKOT ?? false,
                printCount: user.printCount ?? 1,
                printCategoryInBill: user.printCategoryInBill ?? false,

                quickMode: user.quickMode ?? false,
                manualQuantity: user.manualQuantity ?? false,
                preferredPosMode: user.preferredPosMode || 'restaurant',
                menuLayout: user.menuLayout || 'Side Menu',
                menuColorStyle: user.menuColorStyle || 'MultiColor',
                menuItemColumnCount: user.menuItemColumnCount ?? 5,
                lowStockAlert: user.lowStockAlert ?? true,
                allowNoStockSale: user.allowNoStockSale ?? true,
                trackCustomerDetail: user.trackCustomerDetail ?? true,
                enableCustomerPointsPage: user.enableCustomerPointsPage ?? false,
                stockCategories: user.stockCategories || 'General,Grocery,Clothing,Pharmacy,Others',

                onlineAutoAccept: user.onlineAutoAccept ?? false,
                onlineAutoPrint: user.onlineAutoPrint ?? false,
                onlinePrintCounter: user.onlinePrintCounter ?? true,
                onlinePrintKitchen: user.onlinePrintKitchen ?? true,
                onlineNotification: user.onlineNotification ?? true,
                onlineStockActivateTime: user.onlineStockActivateTime ?? false,
                customerOrderMode: user.customerOrderMode ?? false,

                whatsappCountryCode: user.whatsappCountryCode || '+91',
                whatsappDetailedBill: user.whatsappDetailedBill ?? false,
                cloudBackupPath: user.cloudBackupPath || ''
            });
        }
    }, [user]);

    if (!user) return null;

    const showToast = (type, text) => {
        setToast({ show: true, type, text });
        // Long messages (e.g. GPS warning) need more time to read
        const duration = text.length > 80 ? 7000 : 4000;
        setTimeout(() => setToast({ show: false, type: '', text: '' }), duration);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };



    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const data = await res.json();
            setSearchResults(data);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setIsSearching(false);
        }
    };

    const selectSearchResult = (result) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        setFormData(prev => ({ ...prev, latitude: lat, longitude: lon, address: result.display_name }));

        if (mapRef.current && markerRef.current) {
            mapRef.current.setView([lat, lon], 17);
            markerRef.current.setLatLng([lat, lon]);
        }

        setSearchResults([]);
        setSearchQuery('');
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            // Convert metadata to string if backend expects string (Java)
            const payload = { ...formData, accentColor };
            if (typeof payload.tableMetadata !== 'string') {
                payload.tableMetadata = JSON.stringify(payload.tableMetadata);
            }
            if (typeof payload.tableCategories !== 'string') {
                payload.tableCategories = JSON.stringify(payload.tableCategories);
            }

            const res = await api.put('/auth/profile', payload);
            if (res.data.success) {
                // OVERRIDE: Force local javascript state to persist the KOT bypass instantly 
                // without relying on the backend Java API to reflect it properly.
                const updatedUser = {
                    ...res.data.data.user,
                    requireKotBeforeBilling: formData.requireKotBeforeBilling,
                    defaultPrintWithGst: formData.defaultPrintWithGst
                };
                localStorage.setItem('requireKotBeforeBilling', formData.requireKotBeforeBilling);
                localStorage.setItem('defaultPrintWithGst', formData.defaultPrintWithGst);
                updateUser(updatedUser);
                setSupermarketMode(updatedUser.preferredPosMode === 'supermarket');
                showToast('success', 'Profile and settings updated successfully!');
            }
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategorySubmit = async () => {
        const input = document.getElementById('stock-categories-add-input');
        const val = input ? input.value.trim() : '';
        if (!val) return;

        const current = formData.stockCategories ? formData.stockCategories.split(',').map(c => c.trim()) : [];
        if (current.includes(val)) {
            showToast('error', 'Category already exists');
            return;
        }

        const updated = [...current, val].join(',');
        setFormData(prev => ({ ...prev, stockCategories: updated }));
        if (input) input.value = '';

        // Auto-save the profile to backend
        setLoading(true);
        try {
            const payload = { ...formData, stockCategories: updated, accentColor };
            if (typeof payload.tableMetadata !== 'string') payload.tableMetadata = JSON.stringify(payload.tableMetadata);
            if (typeof payload.tableCategories !== 'string') payload.tableCategories = JSON.stringify(payload.tableCategories);

            const res = await api.put('/auth/profile', payload);
            if (res.data.success) {
                updateUser(res.data.data.user);
                showToast('success', 'Category added successfully!');
            }
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Failed to add category');
        } finally {
            setLoading(false);
        }
    };

    const handleRenameCategorySubmit = async (oldName, newName) => {
        if (!newName || oldName === newName) {
            setEditingCategoryName(null);
            return;
        }

        const current = formData.stockCategories ? formData.stockCategories.split(',').map(c => c.trim()) : [];
        if (current.includes(newName)) {
            showToast('error', 'New category name already exists');
            return;
        }

        setLoading(true);
        try {
            // 1. Rename on backend (which also updates user settings)
            const resRename = await api.put('/api/inventory/categories/rename', { oldName, newName });
            if (resRename.data.success) {
                // 2. Fetch updated user profile
                const resProfile = await api.get('/auth/me');
                if (resProfile.data.success) {
                    const u = resProfile.data.data;
                    updateUser(u);
                    setFormData(prev => ({ ...prev, stockCategories: u.stockCategories }));
                    showToast('success', 'Category renamed successfully across all items!');
                }
            }
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Rename failed');
        } finally {
            setEditingCategoryName(null);
            setLoading(false);
        }
    };

    const handleDeleteCategorySubmit = async (catName) => {
        if (window.confirm(`Are you sure you want to delete "${catName}"? All items belonging to this category will automatically be reassigned to "General".`)) {
            setLoading(true);
            try {
                // 1. Delete on backend (which sets items to General and updates user settings)
                const resDel = await api.delete(`/api/inventory/categories?name=${encodeURIComponent(catName)}`);
                if (resDel.data.success) {
                    // 2. Fetch updated user profile
                    const resProfile = await api.get('/auth/me');
                    if (resProfile.data.success) {
                        const u = resProfile.data.data;
                        updateUser(u);
                        setFormData(prev => ({ ...prev, stockCategories: u.stockCategories }));
                        showToast('success', `Category "${catName}" deleted successfully!`);
                    }
                }
            } catch (error) {
                showToast('error', error.response?.data?.message || 'Delete failed');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleTableMetaChange = (tableNum, field, value) => {
        setFormData(prev => ({
            ...prev,
            tableMetadata: {
                ...prev.tableMetadata,
                [tableNum]: {
                    ...(prev.tableMetadata[tableNum] || {}),
                    [field]: value
                }
            }
        }));
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
            return showToast('error', 'New passwords do not match');
        }
        if (changePasswordData.newPassword.length < 6) {
            return showToast('error', 'New password must be at least 6 characters long');
        }

        setPasswordLoading(true);
        try {
            const res = await api.post('/auth/change-password', {
                oldPassword: changePasswordData.oldPassword,
                newPassword: changePasswordData.newPassword
            });
            showToast('success', res.data.message || 'Password changed successfully');
            setChangePasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleLogoClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.type.match('image.*')) {
            showToast('error', 'Please upload an image file (jpg, png, etc.)');
            return;
        }

        setLoading(true);
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const res = await api.post('/auth/profile/logo', formDataUpload);
            if (res.data.success) {
                updateUser(res.data.data.user);
                showToast('success', 'Logo updated successfully!');
            }
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Logo upload failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!window.L || !user) return;

        const mapContainer = document.getElementById('profile-map');
        if (!mapContainer) return;

        if (!mapRef.current) {
            const mapInstance = window.L.map('profile-map', { zoomControl: false }).setView([user.latitude || 12.9716, user.longitude || 77.5946], 15);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);

            const markerInstance = window.L.marker([user.latitude || 12.9716, user.longitude || 77.5946], { draggable: true }).addTo(mapInstance);

            markerInstance.on('dragend', async (e) => {
                const { lat, lng } = e.target.getLatLng();
                setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));

                // Optional: Auto-geocode on drag
                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    const geoData = await geoRes.json();
                    if (geoData && geoData.display_name) {
                        setFormData(prev => ({ ...prev, address: geoData.display_name }));
                    }
                } catch (err) { console.log('Geocode on drag failed', err); }
            });

            mapRef.current = mapInstance;
            markerRef.current = markerInstance;
        }
    }, [user]);

    const handleUpdateLocation = () => {
        setLoading(true);

        if (!navigator.geolocation) {
            showToast('error', 'Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        let watchId = null;
        let settled = false;
        let bestPosition = null; // Track best position seen so far

        const applyPosition = async (latitude, longitude, accuracy, isAccurate) => {
            // Always move the map to show the user something they can correct
            if (mapRef.current && markerRef.current) {
                mapRef.current.setView([latitude, longitude], isAccurate ? 17 : 13);
                markerRef.current.setLatLng([latitude, longitude]);
            }

            let address = formData.address;
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const geoData = await geoRes.json();
                if (geoData && geoData.display_name) address = geoData.display_name;
            } catch (err) { /* silent */ }

            setFormData(prev => ({ ...prev, latitude, longitude, address }));

            if (isAccurate) {
                showToast('success', `✅ GPS location synced! (±${Math.round(accuracy)}m). Drag pin to fine-tune.`);
            } else {
                // Inaccurate (IP-based) — don't show a scary error, just a friendly prompt to drag the pin
                showToast('success',
                    `📍 Map moved to your general area. Please drag the red pin to your exact restaurant location.`
                );
            }
            setLoading(false);
        };

        const onSuccess = async (position) => {
            if (settled) return;
            const { latitude, longitude, accuracy } = position.coords;

            // Keep track of best reading
            if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
                bestPosition = position;
            }

            // Accept immediately if accuracy is reasonable (phones indoors might be ~1000m at first)
            if (accuracy <= 2000) {
                settled = true;
                if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                await applyPosition(latitude, longitude, accuracy, true);
            }
            // Otherwise keep watching for a better fix
        };

        const onError = () => {
            if (settled) return;
            settled = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            showToast('error', 'Location access denied. Please allow location in browser settings, or use the search bar to find your address.');
            setLoading(false);
        };

        watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 20000
        });

        // After 15s with no accurate fix — use best available (even if IP-based)
        // so the user at least sees the map and can drag the pin to correct it.
        setTimeout(async () => {
            if (!settled) {
                settled = true;
                if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                if (bestPosition) {
                    const { latitude, longitude, accuracy } = bestPosition.coords;
                    await applyPosition(latitude, longitude, accuracy, false);
                } else {
                    showToast('error', 'Could not get your location. Use the search bar above the map to find your restaurant.');
                    setLoading(false);
                }
            }
        }, 15000);
    };

    const handleCsvUpload = async () => {
        if (!csvFile) return showToast('error', 'Please select a file first');
        setLoading(true);

        const uploadData = new FormData();
        uploadData.append('file', csvFile);

        try {
            const res = await api.post('/menu/import', uploadData);
            if (res.data.success) {
                showToast('success', `Import Complete: ${res.data.data.count} items added.`);
                setCsvFile(null);
            }
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    const downloadQRs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/qr/download', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `table_qrs_${user.restaurantName.replace(/\s+/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast('success', 'Full QR Code PDF generated!');
        } catch (err) {
            console.error("QR Generation failed", err);
            showToast('error', 'Failed to generate QR Codes');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadSingleQR = async (tableNum) => {
        setLoading(true);
        try {
            const response = await api.get(`/qr/download/table/${tableNum}`, {
                responseType: 'blob'
            });

            // Success case
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Table_${tableNum}_QR_${user.restaurantName.replace(/\s+/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast('success', `QR Code for Table ${tableNum} ready!`);
        } catch (err) {
            console.error("Single QR Generation failed", err);

            // Try to extract error message from blob if possible
            if (err.response?.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const errorJson = JSON.parse(reader.result);
                        showToast('error', errorJson.message || `Failed to generate Table ${tableNum} QR`);
                    } catch (e) {
                        showToast('error', `Failed to generate Table ${tableNum} QR`);
                    }
                };
                reader.readAsText(err.response.data);
            } else {
                showToast('error', err.response?.data?.message || `Failed to generate Table ${tableNum} QR`);
            }
        } finally {
            setLoading(false);
        }
    };

    const isTableMetadataDirty = JSON.stringify(formData.tableMetadata) !== JSON.stringify(initialTableMeta);

    const handleCancelTableMeta = () => {
        setFormData(prev => ({ ...prev, tableMetadata: initialTableMeta }));
    };

    const handleCancelSingleTable = (num) => {
        setFormData(prev => ({
            ...prev,
            tableMetadata: {
                ...prev.tableMetadata,
                [num]: initialTableMeta[num] || {}
            }
        }));
    };

    const handleDownloadWaitlistQR = () => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            alert("⚠️ WARNING: You are currently accessing ProBloom via 'localhost'. The generated QR code will point to localhost and will NOT work on other devices like phones. \n\nPlease access ProBloom using your computer's local Wi-Fi IP address (e.g. 192.168.x.x:5173) to generate a working QR code.");
            return;
        }

        const joinUrl = `${window.location.origin}/#/join-waitlist/${user._id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(joinUrl)}`;

        const a = document.createElement('a');
        a.href = qrUrl;
        a.download = `Waitlist_QR_${user.restaurantName.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(a);

        // Sometimes direct download of external images fails due to CORS, so we can just open it
        window.open(qrUrl, '_blank');

        a.remove();
        showToast('success', 'Waitlist QR opened. Right-click to save or print.');
    };

    const [backupLoading, setBackupLoading] = useState(false);
    const handleManualBackup = async () => {
        if (!window.confirm('Do you want to create a manual database backup now?')) return;
        setBackupLoading(true);
        try {
            const res = await api.post('/admin/database/export');
            if (res.data.success) {
                showToast('success', `Database backup successful! File: ${res.data.data.fileName}`);
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Backup failed');
        } finally {
            setBackupLoading(false);
        }
    };

    return (
        <div className="profile-container">

            {/* ── TV Monitor Setup Modal ── */}
            {showTVModal && (
                <div className="tv-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowTVModal(false); }}>
                    <div className="tv-modal">
                        <div className="tv-modal-header">
                            <div className="tv-modal-header-text">
                                <h3>📺 TV Display Monitor</h3>
                                <p>Opens a fullscreen queue display for your waiting area TV</p>
                            </div>
                            <button className="tv-modal-close" onClick={() => setShowTVModal(false)}>✕</button>
                        </div>

                        <div className="tv-modal-body">
                            {/* Restaurant preview — auto-filled from DB */}
                            <div className="tv-preview-card">
                                {user?.logo ? (
                                    <img src={user.logo} alt="logo" className="tv-preview-logo" />
                                ) : (
                                    <div className="tv-preview-logo-placeholder">🏨</div>
                                )}
                                <div className="tv-preview-info">
                                    <span className="tv-preview-name">{user?.restaurantName || user?.name}</span>
                                    {user?.address && (
                                        <span className="tv-preview-addr">{user.address}</span>
                                    )}
                                    <span className="tv-preview-badge">✔ Details auto-filled from database</span>
                                </div>
                            </div>

                            <div className="tv-modal-info-row">
                                <span>🖥️</span>
                                <span>The display will show live queue tokens and a QR code for customers to join the waitlist.</span>
                            </div>
                            <div className="tv-modal-info-row">
                                <span>🔓</span>
                                <span>No login required — the monitor URL is public and can be bookmarked on any TV browser.</span>
                            </div>
                            <div className="tv-modal-info-row">
                                <span>📡</span>
                                <span>Updates in real-time via WebSocket. Falls back to polling every 5 seconds automatically.</span>
                            </div>
                        </div>

                        <div className="tv-modal-footer">
                            <button
                                className="tv-launch-btn"
                                onClick={() => {
                                    window.open(`/#/waitlist-monitor/${user._id}`, '_blank');
                                    setShowTVModal(false);
                                }}
                            >
                                🖥️ Launch Display in New Tab
                            </button>
                            <button className="tv-modal-cancel" onClick={() => setShowTVModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Printer Settings Modal ── */}
            <PrinterSettingsModal
                isOpen={showPrinterModal}
                onClose={() => setShowPrinterModal(false)}
                onSaved={(updatedUser) => {
                    updateUser(updatedUser);
                    showToast('success', 'Printer settings saved!');
                }}
            />

            <div className="profile-container">


                <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0, width: '100%' }}>
                    <div className="admin-layout">
                        <div className="admin-sidebar">
                            <button className={`admin-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                                <span className="admin-tab-icon">🏢</span> Company Profile
                            </button>
                            <button className={`admin-tab ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => setActiveTab('pos')}>
                                <span className="admin-tab-icon">⚙️</span> Configuration
                            </button>
                            <button className={`admin-tab ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                                <span className="admin-tab-icon">🔒</span> Security & Billing
                            </button>
                            <button className={`admin-tab ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>
                                <span className="admin-tab-icon">🪑</span> Tables & Regions
                            </button>
                            <button className={`admin-tab ${activeTab === 'printer' ? 'active' : ''}`} onClick={() => setActiveTab('printer')}>
                                <span className="admin-tab-icon">🖨️</span> Printers
                            </button>
                            <button className={`admin-tab ${activeTab === 'online' ? 'active' : ''}`} onClick={() => setActiveTab('online')}>
                                <span className="admin-tab-icon">🌐</span> Online Orders
                            </button>
                            <button className={`admin-tab ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>
                                <span className="admin-tab-icon">💬</span> WhatsApp
                            </button>
                            <button className={`admin-tab ${activeTab === 'stockCategories' ? 'active' : ''}`} onClick={() => setActiveTab('stockCategories')}>
                                <span className="admin-tab-icon">📦</span> Stock Categories
                            </button>
                            <button className={`admin-tab ${activeTab === 'other' ? 'active' : ''}`} onClick={() => setActiveTab('other')}>
                                <span className="admin-tab-icon">🎨</span> App & Layout Settings
                            </button>
                            <button className={`admin-tab ${activeTab === 'stakeholder' ? 'active' : ''}`} onClick={() => setActiveTab('stakeholder')}>
                                <span className="admin-tab-icon">👥</span> Team Management
                            </button>
                        </div>
                        <div className="admin-content">
                            <div className="admin-content-header">
                                <h2>{
                                    activeTab === 'profile' ? 'Company Profile' :
                                        activeTab === 'pos' ? 'Configuration' :
                                            activeTab === 'security' ? 'Security & Billing' :
                                                activeTab === 'tables' ? 'Tables & Regions' :
                                                    activeTab === 'printer' ? 'Printers' :
                                                        activeTab === 'online' ? 'Online Orders' :
                                                            activeTab === 'whatsapp' ? 'WhatsApp' :
                                                                activeTab === 'stockCategories' ? 'Stock Categories' :
                                                                    activeTab === 'other' ? 'App & Layout Settings' :
                                                                        activeTab === 'stakeholder' ? 'Team Management' :
                                                                            activeTab === 'data' ? 'Backup & Data' :
                                                                                activeTab === 'system' ? 'System Settings' : 'Settings'
                                }</h2>
                                <div className="admin-header-actions">
                                    {canEdit && (
                                        <button className="profile-save-btn top-save" onClick={handleSaveProfile} disabled={loading}>
                                            {loading ? 'Saving...' : '💾 Save All Changes'}
                                        </button>
                                    )}
                                    <button className="btn-refresh" onClick={() => window.location.reload()} title="Discard changes and reload">
                                        🔄 Refresh
                                    </button>
                                </div>
                            </div>


                            {/* SECTION: COMPANY PROFILE */}
                            <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
                                <div className="profile-card">
                                    <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '40px' }}>
                                        <div className="profile-image-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                            <div
                                                style={{ width: '180px', height: '180px', background: '#1e293b', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '72px', fontWeight: 'bold', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
                                                onClick={handleLogoClick}
                                                title="Click to upload logo"
                                            >
                                                {user?.logo ? (
                                                    <img src={user.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    formData.name ? formData.name.charAt(0).toUpperCase() : 'M'
                                                )}
                                                {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner"></span></div>}
                                            </div>
                                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Recommended: 400x400px</span>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleLogoUpload}
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                            />
                                        </div>
                                        <div className="profile-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div className="form-field full-width">
                                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Company / Shop Name</label>
                                                <input name="restaurantName" className="form-input" value={formData.restaurantName || ''} onChange={handleInputChange} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                            </div>
                                            <div className="form-group-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                <div className="form-field">
                                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Owner Name</label>
                                                    <input name="name" className="form-input" value={formData.name || ''} onChange={handleInputChange} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                                </div>
                                                <div className="form-field">
                                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Email Address</label>
                                                    <input name="email" type="email" className="form-input" value={formData.email || ''} onChange={handleInputChange} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                                </div>
                                                <div className="form-field">
                                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Phone Number</label>
                                                    <input name="phone" className="form-input" value={formData.phone || ''} onChange={handleInputChange} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                                </div>
                                                <div className="form-field" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                                                    <button type="button" onClick={handleUpdateLocation} disabled={loading} style={{ background: '#10b981', color: '#fff', padding: '12px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '12px', outline: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>
                                                        <span style={{ fontSize: '16px' }}>📍</span>
                                                        {loading ? 'GETTING SIGNAL...' : 'SYNC LOCATION'}
                                                    </button>
                                                </div>
                                                <div className="form-field full-width" style={{ gridColumn: 'span 2' }}>
                                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Full Address</label>
                                                    <input name="address" className="form-input" value={formData.address || ''} onChange={handleInputChange} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: CONFIGURATION */}
                            <div style={{ display: activeTab === 'pos' ? 'block' : 'none' }}>
                                <div className="setting-section-header" style={{ color: '#475569', fontSize: '14px', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>🎨</span> THEME & APPEARANCE
                                </div>
                                <div className="profile-card" style={{ padding: '25px', marginBottom: '40px' }}>
                                    <div className="setting-info" style={{ marginBottom: '15px' }}>
                                        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '15px', fontWeight: '600' }}>Theme Accent Color</h4>
                                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '13px' }}>Choose the primary color for buttons, icons, and highlights across the app.</p>
                                    </div>
                                    <div className="color-palette-container" style={{ display: 'flex', gap: '10px', background: '#e2e8f0', padding: '12px', borderRadius: '14px', width: 'fit-content' }}>
                                        {[
                                            '#C6F53D', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#f59e0b', '#06b6d4', '#1f2937'
                                        ].map(color => (
                                            <div
                                                key={color}
                                                className={`color-swatch ${accentColor === color ? 'active' : ''}`}
                                                style={{ background: color, width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', border: accentColor === color ? '2px solid #fff' : 'none', boxShadow: accentColor === color ? '0 0 0 2px #1e293b' : 'none' }}
                                                onClick={() => updateAccentColor(color)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="setting-section-header" style={{ color: '#475569', fontSize: '14px', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>🌐</span> LANGUAGE SETTINGS
                                </div>
                                <div className="form-group-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
                                    <div className="form-field">
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>App Display Language</label>
                                        <select className="form-input" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }}>
                                            <option value="en">English (default)</option>
                                            <option value="ta">தமிழ் (Tamil)</option>
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Default Print Language</label>
                                        <select className="form-input" value={printLanguage} onChange={(e) => setPrintLanguage(e.target.value)} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }}>
                                            <option value="en">English</option>
                                            <option value="ta">Tamil</option>
                                            <option value="bilingual">Bilingual (Both)</option>
                                        </select>
                                    </div>
                                    <div className="form-field">
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Auto-Show Item Names as</label>
                                        <select className="form-input" value={itemNameLanguage} onChange={(e) => setItemNameLanguage(e.target.value)} style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }}>
                                            <option value="en">Original (English)</option>
                                            <option value="ta">Translated (Tamil)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="setting-section-header" style={{ color: '#475569', fontSize: '14px', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>📄</span> BUSINESS DETAILS
                                </div>
                                <div className="profile-card" style={{ padding: '30px', marginBottom: '40px' }}>
                                    <div className="form-group-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="form-field">
                                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>GST Number</label>
                                            <input name="gstNumber" className="form-input" value={formData.gstNumber || ''} onChange={handleInputChange} placeholder="e.g. 22AAAAA0000A1Z5" style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                        </div>
                                        <div className="form-field">
                                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>DL Number (Pharmacy)</label>
                                            <input name="dlNumber" className="form-input" value={formData.dlNumber || ''} onChange={handleInputChange} placeholder="e.g. TN-05-20-..." style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                        </div>
                                        <div className="form-field">
                                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>TIN Number</label>
                                            <input name="tinNumber" className="form-input" value={formData.tinNumber || ''} onChange={handleInputChange} placeholder="TIN Number" style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                        </div>
                                        <div className="form-field">
                                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>CIN Number</label>
                                            <input name="cinNumber" className="form-input" value={formData.cinNumber || ''} onChange={handleInputChange} placeholder="CIN Number" style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: SECURITY & BILLING */}
                            <div style={{ display: activeTab === 'security' ? 'block' : 'none' }}>
                                <div style={{ width: '100%' }}>
                                    <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div className="form-field full-width">
                                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Current Password</label>
                                            <input type="password" minLength="6" className="form-input" placeholder="••••••••" value={changePasswordData.oldPassword || ''} onChange={e => setChangePasswordData({ ...changePasswordData, oldPassword: e.target.value })} required style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                        </div>
                                        <div className="form-group-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <div className="form-field">
                                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>New Password</label>
                                                <input type="password" minLength="6" className="form-input" placeholder="••••••••" value={changePasswordData.newPassword || ''} onChange={e => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })} required style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                            </div>
                                            <div className="form-field">
                                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>Confirm New Password</label>
                                                <input type="password" minLength="6" className="form-input" placeholder="••••••••" value={changePasswordData.confirmPassword || ''} onChange={e => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })} required style={{ width: '100%', background: '#e2e8f0', border: 'none', padding: '14px 16px', borderRadius: '10px' }} />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={passwordLoading} style={{ width: '100%', background: '#0f172a', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' }}>
                                            {passwordLoading ? 'Updating...' : '🔒 Update Password'}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* SECTION: BILLING SETTINGS */}
                            <div className="profile-card" style={{ display: activeTab === 'security' ? 'block' : 'none', marginTop: '20px' }}>
                                <h2 className="card-title">🧾 Billing Preferences</h2>
                                <div className="profile-card-content">
                                    <div className="form-group-grid">
                                        <div className="form-field toggle-field" style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '15px', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.requireKotBeforeBilling !== false}
                                                    onChange={e => setFormData(prev => ({ ...prev, requireKotBeforeBilling: e.target.checked }))}
                                                    style={{ display: 'none' }}
                                                />
                                                <div style={{
                                                    width: '44px', minWidth: '44px', height: '24px',
                                                    background: formData.requireKotBeforeBilling !== false ? 'var(--primary, #0f172a)' : '#cbd5e1',
                                                    borderRadius: '24px', display: 'flex', alignItems: 'center',
                                                    padding: '2px', cursor: 'pointer', transition: 'background 0.3s ease',
                                                    marginTop: '2px'
                                                }}>
                                                    <div style={{
                                                        width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                                                        transform: formData.requireKotBeforeBilling !== false ? 'translateX(20px)' : 'translateX(0)',
                                                        transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                    }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>Enable KOT Before Billing</span>
                                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                                                        If turned OFF, the POS will skip the "Review / Send KOT" confirmation step entirely. Orders will not print kitchen slips or notify KDS displays. The cart action will jump directly to completing the settlement (Fast Retail / Direct Billing).
                                                    </span>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="form-field toggle-field" style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '15px', background: 'var(--bg-hover)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.defaultPrintWithGst !== false}
                                                    onChange={e => setFormData(prev => ({ ...prev, defaultPrintWithGst: e.target.checked }))}
                                                    style={{ display: 'none' }}
                                                />
                                                <div style={{
                                                    width: '44px', minWidth: '44px', height: '24px',
                                                    background: formData.defaultPrintWithGst !== false ? 'var(--primary, #0f172a)' : '#cbd5e1',
                                                    borderRadius: '24px', display: 'flex', alignItems: 'center',
                                                    padding: '2px', cursor: 'pointer', transition: 'background 0.3s ease',
                                                    marginTop: '2px'
                                                }}>
                                                    <div style={{
                                                        width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                                                        transform: formData.defaultPrintWithGst !== false ? 'translateX(20px)' : 'translateX(0)',
                                                        transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                                    }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '15px' }}>Default POS Billing to GST</span>
                                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                                                        Automatically print GST taxes when fast-settling the cart on the POS checkout screen. Turn OFF to default to non-taxed billing for rapid takeaway cash transactions.
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: TABLE CONFIGURATION */}
                            <div className="profile-card" style={{ display: activeTab === 'tables' ? 'block' : 'none' }}>
                                <h2 className="card-title">🪑 Table Configurations</h2>
                                {activeTab === 'tables' && (
                                    <div className="profile-card-content">
                                        <div className="form-group-grid">
                                            <div className="form-field">
                                                <label>Total Number of Tables</label>
                                                <input name="totalTables" type="number" className="form-input" value={formData.totalTables} onChange={handleInputChange} min="1" max="100" />
                                            </div>
                                            <div className="form-field">
                                                <label>AC Tables (e.g. 1, 3, 5)</label>
                                                <input name="acTables" type="text" className="form-input" value={formData.acTables} onChange={handleInputChange} placeholder="Comma separated tables" />
                                            </div>
                                            <div className="form-field">
                                                <label>AC Markup Percentage (%)</label>
                                                <input name="acChargePercentage" type="number" className="form-input" value={formData.acChargePercentage} onChange={handleInputChange} min="0" max="100" />
                                            </div>

                                            <div className="form-field full-width">
                                                <label>Table Categories (e.g. Ground Floor, First Floor, Side Garden)</label>
                                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Add new category..."
                                                        id="new-category-input"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const val = e.target.value.trim();
                                                                if (val && !formData.tableCategories.includes(val)) {
                                                                    setFormData(prev => ({ ...prev, tableCategories: [...prev.tableCategories, val] }));
                                                                    e.target.value = '';
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        className="btn-save-inline"
                                                        style={{ height: 'fit-content' }}
                                                        onClick={() => {
                                                            const input = document.getElementById('new-category-input');
                                                            const val = input.value.trim();
                                                            if (val && !formData.tableCategories.includes(val)) {
                                                                setFormData(prev => ({ ...prev, tableCategories: [...prev.tableCategories, val] }));
                                                                input.value = '';
                                                            }
                                                        }}
                                                    >+ Add</button>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {formData.tableCategories?.map(cat => (
                                                        <div key={cat} className="category-pill" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {cat}
                                                            <span
                                                                style={{ cursor: 'pointer', color: 'var(--danger)', fontWeight: 'bold' }}
                                                                onClick={() => setFormData(prev => ({ ...prev, tableCategories: prev.tableCategories.filter(c => c !== cat) }))}
                                                            >×</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Table Configuration Section */}
                                            <div className="form-field full-width" style={{ marginTop: '20px' }}>
                                                <h4 style={{ marginBottom: '10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>🪑 Table Details (Seats & Location)</span>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn-save-inline" onClick={downloadQRs} disabled={loading} title="Download a PDF containing QR codes for all tables">
                                                            📥 Download All QRs (PDF)
                                                        </button>
                                                        {isTableMetadataDirty && (
                                                            <>
                                                                <button className="btn-save-inline" onClick={handleSaveProfile} disabled={loading}>
                                                                    {loading ? 'Saving...' : '💾 Save All Tables'}
                                                                </button>
                                                                <button className="btn-save-inline" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} onClick={handleCancelTableMeta} disabled={loading}>
                                                                    ✖ Cancel
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </h4>
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                                                    Configure specific details for each table to help staff with seating.
                                                </p>
                                                <div className="table-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                                                    {Array.from({ length: formData.totalTables || 0 }, (_, i) => i + 1).map(num => {
                                                        const isSingleTableDirty = JSON.stringify(formData.tableMetadata[num] || {}) !== JSON.stringify(initialTableMeta[num] || {});

                                                        return (
                                                            <div key={num} className={`table-meta-card ${isSingleTableDirty ? 'dirty' : ''}`} style={{ padding: '12px', border: isSingleTableDirty ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: '8px', background: isSingleTableDirty ? 'var(--bg-card)' : 'var(--bg-hover)', transition: 'all 0.3s' }}>
                                                                <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span>Table {num}</span>
                                                                        {isSingleTableDirty && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 'bold' }}>UNSAVED</span>}
                                                                    </div>
                                                                    <button
                                                                        className="btn-save-inline"
                                                                        style={{ padding: '2px 6px', fontSize: '10px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                                                                        onClick={() => handleDownloadSingleQR(num)}
                                                                        disabled={loading}
                                                                        title="Download QR for this table"
                                                                    >
                                                                        📥 QR
                                                                    </button>
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                                                                    <div>
                                                                        <label style={{ fontSize: '11px', display: 'block' }}>Seats</label>
                                                                        <input
                                                                            type="number"
                                                                            className="form-input small"
                                                                            value={formData.tableMetadata[num]?.seats || ''}
                                                                            onChange={(e) => handleTableMetaChange(num, 'seats', e.target.value)}
                                                                            placeholder="e.g. 4"
                                                                            style={{ padding: '4px 8px' }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '11px', display: 'block' }}>Location / Category</label>
                                                                        <select
                                                                            className="form-input small"
                                                                            value={formData.tableMetadata[num]?.location || ''}
                                                                            onChange={(e) => handleTableMetaChange(num, 'location', e.target.value)}
                                                                            style={{ padding: '4px 8px' }}
                                                                        >
                                                                            <option value="">Uncategorized</option>
                                                                            {formData.tableCategories.map(cat => (
                                                                                <option key={cat} value={cat}>{cat}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                {isSingleTableDirty && (
                                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                                                                        <button className="btn-save-inline" style={{ flex: 1, padding: '4px 8px', fontSize: '11px' }} onClick={handleSaveProfile} disabled={loading}>
                                                                            Save Changes
                                                                        </button>
                                                                        <button className="btn-cancel-inline" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleCancelSingleTable(num)} disabled={loading} title="Undo changes for this table">
                                                                            ✖
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <button className="profile-save-btn" onClick={handleSaveProfile} disabled={loading} style={{ marginTop: '20px' }}>
                                            {loading ? 'Saving Changes...' : '💾 Save Table Configurations'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* SECTION: PRINTER CONFIGURATION */}
                            <div className="profile-card" style={{ display: activeTab === 'printer' ? 'block' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                                    <h2 className="card-title" style={{ margin: 0 }}>🖨️ Printer Settings</h2>
                                    <button
                                        onClick={() => setShowPrinterModal(true)}
                                        style={{
                                            background: 'linear-gradient(135deg, #c6f53d, #a8e63a)',
                                            border: 'none',
                                            color: '#0a0a0a',
                                            borderRadius: '10px',
                                            padding: '10px 20px',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 14px rgba(198,245,61,0.3)',
                                        }}
                                    >
                                        🔌 Configure Printer Connection
                                    </button>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', padding: '10px 14px', background: 'rgba(198,245,61,0.05)', borderRadius: '8px', border: '1px solid rgba(198,245,61,0.15)' }}>
                                    💡 <strong>iMin D1 users:</strong> Click "Configure Printer Connection" above → select <strong>Built-in (iMin)</strong> to use the tablet's built-in thermal printer. Also supports Network IP, USB, Bluetooth, and Default OS printer.
                                </p>
                                {activeTab === 'printer' && (
                                    <div className="profile-card-content">
                                        <div className="settings-list">
                                            <div className="setting-row" style={{ alignItems: 'flex-start' }}>
                                                <div className="setting-info" style={{ flex: 1 }}>
                                                    <h4>Cash Counter Printer</h4>
                                                    <p>Enable primary bill printing at the counter</p>
                                                    {formData.billPrinterEnabled && (
                                                        <div style={{ marginTop: '12px' }}>
                                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Counter Printer IP (Optional)</label>
                                                            <input name="counterPrinterIp" type="text" className="form-input" placeholder="e.g. 192.168.1.50" value={formData.counterPrinterIp} onChange={handleInputChange} style={{ marginTop: '5px', padding: '8px' }} />
                                                            <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px' }}>Enter LAN IP for silent network printing. Leave blank for browser print dialog.</small>
                                                        </div>
                                                    )}
                                                </div>
                                                <label className="switch" style={{ marginTop: '5px' }}>
                                                    <input type="checkbox" name="billPrinterEnabled" checked={formData.billPrinterEnabled} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row" style={{ alignItems: 'flex-start' }}>
                                                <div className="setting-info" style={{ flex: 1 }}>
                                                    <h4>Kitchen Printer</h4>
                                                    <p>Send KOTs directly to the kitchen printer</p>
                                                    {formData.kotPrinterEnabled && (
                                                        <div style={{ marginTop: '12px' }}>
                                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Kitchen Printer IP (Optional)</label>
                                                            <input name="kitchenPrinterIp" type="text" className="form-input" placeholder="e.g. 192.168.1.51" value={formData.kitchenPrinterIp} onChange={handleInputChange} style={{ marginTop: '5px', padding: '8px' }} />
                                                            <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px' }}>Enter LAN IP for automatic silent KOT printing.</small>
                                                        </div>
                                                    )}
                                                </div>
                                                <label className="switch" style={{ marginTop: '5px' }}>
                                                    <input type="checkbox" name="kotPrinterEnabled" checked={formData.kotPrinterEnabled} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Auto Print</h4>
                                                    <p>Automatically print bill when order is settled</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="autoPrintEnabled" checked={formData.autoPrintEnabled} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Item wise KOT</h4>
                                                    <p>Print separate ticket for each item in the order</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="itemWiseKOT" checked={formData.itemWiseKOT} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Print Category in Bill</h4>
                                                    <p>Include the item category name column in the 3-inch thermal bill</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="printCategoryInBill" checked={formData.printCategoryInBill} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="form-group-grid" style={{ marginTop: '15px' }}>
                                                <div className="form-field full-width" style={{ gridColumn: '1 / -1', marginBottom: '10px' }}>
                                                    <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>Basic Printing Bill Type Template</label>
                                                    <select
                                                        className="form-input"
                                                        name="basicBillTemplate"
                                                        value={formData.basicBillTemplate}
                                                        onChange={handleInputChange}
                                                    >
                                                        <option value="standard">Standard 3 inch bill</option>
                                                        <option value="2inch">2-Inch thermal bill</option>
                                                        <option value="pharmacy">Pharmacy</option>
                                                        <option value="gst">GST bill</option>
                                                    </select>
                                                </div>
                                                <div className="form-field">
                                                    <label>Minimum Price to Print</label>
                                                    <input name="minPrintPrice" type="number" className="form-input" value={formData.minPrintPrice} onChange={handleInputChange} />
                                                </div>
                                                <div className="form-field">
                                                    <label>Print Copies Count</label>
                                                    <input name="printCount" type="number" className="form-input" value={formData.printCount} onChange={handleInputChange} min="1" />
                                                </div>
                                                <div className="form-field">
                                                    <label>Pharmacy Bill Item Font Size (px)</label>
                                                    <input name="pharmacyFontSize" type="number" className="form-input" value={formData.pharmacyFontSize} onChange={handleInputChange} min="6" max="14" />
                                                </div>
                                            </div>

                                            <div className="setting-row sub-options">
                                                <div className="setting-info">
                                                    <label className="checkbox-container">
                                                        <input type="checkbox" name="largeFontKOT" checked={formData.largeFontKOT} onChange={handleInputChange} />
                                                        <span className="checkmark"></span>
                                                        Large Font KOT
                                                    </label>
                                                </div>
                                                <div className="setting-info">
                                                    <label className="checkbox-container">
                                                        <input type="checkbox" name="consolidatedReceipt" checked={formData.consolidatedReceipt} onChange={handleInputChange} />
                                                        <span className="checkmark"></span>
                                                        Consolidated Receipt
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="profile-save-btn" onClick={handleSaveProfile} disabled={loading}>
                                            {loading ? 'Saving Changes...' : '💾 Save Printer Settings'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* SECTION: APP BEHAVIOR SETTINGS */}
                            <div className="profile-card" style={{ display: activeTab === 'other' ? 'block' : 'none' }}>
                                <h2 className="card-title">⚙️ App & Layout Settings</h2>
                                {activeTab === 'other' && (
                                    <div className="profile-card-content">
                                        <div className="settings-list">
                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Dark Mode</h4>
                                                    <p>Toggle between light and dark theme</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Quick Mode</h4>
                                                    <p>Bypass intermediate payment confirms for faster checkout</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="quickMode" checked={formData.quickMode} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Manual Quantity</h4>
                                                    <p>Allow typing quantity directly instead of +/- buttons</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="manualQuantity" checked={formData.manualQuantity} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="form-group-grid" style={{ marginTop: '15px' }}>
                                                <div className="form-field">
                                                    <label>Preferred POS interface</label>
                                                    <select name="preferredPosMode" className="form-input" value={formData.preferredPosMode || 'restaurant'} onChange={handleInputChange}>
                                                        <option value="restaurant">Restaurant POS</option>
                                                        <option value="supermarket">Supermarket POS</option>
                                                        <option value="clothing">Clothing POS</option>
                                                        <option value="poultry">Poultry Shop POS</option>
                                                    </select>
                                                </div>
                                                <div className="form-field">
                                                    <label>Choose Menu Layout</label>
                                                    <select name="menuLayout" className="form-input" value={formData.menuLayout} onChange={handleInputChange}>
                                                        <option value="Side Menu">Side Menu (Default)</option>
                                                        <option value="Top Menu">Top Navigation</option>
                                                        <option value="Grid">Full Grid View</option>
                                                    </select>
                                                </div>
                                                <div className="form-field">
                                                    <label>Menu Item Columns</label>
                                                    <input name="menuItemColumnCount" type="number" className="form-input" value={formData.menuItemColumnCount} onChange={handleInputChange} min="1" max="8" />
                                                </div>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Low Stock Alert</h4>
                                                    <p>Show notifications when inventory items are low</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="lowStockAlert" checked={formData.lowStockAlert} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Allow No-Stock Sale</h4>
                                                    <p>Permit billing even if item stock is zero or negative</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="allowNoStockSale" checked={formData.allowNoStockSale} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Track Customer Details</h4>
                                                    <p>Prompt for customer name/phone during checkout</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="trackCustomerDetail" checked={formData.trackCustomerDetail} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Customer Points Calculation Page</h4>
                                                    <p>Enable the customer management & points page in the sidebar</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="enableCustomerPointsPage" checked={formData.enableCustomerPointsPage} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>📺 Waiting Queue Display (TV Monitor)</h4>
                                                    <p>Launch the waitlist queue display for your TV or monitor</p>
                                                </div>
                                                <button className="btn-save-inline" onClick={() => setShowTVModal(true)} style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}>
                                                    Open Display
                                                </button>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>📱 Waiting Queue QR Code</h4>
                                                    <p>Download the QR code for customers to join the waiting queue</p>
                                                </div>
                                                <button className="btn-save-inline" onClick={handleDownloadWaitlistQR} style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                                                    Download QR
                                                </button>
                                            </div>
                                        </div>
                                        <button className="profile-save-btn" onClick={handleSaveProfile} disabled={loading}>
                                            {loading ? 'Saving Changes...' : '💾 Save App Settings'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* SECTION: STOCK CATEGORIES CONFIGURATION */}
                            <div className="profile-card" style={{ display: activeTab === 'stockCategories' ? 'block' : 'none' }}>
                                <h2 className="card-title">📦 Stock Categories Manager</h2>
                                {activeTab === 'stockCategories' && (
                                    <div className="profile-card-content">
                                        <section className="profile-section">
                                            <div className="setting-section-header">Manage Stock Categories</div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
                                                Create, rename, or delete stock categories. Renaming a category automatically updates all associated inventory items. Deleting a category moves its items back to <strong>General</strong>.
                                            </p>

                                            {/* ADD NEW CATEGORY */}
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                                <input
                                                    id="stock-categories-add-input"
                                                    type="text"
                                                    className="form-input"
                                                    placeholder="Enter new category name..."
                                                    style={{ flex: 1 }}
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddCategorySubmit();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-accent"
                                                    style={{ padding: '0 20px', background: 'var(--inv-primary, #C6F53D)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    onClick={handleAddCategorySubmit}
                                                >
                                                    ➕ Add
                                                </button>
                                            </div>

                                            {/* CATEGORIES LIST TABLE */}
                                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                            <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)' }}>Category Name</th>
                                                            <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', width: '180px' }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(formData.stockCategories || 'General,Grocery,Clothing,Pharmacy,Others')
                                                            .split(',')
                                                            .map(c => c.trim())
                                                            .filter(Boolean)
                                                            .map(cat => {
                                                                const isEditingThis = editingCategoryName === cat;
                                                                return (
                                                                    <tr key={cat} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                                        <td style={{ padding: '12px 16px' }}>
                                                                            {isEditingThis ? (
                                                                                <input
                                                                                    type="text"
                                                                                    className="form-input"
                                                                                    defaultValue={cat}
                                                                                    id={`edit-cat-input-${cat}`}
                                                                                    style={{ height: '32px', fontSize: '13px', width: '100%', padding: '0 8px' }}
                                                                                    onKeyDown={async (e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            e.preventDefault();
                                                                                            const inputVal = document.getElementById(`edit-cat-input-${cat}`).value.trim();
                                                                                            handleRenameCategorySubmit(cat, inputVal);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            ) : (
                                                                                <strong style={{ color: 'var(--text-primary)' }}>{cat}</strong>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                                {isEditingThis ? (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            style={{ background: 'var(--inv-primary, #C6F53D)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                                                                                            onClick={() => {
                                                                                                const inputVal = document.getElementById(`edit-cat-input-${cat}`).value.trim();
                                                                                                handleRenameCategorySubmit(cat, inputVal);
                                                                                            }}
                                                                                        >
                                                                                            Save
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
                                                                                            onClick={() => setEditingCategoryName(null)}
                                                                                        >
                                                                                            Cancel
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <button
                                                                                            type="button"
                                                                                            style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
                                                                                            onClick={() => setEditingCategoryName(cat)}
                                                                                        >
                                                                                            ✏️ Rename
                                                                                        </button>
                                                                                        {cat.toLowerCase() !== 'general' && (
                                                                                            <button
                                                                                                type="button"
                                                                                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
                                                                                                onClick={() => handleDeleteCategorySubmit(cat)}
                                                                                            >
                                                                                                🗑️ Delete
                                                                                            </button>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        }
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    </div>
                                )}
                            </div>

                            {/* SECTION: STAKEHOLDER MANAGEMENT (OWNER ONLY) */}
                            {user.role === 'owner' && (
                                <div className="profile-card" style={{ display: activeTab === 'stakeholder' ? 'block' : 'none' }}>
                                    <h2 className="card-title">🤝 Stakeholder / Partner Management</h2>
                                    {activeTab === 'stakeholder' && (
                                        <div className="profile-card-content">
                                            <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border)' }}>
                                                <h4 style={{ marginBottom: '10px' }}>Invite New Investor/Partner</h4>
                                                <form className="form-group-grid" onSubmit={handleInviteStakeholder}>
                                                    {/* Share allocation bar */}
                                                    {(() => {
                                                        const usedShare = (stakeholders || []).reduce((sum, s) => sum + (s.sharePercentage || 0), 0);
                                                        const remainingShare = 100 - usedShare;
                                                        const pendingShare = stakeholderForm.sharePercentage;
                                                        const projectedUsed = usedShare + pendingShare;
                                                        const isOver = projectedUsed > 100;
                                                        return (
                                                            <div className="form-field full-width" style={{ marginBottom: '4px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>Share Allocation</span>
                                                                    <span style={{ color: isOver ? '#ef4444' : remainingShare === 0 ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>
                                                                        {isOver ? `⚠️ Over by ${(projectedUsed - 100).toFixed(1)}%` : `${remainingShare.toFixed(1)}% remaining`}
                                                                    </span>
                                                                </div>
                                                                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-hover)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                                    <div style={{ height: '100%', width: `${Math.min(usedShare, 100)}%`, background: '#3b82f6', borderRadius: '4px 0 0 4px', transition: 'width 0.3s' }} />
                                                                    <div style={{ height: '100%', marginTop: '-8px', marginLeft: `${Math.min(usedShare, 100)}%`, width: `${Math.min(pendingShare, remainingShare)}%`, background: isOver ? '#ef4444' : '#10b981', opacity: 0.7, transition: 'width 0.3s' }} />
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                                    <span>🔵 Assigned: {usedShare.toFixed(1)}%</span>
                                                                    <span style={{ color: isOver ? '#ef4444' : '#10b981' }}>🟢 This invite: {pendingShare}%</span>
                                                                    <span>⬜ Owner retains: {Math.max(0, 100 - Math.min(projectedUsed, 100)).toFixed(1)}%</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="form-field">
                                                        <label>Partner Name</label>
                                                        <input required className="form-input" value={stakeholderForm.name} onChange={e => setStakeholderForm({ ...stakeholderForm, name: e.target.value })} />
                                                    </div>
                                                    <div className="form-field">
                                                        <label>Phone Number</label>
                                                        <input required type="tel" className="form-input" value={stakeholderForm.phone} onChange={e => setStakeholderForm({ ...stakeholderForm, phone: e.target.value })} placeholder="+91..." />
                                                    </div>
                                                    <div className="form-field">
                                                        <label>Partner Password</label>
                                                        <input required type="text" className="form-input" value={stakeholderForm.password} onChange={e => setStakeholderForm({ ...stakeholderForm, password: e.target.value })} placeholder="temp password" />
                                                    </div>
                                                    <div className="form-field">
                                                        {(() => {
                                                            const usedShare = (stakeholders || []).reduce((sum, s) => sum + (s.sharePercentage || 0), 0);
                                                            const remainingShare = Math.max(0, 100 - usedShare);
                                                            const isOver = stakeholderForm.sharePercentage > remainingShare;
                                                            return (
                                                                <>
                                                                    <label>Share % <span style={{ fontSize: '11px', color: isOver ? '#ef4444' : 'var(--text-secondary)', fontWeight: 'normal' }}>(max {remainingShare.toFixed(1)}% available)</span></label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max={remainingShare}
                                                                        className="form-input"
                                                                        value={stakeholderForm.sharePercentage}
                                                                        onChange={e => setStakeholderForm({ ...stakeholderForm, sharePercentage: Number(e.target.value) })}
                                                                        style={{ borderColor: isOver ? '#ef4444' : undefined }}
                                                                    />
                                                                    {isOver && <small style={{ color: '#ef4444', fontSize: '11px' }}>⚠️ Exceeds available share</small>}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="form-field full-width">
                                                        {(() => {
                                                            const usedShare = (stakeholders || []).reduce((sum, s) => sum + (s.sharePercentage || 0), 0);
                                                            const remainingShare = Math.max(0, 100 - usedShare);
                                                            const isOver = stakeholderForm.sharePercentage > remainingShare || stakeholderForm.sharePercentage <= 0;
                                                            return (
                                                                <button type="submit" className="btn-save-inline" disabled={loading || isOver} style={{ width: '100%', opacity: isOver ? 0.5 : 1 }}>
                                                                    {loading ? 'Inviting...' : '➕ Send Invite & Assign Share'}
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>
                                                </form>
                                            </div>

                                            <div>
                                                <h4 style={{ marginBottom: '10px' }}>Current Stakeholders</h4>
                                                {loadingStakeholders ? (
                                                    <p>Loading...</p>
                                                ) : (stakeholders || []).length === 0 ? (
                                                    <p style={{ color: 'var(--text-secondary)' }}>No stakeholders assigned yet.</p>
                                                ) : (
                                                    <div style={{ display: 'grid', gap: '10px' }}>
                                                        {(stakeholders || []).map(s => (
                                                            <div key={s.stakeholderId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-hover)' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: 'bold' }}>{s.name || 'Unknown'}</div>
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.phone || '—'} • {s.sharePercentage || 0}% Share</div>
                                                                </div>
                                                                <button
                                                                    className="btn-cancel-inline"
                                                                    onClick={() => s.stakeholderId && handleRemoveStakeholder(s.stakeholderId)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION: ONLINE ORDER SETTINGS */}
                            <div className="profile-card" style={{ display: activeTab === 'online' ? 'block' : 'none' }}>
                                <h2 className="card-title">🌐 Online Order Settings</h2>
                                {activeTab === 'online' && (
                                    <div className="profile-card-content">
                                        <div className="settings-list">
                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Auto Accept</h4>
                                                    <p>Automatically accept incoming online orders</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="onlineAutoAccept" checked={formData.onlineAutoAccept} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Auto Print</h4>
                                                    <p>Print KOT/Bill immediately upon auto-acceptance</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="onlineAutoPrint" checked={formData.onlineAutoPrint} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Print Cash Counter</h4>
                                                    <p>Print a copy at the main billing counter</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="onlinePrintCounter" checked={formData.onlinePrintCounter} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Print Kitchen</h4>
                                                    <p>Send order directly to the kitchen (KOT)</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="onlinePrintKitchen" checked={formData.onlinePrintKitchen} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Online Orders Notification</h4>
                                                    <p>Play sound alert for new online orders</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="onlineNotification" checked={formData.onlineNotification} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="setting-row">
                                                <div className="setting-info">
                                                    <h4>Out of Stock Selection</h4>
                                                    <p>Allow time-based activation for out-of-stock items</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="onlineStockActivateTime" checked={formData.onlineStockActivateTime} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            {/* Customer Order Flow Toggle */}
                                            <div className="setting-row" style={{ background: 'var(--surface-2, rgba(255,255,255,0.04))', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                                                <div className="setting-info">
                                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        🧑‍🍳 Customer Order Flow
                                                    </h4>
                                                    <p style={{ marginBottom: '8px' }}>
                                                        {formData.customerOrderMode
                                                            ? '🔔 Waiter Acknowledgement — Customer orders wait for waiter to accept before going to kitchen'
                                                            : '⚡ Direct KOT — Customer orders go straight to kitchen immediately (default)'}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', marginTop: '4px' }}>
                                                        <span style={{ padding: '3px 10px', borderRadius: '20px', background: !formData.customerOrderMode ? 'var(--brand, #C6F53D)' : 'rgba(255,255,255,0.08)', color: !formData.customerOrderMode ? '#000' : 'rgba(255,255,255,0.5)', fontWeight: !formData.customerOrderMode ? 700 : 400 }}>⚡ Direct KOT</span>
                                                        <span style={{ padding: '3px 10px', borderRadius: '20px', background: formData.customerOrderMode ? 'var(--brand, #C6F53D)' : 'rgba(255,255,255,0.08)', color: formData.customerOrderMode ? '#000' : 'rgba(255,255,255,0.5)', fontWeight: formData.customerOrderMode ? 700 : 400 }}>🔔 Waiter Ack</span>
                                                    </div>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="customerOrderMode" checked={formData.customerOrderMode} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                        </div>
                                        <button className="profile-save-btn" onClick={handleSaveProfile} disabled={loading}>
                                            {loading ? 'Saving Changes...' : '💾 Save Online Settings'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* SECTION: WHATSAPP SETTINGS */}
                            <div className="profile-card" style={{ display: activeTab === 'whatsapp' ? 'block' : 'none' }}>
                                <h2 className="card-title">💬 WhatsApp Settings</h2>
                                {activeTab === 'whatsapp' && (
                                    <div className="profile-card-content">
                                        <div className="settings-list">
                                            <div className="form-group-grid">
                                                <div className="form-field">
                                                    <label>Country Code</label>
                                                    <input name="whatsappCountryCode" className="form-input" value={formData.whatsappCountryCode} onChange={handleInputChange} placeholder="+91" />
                                                </div>
                                            </div>

                                            <div className="setting-row" style={{ marginTop: '15px' }}>
                                                <div className="setting-info">
                                                    <h4>Detailed Bill</h4>
                                                    <p>Send itemized breakdown in WhatsApp messages</p>
                                                </div>
                                                <label className="switch">
                                                    <input type="checkbox" name="whatsappDetailedBill" checked={formData.whatsappDetailedBill} onChange={handleInputChange} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                        </div>
                                        <button className="profile-save-btn" onClick={handleSaveProfile} disabled={loading}>
                                            {loading ? 'Saving Changes...' : '💾 Save WhatsApp Settings'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* BULK MANAGEMENT -> DATA TAB */}
                            <div style={{ display: activeTab === 'data' ? 'block' : 'none' }}>
                                {['owner', 'manager'].includes(user.role) && (
                                    <div className="profile-card" style={{ marginTop: '25px' }}>
                                        <h3 className="card-title">📁 Menu Bulk Management</h3>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                            Upload a CSV or Excel file to quickly populate your menu items.
                                        </p>

                                        <label className="import-box">
                                            <input
                                                type="file"
                                                className="file-input-hidden"
                                                accept=".csv, .xlsx, .xls"
                                                onChange={(e) => setCsvFile(e.target.files[0])}
                                            />
                                            <div className="import-icon">📦</div>
                                            <h4>{csvFile ? csvFile.name : 'Click to Upload Menu File'}</h4>
                                            <p>Supports CSV, XLSX, and XLS formats</p>
                                        </label>

                                        {csvFile && (
                                            <button className="profile-save-btn" onClick={handleCsvUpload} disabled={loading} style={{ marginTop: '20px' }}>
                                                {loading ? 'Processing File...' : '🚀 Start Bulk Import'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* DATABASE & BACKUPS -> DATA TAB */}
                                {user.role === 'owner' && (
                                    <div className="profile-card" style={{ marginTop: '25px', border: '1px solid var(--accent)', background: 'rgba(var(--accent-rgb), 0.05)' }}>
                                        <h3 className="card-title">💾 Database & Backups</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                                            Your system performs an automatic backup every day at 1:00 AM. You can also trigger a manual backup anytime.
                                        </p>
                                        <button
                                            className="profile-save-btn"
                                            style={{ width: '100%' }}
                                            onClick={handleManualBackup}
                                            disabled={backupLoading}
                                        >
                                            {backupLoading ? '⚙️ Creating Backup...' : '📦 Create Backup Now'}
                                        </button>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', textAlign: 'center', marginBottom: '15px' }}>
                                            Backups are stored in the <code>database_dump/</code> folder.
                                        </p>

                                        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed var(--border-color)' }}>
                                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                                ☁️ Cloud Sync Directory Path
                                            </label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    name="cloudBackupPath"
                                                    value={formData.cloudBackupPath || ''}
                                                    onChange={handleInputChange}
                                                    placeholder="e.g. C:\Users\Username\OneDrive\Backups"
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border-color)',
                                                        background: 'var(--bg-primary)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '13px'
                                                    }}
                                                />
                                                <button
                                                    className="profile-save-btn"
                                                    style={{ width: 'auto', padding: '0 15px', whiteSpace: 'nowrap', margin: 0 }}
                                                    onClick={handleSaveProfile}
                                                    disabled={loading}
                                                >
                                                    Save Path
                                                </button>
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
                                                Provide a local path synchronized to a cloud service (OneDrive, Google Drive, Dropbox, etc.). Newly generated backups will automatically copy here.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ATTENDANCE GUARD & SUPPORT TIP -> SYSTEM TAB */}
                            <div style={{ display: activeTab === 'system' ? 'block' : 'none' }}>
                                {user.role === 'owner' && (
                                    <div className="profile-card">
                                        <h3 className="card-title">📍 Attendance Guard</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                                            Configure geofencing to ensure staff clock in only when they are on-site.
                                        </p>

                                        <div className="location-status-card">
                                            <div className="status-indicator">
                                                <div className={`dot ${user.latitude ? 'active' : 'inactive'}`}></div>
                                                <span>Restaurant PIN: {user.latitude ? 'SET' : 'MISSING'}</span>
                                            </div>
                                            {user.latitude && (
                                                <div className="location-coord-row">
                                                    <span>{user.latitude?.toFixed(4)}° N</span>
                                                    <span>{user.longitude?.toFixed(4)}° E</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="form-field" style={{ marginBottom: '15px' }}>
                                            <label>Geofence Radius (meters)</label>
                                            <input
                                                name="geofenceRadius"
                                                type="number"
                                                className="form-input"
                                                value={formData.geofenceRadius}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="location-coord-row">
                                            <span>Latitude</span>
                                            <span>{formData.latitude?.toFixed(6) || 'N/A'}</span>
                                        </div>
                                        <div className="location-coord-row">
                                            <span>Longitude</span>
                                            <span>{formData.longitude?.toFixed(6) || 'N/A'}</span>
                                        </div>

                                        <span className="map-tip">📍 Drag the pin to your exact restaurant entrance</span>

                                        <div className="map-search-container">
                                            <input
                                                type="text"
                                                className="map-search-input"
                                                placeholder="🔍 Search for your restaurant or street..."
                                                value={searchQuery}
                                                onChange={handleSearch}
                                            />
                                            {searchResults.length > 0 && (
                                                <div className="map-search-results">
                                                    {searchResults.map((res, i) => (
                                                        <div key={i} className="search-result-item" onClick={() => selectSearchResult(res)}>
                                                            {res.display_name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div id="profile-map"></div>

                                        <button
                                            type="button"
                                            className="profile-save-btn"
                                            style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '14px', marginBottom: '10px' }}
                                            onClick={handleUpdateLocation}
                                            disabled={loading}
                                        >
                                            🎯 Sync to My Current GPS
                                        </button>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0', marginBottom: '0' }}>
                                            💡 <strong>Tip:</strong> For a precise location, connect your phone to this Wi-Fi and sync from your phone's browser, or turn ON Wi-Fi on this PC.
                                        </p>
                                    </div>
                                )}

                                <div className="profile-card" style={{ marginTop: '25px', background: 'rgba(52, 152, 219, 0.05)', borderColor: 'rgba(52, 152, 219, 0.2)' }}>
                                    <h3 className="card-title" style={{ color: '#3498db' }}>💡 Support Tip</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                        Need help setting up your restaurant? Visit our documentation or contact our 24/7 success team for assistance.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </fieldset>
            </div>


            {toast.show && (
                <div className={`feedback-toast ${toast.type}`}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.text}
                </div>
            )}
        </div>
    );
}
