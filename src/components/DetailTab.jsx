import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C, serif, sans, fmt, monthLabel, addMonths } from "../lib/theme";
import { ALL_TREE } from "../lib/categories";
import { queryTransactionsByMonth, queryTransactionsByRange, deleteTransaction, thisMonthKey } from "../lib/db";
import { TxRow } from "./Shared";

export default function DetailTab({ uid, accounts = [] }) {
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(thisMonthKey());
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [txs, setTxs] = useState([]);
  const [reloadTick, setReloadTick] = useState(0);

  const nameOf = (id) => accounts.find((a) => a.id === id)?.name || id;
  const toggleSub = (s) => setSelectedSubs((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const run = mode === "month" ? queryTransactionsByMonth(uid, month) : queryTransactionsByRange(uid, start, end);
    run
      .then((res) => {
        if (!cancelled) {
          setTxs(res);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setLoading(false);
          setError(
            e?.code === "failed-precondition" || /index/i.test(e?.message || "")
              ? "這個查詢需要先在 Firestore 建立一個複合索引（一次性設定）。打開瀏覽器的開發者工具（F12）→Console，會有一行紅字錯誤訊息附帶一個連結，點它就能自動建好索引，等一兩分鐘後回來重新整理即可。"
              : "讀取失敗，請檢查網路連線後重新整理頁面再試一次。"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid, mode, month, start, end, reloadTick]);

  const handleDelete = async (t) => {
    if (!window.confirm("確定要刪除這筆記錄嗎？帳戶餘額跟相關統計會自動還原。")) return;
    await deleteTransaction(uid, t);
    setReloadTick((n) => n + 1);
  };

  const filtered = selectedSubs.length === 0 ? txs : txs.filter((t) => selectedSubs.includes(t.sub));
  const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex" style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          {["month", "range"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1.5 text-sm"
              style={{ fontFamily: sans, background: mode === m ? C.gold : "transparent", color: mode === m ? "#fff" : C.ink }}
            >
              {m === "month" ? "以月查看" : "自訂區間"}
            </button>
          ))}
        </div>

        {mode === "month" ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth((m) => addMonths(m, -1))} style={{ color: C.ink }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontFamily: serif, fontWeight: 700, color: C.ink, minWidth: 90, textAlign: "center" }}>{monthLabel(month)}</span>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} style={{ color: C.ink }}>
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="px-2 py-1 text-sm"
              style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans, color: C.ink }}
            />
            <span style={{ color: C.inkSoft }}>至</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="px-2 py-1 text-sm"
              style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans, color: C.ink }}
            />
          </div>
        )}
      </div>

      <div>
        <div style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft, marginBottom: 6 }}>篩選項目（可複選，例如「早餐＋午餐」）</div>
        <button
          onClick={() => setSelectedSubs([])}
          className="px-2.5 py-1 text-xs"
          style={{
            border: `1px solid ${C.line}`,
            borderRadius: 999,
            fontFamily: sans,
            background: selectedSubs.length === 0 ? C.ink : "transparent",
            color: selectedSubs.length === 0 ? "#fff" : C.ink,
          }}
        >
          全部
        </button>
        <div className="flex flex-col gap-1.5 mt-1.5">
          {Object.entries(ALL_TREE).map(([main, subs]) => (
            <div key={main} className="flex flex-wrap items-center gap-1.5">
              <span style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft, width: 42 }}>{main}</span>
              {subs.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSub(s)}
                  className="px-2.5 py-1 text-xs"
                  style={{
                    border: `1px solid ${C.line}`,
                    borderRadius: 999,
                    fontFamily: sans,
                    background: selectedSubs.includes(s) ? C.gold : "transparent",
                    color: selectedSubs.includes(s) ? "#fff" : C.ink,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="px-3 py-2" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 8 }}>
          <div style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft }}>收入</div>
          <div style={{ fontFamily: serif, fontWeight: 700, color: C.green }}>{fmt(income)}</div>
        </div>
        <div className="px-3 py-2" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 8 }}>
          <div style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft }}>支出</div>
          <div style={{ fontFamily: serif, fontWeight: 700, color: C.red }}>{fmt(expense)}</div>
        </div>
        <div className="px-3 py-2" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 8 }}>
          <div style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft }}>淨額</div>
          <div style={{ fontFamily: serif, fontWeight: 700, color: C.ink }}>{fmt(income - expense)}</div>
        </div>
      </div>

      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.cardBg }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: C.inkSoft, fontFamily: sans, fontSize: 13 }}>讀取中…</div>
        ) : error ? (
          <div style={{ padding: 24, color: C.red, fontFamily: sans, fontSize: 13, lineHeight: 1.6 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: C.inkSoft, fontFamily: sans, fontSize: 13 }}>此區間沒有符合的紀錄</div>
        ) : (
          filtered.map((t, i) => <TxRow key={t.id} t={t} isFirst={i === 0} onDelete={handleDelete} accountNameOf={nameOf} />)
        )}
      </div>
    </div>
  );
}
