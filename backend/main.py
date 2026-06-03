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
        # Pull 1 year of daily data
        hist = stock.history(period="1y", interval="1d") 
        
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
    """Calculates live technical indicators and generates a Buy/Sell signal using pure Pandas."""
    try:
        # 1. Fetch 1 year of data
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y", interval="1d")
        
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found.")

        # --- PURE PANDAS MATH ENGINE ---
        
        # Simple Moving Averages (SMA)
        hist['SMA_50'] = hist['Close'].rolling(window=50).mean()
        hist['SMA_200'] = hist['Close'].rolling(window=200).mean()

        # MACD (Moving Average Convergence Divergence)
        ema_12 = hist['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = hist['Close'].ewm(span=26, adjust=False).mean()
        hist['MACD_Line'] = ema_12 - ema_26
        hist['MACD_Signal'] = hist['MACD_Line'].ewm(span=9, adjust=False).mean()
        hist['MACD_Hist'] = hist['MACD_Line'] - hist['MACD_Signal']

        # RSI (Relative Strength Index)
        delta = hist['Close'].diff()
        gain = delta.clip(lower=0).rolling(window=14).mean()
        loss = -delta.clip(upper=0).rolling(window=14).mean()
        rs = gain / loss
        hist['RSI_14'] = 100 - (100 / (1 + rs))

        # --- END MATH ENGINE ---

        # 2. Grab the very last row of data (today's current numbers)
        latest = hist.iloc[-1]

        # Extracting the values safely
        current_price = float(latest["Close"])
        rsi = float(latest["RSI_14"]) if pd.notna(latest["RSI_14"]) else 50.0
        sma_50 = float(latest["SMA_50"]) if pd.notna(latest["SMA_50"]) else current_price
        sma_200 = float(latest["SMA_200"]) if pd.notna(latest["SMA_200"]) else current_price
        macd_val = float(latest["MACD_Line"]) if pd.notna(latest["MACD_Line"]) else 0.0
        macd_hist = float(latest["MACD_Hist"]) if pd.notna(latest["MACD_Hist"]) else 0.0

        # 3. Build the Algorithmic Logic
        signal = "HOLD"
        bullish_points = 0
        
        if rsi < 35: bullish_points += 1 
        if current_price > sma_50: bullish_points += 1 
        if macd_hist > 0: bullish_points += 1 
        
        if bullish_points >= 2:
            signal = "BUY"
        elif rsi > 70 or current_price < sma_200:
            signal = "SELL"

        confidence = round((bullish_points / 3.0), 2)

        # 4. Return the JSON contract
        return {
            "ticker": ticker.upper(),
            "timestamp": datetime.utcnow().isoformat(),
            "overall_signal": signal,
            "confidence_level": confidence,
            "indicators": {
                "rsi_14": round(rsi, 2),
                "macd": {
                    "value": round(macd_val, 2),
                    "histogram": round(macd_hist, 2),
                },
                "moving_averages": {
                    "sma_50": round(sma_50, 2),
                    "sma_200": round(sma_200, 2),
                    "current_vs_sma50": "above" if current_price > sma_50 else "below"
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/insights/{ticker}")
async def get_ai_insights(ticker: str):
    return {
        "ticker": ticker.upper(),
        "generated_at": datetime.utcnow().isoformat(),
        "sentiment": {"score": 0.65, "label": "Moderately Bullish"},
        "executive_summary": "Technical indicators suggest a strong entry point following a recent pullback.",
        "key_drivers": ["RSI approaching oversold", "Positive upcoming event sentiment", "Macroeconomic chip pressures"]
    }