import { useState, useEffect } from 'react'

function App() {
  // 1. Set up our state variables to hold the data and track loading status
  const [signalData, setSignalData] = useState(null)
  const [loading, setLoading] = useState(true)

  // 2. useEffect runs automatically when the page first loads
  useEffect(() => {
    // We are reaching out to the FastAPI server running on port 8000
    // Testing this out with the KWEB ticker
    fetch('http://localhost:8000/api/v1/signals/KWEB')
      .then(response => response.json())
      .then(data => {
        setSignalData(data) // Save the JSON data to our state
        setLoading(false)   // Turn off the loading screen
      })
      .catch(error => {
        console.error("Error connecting to FastAPI:", error)
        setLoading(false)
      })
  }, [])

  // 3. What to show while we wait for the backend to respond
  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h2>Connecting to Backend...</h2>
      </div>
    )
  }

  // 4. What to show once the data successfully arrives
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Stock Predictor Dashboard</h1>
      <hr />
      <h2>Ticker: {signalData.ticker}</h2>
      
      <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', maxWidth: '400px' }}>
        <p><strong>Overall Signal:</strong> {signalData.overall_signal}</p>
        <p><strong>AI Confidence:</strong> {signalData.confidence_level * 100}%</p>
        <p><strong>RSI (14):</strong> {signalData.indicators.rsi_14}</p>
      </div>
      
      <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
        Data retrieved at: {new Date(signalData.timestamp).toLocaleTimeString()}
      </p>
    </div>
  )
}

export default App