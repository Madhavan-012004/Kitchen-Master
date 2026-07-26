import React, { createContext, useContext, useState, useEffect } from 'react'

const POSModeContext = createContext()

export function POSModeProvider({ children }) {
    const [storeMode, setStoreModeRaw] = useState(() => {
        const saved = localStorage.getItem('storeMode') || 'restaurant'
        // Normalize legacy 'market' value to 'supermarket' for consistency
        return saved === 'market' ? 'supermarket' : saved
    })

    const setStoreMode = (mode) => {
        // Normalize legacy 'market' -> 'supermarket'
        setStoreModeRaw(mode === 'market' ? 'supermarket' : (mode || 'restaurant'))
    }

    useEffect(() => {
        localStorage.setItem('storeMode', storeMode)
        // Backward compat: keep legacy supermarketMode key in sync
        localStorage.setItem('supermarketMode', storeMode === 'supermarket' ? 'true' : 'false')
    }, [storeMode])

    const supermarketMode = storeMode === 'supermarket'
    const isRestaurant = storeMode === 'restaurant'
    const isMarket = storeMode === 'supermarket'
    const isClothing = storeMode === 'clothing'

    const setSupermarketMode = (val) => {
        setStoreMode(val ? 'supermarket' : 'restaurant')
    }
    const toggleSupermarketMode = () => {
        setStoreMode(prev => prev === 'restaurant' ? 'supermarket' : 'restaurant')
    }
    const cycleMode = () => {
        setStoreMode(prev => {
            if (prev === 'restaurant') return 'supermarket'
            if (prev === 'supermarket') return 'clothing'
            return 'restaurant'
        })
    }

    return (
        <POSModeContext.Provider value={{
            storeMode, setStoreMode, cycleMode,
            supermarketMode, setSupermarketMode, toggleSupermarketMode,
            isRestaurant, isMarket, isClothing
        }}>
            {children}
        </POSModeContext.Provider>
    )
}

export function usePOSMode() {
    return useContext(POSModeContext)
}
