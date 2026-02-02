import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function App() {
  const [services, setServices] = useState([]);
  const [runs, setRuns] = useState([]);

  async function refresh() {
    try {
      const servicesResponse = await fetch(`${API}/api/services`);
      if (!servicesResponse.ok) {
        throw new Error(`Failed to fetch services: ${servicesResponse.status} ${servicesResponse.statusText}`);
      }
      const s = await servicesResponse.json();
      setServices(s);

      const runsResponse = await fetch(`${API}/api/runs`);
      if (!runsResponse.ok) {
        throw new Error(`Failed to fetch runs: ${runsResponse.status} ${runsResponse.statusText}`);
      }
      const rr = await runsResponse.json();
      setRuns(rr.items || []);
    } catch (error) {
      console.error("Failed to refresh data:", error);
      setServices([]);
      setRuns([]);
      alert("Failed to load data from the server. Please try again later.");
    }
  }

  async function runScenario(scenario_id) {
    try {
      const response = await fetch(`${API}/api/scenarios/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id })
      });
      if (!response.ok) {
        throw new Error(`Failed to run scenario: ${response.status} ${response.statusText}`);
      }
      await refresh();
    } catch (error) {
      console.error("Failed to run scenario:", error);
      alert("Failed to run scenario. Please try again.");
    }
  }

  async function resetScenario() {
    try {
      const response = await fetch(`${API}/api/scenarios/reset`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Failed to reset scenario: ${response.status} ${response.statusText}`);
      }
      await refresh();
    } catch (error) {
      console.error("Failed to reset scenario:", error);
      alert("Failed to reset scenario. Please try again.");
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div
      style={{
        background: "#0b0f14",
        color: "#e5e7eb",
        minHeight: "100vh",
        padding: 20,
        fontFamily: "system-ui",
        maxWidth: 1100,
        margin: "0 auto"
      }}
    >
      <h1>IT/OT Lab v2 (MVP)</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <a href="http://localhost:3000" target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>Open Grafana</a>
        <a href="http://localhost:9500" target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>Open Prometheus</a>
        <a href="http://localhost:3100/ready" target="_blank" rel="noreferrer" style={{ color: "#93c5fd" }}>Loki Ready</a>
      </div>

      <h2 style={{ marginTop: 24 }}>Scenarios</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {["normal","sensor_drift","valve_stuck","comms_jitter","rogue_device"].map(m => (
          <button
            key={m}
            onClick={() => runScenario(m)}
            style={{
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #374151",
              padding: "6px 12px",
              cursor: "pointer"
            }}
          >
            {m}
          </button>
        ))}
        <button
          onClick={resetScenario}
          style={{
            background: "#111827",
            color: "#e5e7eb",
            border: "1px solid #374151",
            padding: "6px 12px",
            cursor: "pointer"
          }}
        >
          reset
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>Scenario → Expected Signals</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#020617"
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Scenario</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Expected Signals</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>sensor_drift</td>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>temp ↑, log: alarm</td>
          </tr>
          <tr>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>valve_stuck</td>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>valve_state=0, anomaly log</td>
          </tr>
          <tr>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>comms_jitter</td>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>timeout logs</td>
          </tr>
          <tr>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>rogue_device</td>
            <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>asset log</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Topology</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {["IT Zone", "DMZ", "OT Zone"].map((zone, index) => (
          <React.Fragment key={zone}>
            <div
              style={{
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 8,
                padding: "10px 16px",
                minWidth: 120,
                textAlign: "center"
              }}
            >
              {zone}
            </div>
            {index < 2 && <span style={{ color: "#94a3b8" }}>──▶</span>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {["IT Apps", "Broker", "OT Sim"].map((item, index) => (
          <React.Fragment key={item}>
            <div
              style={{
                background: "#020617",
                border: "1px solid #1f2937",
                borderRadius: 6,
                padding: "8px 12px",
                minWidth: 110,
                textAlign: "center"
              }}
            >
              {item}
            </div>
            {index < 2 && <span style={{ color: "#94a3b8" }}>──▶</span>}
          </React.Fragment>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>Services</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#020617"
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Name</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Zone</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Status</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>URL</th>
          </tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.name}>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{s.name}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{s.zone}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{s.status}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>
                <code style={{ color: "#a5b4fc" }}>{s.url}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Recent Runs</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#020617"
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>ID</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Scenario</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Status</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #1f2937" }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id}>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{r.id}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{r.scenario_id}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{r.status}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #1f2937" }}>{String(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
