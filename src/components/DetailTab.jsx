import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { C, serif, sans, fmt, monthLabel, addMonths } from "../lib/theme";
import { ALL_TREE, EXPENSE_TREE, INCOME_TREE } from "../lib/categories";
import { queryTransactionsByMonth, queryTransactionsByRange, deleteTransaction, updateTransaction, thisMonthKey } from "../lib/db";
import { TxRow } from "./Shared";

function EditForm({ uid, tx, accounts, onDone, onCancel }) {
  const [type, setType] = useState(tx.type === "transfer" ? "expense" : tx.type); // 轉帳先鎖定，避免跟支出/收入混在一起改
  const [main, setMain] = useState(tx.category || Object.keys(EXPENSE_TREE)[0]);
  const [sub, setSub] = useState(tx.sub || ALL_TREE[tx.category]?.[0] || "");
  const [date, setDate] = useState(tx.date);
  const [accountId, setAccountId] = useState(tx.accountId || accounts[0]?.id || "");
  const [fromId, setFromId] = useState(tx.fromAccountId || accounts[0]?.id || "");
  const [toId, setToId] = useState(tx.toAccountId || accounts[1]?.id || accounts[0]?.id || "");
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note || "");
  const [saving, setSaving] = useState(false);
  const isTransfer = tx.type === "transfer";

  const mainOptions = type === "income" ? Object.keys(INCOME_TREE) : Object.keys(EXPENSE_TREE);
  const subOptions = ALL_TREE[main] || [];

  const changeType = (val) => {
    setType(val);
    const firstMain = val === "income" ? Object.keys(INCOME_TREE)[0] : Object.keys(EXPENSE_TREE)[0];
    setMain(firstMain);
    setSub((ALL_TREE[firstMain] || [])[0] || "");
  };
  const changeMain = (val) => {
    setMain(val);
    setSub((ALL_TREE[val] || [])[0] || "");
  };

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      const newTx = isTransfer
        ? { type: "transfer", date, fromAccountId: fromId, toAccountId: toId, amount: Number(amount), note }
        : { type, date, category: main, sub, amount: Number(amount), accountId, note };
      await updateTransaction(uid, tx, newTx);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ background: "#FBF4E7", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="px-2 py-1 text-sm"
        style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
      />
      {isTransfer ? (
        <>
          <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="px-2 py-1 text-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span style={{ color: C.inkSoft }}>→</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="px-2 py-1 text-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      ) : (
        <>
          <select value={type} onChange={(e) => changeType(e.target.value)} className="px-2 py-1 text-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <select value={main} onChange={(e) => changeMain(e.target.value)} className="px-2 py-1 text-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}>
            {mainOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ color: C.inkSoft }}>›</span>
          <select value={sub} onChange={(e) => setSub(e.target.value)} className="px-2 py-1 text-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}>
            {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="px-2 py-1 text-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      )}
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="px-2 py-1 text-sm w-24"
        style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="備註"
        className="px-2 py-1 text-sm flex-1 min-w-[100px]"
        style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
      />
      <button onClick={submit} disabled={saving} className="px-3 py-1.5 text-sm" style={{ background: C.gold, color: "#fff", borderRadius: 6, fontFamily: sans, opacity: saving ? 0.6 : 1 }}>
        {saving ? "儲存中…" : "儲存"}
      </button>
      <button onClick={onCancel} style={{ color: C.inkSoft }}>
        <X size={16} />
      </button>
    </div>
  );
}

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
  const [editingTx, setEditingTx] = useState(null);

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
          filtered.map((t, i) =>
            editingTx?.id === t.id ? (
              <EditForm
                key={t.id}
                uid={uid}
                tx={t}
                accounts={accounts}
                onCancel={() => setEditingTx(null)}
                onDone={() => {
                  setEditingTx(null);
                  setReloadTick((n) => n + 1);
                }}
              />
            ) : (
              <TxRow key={t.id} t={t} isFirst={i === 0} onDelete={handleDelete} onEdit={setEditingTx} accountNameOf={nameOf} />
            )
          )
        )}
      </div>
    </div>
  );
}
