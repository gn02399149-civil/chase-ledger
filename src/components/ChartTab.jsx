import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C, serif, sans, fmt } from "../lib/theme";
import { thisMonthKey } from "../lib/db";

export default function ChartTab({ trend, currentValue }) {
  const fullHistory = useMemo(() => {
    const nowKey = thisMonthKey();
    return [...trend, { month: nowKey, value: currentValue }].sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [trend, currentValue]);

  const [rangeStart, setRangeStart] = useState(fullHistory[0]?.month || "");
  const [rangeEnd, setRangeEnd] = useState(fullHistory[fullHistory.length - 1]?.month || "");

  if (fullHistory.length < 2) {
    return (
      <div style={{ fontFamily: sans, color: C.inkSoft, fontSize: 13.5 }}>
        累積滿一個月以上的資料後，這裡就會出現淨資產走勢圖。
      </div>
    );
  }

  const history = fullHistory
    .filter((p) => (!rangeStart || p.month >= rangeStart) && (!rangeEnd || p.month <= rangeEnd))
    .map((p) => ({ ...p, label: p.month }));

  if (history.length < 2) {
    return (
      <div className="flex flex-col gap-3">
        <RangePicker fullHistory={fullHistory} rangeStart={rangeStart} rangeEnd={rangeEnd} setRangeStart={setRangeStart} setRangeEnd={setRangeEnd} />
        <div style={{ fontFamily: sans, color: C.inkSoft, fontSize: 13.5 }}>這個區間內資料點不夠，選再寬一點的範圍看看。</div>
      </div>
    );
  }

  const first = history[0].value;
  const last = history[history.length - 1].value;
  const diff = last - first;

  return (
    <div className="flex flex-col gap-4">
      <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: C.ink }}>淨資產走勢</div>

      <RangePicker fullHistory={fullHistory} rangeStart={rangeStart} rangeEnd={rangeEnd} setRangeStart={setRangeStart} setRangeEnd={setRangeEnd} />

      <div className="flex items-baseline gap-3">
        <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 700, color: C.ink }}>{fmt(last)}</span>
        <span style={{ fontFamily: sans, fontSize: 13, color: diff >= 0 ? C.green : C.red }}>
          這段區間 {diff >= 0 ? "+" : ""}
          {fmt(diff).replace("NT$ ", "")}
        </span>
      </div>
      <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 6px" }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.inkSoft, fontFamily: sans, fontSize: 11 }} axisLine={{ stroke: C.line }} tickLine={false} />
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

function RangePicker({ fullHistory, rangeStart, rangeEnd, setRangeStart, setRangeEnd }) {
  const min = fullHistory[0]?.month;
  const max = fullHistory[fullHistory.length - 1]?.month;
  return (
    <div className="flex flex-wrap items-center gap-2" style={{ fontFamily: sans, fontSize: 12.5 }}>
      <span style={{ color: C.inkSoft }}>自訂區間</span>
      <input
        type="month"
        value={rangeStart}
        min={min}
        max={max}
        onChange={(e) => setRangeStart(e.target.value)}
        className="px-2 py-1 text-sm"
        style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
      />
      <span style={{ color: C.inkSoft }}>至</span>
      <input
        type="month"
        value={rangeEnd}
        min={min}
        max={max}
        onChange={(e) => setRangeEnd(e.target.value)}
        className="px-2 py-1 text-sm"
        style={{ border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans }}
      />
      <button
        onClick={() => {
          setRangeStart(min);
          setRangeEnd(max);
        }}
        className="px-2 py-1 text-xs"
        style={{ border: `1px solid ${C.line}`, borderRadius: 6, color: C.inkSoft }}
      >
        全部區間
      </button>
    </div>
  );
}
