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
import { FaSave } from "react-icons/fa";

import "reactflow/dist/style.css";
import "./style.css"; // Make sure to import the stylesheet

// Import Firestore
import { collection, doc, setDoc, addDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js"; // Import the db object from firebase.js

const initialNodes = [
  {
    id: "1",
    type: "custom",
    position: { x: 250, y: 0 },
    data: { label: "Condition Block" },
  },
  {
    id: "2",
    type: "custom",
    position: { x: 100, y: 100 },
    data: { label: "Action Block" },
  },
];

const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

const CustomNodeComponent = ({ id, data }) => (
  <div className="custom-node">
    <Handle
      type="target"
      position={Position.Top}
      id={`${id}_input`}
      style={{ borderRadius: 0 }}
    />
    <div className="custom-node-inner">
      <div className="custom-node-label">{data.label}</div>
      <div className="custom-node-summary">{data.summary}</div>
    </div>
    <Handle
      type="source"
      position={Position.Bottom}
      id={`${id}_output`}
      style={{ borderRadius: 0 }}
    />
  </div>
);

const nodeTypes = {
  custom: CustomNodeComponent,
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);
  const [strategyId, setStrategyId] = useState(null);
  const nodeCounter = useRef(2);

  // Call the load strategy function with specific strategyId when the component mounts
  useEffect(() => {
    // Example: Assume you're loading a strategy with ID 'strategy_1' for user 'nate'
    const strategyId = "Ncj4Tv4ljzB83hYuWHOh";
    const userId = "nate"; // Should be retrieved from the authenticated user's info
    loadStrategyFromFirestore(userId, strategyId);
  }, []); // Empty dependency array ensures this is run once on component mount

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddNode = (type, label) => {
    const newNodeId = (nodeCounter.current += 1).toString();
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

  const handleChangeNodeLabel = (newLabel) => {
    if (contextMenuNode && newLabel.trim()) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === contextMenuNode.nodeId
            ? { ...node, data: { ...node.data, label: newLabel.trim() } }
            : node
        )
      );
      setContextMenuNode(null);
    }
  };

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
          options: [">", "<", "="],
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
  // };
  //   if (node.data.label === "Action Block" && menus && menuSelections) {
  //     for (const menuKey of Object.keys(menus)) {
  //       const subMenuKey = menus[menuKey];
  //       const selections = menuSelections[menuKey];
  //       if (subMenuKey && selections) {
  //         const selectionSummary = Object.values(selections).join(" ");
  //         if (selectionSummary)
  //           operations.push(`${subMenuKey} ${selectionSummary}`);
  //       }
  //     }
  //   }

  //   return operations.join(" "); // Format your summary text as needed
  // };

  const saveStrategyToFirestore = async () => {
    console.log("Saving strategy to Firestore...");
    // get the state strategyId, if it's null, create a new strategy
    // if it's not null, update the existing strategy
    const strategyData = {
      // If using authenticated userId, replace 'nate' with the userId variable
      uid: "nate",
      strategy: {
        nodes: nodes,
        edges: edges,
      },
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
      }
    } catch (error) {
      console.error("Error saving strategy: ", error);
    }
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
        // set strategyId to the strategyId state
        setStrategyId(strategySnap.id);
        console.log("Strategy loaded successfully!");
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
        }}
      >
        <div
          className="logo"
          style={{ marginBottom: "20px", color: "black", textAlign: "center" }}
        >
          <strong>Magnetrade</strong>
        </div>
        <hr />
        <div
          className="balance-info"
          style={{ marginBottom: "20px", color: "black" }}
        >
          <strong>Total Balance:</strong>
          <div>$100000.00</div>
        </div>

        <hr />

        <div className="strategies">
          <button
            style={{ width: "100%", padding: "5px 10px", margin: "5px 0" }}
          >
            Strategy 1
          </button>
          <button
            style={{ width: "100%", padding: "5px 10px", margin: "5px 0" }}
          >
            Strategy 2
          </button>
          <button
            style={{ width: "100%", padding: "5px 10px", margin: "5px 0" }}
          >
            Strategy 3
          </button>
        </div>

        <button
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
            width: 50,
            height: 50,
            cursor: "pointer",
          }}
        >
          +
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
            width: 50,
            height: 50,
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
                  onClick={() => handleAddNode("custom", "Condition Block")}
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
                  onClick={() => handleAddNode("custom", "Action Block")}
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
    </div>
  );
}
