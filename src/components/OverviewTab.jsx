import React, { useState } from "react";
import { TrendingUp, TrendingDown, Plus, Pencil, Trash2, X } from "lucide-react";
import { C, serif, sans, fmt } from "../lib/theme";
import { AccountCard, TxRow } from "./Shared";
import { addAccount, correctAccountBalance, deleteAccount, updateAccountMeta } from "../lib/db";

function AccountEditor({ uid, account, onClose }) {
  const isNew = !account;
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "cash");
  const [balance, setBalance] = useState(account ? String(account.balance) : "0");
  const [limitVal, setLimitVal] = useState(account?.limit ? String(account.limit) : "");

  const save = async () => {
    if (!name.trim()) return;
    if (isNew) {
      await addAccount(uid, {
        name: name.trim(),
        type,
        balance: Number(balance) || 0,
        ...(type === "credit" ? { limit: Number(limitVal) || 0 } : {}),
      });
    } else {
      await updateAccountMeta(uid, account.id, {
        name: name.trim(),
        type,
        ...(type === "credit" ? { limit: Number(limitVal) || 0 } : {}),
      });
      const newBal = Number(balance) || 0;
      if (newBal !== account.balance) {
        await correctAccountBalance(uid, account.id, account.balance, newBal);
      }
    }
    onClose();
  };

  const remove = async () => {
    if (!account) return;
    await deleteAccount(uid, account.id, account.balance);
    onClose();
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3" style={{ border: `1px dashed ${C.goldSoft}`, borderRadius: 10, background: "#FBF4E7" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>{isNew ? "新增帳戶" : "編輯帳戶"}</span>
        <button onClick={onClose} style={{ color: C.inkSoft }}>
          <X size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          placeholder="帳戶名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-2 py-1 text-sm w-28"
          style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-2 py-1 text-sm"
          style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
        >
          <option value="cash">現金</option>
          <option value="bank">銀行</option>
          <option value="credit">信用卡</option>
        </select>
        <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: sans }}>{isNew ? "起始餘額" : "目前餘額"}</span>
        <input
          type="number"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="px-2 py-1 text-sm w-24"
          style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
        />
        {type === "credit" && (
          <>
            <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: sans }}>額度</span>
            <input
              type="number"
              value={limitVal}
              onChange={(e) => setLimitVal(e.target.value)}
              className="px-2 py-1 text-sm w-24"
              style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
            />
          </>
        )}
        <button onClick={save} className="px-3 py-1.5 text-sm" style={{ background: C.gold, color: "#fff", borderRadius: 6, fontFamily: sans }}>
          儲存
        </button>
        {!isNew && (
          <button onClick={remove} className="px-2 py-1.5" style={{ color: C.red }}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {!isNew && <div style={{ fontFamily: sans, fontSize: 11, color: C.inkSoft }}>調整「目前餘額」會直接校正為輸入的數字（例如對帳後修正）。</div>}
    </div>
  );
}

export default function OverviewTab({ uid, accounts, monthStats, recentTx, onRefreshRecent }) {
  const [editingId, setEditingId] = useState(null); // null=無, 'new'=新增, id=編輯某帳戶
  const editingAccount = editingId && editingId !== "new" ? accounts.find((a) => a.id === editingId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap gap-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} acc={a} onClick={() => setEditingId(a.id)} />
          ))}
          <button
            onClick={() => setEditingId("new")}
            className="flex flex-col items-center justify-center gap-1 px-4 py-3 min-w-[110px]"
            style={{ border: `1px dashed ${C.line}`, borderRadius: 10, color: C.inkSoft, fontFamily: sans, fontSize: 12.5 }}
          >
            <Plus size={16} />
            新增帳戶
          </button>
        </div>
        {editingId && (
          <div className="mt-3">
            <AccountEditor uid={uid} account={editingAccount} onClose={() => setEditingId(null)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div className="flex items-center gap-1.5" style={{ color: C.green, fontFamily: sans, fontSize: 12.5 }}>
            <TrendingUp size={15} /> 本月收入
          </div>
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 4 }}>{fmt(monthStats.income)}</div>
        </div>
        <div className="px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div className="flex items-center gap-1.5" style={{ color: C.red, fontFamily: sans, fontSize: 12.5 }}>
            <TrendingDown size={15} /> 本月支出
          </div>
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.red, marginTop: 4 }}>{fmt(monthStats.expense)}</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink }}>近期記錄</div>
          <button onClick={onRefreshRecent} style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>
            重新整理
          </button>
        </div>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.cardBg }}>
          {recentTx.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.inkSoft, fontFamily: sans, fontSize: 13 }}>還沒有記錄，去「記帳」分頁新增吧</div>
          ) : (
            recentTx.map((t, i) => <TxRow key={t.id} t={t} isFirst={i === 0} />)
          )}
        </div>
      </div>
    </div>
  );
}
