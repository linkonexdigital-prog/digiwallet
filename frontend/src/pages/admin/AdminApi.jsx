import React, { useEffect, useState } from "react";
import api, { fmtErr } from "@/lib/api";
import { Plus, Trash, Pause, Play, Copy, Check } from "@phosphor-icons/react";

export default function AdminApi() {
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [logFilter, setLogFilter] = useState("");
  const [copied, setCopied] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/admin/api-keys"), api.get("/admin/api-logs", { params: { status: logFilter || undefined, limit: 200 } })]);
    setKeys(a.data); setLogs(b.data);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [logFilter]);

  const create = async (e) => {
    e.preventDefault();
    try { await api.post("/admin/api-keys", { name, ip_whitelist: [] }); setName(""); setShowForm(false); setMsg("API key created."); load(); }
    catch (e) { setErr(fmtErr(e)); }
  };
  const toggle = async (id) => { await api.patch(`/admin/api-keys/${id}/toggle`); load(); };
  const del = async (id) => { if (window.confirm("Delete this API key?")) { await api.delete(`/admin/api-keys/${id}`); load(); } };
  const copy = (k) => { navigator.clipboard.writeText(k); setCopied(k); setTimeout(() => setCopied(""), 1500); };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="flex justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline text-muted-foreground mb-2">Integrations</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">API Keys</h1>
        </div>
        <button data-testid="apikey-create-toggle" onClick={() => setShowForm(!showForm)} className="px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-semibold inline-flex items-center gap-2 hover-lift"><Plus size={14} weight="bold"/> Create key</button>
      </div>

      <GatewayUrlPanel keys={keys} />

      {msg && <div className="mb-3 text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
      {err && <div className="mb-3 text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

      {showForm && (
        <form onSubmit={create} className="card-flat p-4 mb-4 flex gap-2">
          <input data-testid="apikey-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Production Backend)" className="flex-1 px-3 py-2.5 bg-surface border border-border rounded-md text-sm" required/>
          <button data-testid="apikey-create-submit" type="submit" className="px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-semibold">Generate</button>
        </form>
      )}

      <div className="card-flat overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead><tr><th>Name</th><th>Key</th><th>Status</th><th>Requests today</th><th>Created</th><th>Last used</th><th></th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="font-semibold">{k.name}</td>
                  <td>
                    <div className="mono text-xs flex items-center gap-2">
                      <span className="px-2 py-1 bg-surface border border-border rounded">{k.key.slice(0, 12)}…{k.key.slice(-6)}</span>
                      <button onClick={() => copy(k.key)} className="p-1 hover:bg-secondary rounded">
                        {copied === k.key ? <Check size={12}/> : <Copy size={12}/>}
                      </button>
                    </div>
                  </td>
                  <td><span className={`pill pill-${k.status === "active" ? "success" : "warning"}`}>{k.status}</span></td>
                  <td className="mono">{k.requests_today}</td>
                  <td className="mono text-xs">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="mono text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => toggle(k.id)} className="p-1.5 rounded-md hover:bg-secondary" title={k.status === "active" ? "Pause" : "Activate"}>
                        {k.status === "active" ? <Pause size={14}/> : <Play size={14}/>}
                      </button>
                      <button onClick={() => del(k.id)} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10"><Trash size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!keys.length && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No keys yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-end mb-4 flex-wrap gap-3">
        <div>
          <div className="overline text-muted-foreground mb-2">Logs</div>
          <h2 className="font-display text-xl font-bold">API request logs</h2>
        </div>
        <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)} className="px-3 py-2 bg-surface border border-border rounded-md text-sm">
          <option value="">All</option><option value="success">Success</option><option value="failed">Failed</option><option value="duplicate">Duplicate</option>
        </select>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead><tr><th>Time</th><th>Endpoint</th><th>IP</th><th>Status</th><th>Error</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="mono text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="mono text-xs">{l.endpoint}</td>
                  <td className="mono text-xs">{l.ip}</td>
                  <td><span className={`pill pill-${l.status}`}>{l.status}</span></td>
                  <td className="text-xs text-muted-foreground max-w-[280px] truncate">{l.error || "—"}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No logs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function GatewayUrlPanel({ keys }) {
  const [selectedKey, setSelectedKey] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (keys?.length && !selectedKey) setSelectedKey(keys[0].key);
  }, [keys]);

  const base = `${process.env.REACT_APP_BACKEND_URL}/api`;
  const k = selectedKey || "YOUR_API_KEY";
  const url = `${base}/add_balance.php?key=${k}&numbe={paytm}&amount={amo}&comment={com}`;

  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="card-flat p-6 mb-6">
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <div className="overline text-muted-foreground mb-1">Gateway URL</div>
          <h3 className="font-display text-lg font-bold">External integration endpoint</h3>
          <p className="text-xs text-muted-foreground mt-1">Paste this URL into your upstream wallet / payment gateway. Placeholders <code className="mono px-1 bg-surface rounded">{"{paytm}"}</code>, <code className="mono px-1 bg-surface rounded">{"{amo}"}</code>, <code className="mono px-1 bg-surface rounded">{"{com}"}</code> are substituted by the gateway at runtime.</p>
        </div>
        {keys?.length > 0 && (
          <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} className="px-3 py-2 bg-surface border border-border rounded-md text-sm mono max-w-[260px]">
            {keys.map((kk) => <option key={kk.id} value={kk.key}>{kk.name} · {kk.key.slice(0,12)}…</option>)}
          </select>
        )}
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-4 py-2.5 bg-surface flex justify-between items-center gap-3">
          <div className="text-sm font-semibold">add_balance.php · Gateway URL</div>
          <button onClick={copy} data-testid="gw-copy-url" className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
            {copied ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
          </button>
        </div>
        <div className="px-4 py-3 mono text-xs break-all">{url}</div>
      </div>

      <div className="mt-4 p-4 rounded-md bg-surface border border-border">
        <div className="overline text-muted-foreground mb-2">Parameter reference</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div><span className="mono font-semibold">key</span> &nbsp;<span className="text-muted-foreground">→ your API key (fixed in URL)</span></div>
          <div><span className="mono font-semibold">numbe</span> <span className="text-muted-foreground">→ user wallet number (paytm/mobile)</span></div>
          <div><span className="mono font-semibold">amount</span> <span className="text-muted-foreground">→ amount to credit</span></div>
          <div><span className="mono font-semibold">comment</span> <span className="text-muted-foreground">→ description / unique reference</span></div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          <strong>Optional:</strong> append <span className="mono">&order_id=...</span> if your gateway provides one — it is used for stronger duplicate detection. If not provided, <span className="mono">comment</span> is used as the unique key.
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          <strong>Response:</strong> plain text <span className="mono">SUCCESS: ...</span> / <span className="mono">ERROR: ...</span>. Append <span className="mono">&format=json</span> for JSON.
        </div>
      </div>
    </div>
  );
}
