import os
import time
import json
from typing import List, Dict, Any

import docker
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "")
OT_SIM_URL = os.getenv("OT_SIM_URL", "http://ot-sim:9000")
LOKI_URL = os.getenv("LOKI_URL", "http://loki:3100")

app = FastAPI(title="Portal API", version="0.1.0")

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins like ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REQ_COUNT = Counter("portal_requests_total", "Total HTTP requests", ["path", "method", "status"])
LAST_SCENARIO = Gauge("portal_last_scenario_mode", "Last requested scenario mode as numeric label", ["mode"])

MODE_MAP = {"normal": 0, "sensor_drift": 1, "valve_stuck": 2, "comms_jitter": 3, "rogue_device": 4}

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
docker_client = docker.from_env()

def jlog(event_type: str, message: str, **fields: Any) -> None:
    payload = {
        "ts": int(time.time()),
        "service": "portal-api",
        "zone": "CORE",
        "event_type": event_type,
        "message": message,
        **fields,
    }
    print(json.dumps(payload), flush=True)

def init_db():
    if not DATABASE_URL:
        return
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS scenario_runs (
          id SERIAL PRIMARY KEY,
          scenario_id TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """))

async def loki_recent(service: str, minutes: int = 10, limit: int = 200) -> list[dict]:
    query = f'{{service="{service}"}}'
    end_ns = int(time.time() * 1e9)
    start_ns = end_ns - int(minutes * 60 * 1e9)

    params = {
        "query": query,
        "start": str(start_ns),
        "end": str(end_ns),
        "limit": str(limit),
        "direction": "BACKWARD",
    }

    async with httpx.AsyncClient(timeout=4.0) as client:
        r = await client.get(f"{LOKI_URL}/loki/api/v1/query_range", params=params)
        r.raise_for_status()
        data = r.json()

    items = []
    result = data.get("data", {}).get("result", [])
    for stream in result:
        labels = stream.get("stream", {})
        for ts, line in stream.get("values", []):
            items.append({"ts": ts, "labels": labels, "line": line})

    items.sort(key=lambda x: x["ts"], reverse=True)
    return items

@app.on_event("startup")
def on_startup():
    init_db()
    jlog("startup", "portal-api started")

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/metrics")
def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/services")
async def services() -> List[Dict[str, Any]]:
    # Minimal static service registry for MVP
    services = [
        {"name": "portal-api", "url": "http://portal-api:8000/api/health", "zone": "CORE"},
        {"name": "portal-ui", "url": "http://localhost:5173", "zone": "CORE", "status": "ui"},
        {"name": "ot-sim", "url": f"{OT_SIM_URL}/health", "zone": "OT"},
        {"name": "prometheus", "url": "http://prometheus:9090/-/healthy", "zone": "CORE"},
        {"name": "grafana", "url": "http://grafana:3000/api/health", "zone": "CORE"},
        {"name": "loki", "url": "http://loki:3100/ready", "zone": "CORE"},
    ]

    out = []
    async with httpx.AsyncClient(timeout=2.5) as client:
        for s in services:
            # Skip health check for UI services (client-side only)
            if s.get("status") == "ui":
                out.append({**s, "status": "ui"})
                continue
            
            try:
                r = await client.get(s["url"])
                status = "up" if r.status_code < 400 else f"down({r.status_code})"
            except Exception:
                status = "down"
            out.append({**s, "status": status})
    return out

@app.post("/api/scenarios/run")
async def run_scenario(body: Dict[str, Any]):
    scenario_id = body.get("scenario_id")
    if scenario_id not in MODE_MAP:
        raise HTTPException(status_code=400, detail=f"scenario_id must be one of {list(MODE_MAP.keys())}")

    # call OT sim mode change
    async with httpx.AsyncClient(timeout=3.0) as client:
        r = await client.post(f"{OT_SIM_URL}/mode", json={"mode": scenario_id})
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail="ot-sim rejected mode")

    LAST_SCENARIO.labels(mode=scenario_id).set(MODE_MAP[scenario_id])
    jlog("scenario_run", "scenario started", scenario_id=scenario_id)

    # store run record
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO scenario_runs (scenario_id, status) VALUES (:sid, :st)"),
                     {"sid": scenario_id, "st": "started"})

    return {"ok": True, "scenario_id": scenario_id}

@app.post("/api/scenarios/reset")
async def reset_scenario():
    async with httpx.AsyncClient(timeout=3.0) as client:
        await client.post(f"{OT_SIM_URL}/mode", json={"mode": "normal"})
    LAST_SCENARIO.labels(mode="normal").set(MODE_MAP["normal"])
    jlog("scenario_reset", "scenario reset")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO scenario_runs (scenario_id, status) VALUES (:sid, :st)"),
                     {"sid": "normal", "st": "reset"})
    return {"ok": True}

@app.get("/api/runs")
def runs():
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, scenario_id, status, created_at FROM scenario_runs ORDER BY id DESC LIMIT 50")).mappings().all()
    return {"items": list(rows)}

@app.get("/api/activity")
async def activity(limit: int = 30, service: str = "ot-sim"):
    items = await loki_recent(service=service, minutes=10, limit=limit)
    return {"items": items[:limit]}

@app.post("/api/services/{service_name}/start")
def start_service(service_name: str):
    try:
        c = docker_client.containers.get(f"it-ot-lab-v2-{service_name}-1")
        c.start()
        jlog("svc_start", "service started", service=service_name)
        return {"ok": True, "service": service_name, "action": "start"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/services/{service_name}/stop")
def stop_service(service_name: str):
    try:
        c = docker_client.containers.get(f"it-ot-lab-v2-{service_name}-1")
        c.stop(timeout=3)
        jlog("svc_stop", "service stopped", service=service_name)
        return {"ok": True, "service": service_name, "action": "stop"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/services/{service_name}/restart")
def restart_service(service_name: str):
    try:
        c = docker_client.containers.get(f"it-ot-lab-v2-{service_name}-1")
        c.restart(timeout=3)
        jlog("svc_restart", "service restarted", service=service_name)
        return {"ok": True, "service": service_name, "action": "restart"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/validate")
async def validate():
    """
    Simple validation rules:
    - sensor_drift detected if logs contain '"event_type": "alarm"' OR temp_high counter exists in logs
    - valve_stuck detected if logs contain '"event_type": "anomaly"'
    - comms_jitter detected if logs contain '"event_type": "warn"' or contains 'timeout'
    - rogue_device detected if logs contain '"event_type": "asset"'
    """
    logs = await loki_recent(service="ot-sim", minutes=20, limit=400)
    text_blob = "\n".join([x.get("line", "") for x in logs])

    def has(substr: str) -> bool:
        return substr in text_blob

    results = {
        "sensor_drift": {
            "detected": has('"event_type": "alarm"') or has("temperature drifting high") or has("temp_high"),
            "signals": ["ot_temp_c trending up", "alarm logs", "ot_events_total(temp_high)"],
        },
        "valve_stuck": {
            "detected": has('"event_type": "anomaly"') or has("valve command mismatch"),
            "signals": ["ot_valve_state=0", "anomaly logs", "ot_events_total(valve_mismatch)"],
        },
        "comms_jitter": {
            "detected": has("timeout") or has('"event_type": "warn"') or has("intermittent timeout"),
            "signals": ["timeout logs", "ot_events_total(timeout)", "metrics still scrape"],
        },
        "rogue_device": {
            "detected": has('"event_type": "asset"') or has("new device observed"),
            "signals": ["asset logs", "ot_events_total(new_device)", "no major timeseries shift"],
        },
    }

    completed = [k for k, v in results.items() if v["detected"]]
    return {"results": results, "completed": completed, "count": len(completed)}

@app.get("/api/report")
async def report():
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT scenario_id, status, created_at FROM scenario_runs ORDER BY id DESC LIMIT 200")
        ).mappings().all()

    val = await validate()
    completed = val.get("completed", [])

    logs = await loki_recent(service="ot-sim", minutes=20, limit=50)

    return {
        "lab": "IT/OT Lab v2",
        "generated_at_unix": int(time.time()),
        "completed_scenarios": completed,
        "validation": val["results"],
        "recent_runs": list(rows)[:30],
        "log_sample": logs[:15],
        "status": "PWNED" if len(completed) == 4 else "IN_PROGRESS",
        "telemetry": {
            "grafana": "http://localhost:3000",
            "prometheus": "http://localhost:9090",
            "loki": "http://localhost:3100",
        },
    }

@app.post("/api/lab/reset")
async def lab_reset():
    async with httpx.AsyncClient(timeout=3.0) as client:
        await client.post(f"{OT_SIM_URL}/mode", json={"mode": "normal"})

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE scenario_runs RESTART IDENTITY"))

    jlog("lab_reset", "lab reset done")
    return {"ok": True}
