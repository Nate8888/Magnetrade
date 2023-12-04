from flask import Flask, jsonify
from google.cloud import firestore
from google.oauth2 import service_account
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import google.auth
import json
import requests
import os
from dotenv import load_dotenv
load_dotenv()


app = Flask(__name__)

# Initialize Firestore DB
credentials = service_account.Credentials.from_service_account_file('cred.json')
APCA_KEY = os.getenv('APCA_KEY')
APCA_SECRET_KEY = os.getenv('APCA_SECRET_KEY')

db = firestore.Client(credentials=credentials, project=credentials.project_id)


def get_historical_bars(ticker, timeframe="1Min", start_date="2023-01-01", end_date=None, sort="asc"):
  url = f"https://data.alpaca.markets/v2/stocks/bars?symbols={ticker}&timeframe={timeframe}&start={start_date}&limit=10000&adjustment=raw&sort={sort}"

  headers = {
      "accept": "application/json",
      "APCA-API-KEY-ID": APCA_KEY,
      "APCA-API-SECRET-KEY": APCA_SECRET_KEY
  }

  response = requests.get(url, headers=headers).json().get('bars')

  return response

# Helper function to convert period and aggregation to a string for the get_historical_bars function
def convert_to_timeframe(aggregation, quantity):
    # Here we'll assume that 1Min, 1H, 1D, etc. are valid inputs for the function
    # This logic can be expanded to match your specific timeframe format requirements
    abbreviations = {'Minutes': 'Min', 'Hours': 'H', 'Days': 'D', 'Weeks': 'W', 'Months': 'M'}
    return f"{quantity}{abbreviations.get(aggregation, 'Min')}"

def calculate_rsi(ticker, period_quantity, aggregation):
    # Convert aggregation to a valid timeframe string for the get_historical_bars function
    timeframe = convert_to_timeframe(aggregation, period_quantity)
    # Call the external function to get historical data
    print("calling get_historical_bars with", ticker, timeframe)
    historical_data = get_historical_bars(ticker, timeframe)
    print(historical_data)
    # Convert the response to a DataFrame
    df = pd.DataFrame(historical_data.get(ticker))
    # Calculate the RSI
    print(ticker, "values")
    print(df['c'].values)
    return True
    # rsi = talib.RSI(df['c'].values)
    # return rsi

@app.route('/strategies', methods=['GET'])
def get_strategies():
    try:
        strategies_ref = db.collection('strategies')
        docs = strategies_ref.stream()
        
        strategies_list = []
        for doc in docs:
            print(f'{doc.id} => {doc.to_dict()}')
            document = doc.to_dict()
            document['orderedWorkflow'] = json.loads(document['orderedWorkflow'])
            print(document['orderedWorkflow'])
            strategies_list.append(doc.to_dict())
        return jsonify(strategies_list), 200
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/')
def home():
    print(get_historical_bars("AAPL", "1D"))
    return "Welcome to the Flask Firestore API!"

if __name__ == '__main__':
    app.run(debug=True)