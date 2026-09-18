import React, { useState } from "react";
import { C, serif, sans, fmt } from "../lib/theme";
import { thisMonthKey } from "../lib/db";
import {
  clearSeedData,
  importAccounts,
  importBudgetGroups,
  importBudgetSummaries,
  importMeta,
  importTransactionsChunked,
  clearTransactionsAndSummaries,
  overwriteAccountBalances,
  repairBudgetSummaries,
} from "../lib/db";

function RepairPanel({ uid }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const run = async () => {
    setRunning(true);
    setErr("");
    setResult(null);
    try {
      const r = await repairBudgetSummaries(uid, setProgress);
      setResult(r);
    } catch (e) {
      console.error(e);
      setErr("修復失敗（" + (e?.message || "未知錯誤") + "），重新整理頁面再試一次。");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3" style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff" }}>
      <div style={{ fontFamily: sans, fontSize: 13, color: C.ink, fontWeight: 700 }}>修復預算彙總</div>
      <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
        如果「預算」分頁的金額對不上明細裡的真實支出，用這個修復：直接讀取你現有的交易明細重新計算，不需要重新上傳任何檔案。
      </div>
      <button
        onClick={run}
        disabled={running}
        className="px-3 py-1.5 text-sm self-start"
        style={{ background: C.gold, color: "#fff", borderRadius: 6, fontFamily: sans, opacity: running ? 0.6 : 1 }}
      >
        {running ? "修復中…" : "開始修復"}
      </button>
      {progress && running && <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>{progress}</div>}
      {result && (
        <div style={{ fontFamily: sans, fontSize: 12.5, color: C.green }}>
          修復完成 ✓ 讀取了 {result.transactionCount.toLocaleString()} 筆交易，重建了 {result.monthCount} 個月份的預算彙總。回去「預算」分頁看看數字有沒有對上。
        </div>
      )}
      {err && <div style={{ fontFamily: sans, fontSize: 12.5, color: C.red }}>{err}</div>}
    </div>
  );
}

export default function ImportTool({ uid }) {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [parseError, setParseError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const isOverwrite = !!data?.resetAccounts;

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setData(null);
    setParseError("");
    setDone(false);
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      if (!json.transactions || (!json.accounts && !json.resetAccounts)) throw new Error("格式不對");
      setData(json);
    } catch (e) {
      setParseError("這個檔案讀不懂，確認選的是產生好的 import-data json 檔案本身。");
    }
  };

  const runFull = async () => {
    setProgress("清除預設資料中…");
    await clearSeedData(uid);

    setProgress("寫入帳戶中…");
    await importAccounts(uid, data.accounts);

    setProgress("寫入預算群組中…");
    await importBudgetGroups(uid, data.budgetGroups);

    await writeSharedAggregates();
  };

  const runOverwrite = async () => {
    setProgress("清除舊的交易明細與預算彙總中…");
    await clearTransactionsAndSummaries(uid);

    setProgress("依新明細重新計算帳戶餘額中…");
    await overwriteAccountBalances(uid, data.resetAccounts);

    await writeSharedAggregates();
  };

  const writeSharedAggregates = async () => {
    setProgress("寫入每月／每年預算彙總中…");
    await importBudgetSummaries(uid, data.budgetSummaries, data.budgetSummariesAnnual);

    const nowMonth = thisMonthKey();
    const stats = data.monthlyStats[nowMonth] || { income: 0, expense: 0 };
    const points = Object.entries(data.monthlyNetWorthEnd || {})
      .filter(([m]) => m !== nowMonth)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, value]) => ({ month, value }));

    setProgress("寫入淨資產走勢與本月統計中…");
    await importMeta(uid, {
      netWorthCounter: data.finalNetWorth,
      netWorthTrend: points,
      currentMonthStats: { month: nowMonth, income: stats.income, expense: stats.expense },
    });

    setProgress(`寫入交易明細中… 0 / ${data.transactions.length}`);
    await importTransactionsChunked(uid, data.transactions, (doneCount, total) => {
      setProgress(`寫入交易明細中… ${doneCount} / ${total}`);
    });
  };

  const run = async () => {
    if (!data || running) return;
    setRunning(true);
    setErr("");
    try {
      if (isOverwrite) await runOverwrite();
      else await runFull();
      setDone(true);
      setProgress("");
    } catch (e) {
      console.error(e);
      setErr("匯入過程中發生錯誤（" + (e?.message || "未知錯誤") + "），已經寫入的部分不會消失，重新整理頁面後可以再匯入一次（不會重複扣款，只是重新蓋過去）。");
    } finally {
      setRunning(false);
    }
  };

  const thisMonthPreview = data?.monthlyStats?.[thisMonthKey()];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `repeating-linear-gradient(${C.paper}, ${C.paper} 27px, ${C.line}55 28px), ${C.paper}`,
        fontFamily: sans,
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="flex flex-col gap-4 px-6 py-6" style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 14 }}>
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, color: C.ink }}>資料匯入工具</div>
            <div style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>
              一次性工具，把記帳資料匯入這個帳本。這個檔案只會在你的瀏覽器裡處理，不會被上傳到任何地方，也不會存進 GitHub。
            </div>
          </div>

          {!done && (
            <>
              <RepairPanel uid={uid} />

              <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft, textAlign: "center" }}>— 或者，重新匯入整份檔案 —</div>

              <input type="file" accept="application/json" onChange={onPickFile} style={{ fontFamily: sans, fontSize: 13 }} />
              {parseError && <div style={{ color: C.red, fontFamily: sans, fontSize: 12.5 }}>{parseError}</div>}

              {data && (
                <div className="flex flex-col gap-2 px-4 py-3" style={{ border: `1px dashed ${C.goldSoft}`, borderRadius: 10 }}>
                  <div style={{ fontFamily: sans, fontSize: 12, color: C.gold, fontWeight: 700 }}>
                    {isOverwrite ? "覆蓋模式：只換掉明細資料，帳戶清單／預算群組設定保留" : "完整匯入模式：連帳戶跟預算群組一起建立"}
                  </div>
                  <div style={{ fontFamily: sans, fontSize: 13, color: C.ink, lineHeight: 1.8 }}>
                    讀到 <b>{data.transactions.length.toLocaleString()}</b> 筆交易明細
                    {!isOverwrite && (
                      <>
                        、<b>{data.accounts.length}</b> 個帳戶、<b>{data.budgetGroups.length}</b> 個預算群組
                      </>
                    )}
                    。
                    <br />
                    {isOverwrite ? "這份明細算出來的" : "匯入後"}總資產會是 <b>{fmt(data.finalNetWorth)}</b>
                    {isOverwrite && "（只有這份明細的效果，不含你之前的餘額；匯入後可以到「總覽」再手動校正每個帳戶的起始金額）"}。
                    {thisMonthPreview && (
                      <>
                        <br />
                        本月（依你電腦時間）支出合計 <b>{fmt(thisMonthPreview.expense)}</b>，收入合計 <b>{fmt(thisMonthPreview.income)}</b>，
                        匯入完成後可以直接去「預算」分頁核對這個數字有沒有對上。
                      </>
                    )}
                  </div>
                  <label className="flex items-center gap-2" style={{ fontFamily: sans, fontSize: 12.5, color: C.ink }}>
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                    {isOverwrite
                      ? "我了解這會刪除目前帳本裡「所有」的交易明細，換成這份新的"
                      : "我了解這會清掉目前帳本裡的預設資料，換成匯入的資料"}
                  </label>
                  <button
                    onClick={run}
                    disabled={!confirmed || running}
                    className="px-4 py-2 text-sm font-semibold"
                    style={{ background: C.red, color: "#fff", borderRadius: 8, fontFamily: sans, opacity: !confirmed || running ? 0.5 : 1 }}
                  >
                    {running ? "匯入中，請不要關閉分頁…" : "開始匯入"}
                  </button>
                  {progress && <div style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>{progress}</div>}
                  {err && <div style={{ fontFamily: sans, fontSize: 12.5, color: C.red }}>{err}</div>}
                </div>
              )}
            </>
          )}

          {done && (
            <div className="flex flex-col gap-2 px-4 py-3" style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff" }}>
              <div style={{ fontFamily: sans, fontSize: 14, color: C.green, fontWeight: 700 }}>匯入完成 ✓</div>
              <div style={{ fontFamily: sans, fontSize: 12.5, color: C.inkSoft }}>
                把網址列後面的 <code>?import=1</code> 拿掉，重新整理頁面，回到正常畫面查看結果。
                {isOverwrite && "記得去「總覽」把每個帳戶的餘額校正成實際數字（等於補上這份明細沒涵蓋到的起始金額）。"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
