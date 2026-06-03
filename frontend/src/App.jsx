import { useState, useEffect } from 'react'
// 1. Import the Recharts components
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'

function App() {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // NEW: State for the search bar
  const [searchInput, setSearchInput] = useState('NVDA') 
  const [activeTicker, setActiveTicker] = useState('NVDA')

  // Notice the [activeTicker] at the very end. This tells React: 
  // "Whenever activeTicker changes, run this fetch again!"
  useEffect(() => {
    setLoading(true) // Turn the loading screen back on when searching
    setError(null)   // Clear any old errors
    
    // We use backticks (`) here to inject the activeTicker variable into the URL
    fetch(`http://localhost:8000/api/v1/chart/${activeTicker}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`)
        }
        return response.json()
      })
      .then(data => {
        setChartData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Fetch error:", err)
        setError(err.message)
        setLoading(false)
      })
  }, [activeTicker]) // <--- CRITICAL: This dependency array is what triggers the reload

  if (loading) return <h2 style={{ padding: '20px' }}>Loading Live Market Data...</h2>
  if (error) return <h2 style={{ padding: '20px', color: 'red' }}>Error: {error}</h2>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto', color: '#fff' }}>
      <h1>Stock Predictor Dashboard</h1>
      <hr style={{ marginBottom: '30px', borderColor: '#333' }} />
      
      {/* --- NEW SEARCH BAR UI --- */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
          placeholder="Enter Ticker (e.g. AAPL)"
          style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc', textTransform: 'uppercase' }}
        />
        <button 
          onClick={() => setActiveTicker(searchInput)}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
        >
          Search
        </button>
      </div>
      
      {/* We check if chartData exists before trying to render the title or chart */}
      {chartData && (
        <>
          <h2>{chartData.ticker} - 1 Year History</h2>
          
          <div style={{ height: '400px', width: '100%', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} minTickGap={30} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value) => [`$${value}`, 'Close Price']} labelStyle={{ color: '#333', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

export default App