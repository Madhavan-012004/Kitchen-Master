import React, { createContext, useContext, useState, useEffect } from 'react'

const POSModeContext = createContext()

export function POSModeProvider({ children }) {
    const [supermarketMode, setSupermarketMode] = useState(() => {
        const saved = localStorage.getItem('supermarketMode')
        return saved === 'true'
    })

    useEffect(() => {
        localStorage.setItem('supermarketMode', supermarketMode)
    }, [supermarketMode])

    const toggleSupermarketMode = () => setSupermarketMode(v => !v)

    return (
        <POSModeContext.Provider value={{ supermarketMode, setSupermarketMode, toggleSupermarketMode }}>
            {children}
        </POSModeContext.Provider>
    )
}

export function usePOSMode() {
    return useContext(POSModeContext)
}
