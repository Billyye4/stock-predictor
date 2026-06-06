import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import styles from './App.module.css';
import Settings from './Settings';

const Icons = {
  TrendingUp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>,
  Target: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
  Alert: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
};

// --- NEW: Universal Formatting Engines ---
const formatPrice = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDelta = (value, percent) => {
  if (value === undefined || value === null || isNaN(value)) return '---';
  const isPos = value >= 0;
  const sign = isPos ? '+' : '-';
  const absVal = formatPrice(Math.abs(value));
  const absPct = formatPrice(Math.abs(percent));
  return `${sign}$${absVal} (${sign}${absPct}%)`;
};

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedTicker, setSelectedTicker] = useState('PORTFOLIO');
  const [timeframe, setTimeframe] = useState('1D');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newShares, setNewShares] = useState('');

  const [uninvestedCash, setUninvestedCash] = useState(() => {
    const savedCash = localStorage.getItem('dashboard_cash');
    return savedCash ? parseFloat(savedCash) : 0;
  });

  const [portfolio, setPortfolio] = useState(() => {
    const savedPortfolio = localStorage.getItem('dashboard_portfolio');
    if (savedPortfolio) return JSON.parse(savedPortfolio);
    return [
      { ticker: 'AAPL', name: 'Apple Inc.', shares: 10, price: 0, change: 0, changePct: 0 },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', shares: 5, price: 0, change: 0, changePct: 0 },
      { ticker: 'MSFT', name: 'Microsoft Corp.', shares: 8, price: 0, change: 0, changePct: 0 }
    ];
  });

  const [insights, setInsights] = useState(() => {
    const savedInsights = localStorage.getItem('dashboard_insights');
    return savedInsights ? JSON.parse(savedInsights) : {};
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [insightError, setInsightError] = useState(null); // <--- NEW: Track backend errors

  // <--- NEW: Clear the error if they click a different stock
  useEffect(() => {
    setInsightError(null);
  }, [selectedTicker]);

  
  useEffect(() => localStorage.setItem('dashboard_portfolio', JSON.stringify(portfolio)), [portfolio]);
  useEffect(() => localStorage.setItem('dashboard_insights', JSON.stringify(insights)), [insights]);
  useEffect(() => localStorage.setItem('dashboard_cash', uninvestedCash.toString()), [uninvestedCash]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchLivePrices = async () => {
      const updatedPortfolio = await Promise.all(portfolio.map(async (stock) => {
        try {
          const res = await fetch(`http://localhost:8000/api/v1/quote/${stock.ticker}`);
          if (res.ok) {
            const data = await res.json();
            return { ...stock, price: data.price, change: data.change, changePct: data.changePct };
          }
        } catch (e) {}
        return stock;
      }));
      setPortfolio(updatedPortfolio);
    };

    if (portfolio.length > 0) fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 10000);
    return () => clearInterval(interval);
  }, [portfolio.length]);

  useEffect(() => {
    const jitterTimer = setInterval(() => {
      setPortfolio(prevPortfolio => prevPortfolio.map(stock => {
        if (stock.price <= 0) return stock; 
        const volatility = (Math.random() * 0.06) - 0.03;
        const newPrice = stock.price + volatility;
        const newChange = stock.change + volatility;
        const previousClose = stock.price - stock.change;
        const newChangePct = previousClose > 0 ? (newChange / previousClose) * 100 : 0;
        return { ...stock, price: newPrice, change: newChange, changePct: newChangePct };
      }));
    }, 1500); 
    return () => clearInterval(jitterTimer);
  }, []);

const fetchNewInsight = async (tickerToFetch) => {
    const userApiKey = localStorage.getItem('stock_api_key');

    if (!userApiKey) {
      alert("Please go to Settings and enter your API key first!");
      return; 
    }

    setIsGenerating(true);
    setInsightError(null); // Reset any previous errors

    try {
      const res = await fetch(`http://localhost:8000/api/v1/insights/${tickerToFetch}`, {
        method: 'GET', 
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': userApiKey 
        }
      });

      if (res.ok) {
        const data = await res.json();
        setInsights(prev => ({ ...prev, [tickerToFetch]: data }));
      } else {
        // --- NEW: Handle Backend Errors ---
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.detail || "";
        
        // Check if it's the specific high-demand 503 error
        if (res.status === 503 || errorMessage.includes('503 UNAVAILABLE')) {
          setInsightError("Gemini is currently experiencing high demand. Please try again in a few moments.");
        } else {
          setInsightError(errorMessage || `Server Error ${res.status}: Failed to generate insight.`);
        }
      }
    } catch (err) {
      setInsightError("Network Error: Could not connect to the Python backend.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      if (selectedTicker === 'PORTFOLIO') {
        try {
          const promises = portfolio.map(p => 
            fetch(`http://localhost:8000/api/v1/chart/${p.ticker}?timeframe=${timeframe}`)
              .then(res => res.json())
              .then(data => ({ ticker: p.ticker, shares: p.shares, data: data.data || [] }))
          );
          const results = await Promise.all(promises);

          let baselineStock = results[0];
          results.forEach(r => {
            if (r.data.length > (baselineStock?.data.length || 0)) baselineStock = r;
          });

          if (baselineStock && baselineStock.data) {
            const masterChart = baselineStock.data.map(point => {
              let aggregateClose = 0;
              results.forEach(res => {
                const match = res.data.find(d => d.date === point.date);
                const price = match ? match.close : (res.data[res.data.length - 1]?.close || 0);
                aggregateClose += (price * res.shares);
              });
              return { date: point.date, close: aggregateClose + uninvestedCash };
            });
            setChartData(masterChart);
          }
        } catch (err) {
          setChartData([]);
        } finally {
          setLoading(false);
        }
      } else {
        const activeAsset = portfolio.find(p => p.ticker === selectedTicker);
        if (!activeAsset) return;
        
        fetch(`http://localhost:8000/api/v1/chart/${selectedTicker}?timeframe=${timeframe}`)
          .then(res => res.json())
          .then(data => setChartData(data.data))
          .catch(() => setChartData([]))
          .finally(() => setLoading(false));
      }
    };
    fetchChartData();
  }, [selectedTicker, timeframe]); 

  const handleRemovePosition = (e, tickerToRemove) => {
    e.stopPropagation();
    const updated = portfolio.filter(p => p.ticker !== tickerToRemove);
    setPortfolio(updated);
    if (selectedTicker === tickerToRemove && updated.length > 0) setSelectedTicker(updated[0].ticker);
    else if (updated.length === 0) setSelectedTicker('');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newTicker || !newShares) return;
    const formattedTicker = newTicker.toUpperCase().trim();
    if (portfolio.some(p => p.ticker === formattedTicker)) return alert("Stock already exists.");
    
    const newStock = { ticker: formattedTicker, name: formattedTicker, shares: parseFloat(newShares), price: 0, change: 0, changePct: 0 };
    setPortfolio(prev => [...prev, newStock]);
    setIsAdding(false);
    setNewTicker('');
    setNewShares('');
    setSelectedTicker(formattedTicker);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/quote/${formattedTicker}`);
      if(res.ok) {
        const data = await res.json();
        setPortfolio(prev => prev.map(p => p.ticker === formattedTicker ? { ...p, price: data.price, change: data.change, changePct: data.changePct } : p));
      }
    } catch (err) {}
  };

  // ==========================================
  // ARITHMETIC & STATE HELPERS
  // ==========================================
  const rawTotalValue = portfolio.reduce((acc, stock) => acc + (stock.shares * stock.price), 0) + (uninvestedCash || 0);
  const rawTotalChange = portfolio.reduce((acc, stock) => acc + (stock.shares * stock.change), 0);
  
  const cleanTotalValue = Math.round(rawTotalValue * 100) / 100;
  const cleanTotalChange = Math.round(rawTotalChange * 100) / 100;
  
  const previousPortfolioValue = cleanTotalValue - cleanTotalChange;
  const totalChangePct = previousPortfolioValue > 0 ? (cleanTotalChange / previousPortfolioValue) * 100 : 0;
  
  const activeStock = portfolio.find(p => p.ticker === selectedTicker);
  const isPortfolio = selectedTicker === 'PORTFOLIO';
  
  const isPositive = activeStock?.change >= 0;
  const isPortfolioPositive = cleanTotalChange >= 0;
  const displayPositive = isPortfolio ? isPortfolioPositive : isPositive;
  
  const baselinePrice = timeframe === '1D' 
    ? (isPortfolio ? (cleanTotalValue - cleanTotalChange) : (activeStock ? activeStock.price - activeStock.change : null))
    : (chartData.length > 0 ? chartData[0].close : null);
  
  const activeInsight = insights[selectedTicker];

  const getMarketStatus = (date) => {
    const nyTime = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const day = nyTime.getDay();
    const hours = nyTime.getHours();
    const minutes = nyTime.getMinutes();
    const timeAsDecimal = hours + minutes / 60;

    if (day === 0 || day === 6) return { text: "Market Closed", color: "#475569", bg: "#e2e8f0", dot: "#94a3b8" }; 
    if (timeAsDecimal >= 4 && timeAsDecimal < 9.5) return { text: "Pre-Market", color: "#6d28d9", bg: "#ede9fe", dot: "#8b5cf6" };
    if (timeAsDecimal >= 9.5 && timeAsDecimal < 16) return { text: "Market Open", color: "#047857", bg: "#d1fae5", dot: "#10b981" };
    if (timeAsDecimal >= 16 && timeAsDecimal < 20) return { text: "After-Hours", color: "#1d4ed8", bg: "#dbeafe", dot: "#3b82f6" };
    return { text: "Market Closed", color: "#475569", bg: "#e2e8f0", dot: "#94a3b8" };
  };

  const marketStatus = getMarketStatus(currentTime);

  return (
    <div className={styles.dashboardContainer}>
      
      <aside className={styles.portfolioSidebar}>
        <div className={styles.sidebarHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className={styles.sidebarTitle}>Stocks Dashboard</h1>
            <p className={styles.sidebarSub}>Track your portfolio</p>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
            title="Open Settings"
          >
            <Icons.Settings />
          </button>
        </div>

        <div className={styles.valueCardContainer}>
          <div className={styles.valueCard} onClick={() => setSelectedTicker('PORTFOLIO')}>
            <div className={styles.cardTitle}>
              <span style={{ fontWeight: 'bold' }}>$</span> Portfolio Value
            </div>
            
            {/* --- UPDATED: Portfolio Value --- */}
            <div className={styles.totalValueText}>
              ${formatPrice(cleanTotalValue)}
            </div>
            <div className={styles.totalChangeText}>
              {isPortfolioPositive ? <Icons.TrendingUp /> : <span style={{ transform: 'scaleY(-1)' }}><Icons.TrendingUp /></span>}
              {formatDelta(cleanTotalChange, totalChangePct)}
            </div>
            <div className={styles.cardFooter}>
              {portfolio.length} Stocks in Portfolio
            </div>
          </div>
        </div>

        <div className={styles.cashContainer}>
          <div className={styles.cashInputWrapper}>
            <span className={styles.cashLabel}>Buying Power</span>
            <div>
              <span style={{color: '#64748b', fontWeight: '600', marginRight: '4px'}}>$</span>
              <input 
                type="number" step="any" className={styles.cashInput} placeholder="0.00"
                value={uninvestedCash === 0 ? '' : uninvestedCash}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setUninvestedCash(isNaN(val) ? 0 : val);
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.actionButtonContainer}>
          {!isAdding ? (
            <button className={styles.addButton} onClick={() => setIsAdding(true)}>+ Add Stock</button>
          ) : (
            <form className={styles.addStockForm} onSubmit={handleAddSubmit}>
              <div className={styles.inputRow}>
                <input type="text" placeholder="TICKER" className={styles.inputField} value={newTicker} onChange={(e) => setNewTicker(e.target.value)} style={{ textTransform: 'uppercase' }}/>
                <input type="number" step="any" placeholder="Shares" className={styles.inputField} value={newShares} onChange={(e) => setNewShares(e.target.value)} />
              </div>
              <div className={styles.buttonRow}>
                <button type="submit" className={styles.confirmButton}>Confirm</button>
                <button type="button" className={styles.cancelButton} onClick={() => setIsAdding(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className={styles.positionsHeader}>
          <span>Your Positions</span>
          <div className={styles.positionsLine}></div>
        </div>

        <div className={styles.stockList}>
          {portfolio.map((stock) => {
            const isSelected = stock.ticker === selectedTicker;
            const stockPos = stock.change >= 0;
            return (
              <div key={stock.ticker} onClick={() => setSelectedTicker(stock.ticker)} className={isSelected ? styles.stockCardSelected : styles.stockCard}>
                <div className={styles.stockCardHeader}>
                  <div>
                    <div className={styles.stockTicker}>{stock.ticker}</div>
                    <div className={styles.stockName}>{stock.name}</div>
                  </div>
                  <div className={styles.cardActionIcons}>
                    <button className={styles.iconButton} onClick={(e) => handleRemovePosition(e, stock.ticker)}><Icons.X /></button>
                  </div>
                </div>
                
                {/* --- UPDATED: Sidebar Stock Prices --- */}
                <div className={styles.stockCardBody}>
                  <div className={styles.stockPriceText}>${stock.price > 0 ? formatPrice(stock.price) : '---'}</div>
                  <div className={styles.stockMetaText}>{stock.shares} shares</div>
                  <div className={styles.stockMetaText}>Position: ${formatPrice(stock.shares * stock.price)}</div>
                  <div className={`${styles.stockDeltaBadge} ${stockPos ? styles.positiveDelta : styles.negativeDelta}`}>
                    {stockPos ? '↗' : '↘'} {formatDelta(stock.change, stock.changePct)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      <main className={styles.mainCanvas}>
        <header className={styles.topStatusBar}>
          <div className={styles.marketIndicator} style={{ backgroundColor: marketStatus.bg, color: marketStatus.color }}>
            <div className={styles.marketDot} style={{ backgroundColor: marketStatus.dot }}></div>
            {marketStatus.text}
          </div>
          
          <div className={styles.timestampClock}>
            <Icons.Clock />
            {currentTime.toLocaleTimeString("en-US", { timeZone: "America/New_York" })} ET
          </div>
        </header>

        {/* --- SETTINGS SCREEN INJECTION --- */}
        {showSettings ? (
          <div className={styles.settingsWrapper}>
            <div className={styles.settingsCard}>
              
              <div className={styles.settingsHeader}>
                <h2 className={styles.settingsTitle}>Application Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className={styles.settingsCloseBtn}
                >
                  Close
                </button>
              </div>

              <Settings />
              
            </div>
          </div>
          
        ) : (activeStock || isPortfolio) ? (
          <div className={styles.chartWorkspace}>
            <div className={styles.workspaceHeader}>
              <div>
                <h2 className={styles.workspaceTitle}>
                  {isPortfolio ? 'Total Portfolio' : activeStock?.ticker}
                </h2>
                <div className={styles.workspaceSub}>
                  {isPortfolio ? 'Consolidated Equity & Cash' : activeStock?.name}
                </div>
              </div>
              
              <div className={styles.headerMetricsRight}>
                <div className={styles.activePriceValue}>
                  ${isPortfolio 
                      ? formatPrice(cleanTotalValue) 
                      : (activeStock?.price > 0 ? formatPrice(activeStock.price) : '---')}
                </div>
                <div className={`${styles.activeDeltaValue} ${displayPositive ? styles.positiveDelta : styles.negativeDelta}`}>
                  {isPortfolio ? formatDelta(cleanTotalChange, totalChangePct) : formatDelta(activeStock?.change, activeStock?.changePct)}
                </div>
              </div>
            </div>

            <div className={styles.timeframeRow}>
              {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)} className={timeframe === tf ? styles.timeframeBtnActive : styles.timeframeBtn}>
                  {tf}
                </button>
              ))}
            </div>

            <div className={styles.chartContainer}>
              {loading ? (
                <div className={styles.centerLoadingState}>Loading market data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" hide />
                    
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${formatPrice(val)}`} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value) => [`$${formatPrice(value)}`, 'Price']} />
                    
                    {baselinePrice !== null && (
                      <ReferenceLine y={baselinePrice} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
                    )}
                    <Line type="monotone" dataKey="close" stroke={displayPositive ? '#10b981' : '#ef4444'} strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: displayPositive ? '#10b981' : '#ef4444', stroke: 'white', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.centerLoadingState}>Please add a stock to view market data.</div>
        )}
      </main>

      {/* ================= RIGHT SIDEBAR: AI INSIGHTS ================= */}
      <aside className={styles.insightsSidebar}>
        
        {/* --- MERGED HEADER & REFRESH BUTTON --- */}
        <div className={styles.sidebarHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 className={styles.sidebarTitle}>AI Market Insights</h3>
            <p className={styles.sidebarSub}>
              {selectedTicker === 'PORTFOLIO' ? 'Aggregate Portfolio Review' : `${selectedTicker} Asset Analysis`}
            </p>
          </div>
          
          {(activeStock || isPortfolio) && (
            <button 
              className={styles.refreshButton} 
              onClick={() => fetchNewInsight(selectedTicker || 'PORTFOLIO')} 
              disabled={isGenerating}
              style={{ margin: 0 }} /* Overrides the old auto-margin */
            >
              {isGenerating ? 'Analyzing...' : 'Refresh'}
            </button>
          )}
        </div>

        <div className={styles.insightsContent}>
          {/* Active Generation State */}
          {isGenerating ? (
            <div className={styles.centerLoadingState} style={{ minHeight: '200px' }}>
              Synthesizing market catalysts...
            </div>
          ) : insightError ? (
            /* Error State */
            <div className={styles.centerLoadingState} style={{ minHeight: '200px', flexDirection: 'column', color: '#ef4444', textAlign: 'center', padding: '0 20px' }}>
              <Icons.Alert />
              <div style={{ fontWeight: '700', marginTop: '12px', color: '#0f172a' }}>AI Service Unavailable</div>
              <div style={{ fontSize: '13px', marginTop: '8px', lineHeight: '1.5', color: '#64748b' }}>
                {insightError}
              </div>
              <button 
                onClick={() => fetchNewInsight(selectedTicker || 'PORTFOLIO')}
                style={{ marginTop: '16px', background: '#f1f5f9', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#475569' }}
              >
                Try Again
              </button>
            </div>
          ) : activeInsight ? (
            /* Content State (Only renders if AI data actually exists!) */
            <div className={styles.insightsStack}>
              
              {!selectedTicker || selectedTicker === 'PORTFOLIO' ? (
                /* ---------------------------------------------------- */
                /* ROW A: DETAILED PORTFOLIO OVERVIEW INSIGHTS          */
                /* ---------------------------------------------------- */
                <>
                  {/* 1. Macro Allocation */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper} ${styles.sentimentIcon}`}><Icons.TrendingUp /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Macro Environment & Liquidity</h4>
                      <p className={styles.insightText}>
                        {activeInsight?.macro_allocation || `Your capital is distributed across ${portfolio.length} active equities with a cash buffer of $${formatPrice(uninvestedCash)}.`}
                      </p>
                    </div>
                  </div>

                  {/* 2. Diversification & Risk */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper} ${styles.riskIcon}`}><Icons.Alert /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Risk Concentration Vectors</h4>
                      <p className={styles.insightText}>
                        {activeInsight?.risk_concentration || 'Analyzing current market risks and sector headwinds...'}
                      </p>
                    </div>
                  </div>

                  {/* 3. Rebalancing Strategy */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper} ${styles.analysisIcon}`}><Icons.Target /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Strategic Rebalancing</h4>
                      <p className={styles.insightText}>
                        {activeInsight?.rebalancing_strategy || 'Generating actionable portfolio rebalancing strategies...'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                /* ---------------------------------------------------- */
                /* ROW B: HIGH-CONVICTION INDIVIDUAL STOCK INSIGHTS     */
                /* ---------------------------------------------------- */
                <>
                  {/* 1. Sentiment & Movement */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper} ${styles.sentimentIcon}`}><Icons.TrendingUp /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Wall Street Sentiment: {activeInsight?.sentiment?.label || 'Neutral'}</h4>
                      <p className={styles.insightText}>
                        <strong>Catalyst:</strong> {activeInsight?.sentiment?.catalyst_summary || 'Analyzing current market catalysts...'}<br/>
                        <strong>Consensus:</strong> {activeInsight?.sentiment?.wall_street_consensus || 'Gathering institutional consensus data...'}
                      </p>
                    </div>
                  </div>

                  {/* 2. Health & Valuation */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper} ${styles.analysisIcon}`}><Icons.Target /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Business Health & Valuation</h4>
                      <p className={styles.insightText}>
                        <strong>Health:</strong> {activeInsight?.fundamentals?.business_health || 'Analyzing fundamental metrics...'}<br/>
                        <strong>Valuation:</strong> {activeInsight?.fundamentals?.valuation_status || 'Evaluating historical pricing multiples...'}
                      </p>
                    </div>
                  </div>

                  {/* 3. Actionable Strategy & Scenarios */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper} ${styles.riskIcon}`}><Icons.Alert /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Trading Strategy & Levels</h4>
                      <p className={styles.insightText}>
                        <strong>Buy Zone:</strong> {activeInsight?.strategy?.buy_zone || 'Calculating institutional support areas...'}<br/>
                        <strong>Sell Zone:</strong> {activeInsight?.strategy?.sell_zone || 'Identifying overhead resistance zones...'}<br/>
                        <span style={{ color: '#10b981', fontWeight: '600' }}>↑ Bull Target:</span> {activeInsight?.strategy?.bull_scenario || 'N/A'}<br/>
                        <span style={{ color: '#ef4444', fontWeight: '600' }}>↓ Bear Support:</span> {activeInsight?.strategy?.bear_scenario || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* 4. Competitor Analysis */}
                  <div className={styles.insightBlock}>
                    <div className={`${styles.iconWrapper}`} style={{ backgroundColor: '#f1f5f9', color: '#475569' }}><Icons.Target /></div>
                    <div>
                      <h4 className={styles.insightHeading}>Top Competitor Threats</h4>
                      {activeInsight?.competition && activeInsight.competition.length > 0 ? (
                        activeInsight.competition.map((comp, idx) => (
                          <p key={idx} className={styles.insightText} style={{ marginBottom: '6px' }}>
                            <strong>{comp.competitor} ({comp.threat_level} Threat):</strong> {comp.comparative_advantage}
                          </p>
                        ))
                      ) : (
                        <p className={styles.insightText}>Scanning competitive landscape and industry moats...</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Initial / Empty State */
            <div className={styles.centerLoadingState} style={{ minHeight: '200px' }}>
              Click 'Refresh' to generate an AI analysis.
            </div>
          )}
        </div>

        <div className={styles.insightsFooter}>
          ✦ Insights powered by Gemini AI • Updated in real-time
        </div>
      </aside>
    </div>
  );
}