import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Settings2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { C, serif, sans, fmt, monthLabel, addMonths } from "../lib/theme";
import { ProgressBar, SubPicker } from "./Shared";
import { addBudgetGroup, deleteBudgetGroup, updateBudgetGroup, reorderBudgetGroups, subscribeBudgetSummary, thisMonthKey } from "../lib/db";

export default function BudgetTab({ uid, groups }) {
  const [month, setMonth] = useState(thisMonthKey());
  const [monthlySpend, setMonthlySpend] = useState({});
  const [ytdSpend, setYtdSpend] = useState({});
  const [editing, setEditing] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [newGroup, setNewGroup] = useState({ name: "", subs: [], monthly: "" });

  const year = month.slice(0, 4);
  const monthNum = Number(month.slice(5, 7)); // 1~12：選了幾月，年度就累計到那個月為止

  useEffect(() => subscribeBudgetSummary(uid, month, setMonthlySpend), [uid, month]);

  // 年度累計＝從當年1月一路加到目前選的月份（含），跨年份選擇會自動換一批月份重新累計
  useEffect(() => {
    const monthsToSum = Array.from({ length: monthNum }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    const perMonth = {};
    const recompute = () => {
      const combined = {};
      Object.values(perMonth).forEach((map) => {
        Object.entries(map).forEach(([k, v]) => {
          combined[k] = (combined[k] || 0) + v;
        });
      });
      setYtdSpend(combined);
    };
    const unsubs = monthsToSum.map((m) =>
      subscribeBudgetSummary(uid, m, (map) => {
        perMonth[m] = map;
        recompute();
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [uid, year, monthNum]);

  const spendOfGroup = (map, subs) => subs.reduce((s, sub) => s + (map[sub] || 0), 0);

  const addGroup = async () => {
    if (!newGroup.name || newGroup.subs.length === 0) return;
    await addBudgetGroup(uid, {
      name: newGroup.name,
      subs: newGroup.subs,
      monthly: Number(newGroup.monthly) || 0,
    });
    setNewGroup({ name: "", subs: [] });
  };
  const toggleGroupSub = (g, sub) => {
    const subs = g.subs.includes(sub) ? g.subs.filter((s) => s !== sub) : [...g.subs, sub];
    updateBudgetGroup(uid, g.id, { subs });
  };
  const moveGroup = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= groups.length) return;
    const ids = groups.map((g) => g.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderBudgetGroups(uid, ids);
  };

  const annualOf = (g) => g.monthly * 12; // 群組管理面板裡單純顯示「滿一整年會是多少」，方便設定時參考
  const ytdBudgetOf = (g) => g.monthly * monthNum; // 實際累計進度用的目標：到選定月份為止的累計預算
  const totalMonthlyBudget = groups.reduce((s, g) => s + g.monthly, 0);
  const totalYtdBudget = totalMonthlyBudget * monthNum;
  const totalMonthlySpend = groups.reduce((s, g) => s + spendOfGroup(monthlySpend, g.subs), 0);
  const totalYtdSpend = groups.reduce((s, g) => s + spendOfGroup(ytdSpend, g.subs), 0);

  const remainLabel = (budget, spend) => {
    const remain = budget - spend;
    return remain >= 0
      ? { text: `剩餘 ${fmt(remain)}`, color: C.green }
      : { text: `超支 ${fmt(-remain)}`, color: C.red };
  };

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
        <div style={{ fontFamily: sans, fontSize: 11.5, color: C.inkSoft }}>
          年度控管會自動累計 {year}年1月～{monthNum}月，換月份就跟著變
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
          <div style={{ fontFamily: sans, fontSize: 11.5, color: remainLabel(totalMonthlyBudget, totalMonthlySpend).color, marginTop: 2 }}>
            {remainLabel(totalMonthlyBudget, totalMonthlySpend).text}
          </div>
        </div>
        <div className="px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>{year}年 1～{monthNum}月累計</div>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 17, color: totalYtdSpend > totalYtdBudget ? C.red : C.ink }}>
            {fmt(totalYtdSpend)} / {fmt(totalYtdBudget)}
          </div>
          <div style={{ fontFamily: sans, fontSize: 11.5, color: remainLabel(totalYtdBudget, totalYtdSpend).color, marginTop: 2 }}>
            {remainLabel(totalYtdBudget, totalYtdSpend).text}
          </div>
        </div>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 px-4 py-3" style={{ border: `1px dashed ${C.goldSoft}`, borderRadius: 10, background: "#FBF4E7" }}>
          <div style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>
            自訂預算群組——每個群組可自由勾選任何大項目下的次要項目（例如「早餐＋晚餐」跨不同分類組合）
          </div>
          {groups.map((g, idx) => (
            <div key={g.id} className="flex flex-col gap-2 px-3 py-2.5" style={{ border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff" }}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col" style={{ lineHeight: 1 }}>
                  <button onClick={() => moveGroup(idx, -1)} disabled={idx === 0} style={{ color: idx === 0 ? C.line : C.inkSoft }}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveGroup(idx, 1)} disabled={idx === groups.length - 1} style={{ color: idx === groups.length - 1 ? C.line : C.inkSoft }}>
                    <ChevronDown size={14} />
                  </button>
                </div>
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
                <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: sans }}>年預算＝月預算×12＝{fmt(annualOf(g))}</span>
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
              <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: sans }}>
                年預算會自動＝月預算×12{newGroup.monthly ? `（${fmt(Number(newGroup.monthly) * 12)}）` : ""}
              </span>
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
          const ySpend = spendOfGroup(ytdSpend, g.subs);
          const gYtdBudget = ytdBudgetOf(g);
          const mPct = g.monthly > 0 ? mSpend / g.monthly : 0;
          const yPct = gYtdBudget > 0 ? ySpend / gYtdBudget : 0;
          const mRemain = remainLabel(g.monthly, mSpend);
          const yRemain = remainLabel(gYtdBudget, ySpend);
          return (
            <div key={g.id} className="flex flex-col gap-2.5 px-4 py-3" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <div className="flex items-center justify-between" style={{ fontFamily: sans, fontSize: 13.5 }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{g.name}</span>
                <span style={{ fontFamily: sans, fontSize: 11, color: C.inkSoft }}>{g.subs.join("・")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between" style={{ fontFamily: sans, fontSize: 12 }}>
                  <span style={{ color: C.inkSoft }}>本月</span>
                  <span className="flex items-center gap-2">
                    <span style={{ color: mPct > 1 ? C.red : C.inkSoft }}>
                      {fmt(mSpend)} / {fmt(g.monthly)}
                    </span>
                    <span style={{ color: mRemain.color, fontSize: 11 }}>（{mRemain.text}）</span>
                  </span>
                </div>
                <ProgressBar pct={mPct} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between" style={{ fontFamily: sans, fontSize: 12 }}>
                  <span style={{ color: C.inkSoft }}>年度累計（1～{monthNum}月）</span>
                  <span className="flex items-center gap-2">
                    <span style={{ color: yPct > 1 ? C.red : C.inkSoft }}>
                      {fmt(ySpend)} / {fmt(gYtdBudget)}
                    </span>
                    <span style={{ color: yRemain.color, fontSize: 11 }}>（{yRemain.text}）</span>
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
