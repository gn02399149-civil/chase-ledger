import React, { useState } from "react";
import { Plus, Trash2, ListPlus } from "lucide-react";
import { C, serif, sans } from "../lib/theme";
import { ALL_TREE, EXPENSE_TREE, INCOME_TREE } from "../lib/categories";
import { addTransactionsBatch } from "../lib/db";

export default function BatchEntryTab({ uid, accounts, onSubmitted }) {
  const today = new Date().toISOString().slice(0, 10);
  const blankRow = () => ({
    key: Math.random().toString(36).slice(2),
    date: today,
    type: "expense",
    main: "餐飲",
    sub: "午餐",
    accountId: accounts[0]?.id || "",
    amount: "",
    note: "",
  });
  const [rows, setRows] = useState([blankRow(), blankRow()]);
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const update = (key, field, val) =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        if (field === "type") {
          const main = val === "income" ? "收入" : "餐飲";
          return { ...r, type: val, main, sub: ALL_TREE[main][0] };
        }
        if (field === "main") {
          return { ...r, main: val, sub: ALL_TREE[val][0] };
        }
        return { ...r, [field]: val };
      })
    );
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  const validRows = rows.filter((r) => r.amount && Number(r.amount) > 0 && r.accountId);

  const submit = async () => {
    if (validRows.length === 0 || saving) return;
    setSaving(true);
    setErr("");
    try {
      await addTransactionsBatch(
        uid,
        validRows.map((r) => ({
          date: r.date,
          type: r.type,
          category: r.main,
          sub: r.sub,
          amount: Number(r.amount),
          accountId: r.accountId,
          note: r.note,
        }))
      );
      setDone(validRows.length);
      setRows([blankRow()]);
      onSubmitted?.();
      setTimeout(() => setDone(0), 2500);
    } catch (e) {
      setErr("儲存失敗，請確認網路連線後再試一次（離線時會先存在本機，恢復連線會自動送出）");
    } finally {
      setSaving(false);
    }
  };

  if (accounts.length === 0) {
    return <div style={{ fontFamily: sans, color: C.inkSoft, fontSize: 13.5 }}>請先到「總覽」分頁新增至少一個帳戶。</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink }}>批次記帳</div>
        {done > 0 && <div style={{ fontFamily: sans, fontSize: 12.5, color: C.green }}>已記錄 {done} 筆 ✓</div>}
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((r, idx) => {
          const mainOptions = r.type === "income" ? Object.keys(INCOME_TREE) : Object.keys(EXPENSE_TREE);
          const subOptions = ALL_TREE[r.main] || [];
          return (
            <div
              key={r.key}
              className="flex flex-wrap items-center gap-2 px-3 py-2.5"
              style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}
            >
              <span style={{ fontFamily: serif, fontSize: 12, color: C.inkSoft, width: 20, textAlign: "center" }}>{idx + 1}</span>
              <input
                type="date"
                value={r.date}
                onChange={(e) => update(r.key, "date", e.target.value)}
                className="px-2 py-1 text-sm"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              />
              <select
                value={r.type}
                onChange={(e) => update(r.key, "type", e.target.value)}
                className="px-2 py-1 text-sm"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              >
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
              <select
                value={r.main}
                onChange={(e) => update(r.key, "main", e.target.value)}
                className="px-2 py-1 text-sm"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              >
                {mainOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span style={{ color: C.inkSoft, fontSize: 13 }}>›</span>
              <select
                value={r.sub}
                onChange={(e) => update(r.key, "sub", e.target.value)}
                className="px-2 py-1 text-sm"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              >
                {subOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={r.accountId}
                onChange={(e) => update(r.key, "accountId", e.target.value)}
                className="px-2 py-1 text-sm"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="金額"
                value={r.amount}
                onChange={(e) => update(r.key, "amount", e.target.value)}
                className="px-2 py-1 text-sm w-24"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              />
              <input
                type="text"
                placeholder="備註"
                value={r.note}
                onChange={(e) => update(r.key, "note", e.target.value)}
                className="px-2 py-1 text-sm flex-1 min-w-[100px]"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff", fontFamily: sans, color: C.ink }}
              />
              <button onClick={() => removeRow(r.key)} style={{ color: C.inkSoft }}>
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {err && <div style={{ color: C.red, fontFamily: sans, fontSize: 12.5 }}>{err}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-2 text-sm"
          style={{ border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, fontFamily: sans, background: "transparent" }}
        >
          <Plus size={15} /> 新增一列
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
          style={{ background: C.red, color: "#fff", borderRadius: 8, fontFamily: sans, opacity: saving ? 0.7 : 1 }}
        >
          <ListPlus size={15} /> {saving ? "儲存中…" : "一次記錄全部"}
        </button>
      </div>
    </div>
  );
}
