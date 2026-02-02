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
    <div style={{ fontFamily: "system-ui", padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1>IT/OT Lab v2 (MVP)</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <a href="http://localhost:3000" target="_blank" rel="noreferrer">Open Grafana</a>
        <a href="http://localhost:9500" target="_blank" rel="noreferrer">Open Prometheus</a>
        <a href="http://localhost:3100/ready" target="_blank" rel="noreferrer">Loki Ready</a>
      </div>

      <h2 style={{ marginTop: 24 }}>Scenarios</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {["normal","sensor_drift","valve_stuck","comms_jitter","rogue_device"].map(m => (
          <button key={m} onClick={() => runScenario(m)}>{m}</button>
        ))}
        <button onClick={resetScenario}>reset</button>
      </div>

      <h2 style={{ marginTop: 24 }}>Services</h2>
      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr><th>Name</th><th>Zone</th><th>Status</th><th>URL</th></tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.zone}</td>
              <td>{s.status}</td>
              <td><code>{s.url}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Recent Runs</h2>
      <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr><th>ID</th><th>Scenario</th><th>Status</th><th>Created</th></tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.scenario_id}</td>
              <td>{r.status}</td>
              <td>{String(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
