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

# def calculate_rsi(ticker, period_quantity, aggregation):
#     # Convert aggregation to a valid timeframe string for the get_historical_bars function
#     timeframe = convert_to_timeframe(aggregation, period_quantity)
#     # Call the external function to get historical data
#     print("calling get_historical_bars with", ticker, timeframe)
#     historical_data = get_historical_bars(ticker, timeframe)
#     print(historical_data)
#     # Convert the response to a DataFrame
#     df = pd.DataFrame(historical_data.get(ticker))
#     # Calculate the RSI
#     print(ticker, "values")
#     print(df['c'].values)
#     return True
#     # rsi = talib.RSI(df['c'].values)
#     # return rsi

def calculate_rsi(*args):
    print("Called calculate_rsi", args[:3])
    return 50

def calculate_bollinger_bands_middle(*args):
    print("Called calculate_bollinger_bands_middle", args[:4])
    return 50

def calculate_macd_line(*args):
    print("Called calculate_macd_line", args[:5])
    return 50

def get_current_stock_price(*args):
    print("Called get_current_stock_price", args[0])
    return 50

def calculate_volume(*args):
    print("Called calculate_volume", args[:2])
    return 50

def execute_buy(*args):
    print("Called execute_buy", args)
    return 50

def execute_sell(*args):
    print("Called execute_sell", args)
    return 50

function_mappings = {
    "RSI (Relative Strength Index)": calculate_rsi,
    "RSI": calculate_rsi,  # This is a duplicate of "RSI (Relative Strength Index)
    "Bollinger Bands Middle": calculate_bollinger_bands_middle,
    "MACD Line": calculate_macd_line,
    "Current Stock Price": get_current_stock_price,
    "Volume": calculate_volume,
    "Buy": execute_buy,
    "Sell": execute_sell,
}

operators = ["<", ">", "=="]

# Define the modified process_command function
def process_command(command):
    tokens = command.split()
    # If the command starts with a keyword indicating an action
    if tokens[0] in function_mappings and tokens[0] in ["Buy", "Sell"]:
        action = tokens[0]
        function_mappings[action](tokens[1], int(tokens[2]))
        return None
        
    # This will hold (function_name, [arguments])
    left_operation = None
    right_operation = None
    
    # Extract first operation
    for function_name in function_mappings:
        if command.startswith(function_name):
            rest_of_command = command[len(function_name):].strip()
            left_operation = (function_name, rest_of_command)
            break
    
    # Identify the operator and the right part of the command
    operator = None
    for op in operators:
        if op in command:
            operator = op
            break
    
    if operator is None:
        raise ValueError("No valid operator found in command.")
    
    left_part, right_part = command.split(operator)
    right_part = right_part.strip()
    
    # If the right part starts with an operation, extract it too
    for function_name in function_mappings:
        if right_part.startswith(function_name):
            rest_of_command = right_part[len(function_name):].strip()
            right_operation = (function_name, rest_of_command)
            break
    
    # Now, let's evaluate the left and right operations if any
    left_result = None
    right_result = None
    
    if left_operation:
        function_name, params_str = left_operation
        params = params_str.split()
        left_result = function_mappings[function_name](*params)
    
    if right_operation:
        function_name, params_str = right_operation
        params = params_str.split()
        right_result = function_mappings[function_name](*params)
    else:
        right_result = float(right_part)
    
    # Now, evaluate the condition with both results
    condition_met = eval(f"{left_result} {operator} {right_result}")
    print(f"{left_operation[0]} Condition {'met' if condition_met else 'not met'} (left: {left_result}, right: {right_result})")
    return condition_met
        
# Your list of commands from the input examples
commands = [
    [
        "RSI (Relative Strength Index) AAPL 1 Days < RSI (Relative Strength Index) AAPL 1 Days",
        "RSI (Relative Strength Index) AAPL 1 Days > RSI (Relative Strength Index) AAPL 1 Days",
        "Current Stock Price AAPL < RSI (Relative Strength Index) AAPL 1 Days",
        "Current Stock Price AAPL == 50",
        "Bollinger Bands Middle AAPL 1 Days 2 < Bollinger Bands Middle AAPL 1 Weeks 2",
        "Buy AAPL 10"
    ],
    # ... additional commands
]

# Process each command from the list
for group in commands:
    for command in group:
      if not process_command(command):
        print("Short Stopped @", command)
        print()


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