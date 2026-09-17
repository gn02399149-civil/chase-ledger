import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Settings2, Plus, Trash2 } from "lucide-react";
import { C, serif, sans, fmt, monthLabel, addMonths } from "../lib/theme";
import { ProgressBar, SubPicker } from "./Shared";
import {
  addBudgetGroup,
  deleteBudgetGroup,
  updateBudgetGroup,
  subscribeBudgetSummary,
  subscribeBudgetSummaryAnnual,
  thisMonthKey,
  thisYearKey,
} from "../lib/db";

export default function BudgetTab({ uid, groups }) {
  const [month, setMonth] = useState(thisMonthKey());
  const [year, setYear] = useState(thisYearKey());
  const [monthlySpend, setMonthlySpend] = useState({});
  const [annualSpend, setAnnualSpend] = useState({});
  const [editing, setEditing] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: "", subs: [], monthly: "", annual: "" });

  useEffect(() => subscribeBudgetSummary(uid, month, setMonthlySpend), [uid, month]);
  useEffect(() => subscribeBudgetSummaryAnnual(uid, year, setAnnualSpend), [uid, year]);

  const spendOfGroup = (map, subs) => subs.reduce((s, sub) => s + (map[sub] || 0), 0);

  const addGroup = async () => {
    if (!newGroup.name || newGroup.subs.length === 0) return;
    await addBudgetGroup(uid, {
      name: newGroup.name,
      subs: newGroup.subs,
      monthly: Number(newGroup.monthly) || 0,
      annual: Number(newGroup.annual) || 0,
    });
    setNewGroup({ name: "", subs: [], monthly: "", annual: "" });
  };
  const toggleGroupSub = (g, sub) => {
    const subs = g.subs.includes(sub) ? g.subs.filter((s) => s !== sub) : [...g.subs, sub];
    updateBudgetGroup(uid, g.id, { subs });
  };

  const totalMonthlyBudget = groups.reduce((s, g) => s + g.monthly, 0);
  const totalAnnualBudget = groups.reduce((s, g) => s + g.annual, 0);
  const totalMonthlySpend = groups.reduce((s, g) => s + spendOfGroup(monthlySpend, g.subs), 0);
  const totalAnnualSpend = groups.reduce((s, g) => s + spendOfGroup(annualSpend, g.subs), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>本月</span>
          <button onClick={() => setMonth((m) => addMonths(m, -1))} style={{ color: C.ink }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: serif, fontWeight: 700, color: C.ink, minWidth: 78, textAlign: "center" }}>{monthLabel(month)}</span>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} style={{ color: C.ink }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>年度</span>
          <button onClick={() => setYear((y) => String(Number(y) - 1))} style={{ color: C.ink }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: serif, fontWeight: 700, color: C.ink, minWidth: 50, textAlign: "center" }}>{year}年</span>
          <button onClick={() => setYear((y) => String(Number(y) + 1))} style={{ color: C.ink }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
          style={{ border: `1px solid ${C.line}`, borderRadius: 8, color: C.ink, fontFamily: sans }}
        >
          <Settings2 size={15} /> 管理群組
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>{monthLabel(month)} 總計</div>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 17, color: totalMonthlySpend > totalMonthlyBudget ? C.red : C.ink }}>
            {fmt(totalMonthlySpend)} / {fmt(totalMonthlyBudget)}
          </div>
        </div>
        <div className="px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>{year}年 總計</div>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 17, color: totalAnnualSpend > totalAnnualBudget ? C.red : C.ink }}>
            {fmt(totalAnnualSpend)} / {fmt(totalAnnualBudget)}
          </div>
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 px-4 py-3" style={{ border: `1px dashed ${C.goldSoft}`, borderRadius: 10, background: "#FBF4E7" }}>
          <div style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>
            自訂預算群組——每個群組可自由勾選任何大項目下的次要項目（例如「早餐＋晚餐」跨不同分類組合）
          </div>
          {groups.map((g) => (
            <div key={g.id} className="flex flex-col gap-2 px-3 py-2.5" style={{ border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff" }}>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  defaultValue={g.name}
                  onBlur={(e) => e.target.value !== g.name && updateBudgetGroup(uid, g.id, { name: e.target.value })}
                  className="px-2 py-1 text-sm w-20"
                  style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
                />
                <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: sans }}>月預算</span>
                <input
                  type="number"
                  defaultValue={g.monthly}
                  onBlur={(e) => updateBudgetGroup(uid, g.id, { monthly: Number(e.target.value) || 0 })}
                  className="px-2 py-1 text-sm w-20"
                  style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
                />
                <span style={{ fontSize: 12, color: C.inkSoft, fontFamily: sans }}>年預算</span>
                <input
                  type="number"
                  defaultValue={g.annual}
                  onBlur={(e) => updateBudgetGroup(uid, g.id, { annual: Number(e.target.value) || 0 })}
                  className="px-2 py-1 text-sm w-24"
                  style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
                />
                <button
                  onClick={() => setOpenGroupId(openGroupId === g.id ? null : g.id)}
                  className="px-2 py-1 text-xs"
                  style={{ border: `1px solid ${C.line}`, borderRadius: 6, color: C.gold, fontFamily: sans }}
                >
                  {openGroupId === g.id ? "收合項目" : `編輯項目（${g.subs.length}）`}
                </button>
                <button onClick={() => deleteBudgetGroup(uid, g.id)} style={{ color: C.inkSoft, marginLeft: "auto" }}>
                  <Trash2 size={15} />
                </button>
              </div>
              {openGroupId === g.id ? (
                <div className="pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
                  <SubPicker selected={g.subs} onToggle={(s) => toggleGroupSub(g, s)} />
                </div>
              ) : (
                <div style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft }}>{g.subs.join("、") || "尚未選擇項目"}</div>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-2 px-3 py-2.5" style={{ border: `1px dashed ${C.line}`, borderRadius: 8 }}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                placeholder="新群組名稱"
                value={newGroup.name}
                onChange={(e) => setNewGroup((n) => ({ ...n, name: e.target.value }))}
                className="px-2 py-1 text-sm w-24"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
              />
              <input
                type="number"
                placeholder="月預算"
                value={newGroup.monthly}
                onChange={(e) => setNewGroup((n) => ({ ...n, monthly: e.target.value }))}
                className="px-2 py-1 text-sm w-20"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
              />
              <input
                type="number"
                placeholder="年預算"
                value={newGroup.annual}
                onChange={(e) => setNewGroup((n) => ({ ...n, annual: e.target.value }))}
                className="px-2 py-1 text-sm w-24"
                style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
              />
              <button
                onClick={addGroup}
                className="flex items-center gap-1 px-2.5 py-1.5 text-sm"
                style={{ background: C.gold, color: "#fff", borderRadius: 6, fontFamily: sans }}
              >
                <Plus size={14} /> 新增群組
              </button>
            </div>
            <SubPicker
              selected={newGroup.subs}
              onToggle={(s) => setNewGroup((n) => ({ ...n, subs: n.subs.includes(s) ? n.subs.filter((x) => x !== s) : [...n.subs, s] }))}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const mSpend = spendOfGroup(monthlySpend, g.subs);
          const ySpend = spendOfGroup(annualSpend, g.subs);
          const mPct = g.monthly > 0 ? mSpend / g.monthly : 0;
          const yPct = g.annual > 0 ? ySpend / g.annual : 0;
          return (
            <div key={g.id} className="flex flex-col gap-2.5 px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <div className="flex items-center justify-between" style={{ fontFamily: sans, fontSize: 13.5 }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{g.name}</span>
                <span style={{ fontFamily: sans, fontSize: 11, color: C.inkSoft }}>{g.subs.join("・")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between" style={{ fontFamily: sans, fontSize: 12 }}>
                  <span style={{ color: C.inkSoft }}>本月</span>
                  <span style={{ color: mPct > 1 ? C.red : C.inkSoft }}>
                    {fmt(mSpend)} / {fmt(g.monthly)}
                  </span>
                </div>
                <ProgressBar pct={mPct} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between" style={{ fontFamily: sans, fontSize: 12 }}>
                  <span style={{ color: C.inkSoft }}>年度</span>
                  <span style={{ color: yPct > 1 ? C.red : C.inkSoft }}>
                    {fmt(ySpend)} / {fmt(g.annual)}
                  </span>
                </div>
                <ProgressBar pct={yPct} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
