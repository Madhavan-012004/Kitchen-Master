import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const StakeholderContext = createContext(null)

/**
 * Manages stakeholder multi-restaurant context.
 * Only active when the logged-in user has role === 'stakeholder'.
 * Provides:
 *   - accessibleRestaurants: list of all restaurants the stakeholder can access
 *   - selectedRestaurantId: the currently selected restaurant (null = "All")
 *   - setSelectedRestaurantId: function to switch restaurant context
 *   - effectiveRestaurantId: the value to send as X-Restaurant-Id header
 */
export function StakeholderProvider({ children }) {
    const [accessibleRestaurants, setAccessibleRestaurants] = useState([])
    const [selectedRestaurantId, setSelectedRestaurantId] = useState(null) // null = "ALL"

    const loadRestaurants = useCallback(async () => {
        try {
            const user = JSON.parse(sessionStorage.getItem('km_user') || 'null')
            if (!user) return
            const role = user.role?.toLowerCase()
            if (role !== 'stakeholder' && role !== 'owner') return

            // Use restaurants embedded in user object from login response
            if (user.accessibleRestaurants?.length) {
                setAccessibleRestaurants(user.accessibleRestaurants)
                return
            }

            // Fallback: fetch from API
            const res = await api.get('/stakeholder/restaurants')
            if (res.data.success) {
                setAccessibleRestaurants(res.data.data.restaurants || [])
            }
        } catch (err) {
            console.error('Failed to load stakeholder restaurants:', err)
        }
    }, [])

    useEffect(() => {
        loadRestaurants()
    }, [loadRestaurants])

    // The value sent in X-Restaurant-Id header
    const effectiveRestaurantId = selectedRestaurantId ?? 'ALL'

    const selectRestaurant = (id) => {
        setSelectedRestaurantId(id) // null means "ALL"
    }

    return (
        <StakeholderContext.Provider value={{
            accessibleRestaurants,
            selectedRestaurantId,
            effectiveRestaurantId,
            selectRestaurant,
            refreshRestaurants: loadRestaurants
        }}>
            {children}
        </StakeholderContext.Provider>
    )
}

export const useStakeholder = () => useContext(StakeholderContext)
