import React, { useCallback, useState, useRef } from "react";
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";

import "reactflow/dist/style.css";

const initialNodes = [
  {
    id: "1",
    type: "input",
    position: { x: 250, y: 0 },
    data: { label: "Condition Block" },
    style: {
      background: "linear-gradient(45deg, red, #8e44ad)",
      color: "white",
    },
  },
  {
    id: "2",
    position: { x: 100, y: 100 },
    data: { label: "Action Block" },
    style: {
      background: "linear-gradient(45deg, purple, #8e44ad)",
      color: "white",
    },
  },
];

const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);

  const nodeCounter = useRef(2);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddNode = (type, label) => {
    const newNodeId = (nodeCounter.current += 1).toString();
    const styleByLabel = {
      "Condition Block": {
        background: "linear-gradient(45deg, red, #8e44ad)",
        color: "white",
      },
      "Action Block": {
        background: "linear-gradient(45deg, purple, #8e44ad)",
        color: "white",
      },
    };
    const newNode = {
      id: newNodeId,
      type: type,
      position: {
        x: Math.random() * window.innerWidth * 0.5,
        y: Math.random() * window.innerHeight * 0.5,
      },
      data: { label },
      style: styleByLabel[label],
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
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                menuSelections: {
                  ...node.data.menuSelections,
                  [menuKey]: {
                    ...node.data.menuSelections[menuKey],
                    [promptLabel]: value,
                  },
                },
              },
            }
          : node
      )
    );
    console.log(nodes);
  };

  const operatorOptions = {
    operator: {
      prompts: [
        {
          label: "Choose Operator",
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
              label: "Standard Deviations:",
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
        "Volume": {
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
              label: "Standard Deviations:",
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
        "Volume": {
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
            right: 20,
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
                  onClick={() => handleAddNode("default", "Condition Block")}
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
                  onClick={() => handleAddNode("default", "Action Block")}
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
            overflow: "auto" // Add scroll if content exceeds the container height
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
