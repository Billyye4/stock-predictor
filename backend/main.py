from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Query
from datetime import datetime
import yfinance as yf
import pandas as pd
import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from duckduckgo_search import DDGS

# Load the secret API key from the .env file
load_dotenv()
# client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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
@app.get("/api/v1/quote/{ticker}")
async def get_live_quote(ticker: str):
    """Fetches live intraday price, explicitly including after-hours trading."""
    ticker_upper = ticker.upper()
    current_time = time.time()
    
    # 1. Check Cache
    if ticker_upper in quote_cache:
        last_fetch_time, cached_data = quote_cache[ticker_upper]
        if current_time - last_fetch_time < CACHE_TTL:
            return cached_data

    try:
        stock = yf.Ticker(ticker_upper)
        
        # 2. Get the official previous close (extremely fast method)
        try:
            previous_close = stock.fast_info['previous_close']
        except:
            # Fallback if fast_info is unavailable
            daily_hist = stock.history(period="5d")
            previous_close = daily_hist['Close'].iloc[-2] if len(daily_hist) >= 2 else daily_hist['Open'].iloc[0]

        # 3. Get the TRUE live price using 1-minute intervals and prepost=True
        live_hist = stock.history(period="1d", interval="1m", prepost=True)
        if live_hist.empty:
            current_price = previous_close
        else:
            current_price = live_hist['Close'].iloc[-1]
            
        change = current_price - previous_close
        change_pct = (change / previous_close) * 100
        
        fresh_data = {
            "ticker": ticker_upper,
            "price": float(current_price),
            "change": float(change),
            "changePct": float(change_pct)
        }
        
        quote_cache[ticker_upper] = (current_time, fresh_data)
        return fresh_data
        
    except Exception as e:
        print(f"Quote Error for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/chart/{ticker}")
async def get_chart_data(ticker: str, timeframe: str = Query("1D")): # Defaulted to 1D
    """Fetches historical price data mapped to specific timeframes, including extended hours."""
    try:
        stock = yf.Ticker(ticker)
        
        timeframe_map = {
            "1D": {"period": "1d", "interval": "1m"}, # Upgraded to 1m resolution for 1D chart
            "1W": {"period": "5d", "interval": "15m"},
            "1M": {"period": "1mo", "interval": "1d"},
            "3M": {"period": "3mo", "interval": "1d"},
            "1Y": {"period": "1y", "interval": "1d"},
            "ALL": {"period": "max", "interval": "1wk"}
        }
        
        tf_settings = timeframe_map.get(timeframe.upper(), timeframe_map["1D"])
        
        # CRITICAL: Added prepost=True so the chart plots after-hours data!
        hist = stock.history(period=tf_settings["period"], interval=tf_settings["interval"], prepost=True)
        
        if hist.empty:
             return {"ticker": ticker.upper(), "data": []}
             
        chart_data = []
        for date, row in hist.iterrows():
            if tf_settings["interval"] in ["1m", "5m", "15m"]:
                date_str = date.strftime("%I:%M %p") 
            elif tf_settings["interval"] == "1wk":
                date_str = date.strftime("%b %Y")    
            else:
                date_str = date.strftime("%b %d")    
                
            chart_data.append({
                "date": date_str,
                "close": round(row['Close'], 2)
            })
            
        return {"ticker": ticker.upper(), "timeframe": timeframe, "data": chart_data}
        
    except Exception as e:
        print(f"Chart Error for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 1. Create a memory cache and set the limit to 10 seconds
quote_cache = {}
CACHE_TTL = 10 

@app.get("/api/v1/quote/{ticker}")
async def get_live_quote(ticker: str):
    """Fetches live intraday price with a 10-second safety cache."""
    ticker_upper = ticker.upper()
    current_time = time.time()
    
    # 2. Safety Check: If we fetched this stock less than 10 seconds ago, return the saved price instantly!
    if ticker_upper in quote_cache:
        last_fetch_time, cached_data = quote_cache[ticker_upper]
        if current_time - last_fetch_time < CACHE_TTL:
            return cached_data

    try:
        # 3. If the cache is old, ping Yahoo Finance for fresh data
        stock = yf.Ticker(ticker_upper)
        hist = stock.history(period="5d") 
        if hist.empty:
            raise ValueError(f"No price data found for {ticker_upper}.")
            
        current_price = hist['Close'].iloc[-1]
        
        if len(hist) >= 2:
            previous_close = hist['Close'].iloc[-2]
        else:
            previous_close = hist['Open'].iloc[0]
            
        change = current_price - previous_close
        change_pct = (change / previous_close) * 100
        
        fresh_data = {
            "ticker": ticker_upper,
            "price": float(current_price),
            "change": float(change),
            "changePct": float(change_pct)
        }
        
        # 4. Save the fresh data to the cache so the next rapid-fire request doesn't hit Yahoo
        quote_cache[ticker_upper] = (current_time, fresh_data)
        
        return fresh_data
        
    except Exception as e:
        print(f"Quote Error for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_ai_insights(
    ticker: str,
    x_api_key: str | None = Header(default=None)
):
    try:
        if not x_api_key:
            raise HTTPException(status_code=401, detail="API Key missing. Please set it in the app settings.")

        client = genai.Client(api_key=x_api_key)
        news_items = []
        is_portfolio = ticker.upper() == "PORTFOLIO"

        # ==========================================
        # PATH A: PORTFOLIO / MACRO ANALYSIS
        # ==========================================
        if is_portfolio:
            try:
                with DDGS() as ddgs:
                    # Search for broad market/economy news instead of a specific stock
                    results = ddgs.text("stock market macro economy federal reserve interest rates news", max_results=5)
                    if results:
                        for r in results:
                            news_items.append(f"Title: {r.get('title', '')}\nSnippet: {r.get('body', '')}\n---")
            except Exception as e:
                print(f"Macro search failure: {e}")

            context_data = "\n".join(news_items) if news_items else "No immediate news. Rely on internal macro knowledge."
            
            prompt = f"""
            You are a Chief Investment Officer. Provide a broad macroeconomic analysis of the current stock market environment.
            Context: {context_data}
            """
            
            schema_instructions = """
            Return ONLY a raw, valid JSON object matching this exact schema. Do not wrap in markdown.
            {
              "analysis_type": "portfolio",
              "macro_allocation": "<A 2-sentence analysis of the current market environment and whether cash/liquidity is valuable right now.>",
              "risk_concentration": "<A 2-sentence analysis of current broader market risks, sector headwinds, or volatility.>",
              "rebalancing_strategy": "<Specific advice on what asset classes or sectors to accumulate, trim, or avoid right now.>"
            }
            """

        # ==========================================
        # PATH B: SINGLE STOCK ANALYSIS
        # ==========================================
        else:
            try:
                with DDGS() as ddgs:
                    results = ddgs.text(f"{ticker} stock government regulatory earnings catalyst news", max_results=5)
                    if results:
                        for r in results:
                            news_items.append(f"Title: {r.get('title', '')}\nSnippet: {r.get('body', '')}\n---")
            except Exception as e:
                print(f"Search failure for {ticker}: {e}")

            context_data = "\n".join(news_items) if news_items else "No immediate news. Rely on internal knowledge."
            
            prompt = f"""
            You are an elite institutional equity research analyst. Conduct a granular, highly structured analysis for {ticker.upper()} using the provided context.
            Recent Context: {context_data}
            CRITICAL: Be concise, data-driven, and decisive.
            """

            schema_instructions = f"""
            Return ONLY a raw, valid JSON object matching this exact schema. Do not wrap in markdown.
            {{
              "ticker": "{ticker.upper()}",
              "sentiment": {{
                "label": "<Bullish, Neutral, Bearish>",
                "wall_street_consensus": "<1 sentence on what institutions are saying right now>",
                "catalyst_summary": "<1 sentence on exactly why the stock is currently moving>"
              }},
              "fundamentals": {{
                "business_health": "<1 sentence on balance sheet strength, margins, and operational health>",
                "valuation_status": "<Explicitly state if Cheap, Fairly Valued, or Overvalued, and why>"
              }},
              "competition": [
                {{
                  "competitor": "<Ticker>",
                  "threat_level": "<High, Medium, Low>",
                  "comparative_advantage": "<How they rival {ticker.upper()}>"
                }}
              ],
              "strategy": {{
                "buy_zone": "<Specific conditions or price levels for optimal entry>",
                "sell_zone": "<Specific conditions or price levels for taking profit>",
                "bull_scenario": "<What needs to happen for a breakout>",
                "bear_scenario": "<What causes a breakdown>"
              }}
            }}
            """

        # ==========================================
        # EXECUTE AND PARSE
        # ==========================================
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt + schema_instructions,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text.replace("```json", "").replace("```", "").strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.replace("```", "").strip()

        return json.loads(raw_text)

    except Exception as e:
        print(f"BACKEND ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))