import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C, serif, sans, fmt, monthLabel } from "../lib/theme";

export default function ChartTab({ trend, currentValue }) {
  const history = [
    ...trend.map((p) => ({ month: monthLabel(p.month).replace(/^\d+年/, ""), value: p.value })),
    { month: "本月", value: currentValue },
  ];

  if (history.length < 2) {
    return (
      <div style={{ fontFamily: sans, color: C.inkSoft, fontSize: 13.5 }}>
        累積滿一個月以上的資料後，這裡就會出現淨資產走勢圖。
      </div>
    );
  }

  const first = history[0].value;
  const last = history[history.length - 1].value;
  const diff = last - first;

  return (
    <div className="flex flex-col gap-4">
      <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink }}>淨資產走勢（月）</div>
      <div className="flex items-baseline gap-3">
        <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: C.ink }}>{fmt(last)}</span>
        <span style={{ fontFamily: sans, fontSize: 13, color: diff >= 0 ? C.green : C.red }}>
          近 {history.length} 個月 {diff >= 0 ? "+" : ""}
          {fmt(diff).replace("NT$ ", "")}
        </span>
      </div>
      <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 6px" }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: C.inkSoft, fontFamily: sans, fontSize: 12 }} axisLine={{ stroke: C.line }} tickLine={false} />
            <YAxis
              tick={{ fill: C.inkSoft, fontFamily: sans, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v / 10000).toFixed(0) + "萬"}
              width={44}
            />
            <Tooltip
              contentStyle={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, fontFamily: sans, fontSize: 12 }}
              formatter={(v) => [fmt(v), "淨資產"]}
            />
            <Line type="monotone" dataKey="value" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3, fill: C.gold }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
