import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Receipt, ListPlus, TrendingUp, Wallet, PiggyBank, LogOut } from "lucide-react";
import { auth } from "./firebase";
import { C, serif, sans, fmt, sortByOrder } from "./lib/theme";
import { Seal, TabButton } from "./components/Shared";
import AuthGate from "./components/AuthGate";
import OverviewTab from "./components/OverviewTab";
import BatchEntryTab from "./components/BatchEntryTab";
import ChartTab from "./components/ChartTab";
import DetailTab from "./components/DetailTab";
import BudgetTab from "./components/BudgetTab";
import ImportTool from "./components/ImportTool";
import {
  ensureSeedData,
  ensureMonthRollover,
  subscribeAccounts,
  subscribeNetWorthCounter,
  subscribeNetWorthTrend,
  subscribeCurrentMonthStats,
  subscribeBudgetGroups,
  fetchRecentTransactions,
} from "./lib/db";

const TABS = [
  { key: "overview", label: "總覽", icon: <Receipt size={15} /> },
  { key: "batch", label: "記帳", icon: <ListPlus size={15} /> },
  { key: "chart", label: "圖表", icon: <TrendingUp size={15} /> },
  { key: "detail", label: "明細", icon: <Wallet size={15} /> },
  { key: "budget", label: "預算", icon: <PiggyBank size={15} /> },
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined=載入中, null=未登入
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("overview");

  const [accounts, setAccounts] = useState([]);
  const [netWorthCounter, setNetWorthCounter] = useState(0);
  const [netWorthTrend, setNetWorthTrend] = useState([]);
  const [monthStats, setMonthStats] = useState({ month: null, income: 0, expense: 0 });
  const [budgetGroups, setBudgetGroups] = useState([]);
  const [recentTx, setRecentTx] = useState([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    let unsub = [];
    (async () => {
      await ensureSeedData(user.uid);
      await ensureMonthRollover(user.uid);
      unsub = [
        subscribeAccounts(user.uid, (list) => setAccounts(sortByOrder(list))),
        subscribeNetWorthCounter(user.uid, setNetWorthCounter),
        subscribeNetWorthTrend(user.uid, setNetWorthTrend),
        subscribeCurrentMonthStats(user.uid, setMonthStats),
        subscribeBudgetGroups(user.uid, (list) => setBudgetGroups(sortByOrder(list))),
      ];
      const recent = await fetchRecentTransactions(user.uid, 6);
      setRecentTx(recent);
      setReady(true);
    })();
    return () => unsub.forEach((u) => u && u());
  }, [user]);

  if (user === undefined) return null; // 判斷登入狀態中，避免畫面閃爍
  if (!user) return <AuthGate />;

  const showImportTool = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("import") === "1";
  if (showImportTool) return <ImportTool uid={user.uid} />;

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, color: C.inkSoft }}>
        準備你的帳本中…
      </div>
    );
  }

  const totalAssets = netWorthCounter;

  return (
    <div
      style={{
        minHeight: "100%",
        background: `repeating-linear-gradient(${C.paper}, ${C.paper} 27px, ${C.line}55 28px), ${C.paper}`,
        fontFamily: sans,
        padding: "20px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Hero */}
        <div className="flex items-center gap-4 px-5 py-5" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 14 }}>
          <Seal>帳</Seal>
          <div className="flex-1">
            <div style={{ fontFamily: serif, fontSize: 13, color: C.inkSoft, letterSpacing: 1 }}>Chase的帳務本 · 總資產</div>
            <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 700, color: C.ink, marginTop: 2, lineHeight: 1.1 }}>{fmt(totalAssets)}</div>
            <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft, marginTop: 4 }}>已含信用卡未償還款項</div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs"
            style={{ border: `1px solid ${C.line}`, borderRadius: 8, color: C.inkSoft, fontFamily: sans }}
            title={user.email || "登出"}
          >
            <LogOut size={13} /> 登出
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 px-1" style={{ borderBottom: `1px solid ${C.line}` }}>
          {TABS.map((t) => (
            <TabButton key={t.key} active={tab === t.key} label={t.label} icon={t.icon} onClick={() => setTab(t.key)} />
          ))}
        </div>

        {/* Content */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 20 }}>
          {tab === "overview" && (
            <OverviewTab
              uid={user.uid}
              accounts={accounts}
              monthStats={monthStats}
              recentTx={recentTx}
              onRefreshRecent={() => fetchRecentTransactions(user.uid, 6).then(setRecentTx)}
            />
          )}
          {tab === "batch" && (
            <BatchEntryTab uid={user.uid} accounts={accounts} onSubmitted={() => fetchRecentTransactions(user.uid, 6).then(setRecentTx)} />
          )}
          {tab === "chart" && <ChartTab trend={netWorthTrend} currentValue={netWorthCounter} />}
          {tab === "detail" && <DetailTab uid={user.uid} accounts={accounts} />}
          {tab === "budget" && <BudgetTab uid={user.uid} groups={budgetGroups} />}
        </div>
      </div>
    </div>
  );
}
