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
      setContextMenuNode({
        nodeId: node.id,
        posX: event.clientX,
        posY: event.clientY,
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

  const handleSubMenuChange = (nodeId, subMenuKey) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                selectedSubMenu: subMenuKey,
                menuSelections: {}, // Reset selections when a new sub menu is selected
              },
            }
          : node
      )
    );
  };

  const handleNodeInputChange = (nodeId, promptLabel, value) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                menuSelections: {
                  ...node.data.menuSelections,
                  [promptLabel]: value,
                },
              },
            }
          : node
      )
    );
    console.log(nodes);
  };

  const menuConfiguration = {
    "Condition Block": {
      "Moving Average": {
        prompts: [
          {
            label: "Asset:",
            type: "select",
            options: ["AAPL", "MSFT", "GOOGL"], // Add more symbols as needed
          },
          {
            label: "Select Timespan:",
            type: "select",
            options: [5, 10, 20], // timespans
          },
        ],
      },
      "Modern Portfolio Theory": {
        prompts: [
          {
            label: "Number of Assets:",
            type: "input",
            inputType: "number", // Number of assets for the portfolio
          },
          {
            label: "Select Assets:",
            type: "selectMultiple",
            options: ["AAPL", "MSFT", "GOOGL"], // Multiple assets selection
          },
        ],
      },
    },
    "Action Block": {
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
  };

  // Renders an individual prompt based on its type
  const renderPrompt = (prompt, index, nodeId) => {
    const savedValue = selectedNode?.data.menuSelections[prompt.label];

    switch (prompt.type) {
      case "select":
        return (
          <div key={index} style={{ padding: "5px", color: "black" }}>
            <label>{prompt.label}: </label>
            <select
              onChange={(e) =>
                handleNodeInputChange(nodeId, prompt.label, e.target.value)
              }
              value={savedValue || ""}
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
              value={savedValue || ""}
              type={prompt.inputType || "text"}
              onChange={(e) =>
                handleNodeInputChange(nodeId, prompt.label, e.target.value)
              }
            />
          </div>
        );
      case "selectMultiple":
        return (
          <div key={index} style={{ padding: "5px", color: "black" }}>
            <label>{prompt.label}: </label>
            <select
              multiple
              value={savedValue || []}
              onChange={(e) =>
                handleNodeInputChange(
                  nodeId,
                  prompt.label,
                  Array.from(e.target.selectedOptions, (option) => option.value)
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
                  Conditional Block
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
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{ marginBottom: "5px" }}>
            <strong>{selectedNode.data.label}</strong>
          </div>

          {menuConfiguration[selectedNode.data.label] && (
            <div style={{ padding: "5px" }}>
              <select
                value={selectedNode.data.selectedSubMenu || ""}
                onChange={(e) =>
                  handleSubMenuChange(selectedNode.id, e.target.value)
                }
              >
                <option value="">Select an Option...</option>
                {Object.keys(menuConfiguration[selectedNode.data.label]).map(
                  (menuKey) => (
                    <option key={menuKey} value={menuKey}>
                      {menuKey}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {/* Map through prompts and render form elements */}
          {selectedNode.data.selectedSubMenu &&
            menuConfiguration[selectedNode.data.label][
              selectedNode.data.selectedSubMenu
            ].prompts.map((prompt, index) => (
              <div key={index} style={{ padding: "5px", color: "black" }}>
                <label htmlFor={`node-${selectedNode.id}-${prompt.label}`}>
                  {prompt.label}
                </label>
                {renderPrompt(prompt, index, selectedNode.id)}
              </div>
            ))}

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
