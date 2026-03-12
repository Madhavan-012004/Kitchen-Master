import React, { useEffect, useState } from 'react'
import api from '../api/client.js'
import './Analytics.css'

export default function AnalyticsPage() {
    const [data, setData] = useState(null)
    const [period, setPeriod] = useState('7d')
    const [loading, setLoading] = useState(true)

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/analytics/sales?period=${period}`)
            setData(res.data.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAnalytics()
    }, [period])

    const kpis = [
        {
            label: 'Total Revenue',
            value: `₹${data?.summary?.totalRevenue?.toLocaleString('en-IN') || 0}`,
            icon: '💰',
            bg: 'rgba(255, 107, 53, 0.1)',
            color: '#FF6B35',
            trend: '+12.5%'
        },
        {
            label: 'Total Orders',
            value: data?.summary?.totalOrders || 0,
            icon: '🧾',
            bg: 'rgba(76, 142, 255, 0.1)',
            color: '#4C8EFF',
            trend: '+8.2%'
        },
        {
            label: 'Avg Order Value',
            value: `₹${Math.round(data?.summary?.avgOrderValue || 0)}`,
            icon: '📈',
            bg: 'rgba(0, 214, 143, 0.1)',
            color: '#00D68F',
            trend: '+4.5%'
        },
        {
            label: 'Items Sold',
            value: data?.topItems?.reduce((acc, curr) => acc + curr.totalQuantity, 0) || 0,
            icon: '🍔',
            bg: 'rgba(157, 80, 187, 0.1)',
            color: '#9d50bb',
            trend: '+15.1%'
        }
    ]

    return (
        <div className="analytics-container">
            <div className="analytics-header">
                <div className="header-main">
                    <h1>Restaurant Analytics</h1>
                    <p>Track your business growth and popular dishes</p>
                </div>
                <div className="period-switcher">
                    {[
                        { id: '1d', label: '1D' },
                        { id: '7d', label: '1W' },
                        { id: '30d', label: '1M' },
                        { id: '90d', label: '3M' }
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => setPeriod(p.id)}
                            className={`period-btn ${period === p.id ? 'active' : ''}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="loading" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <>
                    <div className="kpi-grid">
                        {kpis.map((k, i) => (
                            <div key={i} className="kpi-card">
                                <div className="kpi-icon-row">
                                    <div className="kpi-icon" style={{ background: k.bg }}>{k.icon}</div>
                                    <div className="kpi-trend">{k.trend}</div>
                                </div>
                                <div>
                                    <div className="kpi-label">{k.label}</div>
                                    <div className="kpi-value">{k.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="analytics-main-grid">
                        <div className="dashboard-card">
                            <h3 className="card-title">📈 Revenue Trend</h3>
                            {data?.revenueByDay?.length > 0 ? (
                                <div className="trend-list">
                                    {data.revenueByDay.map((d, i) => {
                                        const maxRev = Math.max(...data.revenueByDay.map(x => x.revenue))
                                        const width = maxRev > 0 ? (d.revenue / maxRev) * 100 : 0
                                        return (
                                            <div key={i} className="trend-item">
                                                <span className="trend-date">{d._id.slice(5)}</span>
                                                <div className="trend-bar-container">
                                                    <div className="trend-bar" style={{ width: `${width}%` }}></div>
                                                </div>
                                                <span className="trend-value">₹{d.revenue.toLocaleString('en-IN')}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="loading" style={{ height: '200px' }}>No trend data found</div>
                            )}
                        </div>

                        <div className="dashboard-card">
                            <h3 className="card-title">🏆 Top Sellers</h3>
                            {data?.topItems?.length > 0 ? (
                                <div className="top-items-list">
                                    {data.topItems.map((item, idx) => (
                                        <div key={idx} className="top-item-row">
                                            <div className="item-rank-name">
                                                <div className="rank-badge" style={{
                                                    background: idx === 0 ? 'rgba(255, 215, 0, 0.2)' : idx === 1 ? 'rgba(192, 192, 192, 0.2)' : idx === 2 ? 'rgba(205, 127, 50, 0.2)' : 'var(--bg-card)'
                                                }}>
                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '✨'}
                                                </div>
                                                <span className="rank-text">{item._id}</span>
                                            </div>
                                            <span className="sold-badge">{item.totalQuantity} Sold</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="loading" style={{ height: '200px' }}>No sales data found</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
