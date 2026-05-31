from fastapi import FastAPI, HTTPException
import yfinance as yf
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# 1. Initialize the App
# This is the core application object. It handles all incoming traffic.
app = FastAPI(title="Stock Predictor API")

# 2. Configure CORS (Cross-Origin Resource Sharing)
# THE WHY: Browsers have a security feature that blocks a website on one port 
# (like your React app on port 5173) from requesting data from a server on another 
# port (like this FastAPI app on port 8000). This middleware tells your browser, 
# "It is okay, these two are allowed to talk to each other."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Your Vite React app's default address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Define the Endpoints
# We use decorators (@app.get) to tell FastAPI which URL triggers which function.
# Notice how we are just returning the exact mock JSON contracts we agreed on earlier.

@app.get("/")
async def root():
    return {"message": "Stock Predictor API is online. Go to /docs to test endpoints."}

# --- UPGRADED YFINANCE ROUTE ---
@app.get("/api/v1/chart/{ticker}")
async def get_chart_data(ticker: str):
    """Returns real historical OHLCV data for the charts using yfinance."""
    try:
        # 1. Fetch the data from Yahoo Finance
        stock = yf.Ticker(ticker)
        # Pull 1 month of daily data
        hist = stock.history(period="1mo", interval="1d") 
        
        # 2. Safety check: Did we get valid data?
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data found for ticker {ticker}. It may be delisted or invalid.")

        # 3. Format the Pandas DataFrame into our agreed-upon JSON structure
        # We wrap the values in float() and int() to strip away the pandas/numpy datatypes
        formatted_data = []
        for index, row in hist.iterrows():
            formatted_data.append({
                "date": index.strftime("%Y-%m-%d"),
                "open": float(round(row["Open"], 2)),
                "high": float(round(row["High"], 2)),
                "low": float(round(row["Low"], 2)),
                "close": float(round(row["Close"], 2)),
                "volume": int(row["Volume"])
            })

        return {
            "ticker": ticker.upper(),
            "interval": "1d",
            "data": formatted_data
        }
    except Exception as e:
        # If anything goes wrong with the yfinance network request, catch it gracefully
        raise HTTPException(status_code=500, detail=str(e))

# --- MOCK ROUTES (We will upgrade these next) ---
@app.get("/api/v1/signals/{ticker}")
async def get_technical_signals(ticker: str):
    return {
        "ticker": ticker.upper(),
        "timestamp": datetime.utcnow().isoformat(),
        "overall_signal": "BUY",
        "confidence_level": 0.82,
        "indicators": {
            "rsi_14": 34.5,
            "macd": {"value": 1.25, "signal_line": 0.90, "histogram": 0.35, "trend": "bullish_crossover"},
            "moving_averages": {"sma_50": 178.50, "sma_200": 170.20, "current_vs_sma50": "above"}
        }
    }

@app.get("/api/v1/insights/{ticker}")
async def get_ai_insights(ticker: str):
    return {
        "ticker": ticker.upper(),
        "generated_at": datetime.utcnow().isoformat(),
        "sentiment": {"score": 0.65, "label": "Moderately Bullish"},
        "executive_summary": "Technical indicators suggest a strong entry point following a recent pullback.",
        "key_drivers": ["RSI approaching oversold", "Positive upcoming event sentiment", "Macroeconomic chip pressures"]
    }