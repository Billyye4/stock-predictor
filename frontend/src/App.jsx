import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import styles from './App.module.css';

const Icons = {
  TrendingUp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>,
  Target: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
  Alert: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
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
    setIsGenerating(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/insights/${tickerToFetch}`);
      if(res.ok) {
        const data = await res.json();
        setInsights(prev => ({ ...prev, [tickerToFetch]: data }));
      }
    } catch (err) {} finally {
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
        <div className={styles.sidebarHeader}>
          <h1 className={styles.sidebarTitle}>Stocks Dashboard</h1>
          <p className={styles.sidebarSub}>Track your portfolio</p>
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

        {(activeStock || isPortfolio) ? (
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
              
              {/* --- UPDATED: Active Workspace Header Prices --- */}
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
                    
                    {/* --- UPDATED: Y-Axis and Chart Tooltips formatting --- */}
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

      <aside className={styles.insightsSidebar}>
        <div className={styles.insightsTopBar}>
          {(!isPortfolio && activeStock) && (
            <button className={styles.refreshButton} onClick={() => fetchNewInsight(selectedTicker)} disabled={isGenerating}>
              {isGenerating ? 'Analyzing...' : 'Refresh'}
            </button>
          )}
        </div>

        <div className={styles.insightsContent}>
          {(activeStock || isPortfolio) ? (
            <div className={styles.insightsCard}>
              
              <h3 className={styles.insightsHeader}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  <span className={styles.insightSparkle}>✦</span> AI Insights for {selectedTicker}
                </div>
              </h3>

              {isGenerating && !activeInsight ? (
                <div className={styles.centerLoadingState} style={{minHeight: '200px'}}>Synthesizing market catalysts...</div>
              ) : (
                <div className={styles.insightsStack}>
                
                {isPortfolio ? (
                  <>
                    <div className={styles.insightBlock}>
                      <div className={`${styles.iconWrapper} ${styles.sentimentIcon}`}><Icons.TrendingUp /></div>
                      <div>
                        <h4 className={styles.insightHeading}>Macro Allocation</h4>
                        {/* --- UPDATED: Insights Cash Formatting --- */}
                        <p className={styles.insightText}>Your portfolio is currently distributed across {portfolio.length} active equities with a cash buffer of ${formatPrice(uninvestedCash)}. Uninvested cash provides liquidity to capitalize on immediate market retracements.</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div className={`${styles.iconWrapper} ${styles.analysisIcon}`}><Icons.Target /></div>
                      <div>
                        <h4 className={styles.insightHeading}>Performance Vectors</h4>
                        <p className={styles.insightText}>Your holdings are tracking general market momentum. Consider rebalancing if a single sector exceeds 40% of total equity weight.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.insightBlock}>
                      <div className={`${styles.iconWrapper} ${styles.sentimentIcon}`}><Icons.TrendingUp /></div>
                      <div>
                        <h4 className={styles.insightHeading}>Market Sentiment</h4>
                        <p className={styles.insightText}>{activeInsight?.market_thesis?.structural_outlook || `${selectedTicker} operations show steady positioning relative to core sector momentum.`}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div className={`${styles.iconWrapper} ${styles.analysisIcon}`}><Icons.Target /></div>
                      <div>
                        <h4 className={styles.insightHeading}>Price Analysis</h4>
                        <p className={styles.insightText}>{activeInsight?.critical_events?.[0]?.impact_analysis || `Current price is interacting with moving averages.`}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div className={`${styles.iconWrapper} ${styles.riskIcon}`}><Icons.Alert /></div>
                      <div>
                        <h4 className={styles.insightHeading}>Risk Assessment</h4>
                        <p className={styles.insightText}>{activeInsight?.critical_events?.[1]?.description || `Volatility is moderate. Consider long-term holding strategies.`}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              )}
              <div className={styles.insightsFooter}>
                ✦ Insights powered by Gemini AI • Updated in real-time
              </div>
            </div>
          ) : (
            <div className={styles.insightsCard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#64748b' }}>No data to analyze.</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}