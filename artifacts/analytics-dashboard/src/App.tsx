import { useState, useRef } from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  Users, UserCheck, Activity, UserX, UserPlus, FileText,
  Layers, Link2, RefreshCw, Moon, Sun, Menu, ChevronDown,
  TrendingUp, Database, CheckCircle2, AlertCircle, X,
  ChevronRight, Loader2, Upload, FileSpreadsheet, ChevronLeft,
} from "lucide-react";

const queryClient = new QueryClient();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const EMPTY_DAILY = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (13 - i));
  return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), users: 0 };
});
const EMPTY_MINI = [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }];
const DEFAULT_STATS = {
  todayNew: 0, unique: 0, active7d: 0, todayActive: 0,
  common: 0, blocked: 0, posts: 0, batches: 0, convLinks: 0,
  growthPercent: null as number | null, active7dPercent: 0,
  dailyNewUsers: EMPTY_DAILY,
};
type AnalyticsData = typeof DEFAULT_STATS;

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api${path}`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as T;
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, icon, iconBg, iconColor, badge, badgeColor, progress, progressColor, mini, miniData }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-1.5">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md mb-0.5 ${badgeColor}`}>{badge}</span>
        )}
      </div>
      {mini && miniData && (
        <div className="h-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={miniData} barSize={7}>
              <Bar dataKey="v" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {progress !== undefined && (
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-700">
            <div className={`h-1 rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{Math.min(progress, 100)}%</span>
        </div>
      )}
      {sub && progress === undefined && !mini && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
      )}
      {sub && progress !== undefined && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
      )}
    </div>
  );
}

function SmallStatCard({ label, value, sub, icon, iconBg, iconColor }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-2.5 flex-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase truncate">{label}</p>
        <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-[9px] text-gray-400 dark:text-gray-500 truncate">{sub}</p>
      </div>
    </div>
  );
}

/* ─── Shared inputs ─── */
function Field({ label, value, onChange, placeholder, required, type = "text" }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, allOption }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{placeholder}</option>
        {allOption && <option value="__ALL__">⚡ All Collections (Combined)</option>}
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ─── MongoDB Panel ─── */
function MongoPanel({ onClose, onConnected }: { onClose: () => void; onConnected: (d: AnalyticsData) => void }) {
  const [uri, setUri] = useState("");
  const [database, setDatabase] = useState("");
  const [collection, setCollection] = useState("");
  const [dbList, setDbList] = useState<string[]>([]);
  const [colList, setColList] = useState<string[]>([]);
  const [step, setStep] = useState<"uri" | "db" | "col" | "error">("uri");
  const [errMsg, setErrMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createdAtField, setCreatedAtField] = useState("createdAt");
  const [lastActiveField, setLastActiveField] = useState("lastActive");
  const [blockedField, setBlockedField] = useState("isBlocked");
  const [botIdField, setBotIdField] = useState("botId");
  const [userIdField, setUserIdField] = useState("userId");

  const listDbMutation = useMutation({
    mutationFn: () => apiPost<{ items: string[] }>("/mongo/list-databases", { uri }),
    onSuccess: (data) => { setDbList(data.items); setStep("db"); },
    onError: (err: Error) => { setErrMsg(err.message); setStep("error"); },
  });

  const listColMutation = useMutation({
    mutationFn: () => apiPost<{ items: string[] }>("/mongo/list-collections", { uri, database }),
    onSuccess: (data) => { setColList(data.items); setStep("col"); },
    onError: (err: Error) => { setErrMsg(err.message); setStep("error"); },
  });

  const analyticsMutation = useMutation({
    mutationFn: () => apiPost<AnalyticsData>("/mongo/analytics", {
      uri, database, collection,
      createdAtField, lastActiveField, blockedField, botIdField, userIdField,
    }),
    onSuccess: (data) => { onConnected(data); onClose(); },
    onError: (err: Error) => { setErrMsg(err.message); setStep("error"); },
  });

  const isLoading = listDbMutation.isPending || listColMutation.isPending || analyticsMutation.isPending;

  return (
    <div className="flex flex-col gap-3.5">
      {step === "uri" && (
        <>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2.5">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              Format: <code className="bg-blue-100 dark:bg-blue-800/40 px-1 rounded text-[11px]">mongodb+srv://user:pass@cluster.mongodb.net</code>
            </p>
          </div>
          <Field label="MongoDB URI" value={uri} onChange={setUri} placeholder="mongodb+srv://..." required type="password" />
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2.5">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <ChevronRight size={12} className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
              Advanced field mapping (optional)
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                <Field label="Created At" value={createdAtField} onChange={setCreatedAtField} placeholder="createdAt" />
                <Field label="Last Active" value={lastActiveField} onChange={setLastActiveField} placeholder="lastActive" />
                <Field label="Blocked Field" value={blockedField} onChange={setBlockedField} placeholder="isBlocked" />
                <Field label="Bot ID" value={botIdField} onChange={setBotIdField} placeholder="botId" />
                <Field label="User ID" value={userIdField} onChange={setUserIdField} placeholder="userId" />
              </div>
            )}
          </div>
          <button
            onClick={() => listDbMutation.mutate()}
            disabled={!uri || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            {isLoading ? "Connecting..." : "Connect & Browse"}
            {!isLoading && <ChevronRight size={15} />}
          </button>
        </>
      )}

      {step === "db" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("uri")} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={15} /></button>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Database</p>
          </div>
          {dbList.length > 0
            ? <SelectField label="Available Databases" value={database} onChange={setDatabase} options={dbList} placeholder="— select a database —" />
            : <Field label="Database Name" value={database} onChange={setDatabase} placeholder="mydb" required />
          }
          <button
            onClick={() => listColMutation.mutate()}
            disabled={!database || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <ChevronRight size={15} />}
            {isLoading ? "Loading collections..." : "Next"}
          </button>
        </>
      )}

      {step === "col" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("db")} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={15} /></button>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Collection</p>
          </div>
          {colList.length > 0
            ? <SelectField label="Available Collections" value={collection} onChange={setCollection} options={colList} placeholder="— select a collection —" allOption />
            : <Field label="Collection Name" value={collection} onChange={setCollection} placeholder="users" required />
          }
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold">DB:</span> {database}
            {collection === "__ALL__" && <span className="ml-2 text-indigo-500 font-semibold">· All collections combined</span>}
          </div>
          <button
            onClick={() => analyticsMutation.mutate()}
            disabled={!collection || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {isLoading ? "Fetching analytics..." : collection === "__ALL__" ? "Load All Collections" : "Load Analytics"}
          </button>
        </>
      )}

      {step === "error" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3 w-full text-left">{errMsg}</p>
          <button onClick={() => setStep("uri")} className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── File Upload Panel ─── */
const SUPPORTED = [
  { ext: "CSV", desc: "Comma separated", color: "text-green-600 bg-green-50 dark:bg-green-900/30" },
  { ext: "TSV", desc: "Tab separated", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30" },
  { ext: "TXT", desc: "Auto-detect", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30" },
  { ext: "JSON", desc: "Array of objects", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30" },
];

function FilePanel({ onClose, onConnected }: { onClose: () => void; onConnected: (d: AnalyticsData) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (f: File) => apiUpload<AnalyticsData>("/file/analytics", f),
    onSuccess: (data) => { onConnected(data); onClose(); },
    onError: (err: Error) => setErrMsg(err.message),
  });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-1.5">
        {SUPPORTED.map((s) => (
          <div key={s.ext} className={`rounded-xl px-2 py-2 text-center ${s.color}`}>
            <p className="font-bold text-xs">.{s.ext.toLowerCase()}</p>
            <p className="text-[9px] leading-tight mt-0.5 opacity-80">{s.desc}</p>
          </div>
        ))}
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setErrMsg(""); } }}
        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2.5 cursor-pointer transition-colors ${dragOver ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"}`}
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${file ? "bg-green-100 dark:bg-green-900/40" : "bg-gray-100 dark:bg-gray-700"}`}>
          {file ? <CheckCircle2 size={22} className="text-green-500" /> : <Upload size={22} className="text-gray-400" />}
        </div>
        {file ? (
          <>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Drop file here or click to browse</p>
            <p className="text-xs text-gray-400">CSV, TSV, TXT, JSON supported</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setErrMsg(""); } }} />
      </div>

      {errMsg && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{errMsg}</p>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2.5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">Auto-detected fields:</span> createdAt, lastActive, isBlocked, userId, botId
        </p>
      </div>

      <button
        onClick={() => file && uploadMutation.mutate(file)}
        disabled={!file || uploadMutation.isPending}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
      >
        {uploadMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
        {uploadMutation.isPending ? "Analyzing..." : "Load Analytics"}
      </button>
    </div>
  );
}

/* ─── Source Panel Modal ─── */
function SourcePanel({ onClose, onConnected }: { onClose: () => void; onConnected: (d: AnalyticsData) => void }) {
  const [tab, setTab] = useState<"mongo" | "file">("mongo");
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Connect Data Source</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex gap-1.5 mb-4 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {(["mongo", "file"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
            >
              {t === "mongo" ? <><Database size={12} /> MongoDB</> : <><FileSpreadsheet size={12} /> File Upload</>}
            </button>
          ))}
        </div>
        {tab === "mongo"
          ? <MongoPanel onClose={onClose} onConnected={onConnected} />
          : <FilePanel onClose={onClose} onConnected={onConnected} />
        }
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */
function Dashboard() {
  const [dark, setDark] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveSource, setLiveSource] = useState("");
  const [stats, setStats] = useState<AnalyticsData>(DEFAULT_STATS);

  const miniData = isLive
    ? stats.dailyNewUsers.slice(-7).map((d) => ({ v: d.users }))
    : EMPTY_MINI;

  const badge = stats.growthPercent !== null && stats.growthPercent !== undefined
    ? `↑ ${Math.abs(stats.growthPercent).toLocaleString()}%`
    : undefined;

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-lg mx-auto px-4 pb-8">

          {/* Header */}
          <div className="flex items-center justify-between py-4">
            <button className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Menu size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPanel(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isLive
                  ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                {isLive ? <CheckCircle2 size={11} /> : <Database size={11} />}
                {isLive ? `Live: ${liveSource}` : "Connect Data"}
              </button>
              <button onClick={() => setDark(!dark)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                {dark ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-gray-600" />}
              </button>
              <div className="flex items-center gap-1 bg-blue-600 text-white rounded-xl px-2.5 py-1.5 cursor-pointer">
                <span className="text-xs font-bold">AN</span>
                <ChevronDown size={12} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Analytics Overview</h1>
                {isLive && (
                  <span className="flex items-center gap-1 text-[9px] font-bold bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                    <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {isLive ? `Live data from ${liveSource}` : "Aggregated stats across all bots"}
              </p>
            </div>
            <button
              onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); }}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-1"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-blue-500" : ""} />
              <span className="font-medium">Refresh</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <StatCard label="Today New" value={stats.todayNew} icon={<UserPlus size={14} />} iconBg="bg-blue-50 dark:bg-blue-900/30" iconColor="text-blue-500" badge={badge} badgeColor="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" mini miniData={miniData} />
            <StatCard label="Unique" value={stats.unique} sub={`${stats.unique.toLocaleString()} total rows`} icon={<Users size={14} />} iconBg="bg-purple-50 dark:bg-purple-900/30" iconColor="text-purple-500" />
            <StatCard label="Active 7D" value={stats.active7d} icon={<UserCheck size={14} />} iconBg="bg-green-50 dark:bg-green-900/30" iconColor="text-green-500" progress={stats.active7dPercent} progressColor="bg-green-500" />
            <StatCard label="Today Active" value={stats.todayActive} sub="Interacted today" icon={<Activity size={14} />} iconBg="bg-cyan-50 dark:bg-cyan-900/30" iconColor="text-cyan-500" />
            <StatCard label="Common" value={stats.common} sub="In multiple bots" icon={<Users size={14} />} iconBg="bg-orange-50 dark:bg-orange-900/30" iconColor="text-orange-500" />
            <StatCard label="Blocked" value={stats.blocked} sub="Bot blocked" icon={<UserX size={14} />} iconBg="bg-red-50 dark:bg-red-900/30" iconColor="text-red-400" />
          </div>

          {/* Small stats */}
          <div className="flex gap-2.5 mb-3.5">
            <SmallStatCard label="Posts" value={stats.posts} sub="Total created" icon={<FileText size={13} />} iconBg="bg-blue-50 dark:bg-blue-900/30" iconColor="text-blue-500" />
            <SmallStatCard label="Batches" value={stats.batches} sub={`${stats.batches} active`} icon={<Layers size={13} />} iconBg="bg-violet-50 dark:bg-violet-900/30" iconColor="text-violet-500" />
            <SmallStatCard label="Conv. Links" value={stats.convLinks} sub={`${stats.convLinks} active`} icon={<Link2 size={13} />} iconBg="bg-teal-50 dark:bg-teal-900/30" iconColor="text-teal-500" />
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-green-500" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Daily New Users</span>
              </div>
              <span className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg">
                +{stats.unique.toLocaleString()} total
              </span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">New users per day — last 14 days</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyNewUsers} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#374151" : "#f0f0f0"} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: dark ? "#6b7280" : "#9ca3af" }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 8, fill: dark ? "#6b7280" : "#9ca3af" }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ background: dark ? "#1f2937" : "#fff", border: dark ? "1px solid #374151" : "1px solid #e5e7eb", borderRadius: 8, fontSize: 11, color: dark ? "#f9fafb" : "#111827" }}
                    formatter={(value: number) => [value.toLocaleString(), "New Users"]}
                    labelStyle={{ color: dark ? "#9ca3af" : "#6b7280", fontSize: 10 }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} fill="url(#colorUsers)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {!isLive && (
            <button
              onClick={() => setShowPanel(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-3.5 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 transition-colors group"
            >
              <Upload size={14} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Connect MongoDB or upload a CSV / TXT file to view live analytics</span>
            </button>
          )}

          <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-3">
            {isLive ? `✓ Live data from ${liveSource}` : "Connect a data source to see real analytics"}
          </p>
        </div>
      </div>

      {showPanel && (
        <SourcePanel
          onClose={() => setShowPanel(false)}
          onConnected={(data) => { setStats(data); setIsLive(true); setLiveSource("MongoDB"); }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
