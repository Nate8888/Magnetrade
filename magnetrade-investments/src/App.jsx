import React, { useCallback, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from "reactflow";
import { FaSave, FaClock } from "react-icons/fa";

import "reactflow/dist/style.css";
import "./style.css"; // Make sure to import the stylesheet

// Import Firestore
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js"; // Import the db object from firebase.js

const initialNodes = [];

const initialEdges = [];

const ConditionNodeComponent = ({ id, data }) => (
  <div className="condition-node">
    <Handle
      type="target"
      position={Position.Top}
      id={`${id}_input`}
      style={{ borderRadius: 0 }}
    />
    <div className="condition-node-inner">
      <div className="condition-node-label">{data.label}</div>
      <div className="condition-node-summary">{data.summary}</div>
      {/* if data.evaluatedResults, display data.evaluatedResults.lhs data.evaluatedResults.op data.evaluatedResults.rhs in glowing green*/}
      {data.evaluatedResults && (
        <div className="action-node-evaluatedResults">
          Eval: {data.evaluatedResults.lhs} {data.evaluatedResults.op}{" "}
          {data.evaluatedResults.rhs}
        </div>
      )}
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      id={`${id}_output`}
      style={{ borderRadius: 0 }}
    />
  </div>
);

const ActionNodeComponent = ({ id, data }) => (
  <div className="action-node">
    <Handle
      type="target"
      position={Position.Top}
      id={`${id}_input`}
      style={{ borderRadius: 0 }}
    />
    <div className="action-node-inner">
      <div className="action-node-label">{data.label}</div>
      <div className="action-node-summary">{data.summary}</div>
    </div>
  </div>
);

const nodeTypes = {
  condition: ConditionNodeComponent,
  action: ActionNodeComponent,
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);
  // list of strategies from the menu
  const [allStrategies, setallstrategies] = useState([]);
  const [strategyId, setStrategyId] = useState(null);
  const nodeCounter = useRef(nodes.length);

  const [selectedFrequency, setSelectedFrequency] = useState("now");
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);

  // state variables for total cash and equity
  const [cash, setCash] = useState(0);
  const [equity, setEquity] = useState(0);

  // state variables for open_orders and closed_orders
  const [openOrders, setOpenOrders] = useState([]);
  const [closedOrders, setClosedOrders] = useState([]);

  // When strategyId changes, load the strategy from Firestore
  useEffect(() => {
    loadStrategyFromFirestore("nate", strategyId);
  }, [strategyId]);
  // Call the load strategy function with specific strategyId when the component mounts

  useEffect(() => {
    // Example: Assume you're loading a strategy with ID 'strategy_1' for user 'nate'
    const userId = "nate"; // Should be retrieved from the authenticated user's info
    getUserBalance();
    getAllStrategiesByUser(userId);
  }, []); // Empty dependency array ensures this is run once on component mount

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddNode = (type, label) => {
    let newNodeId = (nodeCounter.current += 1).toString();
    while (nodes.find((node) => node.id === newNodeId)) {
      newNodeId = (nodeCounter.current += 1).toString();
    }
    const newNode = {
      id: newNodeId,
      type: type,
      position: {
        x: Math.random() * window.innerWidth * 0.5,
        y: Math.random() * window.innerHeight * 0.5,
      },
      data: { label },
    };
    setNodes((nds) => nds.concat(newNode));
    setShowDropdown(false);
  };

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();

      // Get the clientX and clientY values where the right-click happened
      const clickX = event.clientX;
      const clickY = event.clientY;

      // Get viewport dimensions
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      // Calculate the available space from the click position to the bottom of the screen
      const maxHeight = screenH - clickY;

      // Set the position and pass the maxHeight to the contextMenuNode state
      setContextMenuNode({
        nodeId: node.id,
        posX: clickX,
        posY: clickY,
        maxHeight: maxHeight, // This will be used to set the maxHeight style of the context menu
      });
    },
    [setContextMenuNode]
  );

  // Helper function to create a map of the adjacency list from edges
  function createAdjacencyList(nodes, edges) {
    const adjacencyList = new Map(nodes.map((node) => [node.id, []]));
    edges.forEach((edge) => {
      adjacencyList.get(edge.source).push(edge.target);
    });
    return adjacencyList;
  }

  // Helper function to check for incoming edges
  const hasIncomingEdges = (nodeId, edges) =>
    edges.some((edge) => edge.target === nodeId);

  // Helper function to check if node is a condition node
  const isConditionNode = (node) => node.data.label.startsWith("Condition");

  // Function to traverse from a given node and collect the path
  const traverse = (nodeId, edges, nodeMap, path) => {
    path.push(nodeMap.get(nodeId).data.summary);
    const outgoingEdges = edges.filter((edge) => edge.source === nodeId);
    outgoingEdges.forEach((edge) => {
      if (isConditionNode(nodeMap.get(edge.target))) {
        // Continue if next node is a condition
        traverse(edge.target, edges, nodeMap, path);
      } else if (
        !isConditionNode(nodeMap.get(edge.target)) &&
        !hasIncomingEdges(edge.target, edges)
      ) {
        // Add action if it's an endpoint
        path.push(nodeMap.get(edge.target).data.summary);
      }
    });
  };

  // Main function to identify and separate connected components
  function extractWorkflow(nodes, edges) {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const workflows = [];

    const isConditionNode = (node) => node.data.label.startsWith("Condition");
    const isActionNode = (node) => node.data.label.startsWith("Action");
    const findEdgesBySource = (sourceId) =>
      edges.filter((e) => e.source === sourceId);

    // Recursive function to build the workflow from a starting node
    const buildWorkflowFromNode = (nodeId, workflow) => {
      const node = nodeMap.get(nodeId);
      if (!node) return; // In case the node is not found in the nodeMap, we return early.

      workflow.push(node.data.summary); // Add the current node summary to the workflow.

      const outgoingEdges = findEdgesBySource(nodeId);

      if (isActionNode(node) && outgoingEdges.length === 0) {
        // No recursive call needed since we don't continue from standalone Action nodes.
        return;
      }

      // Continue the workflow with connected nodes.
      outgoingEdges.forEach((edge) => {
        buildWorkflowFromNode(edge.target, workflow);
      });
    };

    // Identify starting nodes (Condition nodes without incoming edges or standalone Action nodes).
    nodes.forEach((node) => {
      const hasIncoming = edges.some((e) => e.target === node.id);
      if (
        (isConditionNode(node) && !hasIncoming) ||
        (isActionNode(node) && !hasIncoming)
      ) {
        const workflow = [];
        buildWorkflowFromNode(node.id, workflow);
        workflows.push(workflow);
      }
    });

    return workflows;
  }

  // Function to construct the workflow object based on the topological sort
  // Function to transform ordered components into an object with summaries
  // Function to construct the workflow object based on the topological sort
  function constructOrderedWorkflow(workflows, nodes) {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    // Map each workflow path to its summary representation
    const workflowSummaries = workflows.map(
      (path) =>
        path
          .map((nodeId) => {
            const node = nodeMap.get(nodeId);
            return node && node.data ? node.data.summary : undefined;
          })
          .filter((summary) => summary !== undefined) // Filter out undefined summaries
    );

    return workflowSummaries;
  }

  const [valueSelect, setValueSelect] = useState("MovingAverage");
  const handleValueSelectChange = (event) => {
    setValueSelect(event.target.value);
  };

  const [selectedMenu, setSelectedMenu] = useState(null);
  const [selections, setSelections] = useState({});

  const handleSubMenuChange = (nodeId, menuKey, subMenuKey) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                menus: {
                  ...node.data.menus,
                  [menuKey]: subMenuKey,
                },
                menuSelections: {
                  ...node.data.menuSelections,
                  [menuKey]: {}, // Reset selections for the menu when a new sub menu is selected
                },
              },
            }
          : node
      )
    );
  };

  const handleNodeInputChange = (nodeId, promptLabel, value, menuKey) => {
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (node.id === nodeId) {
          // Create a new object with updated menu selections
          const newData = {
            ...node.data,
            menuSelections: {
              ...node.data.menuSelections,
              [menuKey]: {
                ...node.data.menuSelections[menuKey],
                [promptLabel]: value,
              },
            },
          };
          // Generate a new summary based on the new data
          const newSummary = generateNodeSummary({ ...node, data: newData });
          // Return the node with updated data and summary
          return {
            ...node,
            data: {
              ...newData,
              summary: newSummary,
            },
          };
        }
        return node;
      });
    });
  };

  // useEffect everytime that nodes changes
  useEffect(() => {
    // Get the selected node
    console.log("nodes", nodes);
  }, [nodes]);

  const operatorOptions = {
    operator: {
      prompts: [
        {
          label: "Operator",
          type: "select",
          options: [">", "<", "=="],
        },
      ],
    },
  };

  const menuConfiguration = {
    "Condition Block": {
      "Operation 1": {
        "RSI (Relative Strength Index)": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Look-back Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
          ],
        },
        "Bollinger Bands Middle": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Look-back Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
            {
              label: "Standard Deviations:",
              type: "input",
              inputType: "number",
            },
          ],
        },
        "MACD Line": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Fast Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Slow Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Signal Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
          ],
        },
        "Current Stock Price": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
          ],
        },
        Number: {
          prompts: [
            {
              label: "Number:",
              type: "input",
              inputType: "number",
            },
          ],
        },
        Volume: {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Look-back Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
          ],
        },
      },
      condition: operatorOptions,
      "Operation 2": {
        "RSI (Relative Strength Index)": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Look-back Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
          ],
        },
        "Bollinger Bands Middle": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Look-back Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
            {
              label: "Standard Deviations:",
              type: "input",
              inputType: "number",
            },
          ],
        },
        "MACD Line": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Fast Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Slow Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Signal Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
          ],
        },
        "Current Stock Price": {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
          ],
        },
        Number: {
          prompts: [
            {
              label: "Number:",
              type: "input",
              inputType: "number",
            },
          ],
        },
        Volume: {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Look-back Period:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Aggregation:",
              type: "select",
              options: ["Minutes", "Hours", "Days", "Weeks", "Months"],
            },
          ],
        },
      },
    },
    "Action Block": {
      Actions: {
        Buy: {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Quantity:",
              type: "input",
              inputType: "number",
            },
            // Run only once
            {
              label: "Execution:",
              type: "select",
              options: ["once", "loop"],
            },
          ],
        },
        Sell: {
          prompts: [
            {
              label: "Asset:",
              type: "select",
              options: ["AAPL", "MSFT", "GOOGL"],
            },
            {
              label: "Quantity:",
              type: "input",
              inputType: "number",
            },
            {
              label: "Execution:",
              type: "select",
              options: ["once", "loop"],
            },
          ],
        },
      },
    },
  };

  const renderNodeMenu = (selectedNode) => {
    return (
      <>
        {Object.keys(menuConfiguration[selectedNode.data.label]).map(
          (menuKey) => {
            const menu = menuConfiguration[selectedNode.data.label][menuKey];
            const selectedSubMenuKey =
              selectedNode.data.menus && selectedNode.data.menus[menuKey];

            return (
              <div key={menuKey} style={{ padding: "5px" }}>
                <select
                  value={selectedSubMenuKey || ""}
                  onChange={(e) =>
                    handleSubMenuChange(
                      selectedNode.id,
                      menuKey,
                      e.target.value
                    )
                  }
                >
                  <option value="">Select {menuKey}</option>
                  {Object.keys(menu).map((subMenuKey) => (
                    <option key={subMenuKey} value={subMenuKey}>
                      {subMenuKey}
                    </option>
                  ))}
                </select>

                {/* Render the prompts if a sub menu is selected */}
                {selectedSubMenuKey &&
                  menu[selectedSubMenuKey].prompts.map((prompt, index) => (
                    <div key={index} style={{ padding: "5px", color: "black" }}>
                      {renderPrompt(prompt, index, selectedNode.id, menuKey)}
                    </div>
                  ))}
              </div>
            );
          }
        )}
      </>
    );
  };

  // Renders an individual prompt based on its type
  const renderPrompt = (prompt, index, nodeId, menuKey) => {
    // Retrieve the savedValue using the menuKey and prompt.label
    const savedValue =
      selectedNode?.data.menuSelections[menuKey]?.[prompt.label];

    switch (prompt.type) {
      case "select":
        return (
          <div key={index} style={{ padding: "5px", color: "black" }}>
            <label>{prompt.label}: </label>
            <select
              onChange={(e) =>
                handleNodeInputChange(
                  nodeId,
                  prompt.label,
                  e.target.value,
                  menuKey
                )
              }
              // Use savedValue or the default value depending on whether savedValue exists
              value={savedValue !== undefined ? savedValue : ""}
            >
              <option value="">Select {prompt.label}</option>
              {prompt.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      case "input":
        return (
          <div key={index} style={{ padding: "5px", color: "black" }}>
            <label>{prompt.label}: </label>
            <input
              // Use value or empty string if value is undefined
              value={savedValue !== undefined ? savedValue : ""}
              type={prompt.inputType || "text"}
              onChange={(e) =>
                handleNodeInputChange(
                  nodeId,
                  prompt.label,
                  e.target.value,
                  menuKey
                )
              }
            />
          </div>
        );
      case "selectMultiple":
        // Ensure savedValue is an array for 'selectMultiple'
        const savedArrayValue = Array.isArray(savedValue) ? savedValue : [];
        return (
          <div key={index} style={{ padding: "5px", color: "black" }}>
            <label>{prompt.label}: </label>
            <select
              multiple
              // Use savedValue as array or empty array if undefined
              value={savedArrayValue}
              onChange={(e) =>
                handleNodeInputChange(
                  nodeId,
                  prompt.label,
                  Array.from(
                    e.target.selectedOptions,
                    (option) => option.value
                  ),
                  menuKey
                )
              }
            >
              {prompt.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      // ... other cases
      default:
        return null;
    }
  };

  const selectedNode = contextMenuNode
    ? nodes.find((n) => n.id === contextMenuNode.nodeId)
    : null;

  // Place this function inside your App component
  const generateNodeSummary = (node) => {
    let summaryParts = [];

    if (node.data.label === "Condition Block") {
      const orderedMenuKeys = Object.keys(menuConfiguration["Condition Block"]);

      for (const menuKey of orderedMenuKeys) {
        const selectedOperation = node.data.menus?.[menuKey];
        if (selectedOperation) {
          const operation = menuConfiguration["Condition Block"][menuKey];
          const selectedSubMenu = operation[selectedOperation];

          if (selectedSubMenu && selectedSubMenu.prompts) {
            if (selectedOperation != "operator")
              summaryParts.push(selectedOperation);
            const promptValues = selectedSubMenu.prompts
              .map((prompt) => {
                // Use the menuSelections to retrieve the saved value for each prompt
                const savedValue =
                  node.data.menuSelections?.[menuKey]?.[prompt.label];
                return savedValue ? `${savedValue}` : "";
              })
              .filter(Boolean)
              .join(" "); // Remove empty strings and join with space

            // Add the operation name followed by the collected prompt values
            summaryParts.push(`${promptValues}`);
          }
        }
      }
    }
    // Action Block logic
    // This helper function retrieves prompt values and formats them
    const getPromptValues = (operation, menuKey, node) => {
      return operation.prompts
        .map((prompt) => {
          const savedValue =
            node.data.menuSelections?.[menuKey]?.[prompt.label];
          // Assume the prompt label should not be included in the summary, just the value
          return savedValue || ""; // Default to an empty string if no value saved
        })
        .filter(Boolean) // Remove empty strings
        .join(" "); // Join with spaces
    };

    // Action Block logic
    if (node.data.label === "Action Block") {
      const orderedMenuKeys = Object.keys(menuConfiguration["Action Block"]);

      for (const menuKey of orderedMenuKeys) {
        const selectedActionKey = node.data.menus?.[menuKey];

        if (selectedActionKey) {
          const actionConfig =
            menuConfiguration["Action Block"][menuKey][selectedActionKey];

          if (actionConfig && actionConfig.prompts) {
            const promptValues = getPromptValues(actionConfig, menuKey, node);
            // Adding the action name and the prompt values to the summary
            summaryParts.push(`${selectedActionKey} ${promptValues}`);
          }
        }
      }
    }

    // Join the summary parts with spaces
    return summaryParts.length > 0
      ? summaryParts.join(" ")
      : "No operations defined";
  };

  const saveStrategyToFirestore = async () => {
    console.log("Saving strategy to Firestore...");
    // get the state strategyId, if it's null, create a new strategy
    // if it's not null, update the existing strategy
    // Call extractWorkflow and constructOrderedWorkflow to get the ordered actions
    const sortedComponents = extractWorkflow(nodes, edges);
    const orderedWorkflowString = JSON.stringify(sortedComponents);
    const strategyData = {
      // If using authenticated userId, replace 'nate' with the userId variable
      uid: "nate",
      strategy: {
        nodes: nodes,
        edges: edges,
      },
      orderedWorkflow: orderedWorkflowString,
      frequency: selectedFrequency,
    };

    try {
      // This assumes you want to create a new document each time you save.
      // If updating an existing strategy, use the existing strategy ID.
      if (strategyId) {
        const strategyRef = doc(collection(db, "strategies"), strategyId);
        await setDoc(strategyRef, strategyData);
        console.log("Strategy updated successfully with ID: ", strategyRef.id);
      } else {
        const strategyRef = doc(collection(db, "strategies"));
        await setDoc(strategyRef, strategyData);
        console.log("Strategy saved successfully with ID: ", strategyRef.id);
        // refresh the page
        window.location.reload();
      }
    } catch (error) {
      console.error("Error saving strategy: ", error);
    }
  };

  // Function to call to get the results from the API. This is called after loadStrategyFromFirestore.
  // it takes the orderedWorkflow string as input and sends a POST request to http://127.0.0.1:8080/commands
  // with the orderedWorkflow string as the json body with key 'commands'
  const getResultsFromAPI = async (orderedWorkflowString) => {
    const url = "http://127.0.0.1:8080/commands";
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: orderedWorkflowString }),
    };
    try {
      const response = await fetch(url, requestOptions);
      const data = await response.json();
      console.log("API response: ", data);
      // The function will return something like this:
      /*
        {
          "commandStr (from node summary)": {
            lhs: "result of lhs",
            rhs: "result of rhs",
            result: "result of lhs operator rhs",
          },
          "commandStr2 (from node summary)": {
            lhs: "result of lhs",
            rhs: "result of rhs",
            result: "result of lhs operator rhs",
          },
        }
      */
      //  edit the existing nodes to include the results from the API in the field data.evaluatedResults
      // node.summary will be equal to the key in the response object
      // node.data.evaluatedResults will be equal to the value in the response object
      setNodes((currentNodes) => {
        return currentNodes.map((node) => {
          const evaluatedResults = data[node.data.summary];
          // Figure out which operator this summary uses it can be >, <, ==
          // it will add the operator to the evaluatedResults object
          const op_options = [">", "<", "=="];
          for (const option of op_options) {
            if (node.data.summary.includes(option)) {
              evaluatedResults["op"] = option;
            }
          }
          if (evaluatedResults) {
            return {
              ...node,
              data: {
                ...node.data,
                evaluatedResults: evaluatedResults,
              },
            };
          }
          return node;
        });
      });
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };
  // Call /balance with POST. Data returned is {cash: number, equity: number}
  const getUserBalance = async () => {
    const url = "http://127.0.0.1:8080/balance";
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    try {
      const response = await fetch(url, requestOptions);
      const data = await response.json();
      setCash(data.cash);
      setEquity(data.equity);
      setOpenOrders(data.open_orders);
      setClosedOrders(data.closed_orders);
      console.log("API response: ", data);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  const getAllStrategiesByUser = async (uid) => {
    const strategiesRef = collection(db, "strategies");
    // Create a query against the collection to match the uid
    const gcloudQ = await getDocs(
      query(collection(db, "strategies"), where("uid", "==", uid))
    );
    const strategies = [];
    gcloudQ.forEach((doc) => {
      strategies.push({ id: doc.id, ...doc.data() });
    });
    // populate the sidebar menu with the strategies buttons.
    console.log("Found strategies: ", strategies);
    setallstrategies(strategies);
    return strategies;
  };

  // strategyId state
  const loadStrategyFromFirestore = async (uid, strategyId) => {
    const strategyRef = doc(db, "strategies", strategyId);

    try {
      const strategySnap = await getDoc(strategyRef);
      if (strategySnap.exists()) {
        const strategyData = strategySnap.data();
        // Assuming here retrieved data has `nodes` and `edges` format suitable for ReactFlow
        setNodes(strategyData.strategy.nodes);
        setEdges(strategyData.strategy.edges);
        // Call the getResultsFromAPI function with the orderedWorkflow string
        // set strategyId to the strategyId state
        setStrategyId(strategySnap.id);
        setSelectedFrequency(strategyData.frequency || "now");
        console.log("Strategy loaded successfully!");
        getResultsFromAPI(strategyData.orderedWorkflow);
      } else {
        // Handle the case where there is no such strategy with given ID
        console.log("No such strategy!");
      }
    } catch (error) {
      console.error("Error loading strategy: ", error);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
      }}
    >
      <aside
        style={{
          width: "20%",
          background: "#F0F0F0",
          padding: "10px",
          boxShadow: "1px 0px 3px rgba(0,0,0,0.2)",
          maxHeight: "100vh",
          overflowY: "scroll",
        }}
      >
        <div
          className="logo"
          style={{ marginBottom: "20px", color: "black", textAlign: "center" }}
        >
          <strong>Magnetrade</strong>
        </div>
        <hr />
        {/* Show the cash and equity balances */}
        <div
          className="balance-info"
          style={{ marginBottom: "20px", color: "black" }}
        >
          <strong>Cash Available:</strong>
          <div>${cash}</div>
        </div>
        <hr />
        <div
          className="balance-info"
          style={{ marginBottom: "20px", color: "black" }}
        >
          <strong>Total Equity (with cash):</strong>
          <div>${equity}</div>
        </div>
        <hr />
        {/* Right here I want to create 2 scrollable divs.
          1 for showing the openOrders & the other for the closedOrders
          They are arrays of strings. I want to show them as a list. each in a line.
        */}
        <div
          className="open-orders"
          style={{
            marginBottom: "20px",
            maxHeight: "50px",
            overflowY: "scroll",
            color: "black",
            fontSize: "small",
          }}
        >
          <strong>Open Orders:</strong>
          <div>
            {openOrders.map((order) => (
              <div key={order}>{order}</div>
            ))}
          </div>
        </div>
        <hr />
        <div
          className="closed-orders"
          style={{
            marginBottom: "20px",
            maxHeight: "50px",
            overflowY: "scroll",
            color: "black",
            fontSize: "small",
          }}
        >
          <strong>Closed Orders:</strong>
          <div>
            {closedOrders.map((order) => (
              <div key={order}>{order}</div>
            ))}
          </div>
        </div>

        <div className="strategies">
          {allStrategies.map((strategy) => (
            <button
              key={strategy.id}
              onClick={() => setStrategyId(strategy.id)}
              style={{ width: "100%", padding: "5px 10px", margin: "5px 0" }}
            >
              Strat: {strategy.id}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            width: "100%",
            padding: "5px 10px",
            margin: "20px 0",
            background: "#3385ff",
            color: "white",
            border: "none",
          }}
        >
          Create new Strategy
        </button>
      </aside>
      <div className="reactflow-wrapper" style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={(transform) =>
            console.log("Position and zoom updated", transform)
          }
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
        >
          <Controls />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>
      {/* Plus button code */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            position: "absolute",
            right: 80,
            top: 20,
            zIndex: 100,
            background: "linear-gradient(45deg, purple, red)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: 56,
            height: 56,
            cursor: "pointer",
          }}
        >
          +
        </button>
        <button
          onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
          style={{
            position: "absolute",
            right: 140, // Adjust this as needed
            top: 20,
            zIndex: 100,
            borderRadius: "50%",
            width: 56,
            height: 56,
            cursor: "pointer",
            textAlign: "center",
            border: "1px solid #3385ff",
          }}
        >
          <FaClock />
        </button>
        <button
          onClick={saveStrategyToFirestore}
          style={{
            position: "absolute",
            right: 20,
            top: 20,
            zIndex: 100,
            background: "linear-gradient(45deg, green, lightgreen)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            width: 56,
            height: 56,
            cursor: "pointer",
          }}
        >
          {/* save icon */}
          <FaSave />
        </button>
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              right: 20,
              top: 80,
              zIndex: 100,
              background: "white",
              boxShadow: "0 2px 10px rgba(0,0,0,.2)",
              borderRadius: 4,
              padding: 5,
            }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ padding: "5px" }}>
                <button
                  onClick={() => handleAddNode("condition", "Condition Block")}
                  style={{
                    padding: "10px 20px",
                    cursor: "pointer",
                    display: "block",
                    width: "100%",
                  }}
                >
                  Condition Block
                </button>
              </li>
              <li style={{ padding: "5px" }}>
                <button
                  onClick={() => handleAddNode("action", "Action Block")}
                  style={{
                    padding: "10px 20px",
                    cursor: "pointer",
                    display: "block",
                    width: "100%",
                  }}
                >
                  Action Block
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Context Menu code */}
      {selectedNode && (
        <div
          style={{
            position: "fixed",
            left: contextMenuNode.posX,
            top: contextMenuNode.posY,
            zIndex: 10,
            background: "white",
            boxShadow: "0 2px 10px rgba(0,0,0,.2)",
            borderRadius: 4,
            padding: "5px",
            maxHeight: `${contextMenuNode.maxHeight - 20}px`,
            overflow: "auto", // Add scroll if content exceeds the container height
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{ marginBottom: "5px", color: "black" }}>
            <strong>{selectedNode.data.label}</strong>
          </div>

          {/* Render the different menus */}
          {renderNodeMenu(selectedNode)}

          <div style={{ padding: "5px", marginTop: "10px" }}>
            <button
              onClick={() => setContextMenuNode(null)}
              style={{
                background: "#3385ff",
                color: "white",
                border: "none",
                padding: "5px 10px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showFrequencyDropdown && (
        <div
          style={{
            position: "absolute",
            right: 140, // Adjust this as needed
            top: 80,
            zIndex: 100,
          }}
        >
          <select
            value={selectedFrequency}
            onChange={(e) => setSelectedFrequency(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              margin: "5px 0",
            }}
          >
            <option value="now">Now</option>
            <option value="1min">Every 1 Minute</option>
            <option value="1hour">Every Hour</option>
            <option value="1day">Every Day</option>
          </select>
        </div>
      )}
    </div>
  );
}
