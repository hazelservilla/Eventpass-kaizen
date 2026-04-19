import { useState, useEffect, useRef, useCallback } from "react";

console.log("VERSION: LATEST DEPLOY V3"); // 👈 ADD HERE

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — Replace these with your real values before deploying
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  AIRTABLE_API_KEY: import.meta.env.VITE_AIRTABLE_API_KEY,      // paste your pat_XXXXXX token
  AIRTABLE_BASE_ID: "appoq3LYXqmZSiXAa",           // paste your appXXXXXX base ID
  AIRTABLE_TABLE:   "Participants",                // keep exactly as is
  STAFF_PIN:        "1234",                        // ⚠️ change before event day!
  EVENT_NAME:       "Kaizen S9 — Season Ender Party",
};

// ─────────────────────────────────────────────────────────────────────────────
// AIRTABLE API HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const AT = {
  headers: {
    Authorization: `Bearer ${CONFIG.AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  },

  async getAll() {
    const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${CONFIG.AIRTABLE_TABLE}`;
    console.log("GET ALL URL:", url);

    const res = await fetch(url, { headers: this.headers });
    const data = await res.json();

    console.log("GET ALL DATA:", data);
    return data.records || [];
  },

  async findByID(participantId) {
    const cleanID = participantId.trim().toUpperCase();

    const formula = encodeURIComponent(
      `UPPER(TRIM({ParticipantID}))="${cleanID}"`
    );

    const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${CONFIG.AIRTABLE_TABLE}?filterByFormula=${formula}`;
    console.log("FIND URL:", url);

    const res = await fetch(url, { headers: this.headers });
    const data = await res.json();

    console.log("FIND DATA:", data);
    return data.records?.[0] || null;
  },

  async update(recordId, fields) {
    const url = `https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${CONFIG.AIRTABLE_TABLE}/${recordId}`;
    console.log("UPDATE URL:", url);

    const res = await fetch(url, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify({ fields }),
    });

    return res.json();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA (used when Airtable is not yet configured)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK = [
  { id: "rec001", fields: { ParticipantID: "KS9SEP-11111", Name: "Hazel Servilla",    Email: "hazel@thelazylifter.com", TicketType: "General", CheckedIn: false, Food: false, Dessert: false, Drinks: false }},
  { id: "rec002", fields: { ParticipantID: "KS9SEP-22222", Name: "Sample VIP",        Email: "vip@email.com",           TicketType: "VIP",     CheckedIn: false, Food: false, Dessert: false, Drinks: false }},
  { id: "rec003", fields: { ParticipantID: "KS9SEP-33333", Name: "Already Checked",   Email: "checked@email.com",       TicketType: "General", CheckedIn: true,  Food: true,  Dessert: false, Drinks: true  }},
  { id: "rec004", fields: { ParticipantID: "KS9SEP-44444", Name: "Test Participant",  Email: "test@email.com",          TicketType: "General", CheckedIn: false, Food: false, Dessert: false, Drinks: false }},
  { id: "rec005", fields: { ParticipantID: "KS9SEP-55555", Name: "Full Claims Done",  Email: "full@email.com",          TicketType: "VIP",     CheckedIn: true,  Food: true,  Dessert: true,  Drinks: true  }},
];

const isConfigured = () =>
  CONFIG.AIRTABLE_API_KEY !== "YOUR_AIRTABLE_API_KEY";

// ─────────────────────────────────────────────────────────────────────────────
// QR SCANNER (uses device camera via jsQR)
// ─────────────────────────────────────────────────────────────────────────────
function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let jsQR;
    const loadAndStart = async () => {
      try {
        // Dynamically load jsQR
        await new Promise((resolve, reject) => {
          if (window.jsQR) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
        jsQR = window.jsQR;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setScanning(true);
        }
      } catch (e) {
        setError("Camera access denied or not available. Use manual entry below.");
      }
    };
    loadAndStart();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR?.(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        onScan(code.data);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [scanning, onScan]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: 16, overflow: "hidden", background: "#000" }}>
      {error ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
          <div style={{ color: "#f87171", fontSize: 13, lineHeight: 1.6 }}>⚠️ {error}</div>
        </div>
      ) : (
        <>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          {/* Scanning overlay */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 180, height: 180, position: "relative" }}>
              {["tl","tr","bl","br"].map(c => (
                <div key={c} style={{
                  position: "absolute", width: 28, height: 28,
                  borderColor: "#22d3ee", borderStyle: "solid",
                  borderWidth: c.includes("t") ? "3px 0 0" : "0 0 3px",
                  borderRightWidth: c.includes("r") ? "3px" : 0,
                  borderLeftWidth: c.includes("l") ? "3px" : 0,
                  top: c.includes("t") ? 0 : "auto",
                  bottom: c.includes("b") ? 0 : "auto",
                  left: c.includes("l") ? 0 : "auto",
                  right: c.includes("r") ? 0 : "auto",
                  borderRadius: c === "tl" ? "6px 0 0 0" : c === "tr" ? "0 6px 0 0" : c === "bl" ? "0 0 0 6px" : "0 0 6px 0"
                }} />
              ))}
              <div style={{
                position: "absolute", left: 0, right: 0, height: 2,
                background: "linear-gradient(90deg, transparent, #22d3ee, transparent)",
                animation: "scan 2s ease-in-out infinite",
                top: "50%",
              }} />
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center" }}>
            <span style={{ background: "rgba(0,0,0,.6)", color: "#22d3ee", fontSize: 12, padding: "4px 12px", borderRadius: 20 }}>
              Point camera at QR code
            </span>
          </div>
        </>
      )}
      <style>{`@keyframes scan { 0%,100%{top:10%} 50%{top:90%} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT CARD
// ─────────────────────────────────────────────────────────────────────────────
function ResultCard({ result, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;
  const ok = result.type === "success";
  return (
    <div style={{
      position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, width: "90%", maxWidth: 360,
      background: ok ? "#052e16" : "#2d0000",
      border: `2px solid ${ok ? "#22c55e" : "#ef4444"}`,
      borderRadius: 16, padding: "16px 20px",
      boxShadow: `0 8px 32px ${ok ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`,
      animation: "slideDown .3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 32 }}>{ok ? "✅" : "❌"}</div>
        <div>
          <div style={{ color: ok ? "#86efac" : "#fca5a5", fontWeight: 700, fontSize: 16 }}>
            {result.title}
          </div>
          <div style={{ color: ok ? "#4ade80" : "#f87171", fontSize: 13, marginTop: 2 }}>
            {result.subtitle}
          </div>
        </div>
      </div>
      {result.participant && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${ok ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}` }}>
          <div style={{ color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{result.participant.Name}</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>{result.participant.TicketType} · {result.participant.ParticipantID}</div>
        </div>
      )}
      <style>{`@keyframes slideDown { from{opacity:0;transform:translateX(-50%) translateY(-20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function PinLogin({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  const submit = (p) => {
    if (p === CONFIG.STAFF_PIN) { onUnlock(); return; }
    setShake(true);
    setPin("");
    setTimeout(() => setShake(false), 500);
  };

  const press = (d) => {
    const next = pin + d;
    setPin(next);
    if (next.length === 4) setTimeout(() => submit(next), 100);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080c14",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 24
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎟️</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, color: "#fff", fontWeight: 800 }}>EventPass</div>
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 14, marginTop: 4 }}>Staff Access Required</div>
      </div>

      {/* PIN dots */}
      <div style={{ display: "flex", gap: 14, marginBottom: 40, animation: shake ? "shake .4s" : "none" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: "50%",
            background: i < pin.length ? "#22d3ee" : "rgba(255,255,255,.15)",
            transition: "background .15s",
            boxShadow: i < pin.length ? "0 0 12px #22d3ee" : "none"
          }} />
        ))}
      </div>

      {/* Numpad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,72px)", gap: 14 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
          <button key={i} onClick={() => { if (d === "⌫") setPin(p => p.slice(0,-1)); else if (d !== "") press(String(d)); }}
            disabled={d === ""}
            style={{
              width: 72, height: 72, borderRadius: 18, fontSize: d === "⌫" ? 20 : 24,
              fontWeight: 600, cursor: d === "" ? "default" : "pointer",
              background: d === "" ? "transparent" : "rgba(255,255,255,.07)",
              border: d === "" ? "none" : "1px solid rgba(255,255,255,.1)",
              color: "#fff", transition: "all .1s"
            }}
          >{d}</button>
        ))}
      </div>
      <div style={{ marginTop: 24, color: "rgba(255,255,255,.2)", fontSize: 12 }}>Demo PIN: 1234</div>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD TAB
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ records }) {
  const f = (r) => r.fields;
  const total = records.length;
  const checkedIn = records.filter(r => f(r).CheckedIn).length;
  const food = records.filter(r => f(r).Food).length;
  const dessert = records.filter(r => f(r).Dessert).length;
  const drinks = records.filter(r => f(r).Drinks).length;
  const [search, setSearch] = useState("");

  const filtered = records.filter(r =>
    f(r).Name?.toLowerCase().includes(search.toLowerCase()) ||
    f(r).ParticipantID?.toLowerCase().includes(search.toLowerCase())
  );

  const Stat = ({ icon, label, value, color, total }) => (
    <div style={{
      background: "rgba(255,255,255,.04)", borderRadius: 16, padding: "18px 16px",
      border: "1px solid rgba(255,255,255,.07)", flex: 1, minWidth: 100
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 6, fontFamily: "'Syne', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>{label}</div>
      {total && <div style={{ fontSize: 10, color, marginTop: 4, opacity: .7 }}>of {total}</div>}
    </div>
  );

  return (
    <div style={{ padding: "20px 20px 100px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Dashboard</div>
      <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13, marginBottom: 20 }}>{CONFIG.EVENT_NAME}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <Stat icon="👥" label="Registered" value={total} color="#a78bfa" />
        <Stat icon="✅" label="Checked In" value={checkedIn} color="#22c55e" total={total} />
        <Stat icon="🍽️" label="Food" value={food} color="#f59e0b" total={checkedIn} />
        <Stat icon="🍰" label="Dessert" value={dessert} color="#ec4899" total={checkedIn} />
        <Stat icon="🥤" label="Drinks" value={drinks} color="#06b6d4" total={checkedIn} />
      </div>

      {/* Progress bars */}
      {[
        { label: "Check-in Progress", val: checkedIn, max: total, color: "#22c55e" },
        { label: "Food Claims", val: food, max: checkedIn || 1, color: "#f59e0b" },
        { label: "Dessert Claims", val: dessert, max: checkedIn || 1, color: "#ec4899" },
        { label: "Drinks Claims", val: drinks, max: checkedIn || 1, color: "#06b6d4" },
      ].map(b => (
        <div key={b.label} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>
            <span>{b.label}</span>
            <span style={{ color: b.color }}>{Math.round((b.val / b.max) * 100) || 0}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${(b.val / b.max) * 100 || 0}%`, background: b.color, borderRadius: 99, transition: "width .5s ease" }} />
          </div>
        </div>
      ))}

      {/* Participants list */}
      <div style={{ marginTop: 28 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search participant…"
          style={{ width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        {filtered.map(r => (
          <div key={r.id} style={{ background: "rgba(255,255,255,.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{f(r).Name}</div>
              <div style={{ color: "rgba(255,255,255,.35)", fontSize: 12, marginTop: 2 }}>{f(r).ParticipantID} · {f(r).TicketType}</div>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 16 }}>
              <span title="Check-in">{f(r).CheckedIn ? "✅" : "⬜"}</span>
              <span title="Food">{f(r).Food ? "🍽️" : "○"}</span>
              <span title="Dessert">{f(r).Dessert ? "🍰" : "○"}</span>
              <span title="Drinks">{f(r).Drinks ? "🥤" : "○"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCANNER TAB
// ─────────────────────────────────────────────────────────────────────────────
function ScannerTab({ records, onUpdate, setResult, onScanned, autoId }) {
  const [mode, setMode] = useState("CheckedIn");
  const [manualId, setManualId] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const processedRef = useRef(false);

  // Auto-fire if URL param id was passed in after unlock
  useEffect(() => {
    if (autoId && !processedRef.current) processID(autoId);
  }, [autoId]);

  const MODES = [
    { key: "CheckedIn", label: "Check-in", icon: "✅", color: "#22c55e" },
    { key: "Food",      label: "Food",     icon: "🍽️", color: "#f59e0b" },
    { key: "Dessert",   label: "Dessert",  icon: "🍰", color: "#ec4899" },
    { key: "Drinks",    label: "Drinks",   icon: "🥤", color: "#06b6d4" },
  ];

  const currentMode = MODES.find(m => m.key === mode);

  const processID = useCallback(async (rawInput) => {
  console.log("RAW INPUT:", rawInput); // 👈 ADD HERE

  let id = rawInput.trim().toUpperCase();

  try {
    const url = new URL(rawInput);
    const param = url.searchParams.get("id");
    if (param) id = param.toUpperCase();
  } catch {}

  console.log("FINAL ID:", id); // 👈 ADD HERE

  let record = records.find(r => r.fields.ParticipantID?.toUpperCase() === id);

    // If configured, try Airtable live
    if (!record && isConfigured()) {
      try { record = await AT.findByID(id); } catch {}
    }

    if (!record) {
      setResult({ type: "error", title: "Not Found", subtitle: `No participant with ID: ${id}` });
      setLoading(false);
      setTimeout(() => { processedRef.current = false; }, 2000);
      return;
    }

    const fields = record.fields;

    // Validation
    if (mode === "CheckedIn" && fields.CheckedIn) {
      setResult({ type: "error", title: "Already Checked In", subtitle: "This participant already entered.", participant: fields });
      setLoading(false); setTimeout(() => { processedRef.current = false; }, 2000); return;
    }
    if (mode !== "CheckedIn" && !fields.CheckedIn) {
      setResult({ type: "error", title: "Not Checked In Yet", subtitle: "Participant must check in first.", participant: fields });
      setLoading(false); setTimeout(() => { processedRef.current = false; }, 2000); return;
    }
    if (mode !== "CheckedIn" && fields[mode]) {
      setResult({ type: "error", title: `Already Claimed`, subtitle: `${currentMode.label} already used.`, participant: fields });
      setLoading(false); setTimeout(() => { processedRef.current = false; }, 2000); return;
    }

    // Update
    const update = { [mode]: true };
    if (mode === "CheckedIn") update.CheckInTime = new Date().toISOString();
    else update[`${mode}Time`] = new Date().toISOString();

    if (isConfigured()) {
      try { await AT.update(record.id, update); } catch {}
    }
    onUpdate(record.id, update);
    if (onScanned) onScanned(record, mode, update);

    setResult({
      type: "success",
      title: mode === "CheckedIn" ? "Welcome! Checked In ✅" : `${currentMode.label} Claimed!`,
      subtitle: mode === "CheckedIn" ? "Entry recorded successfully" : `${currentMode.icon} stub marked as used`,
      participant: fields,
    });
    setManualId("");
    setLoading(false);
    setTimeout(() => { processedRef.current = false; }, 2000);
  }, [mode, records, loading]);

  return (
    <div style={{ padding: "20px 20px 100px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Scanner</div>
      <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13, marginBottom: 24 }}>Select mode then scan or enter ID</div>

      {/* Mode selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => { setMode(m.key); setShowCamera(false); processedRef.current = false; }} style={{
            padding: "16px 12px", borderRadius: 14, cursor: "pointer", fontSize: 14, fontWeight: 700,
            background: mode === m.key ? m.color : "rgba(255,255,255,.06)",
            color: mode === m.key ? "#fff" : "rgba(255,255,255,.4)",
            border: mode === m.key ? `2px solid ${m.color}` : "2px solid transparent",
            transition: "all .2s",
            boxShadow: mode === m.key ? `0 4px 20px ${m.color}44` : "none"
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{m.icon}</div>
            {m.label}
          </button>
        ))}
      </div>

      {/* Camera scanner */}
      <div style={{ marginBottom: 20 }}>
        {showCamera ? (
          <>
            <QRScanner onScan={processID} onClose={() => setShowCamera(false)} />
            <button onClick={() => setShowCamera(false)} style={{
              width: "100%", marginTop: 10, padding: 12, background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: 14
            }}>Close Camera</button>
          </>
        ) : (
          <button onClick={() => { setShowCamera(true); processedRef.current = false; }} style={{
            width: "100%", padding: 18, background: `linear-gradient(135deg, ${currentMode.color}22, ${currentMode.color}11)`,
            border: `2px dashed ${currentMode.color}66`, borderRadius: 16, color: currentMode.color,
            cursor: "pointer", fontSize: 16, fontWeight: 700,
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
            Tap to Open Camera & Scan QR
          </button>
        )}
      </div>

      {/* Manual entry */}
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginBottom: 8, textAlign: "center" }}>— or enter ID manually —</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={manualId} onChange={e => setManualId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && manualId && processID(manualId)}
            placeholder="e.g. EVT-001"
            style={{ flex: 1, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", fontSize: 15, outline: "none", fontFamily: "monospace", letterSpacing: 2 }}
          />
          <button onClick={() => manualId && processID(manualId)} disabled={loading}
            style={{ padding: "14px 20px", background: currentMode.color, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15, opacity: loading ? .6 : 1 }}>
            {loading ? "…" : "GO"}
          </button>
        </div>
      </div>

      {/* Mode info */}
      <div style={{ marginTop: 24, background: "rgba(255,255,255,.04)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ color: currentMode.color, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
          {currentMode.icon} {currentMode.label} Mode Active
        </div>
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, lineHeight: 1.6 }}>
          {mode === "CheckedIn"
            ? "Marks participant as arrived. Must be done before any claim stubs."
            : `Marks the ${currentMode.label} stub as claimed. Participant must be checked in first.`}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP GUIDE TAB
// ─────────────────────────────────────────────────────────────────────────────
function SetupGuide() {
  const steps = [
    {
      num: "01", title: "Create Airtable Base", color: "#a78bfa",
      items: [
        "Go to airtable.com → New Base → 'Event Registration'",
        "Create table: Participants",
        "Add fields: ParticipantID (text), Name (text), Email (email), TicketType (single select: VIP / General), CheckedIn (checkbox), CheckInTime (date), Food (checkbox), FoodTime (date), Dessert (checkbox), DessertTime (date), Drinks (checkbox), DrinksTime (date)",
        "Copy your Base ID from the URL: airtable.com/YOUR_BASE_ID/...",
        "Get your API key from airtable.com/account → Personal access tokens",
      ]
    },
    {
      num: "02", title: "Connect Typeform → Make.com", color: "#22d3ee",
      items: [
        "Sign up at make.com → Create new Scenario",
        "Add Typeform module: Watch Responses → connect your form",
        "Add Airtable module: Create Record → paste your Base ID + table name",
        "Map Typeform fields → Airtable fields (Name, Email, TicketType)",
        "Add Tools module: Generate unique ID (EVT-{{now.timestamp}})",
      ]
    },
    {
      num: "03", title: "Generate & Send QR Code", color: "#22c55e",
      items: [
        "Add HTTP module in Make.com",
        "URL: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={{ParticipantID}}",
        "Save the returned image to Airtable (QRCode attachment field)",
        "Add SendGrid or Resend module: Send confirmation email",
        "Use the email template from the demo — embed QR image inline",
      ]
    },
    {
      num: "04", title: "Deploy This App", color: "#f59e0b",
      items: [
        "Download the .jsx file from the artifact",
        "Create a new Vite + React project: npm create vite@latest eventpass -- --template react",
        "Replace src/App.jsx with this file",
        "Update the CONFIG object at the top with your Airtable API key, Base ID, and PIN",
        "Run: npm install && npm run build",
        "Deploy the dist/ folder to Vercel: vercel deploy",
        "Share the Vercel URL with your event staff!",
      ]
    },
    {
      num: "05", title: "Event Day Operations", color: "#ec4899",
      items: [
        "Open the app on staff tablets/phones → enter PIN (1234 default)",
        "Entry gate: set Scanner to CHECK-IN mode",
        "Food station: set Scanner to FOOD mode",
        "Dessert station: set Scanner to DESSERT mode",
        "Drinks station: set Scanner to DRINKS mode",
        "Monitor Dashboard tab for real-time counts",
      ]
    },
  ];

  return (
    <div style={{ padding: "20px 20px 100px" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Setup Guide</div>
      <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13, marginBottom: 24 }}>Follow these steps to go live</div>

      {steps.map(s => (
        <div key={s.num} style={{ marginBottom: 20, background: "rgba(255,255,255,.04)", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ background: `${s.color}22`, borderBottom: `1px solid ${s.color}33`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, color: s.color }}>{s.num}</div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{s.title}</div>
          </div>
          <div style={{ padding: "14px 18px" }}>
            {s.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${s.color}22`, border: `1px solid ${s.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: s.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, lineHeight: 1.6 }}>{item}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Config box */}
      <div style={{ background: "#0a1628", borderRadius: 16, padding: 20, border: "1px solid rgba(74,108,247,.3)" }}>
        <div style={{ color: "#4a6cf7", fontWeight: 700, marginBottom: 12, fontSize: 14 }}>⚙️ Config to Update in App.jsx</div>
        <pre style={{ color: "#86efac", fontSize: 12, lineHeight: 1.8, margin: 0, overflowX: "auto" }}>{`const CONFIG = {
  AIRTABLE_API_KEY: "patXXXXXXXX",
  AIRTABLE_BASE_ID: "appXXXXXXXX",
  AIRTABLE_TABLE:   "Participants",
  STAFF_PIN:        "your-pin",
  EVENT_NAME:       "Your Event 2025",
};`}</pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// URL PARAM HELPER — extracts ?id=EVT-001 from the URL
// ─────────────────────────────────────────────────────────────────────────────
function getUrlParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICIPANT CARD — shown after every scan (full details)
// ─────────────────────────────────────────────────────────────────────────────
function ParticipantCard({ participant, mode, onClose }) {
  const f = participant.fields;
  const claims = [
    { key: "Food",    icon: "🍽️", label: "Food"    },
    { key: "Dessert", icon: "🍰", label: "Dessert"  },
    { key: "Drinks",  icon: "🥤", label: "Drinks"   },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, backdropFilter: "blur(8px)", padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 340, background: "#0e1420",
        borderRadius: 24, overflow: "hidden",
        border: "1px solid rgba(255,255,255,.1)",
        boxShadow: "0 24px 64px rgba(0,0,0,.6)",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          background: f.CheckedIn
            ? "linear-gradient(135deg,#052e16,#064e3b)"
            : "linear-gradient(135deg,#0f2027,#203a43)",
          padding: "24px 24px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,.4)", textTransform: "uppercase", marginBottom: 6 }}>
                {mode === "CheckedIn" ? "✅ Checked In" : `${mode} Claimed`}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne', sans-serif" }}>{f.Name}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 3 }}>{f.Email}</div>
            </div>
            <span style={{
              background: f.TicketType === "VIP" ? "#f5a623" : "rgba(255,255,255,.15)",
              color: f.TicketType === "VIP" ? "#000" : "#fff",
              fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
            }}>{f.TicketType}</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, fontFamily: "monospace", letterSpacing: 3, color: "rgba(255,255,255,.35)" }}>
            {f.ParticipantID}
          </div>
        </div>

        {/* Claim status */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginBottom: 12 }}>
            Claim Status
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {claims.map(({ key, icon, label }) => (
              <div key={key} style={{
                flex: 1, borderRadius: 14, padding: "12px 8px", textAlign: "center",
                background: f[key] ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.05)",
                border: `2px solid ${f[key] ? "rgba(34,197,94,.4)" : "rgba(255,255,255,.08)"}`,
                position: "relative",
              }}>
                <div style={{ fontSize: 22 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6,
                  color: f[key] ? "#4ade80" : "rgba(255,255,255,.3)" }}>
                  {label}
                </div>
                <div style={{ fontSize: 10, color: f[key] ? "#22c55e" : "rgba(255,255,255,.2)", marginTop: 2 }}>
                  {f[key] ? "Used" : "Available"}
                </div>
              </div>
            ))}
          </div>

          {/* Check-in status row */}
          <div style={{
            marginTop: 14, padding: "12px 16px", borderRadius: 12,
            background: f.CheckedIn ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.04)",
            border: `1px solid ${f.CheckedIn ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.08)"}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Entry Check-in</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: f.CheckedIn ? "#4ade80" : "rgba(255,255,255,.3)" }}>
              {f.CheckedIn ? "✅ Done" : "⬜ Not yet"}
            </span>
          </div>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <button onClick={onClose} style={{
            width: "100%", padding: 14, background: "#22d3ee",
            border: "none", borderRadius: 14, color: "#000",
            fontWeight: 800, fontSize: 15, cursor: "pointer",
            fontFamily: "'Syne', sans-serif",
          }}>Tap to Dismiss</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  console.log("🔥 VERSION 2 DEPLOYED"); // 👈 ADD HERE

  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState("scanner");
  const [records, setRecords] = useState(MOCK);
  const [result, setResult] = useState(null);
  const [scannedParticipant, setScannedParticipant] = useState(null);
  const [scannedMode, setScannedMode] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [pendingUrlId, setPendingUrlId] = useState(null);

  // ── On load: check for ?id= in the URL (participant scanned QR with phone)
  useEffect(() => {
    const id = getUrlParam("id");
    if (id) {
      setPendingUrlId(id.toUpperCase());
      // Clear the URL param cleanly without reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── After unlock + records loaded, auto-process the URL id if present
  useEffect(() => {
    if (!unlocked || !pendingUrlId || records.length === 0) return;
    setPendingUrlId(null);
    setTab("scanner");
  }, [unlocked, pendingUrlId, records]);

  

  const handleScanResult = (participant, mode, updatedFields) => {
    // Merge updated fields into participant for immediate display
    const updated = { ...participant, fields: { ...participant.fields, ...updatedFields } };
    setScannedParticipant(updated);
    setScannedMode(mode);
  };

  const TABS = [
    { key: "scanner",   icon: "📷", label: "Scan"      },
    { key: "dashboard", icon: "📊", label: "Dashboard" },
    { key: "setup",     icon: "⚙️",  label: "Setup"     },
  ];

  if (!unlocked) return <PinLogin onUnlock={() => setUnlocked(true)} />;

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg,#0f2027,#1a2a3a)",
        padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 24px rgba(0,0,0,.4)", position: "sticky", top: 0, zIndex: 50
      }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", color: "#fff", fontWeight: 800, fontSize: 18 }}>🎟️ EventPass</div>
          <div style={{ color: "rgba(255,255,255,.35)", fontSize: 11 }}>
            {isConfigured() ? "● Live — Airtable Connected" : "○ Demo Mode — Configure Airtable to go live"}
          </div>
        </div>
        <button onClick={() => setUnlocked(false)} style={{
          background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
          color: "rgba(255,255,255,.5)", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 12
        }}>Lock</button>
      </div>

      {/* Result toast */}
      {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}

      {/* Participant card after scan */}
      {scannedParticipant && (
        <ParticipantCard
          participant={scannedParticipant}
          mode={scannedMode}
          onClose={() => setScannedParticipant(null)}
        />
      )}

      {/* Content */}
      {tab === "scanner"   && (
        <ScannerTab
          records={records}
          onUpdate={updateRecord}
          setResult={setResult}
          onScanned={handleScanResult}
          autoId={pendingUrlId}
        />
      )}
      {tab === "dashboard" && <Dashboard records={records} />}
      {tab === "setup"     && <SetupGuide />}

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(8,12,20,.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.08)",
        display: "flex", padding: "8px 0 16px"
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            color: tab === t.key ? "#22d3ee" : "rgba(255,255,255,.3)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            transition: "color .2s"
          }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}