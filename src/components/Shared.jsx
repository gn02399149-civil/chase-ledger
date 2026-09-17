import React from "react";
import { Wallet, CreditCard, Landmark } from "lucide-react";
import { C, serif, sans, fmt } from "../lib/theme";
import { EXPENSE_TREE } from "../lib/categories";

export function Seal({ children }) {
  return (
    <div
      style={{
        width: 54, height: 54, borderRadius: "50%", border: `2px solid ${C.red}`,
        color: C.red, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: serif, fontSize: 13, fontWeight: 700, flexShrink: 0, letterSpacing: 1,
        transform: "rotate(-6deg)", opacity: 0.9,
      }}
    >
      {children}
    </div>
  );
}

export function TabButton({ active, label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2.5 text-sm"
      style={{
        fontFamily: sans,
        color: active ? C.ink : C.inkSoft,
        background: active ? C.cardBg : "transparent",
        borderTop: active ? `1px solid ${C.line}` : "1px solid transparent",
        borderLeft: active ? `1px solid ${C.line}` : "1px solid transparent",
        borderRight: active ? `1px solid ${C.line}` : "1px solid transparent",
        borderBottom: active ? `1px solid ${C.cardBg}` : `1px solid ${C.line}`,
        borderRadius: "8px 8px 0 0",
        marginBottom: -1,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function AccountCard({ acc, onClick }) {
  const icon =
    acc.type === "cash" ? <Wallet size={16} /> : acc.type === "credit" ? <CreditCard size={16} /> : <Landmark size={16} />;
  const isDebt = acc.type === "credit";
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 px-4 py-3 min-w-[150px] text-left"
      style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}
    >
      <div className="flex items-center gap-1.5" style={{ color: C.inkSoft, fontFamily: sans, fontSize: 12.5 }}>
        {icon}
        <span>{acc.name}</span>
      </div>
      <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: isDebt && acc.balance < 0 ? C.red : C.ink }}>
        {fmt(acc.balance)}
      </div>
      {isDebt && (
        <div style={{ fontFamily: sans, fontSize: 11, color: C.inkSoft }}>
          額度 {fmt(acc.limit || 0)}・可用 {fmt((acc.limit || 0) + acc.balance)}
        </div>
      )}
    </button>
  );
}

export function ProgressBar({ pct }) {
  const over = pct > 1;
  return (
    <div style={{ height: 7, borderRadius: 999, background: C.paperDeep, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(pct, 1) * 100}%`,
          background: over ? C.red : pct > 0.85 ? C.goldSoft : C.green,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

export function SubPicker({ selected, onToggle }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Object.entries(EXPENSE_TREE).map(([main, subs]) => (
        <div key={main} className="flex flex-wrap items-center gap-1.5">
          <span style={{ fontFamily: sans, fontSize: 11, color: C.inkSoft, width: 40 }}>{main}</span>
          {subs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onToggle(s)}
              className="px-2 py-0.5 text-xs"
              style={{
                border: `1px solid ${C.line}`,
                borderRadius: 999,
                fontFamily: sans,
                background: selected.includes(s) ? C.goldSoft : "transparent",
                color: selected.includes(s) ? "#fff" : C.ink,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TxRow({ t, isFirst }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderTop: isFirst ? "none" : `1px solid ${C.line}`, fontFamily: sans, fontSize: 13.5 }}
    >
      <div className="flex flex-col">
        <span style={{ color: C.ink, fontWeight: 600 }}>
          {t.category} · {t.sub}
        </span>
        <span style={{ color: C.inkSoft, fontSize: 12 }}>
          {t.date}　{t.note}
        </span>
      </div>
      <span style={{ color: t.type === "expense" ? C.red : C.green, fontFamily: serif, fontWeight: 700 }}>
        {t.type === "expense" ? "-" : "+"}
        {fmt(t.amount).replace("NT$ ", "")}
      </span>
    </div>
  );
}
