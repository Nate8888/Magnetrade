from flask import Flask, jsonify, request
from google.cloud import firestore
from google.oauth2 import service_account
from flask_cors import CORS, cross_origin
import pandas as pd
import json
import requests
import os
import talib
from dotenv import load_dotenv
load_dotenv()


app = Flask(__name__, static_folder="build", static_url_path="/")
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

# Initialize Firestore DB
credentials = service_account.Credentials.from_service_account_file('cred.json')
APCA_KEY = os.getenv('APCA_KEY')
APCA_SECRET_KEY = os.getenv('APCA_SECRET_KEY')

db = firestore.Client(credentials=credentials, project=credentials.project_id)


def alpaca_get_account():
    url = "https://paper-api.alpaca.markets/v2/account"

    headers = {
        "accept": "application/json",
        "APCA-API-KEY-ID": APCA_KEY,
        "APCA-API-SECRET-KEY": APCA_SECRET_KEY
    }

    response = requests.get(url, headers=headers).json()
    return response

def alpaca_get_open_orders(status='open'):
    url = f"https://paper-api.alpaca.markets/v2/orders?status={status}"

    headers = {
        "accept": "application/json",
        "APCA-API-KEY-ID": APCA_KEY,
        "APCA-API-SECRET-KEY": APCA_SECRET_KEY
    }

    response = requests.get(url, headers=headers).json()
    # only return the orders that are not cancelled
    response = [order for order in response if order['status'] != 'canceled']
    return response

def calculate_rsi(*args):
    ticker,period_quantity, aggregation = args[:3]
    # Convert aggregation to a valid timeframe string for the get_historical_bars function
    timeframe = convert_to_timeframe(aggregation, period_quantity)
    # Call the external function to get historical data
    #print("calling get_historical_bars with", ticker, timeframe)
    historical_data = get_historical_bars(ticker, timeframe)
    #print(historical_data)
    # Convert the response to a DataFrame
    df = pd.DataFrame(historical_data.get(ticker))
    # Calculate the RSI
    #print(ticker, "values")
    #print(df['c'].values)
    rsi = talib.RSI(df['c'].values)
    return rsi[-1]

def calculate_bollinger_bands_middle(*args):
    asset, look_back_period, aggregation, std_dev = args[:4]
    timeframe = convert_to_timeframe(aggregation, look_back_period)
    historical_data = get_historical_bars(asset, timeframe)
    df = pd.DataFrame(historical_data.get(asset))
    upper, middle, lower = talib.BBANDS(df['c'].values, 
                                        timeperiod=int(look_back_period), 
                                        nbdevup=float(std_dev), 
                                        nbdevdn=float(std_dev), 
                                        matype=0)  # matype=0 is for a simple moving average
    return middle[-1]

def calculate_macd_line(*args):
    asset, fast_period, slow_period, signal_period, aggregation = args[:5]
    timeframe = convert_to_timeframe(aggregation, max(int(fast_period), int(slow_period), int(signal_period)))
    historical_data = get_historical_bars(asset, timeframe)
    df = pd.DataFrame(historical_data.get(asset))
    macd, macdsignal, macdhist = talib.MACD(df['c'].values, 
                                             fastperiod=int(fast_period), 
                                             slowperiod=int(slow_period), 
                                             signalperiod=int(signal_period))
    return macd[-1]

def get_current_stock_price(*args):
    print("Called get_current_stock_price", args[0])
    bars = get_historical_bars(args[0])
    first_val = bars.get(args[0])[0]['c']
    return first_val

def calculate_volume(*args):
    print("Called calculate_volume", args[:2])
    timeframe = convert_to_timeframe(args[2], args[1])
    bars = get_historical_bars(args[0], timeframe)
    print(bars)
    first_val = bars.get(args[0])[0]['v']
    return first_val

def execute_buy(strategy_id, whole_str):
    print("Called execute_buy", whole_str)
    if type(whole_str) != str or "Buy" not in whole_str:
        return False
    # check if str 'none' is in whole_str
    if 'none' in whole_str.lower(): # Skip
        return False
    else: # Create a sell order with alpaca
        splitted_str = whole_str.split(" ")
        url = "https://paper-api.alpaca.markets/v2/orders"

        payload = {
            "side": "buy",
            "type": "market",
            "time_in_force": "day",
            "symbol": f"{splitted_str[1]}",
            "qty": f"{splitted_str[2]}",
        }
        headers = {
            "accept": "application/json",
            "APCA-API-KEY-ID": APCA_KEY,
            "APCA-API-SECRET-KEY": APCA_SECRET_KEY
        }
        
        response = requests.post(url, json=payload, headers=headers)
        # If response status code is 200, then we have to check if whole_str has loop or once
        if response.status_code == 200:
            if 'once' in whole_str.lower():
                update_ordered_workflow(strategy_id, whole_str, whole_str.replace('once', 'none'))

        return response

# Given a strategy_id, and the initial string, and the end string, go through the orderedWorkflow
# in the firestore db
# and update the string accordingly
def update_ordered_workflow(strategy_id, initial_str, end_str):
    print("Updating ordered workflow", strategy_id, initial_str, end_str)
    strategies_ref = db.collection('strategies')
    strategy_ref = strategies_ref.document(strategy_id)
    strategy = strategy_ref.get().to_dict()
    ordered_workflow = json.loads(strategy['orderedWorkflow'])
    print("ordered_workflow", ordered_workflow)
    for each_command_group in ordered_workflow:
        for i in range(len(each_command_group)):
            if each_command_group[i] == initial_str:
                each_command_group[i] = end_str
    
    strategy['orderedWorkflow'] = json.dumps(ordered_workflow)
    all_nodes = strategy['strategy']['nodes']
    for i in range(len(all_nodes)):
        if all_nodes[i]['data']['summary'] == initial_str:
            all_nodes[i]['data']['summary'] = end_str
    strategy_ref.update(strategy)

    return True

def execute_sell(strategy_id, whole_str):
    print("Called execute_sell", whole_str)
    if type(whole_str) != str or "Sell" not in whole_str:
        return False
    if 'none' in whole_str.lower(): # Skip
        return False
    else: # Create a sell order with alpaca
        splitted_str = whole_str.split(" ")
        url = "https://paper-api.alpaca.markets/v2/orders"

        payload = {
            "side": "sell",
            "type": "market",
            "time_in_force": "day",
            "symbol": f"{splitted_str[1]}",
            "qty": f"{splitted_str[2]}",
        }
        headers = {
            "accept": "application/json",
            "APCA-API-KEY-ID": APCA_KEY,
            "APCA-API-SECRET-KEY": APCA_SECRET_KEY
        }
        
        response = requests.post(url, json=payload, headers=headers)
        # If response status code is 200, then we have to check if whole_str has loop or once
        if response.status_code == 200:
            if 'once' in whole_str.lower():
                update_ordered_workflow(strategy_id, whole_str, whole_str.replace('once', 'none'))

        return response

def execute_number(*args):
    print("Called execute_number", args[0])
    return args[0]

function_mappings = {
    "RSI (Relative Strength Index)": calculate_rsi,
    "RSI": calculate_rsi,  # This is a duplicate of "RSI (Relative Strength Index)
    "Bollinger Bands Middle": calculate_bollinger_bands_middle,
    "MACD Line": calculate_macd_line,
    "Current Stock Price": get_current_stock_price,
    "Volume": calculate_volume,
    "Buy": execute_buy,
    "Sell": execute_sell,
    "Number": execute_number,
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
    print("left_result", left_result)
    print("operator", operator)
    print("right_result", right_result)
    condition_met = eval(f"{left_result} {operator} {right_result}")
    print(f"{left_operation[0]} Condition {'met' if condition_met else 'not met'} (left: {left_result}, right: {right_result})")
    return condition_met, left_result, right_result


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

@cross_origin()
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

@cross_origin()
@app.route("/")
def index():
    return app.send_static_file("index.html")

@cross_origin()
@app.route('/commands', methods=['GET', 'POST'])
def commands():
    command_to_run = None
    # Get a single command from the request body or get from the query string
    if request.method == 'GET':
        command_to_run = request.args.get('command')
    else:
        all_commands = request.get_json()
        print("Got data type", type(all_commands))
        print("Got data", all_commands)
        # this will hold data in the format:
        '''
        {
            commands: [["RSI (Relative Strength Index) AAPL 1 Days < Number 30","Current Stock Price AAPL < Number 190","Buy AAPL 10 loop"],["Current Stock Price MSFT < Number 370","Buy MSFT 10 once"],["Volume MSFT 1 Days > Number 30000000","Buy MSFT 10 once"],["Buy GOOGL 10 once"],["Buy AAPL 100 once"]]
        }
        '''
        # json is a dict, so we need to get the value of the "commands" key
        strategy_id = all_commands.get("strategyId")
        execute = all_commands.get("execute", False)
        all_commands = json.loads(all_commands.get("commands", "[]"))
        results = {}
        # Evaluate each command and then store the lhs, rhs, and result in the results dict with key as the command
        for each_command_list in all_commands:
            broke_condition = False
            for each_command in each_command_list:
                #print("each_command", each_command)
                # skip if command ahs Buy or Sell
                if "Buy" in each_command or "Sell" in each_command:
                    if not execute:
                        continue
                    if not broke_condition:
                        # Execute the buy or sell command
                        if "Buy" in each_command:
                            ret = execute_buy(strategy_id, each_command)
                            continue
                        else:
                            ret = execute_sell(strategy_id, each_command)
                            continue
                        
                result, left_result, right_result = process_command(each_command)
                results[each_command] = {
                    "lhs": left_result,
                    "rhs": right_result,
                    "result": result
                }
                if not result:
                    broke_condition = True
        print("results", results)
        return jsonify(results), 200

    print("command_to_run", command_to_run)
    result, left_result, right_result = process_command(command_to_run)
    response_dict = {
        "command": command_to_run,
        "lhs": left_result,
        "rhs": right_result,
        "result": result
    }
    return jsonify(response_dict), 200

# cross_origin route that gets account balance from Alpaca (as a post)
@cross_origin()
@app.route('/balance', methods=['POST'])
def get_account_balance():
    try:
        acc_details = alpaca_get_account()
        cash = acc_details['cash']
        equity = acc_details['equity']
        order_details = alpaca_get_open_orders()
        open_orders = []
        for order in order_details:
            is_limit = order['order_type'] == 'limit'
            price = order['limit_price'] if is_limit else "market price"
            equivalent_string = f"{order['side']} {order['qty']} {order['symbol']} @ {price}"
            open_orders.append(equivalent_string)
        order_details = alpaca_get_open_orders(status='closed')
        closed_orders = []
        for closed_o in order_details:
            price = closed_o['filled_avg_price']
            equivalent_string = f"{closed_o['side']} {closed_o['filled_qty']}/{closed_o['qty']} {closed_o['symbol']} @ {price}"
            closed_orders.append(equivalent_string)
        return jsonify({'cash': cash, 'equity': equity, 'open_orders': open_orders, 'closed_orders': closed_orders}), 200
    except Exception as e:
        return jsonify({'cash': 100_000, 'equity': 100_000, 'open_orders': [], 'closed_orders': []}), 200

# Create a route for the readiness_check from Google Cloud App Engine
@cross_origin()
@app.route('/readines_check')
def readines_check():
    return "OK", 200

if __name__ == '__main__':
    HOST = '0.0.0.0'
    PORT = 8080
    app.run(HOST, PORT, debug=True)