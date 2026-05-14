import React, { useState, useEffect } from 'react';
import api from '../api/client';
import './Production.css';

export default function Production() {
    const [history, setHistory] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [feasibility, setFeasibility] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [historyRes, menuRes] = await Promise.all([
                api.get('/production/history'),
                api.get('/menu')
            ]);
            setHistory(historyRes.data.data || []);
            setMenuItems(menuRes.data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckFeasibility = async () => {
        if (!selectedItem || quantity <= 0) return;
        try {
            const res = await api.post('/production/check', {
                menuItemId: selectedItem,
                quantity: parseFloat(quantity)
            });
            setFeasibility(res.data.data);
        } catch (error) {
            alert(error.response?.data?.message || 'Error checking feasibility');
        }
    };

    const handleStartProduction = async () => {
        if (!feasibility?.canProduce) {
            alert('Cannot start production. Missing materials.');
            return;
        }
        try {
            await api.post('/production/start', {
                menuItemId: selectedItem,
                quantity: parseFloat(quantity)
            });
            alert('Production Batch Completed!');
            setFeasibility(null);
            setSelectedItem(null);
            setQuantity(1);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Error starting production');
        }
    };

    return (
        <div className="production-page p-6">
            <h1 className="text-2xl font-bold mb-6">Production & BOM Management</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* New Production Run Form */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4">New Production Run</h2>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product to Manufacture</label>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded"
                            value={selectedItem || ''}
                            onChange={(e) => {
                                setSelectedItem(e.target.value);
                                setFeasibility(null);
                            }}
                        >
                            <option value="">Select Product...</option>
                            {menuItems.map(item => (
                                <option key={item._id || item.id} value={item._id || item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border border-gray-300 rounded"
                            min="1"
                            value={quantity}
                            onChange={(e) => {
                                setQuantity(e.target.value);
                                setFeasibility(null);
                            }}
                        />
                    </div>

                    <button 
                        className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded mb-4"
                        onClick={handleCheckFeasibility}
                        disabled={!selectedItem}
                    >
                        Check Material Availability
                    </button>

                    {feasibility && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="font-semibold text-lg mb-2">Material Availability Check</h3>
                            <ul className="mb-4 space-y-2">
                                {feasibility.ingredients.map((ing, idx) => (
                                    <li key={idx} className="flex justify-between items-center text-sm">
                                        <span>
                                            {ing.status === 'OK' ? '✅' : '❌'} {ing.ingredientName}
                                            <span className="text-gray-500 ml-2">
                                                (Need {ing.requiredQty} {ing.unit} | Have {ing.currentStock} {ing.unit})
                                            </span>
                                        </span>
                                        <span className={ing.status === 'OK' ? 'text-green-600' : 'text-red-600 font-bold'}>
                                            {ing.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="text-sm font-bold text-gray-700 mb-4">
                                Total Material Cost: ₹{feasibility.totalMaterialCost.toFixed(2)} 
                                (₹{feasibility.unitCost.toFixed(2)}/unit)
                            </div>
                            
                            {feasibility.canProduce ? (
                                <button 
                                    className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded"
                                    onClick={handleStartProduction}
                                >
                                    Start Production Batch
                                </button>
                            ) : (
                                <div className="text-red-600 font-bold p-3 bg-red-50 rounded text-center">
                                    ⚠️ Cannot start — Insufficient Materials. Please record a purchase first.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* History */}
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4">Recent Production Batches</h2>
                    {loading ? (
                        <p>Loading history...</p>
                    ) : history.length === 0 ? (
                        <p className="text-gray-500">No production batches found.</p>
                    ) : (
                        <div className="overflow-y-auto max-h-[600px]">
                            {history.map(batch => (
                                <div key={batch.id} className="border-b pb-3 mb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold">{batch.menuItem?.name || 'Unknown Product'}</h4>
                                            <p className="text-sm text-gray-600">Produced: {batch.quantityProduced}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                                {batch.status}
                                            </span>
                                            <p className="text-sm font-semibold mt-1">Cost: ₹{batch.materialCost?.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {new Date(batch.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
