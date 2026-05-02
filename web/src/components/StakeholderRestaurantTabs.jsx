import React, { useEffect } from 'react'
import { useStakeholder } from '../context/StakeholderContext'
import { useAuth } from '../context/AuthContext'
import './StakeholderRestaurantTabs.css'

export default function StakeholderRestaurantTabs() {
    const { user } = useAuth()
    const { accessibleRestaurants, selectedRestaurantId, selectRestaurant } = useStakeholder()

    const isStakeholderOrOwner = user?.role === 'stakeholder' || user?.role === 'owner'

    // Debugging visibility issues
    useEffect(() => {
        const role = user?.role?.toLowerCase()
        if (role !== 'stakeholder' && role !== 'owner') return

        if (isStakeholderOrOwner) {
            console.log('StakeholderTabs: User context details', {
                role: user?.role,
                hotelsFound: accessibleRestaurants?.length || 0,
                selected: selectedRestaurantId || 'ALL'
            })
        }
    }, [isStakeholderOrOwner, accessibleRestaurants, selectedRestaurantId, user?.role])

    if (!isStakeholderOrOwner) return null

    // Only show tabs if there are multiple restaurants to switch between
    // This hides the "Scanning..." message and the bar itself for single-hotel owners
    if (!accessibleRestaurants || accessibleRestaurants.length < 2) return null

    return (
        <div className="stakeholder-tabs-container">
            <div className="tabs-scroll-area">
                <button 
                    className={`restaurant-tab ${!selectedRestaurantId ? 'active' : ''}`}
                    onClick={() => selectRestaurant(null)}
                >
                    <span className="tab-icon">🌐</span>
                    <span className="tab-label">All</span>
                </button>
                
                {accessibleRestaurants.map(r => (
                    <button 
                        key={r.restaurantId}
                        className={`restaurant-tab ${selectedRestaurantId === r.restaurantId ? 'active' : ''}`}
                        onClick={() => selectRestaurant(r.restaurantId)}
                    >
                        <span className="tab-icon">🏨</span>
                        <span className="tab-label">{r.restaurantName}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
