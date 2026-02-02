import os
import time
import json
import threading
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from prometheus_client import Gauge, Counter, generate_latest, CONTENT_TYPE_LATEST

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "")
ZONE = os.getenv("OT_ZONE", "OT")

app = FastAPI(title="OT Simulator", version="0.1.0")

mode_lock = threading.Lock()
MODE = "normal"

TEMP = Gauge("ot_temp_c", "Simulated temperature (C)")
PRESS = Gauge("ot_pressure_bar", "Simulated pressure (bar)")
FLOW = Gauge("ot_flow_lpm", "Simulated flow (L/min)")
VALVE = Gauge("ot_valve_state", "Valve state 0=closed 1=open")
EVENTS = Counter("ot_events_total", "Total simulator events", ["event_type"])
SCENARIO = Gauge("ot_scenario_mode", "Scenario mode numeric label", ["mode"])

MODE_MAP = {"normal": 0, "sensor_drift": 1, "valve_stuck": 2, "comms_jitter": 3, "rogue_device": 4}

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

def jlog(event_type: str, message: str, **fields: Any) -> None:
    payload = {
        "ts": int(time.time()),
        "service": "ot-sim",
        "zone": ZONE,
        "event_type": event_type,
        "message": message,
        "scenario_mode": get_mode(),
        **fields,
    }
    print(json.dumps(payload), flush=True)

def init_db():
    if not DATABASE_URL:
        return
    with engine.begin() as conn:
        conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ot_timeseries (
          id SERIAL PRIMARY KEY,
          ts TIMESTAMPTZ DEFAULT NOW(),
          temp_c DOUBLE PRECISION,
          pressure_bar DOUBLE PRECISION,
          flow_lpm DOUBLE PRECISION,
          valve_state INTEGER,
          mode TEXT
        );
        """))

def get_mode() -> str:
    with mode_lock:
        return MODE

def set_mode(m: str) -> None:
    global MODE
    with mode_lock:
        MODE = m
    for k in MODE_MAP:
        SCENARIO.labels(mode=k).set(0)
    SCENARIO.labels(mode=m).set(1)
    jlog("mode_change", "mode updated", mode=m)

def loop():
    # baseline values
    temp = 42.0
    pressure = 3.5
    flow = 120.0
    valve_state = 1

    init_db()
    set_mode("normal")

    while True:
        m = get_mode()

        # benign simulation changes
        temp += 0.05 if (int(time.time()) % 2 == 0) else -0.03
        pressure += 0.02
        flow += 0.1

        if m == "sensor_drift":
            temp += 0.12  # drift upward slowly
            if temp > 55:
                EVENTS.labels(event_type="temp_high").inc()
                jlog("alarm", "temperature drifting high", temp_c=temp)

        if m == "valve_stuck":
            # log says open, but valve stays closed
            valve_state = 0
            EVENTS.labels(event_type="valve_mismatch").inc()
            jlog("anomaly", "valve command mismatch (command=OPEN, state=CLOSED)", valve_state=valve_state)

        if m == "comms_jitter":
            # simulate timeouts as logs (still benign)
            if int(time.time()) % 5 == 0:
                EVENTS.labels(event_type="timeout").inc()
                jlog("warn", "intermittent timeout reading device telemetry")

        if m == "rogue_device":
            if int(time.time()) % 7 == 0:
                EVENTS.labels(event_type="new_device").inc()
                jlog("asset", "new device observed on OT network", device_id=f"OT-DEV-{int(time.time())%1000}")

        # publish metrics
        TEMP.set(temp)
        PRESS.set(pressure)
        FLOW.set(flow)
        VALVE.set(valve_state if m == "valve_stuck" else 1)

        # store to DB (MVP)
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("""INSERT INTO ot_timeseries (temp_c, pressure_bar, flow_lpm, valve_state, mode)
                            VALUES (:t,:p,:f,:v,:m)"""),
                    {"t": temp, "p": pressure, "f": flow, "v": int(valve_state if m == "valve_stuck" else 1), "m": m},
                )
        except Exception:
            # DB not ready yet sometimes; ignore for MVP
            pass

        time.sleep(1)

@app.on_event("startup")
def start_bg():
    t = threading.Thread(target=loop, daemon=True)
    t.start()
    jlog("startup", "ot-sim started")

@app.get("/health")
def health():
    return {"ok": True, "mode": get_mode()}

@app.post("/mode")
def mode(body: Dict[str, Any]):
    m = body.get("mode", "normal")
    if m not in MODE_MAP:
        return {"ok": False, "error": "invalid mode", "allowed": list(MODE_MAP.keys())}
    set_mode(m)
    return {"ok": True, "mode": m}

@app.get("/metrics")
def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)
