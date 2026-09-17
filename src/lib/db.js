import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  increment,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";

/*
 * 資料結構（全部放在 users/{uid}/ 底下，靠 Authentication + 安全規則隔離每個使用者的資料）：
 *
 *   users/{uid}/accounts/{accountId}          帳戶：{ name, type, balance, limit? }
 *   users/{uid}/transactions/{txId}           單筆交易明細：{ date, month, year, type, category, sub, amount, accountId, note }
 *   users/{uid}/budgetGroups/{groupId}        自訂預算群組：{ name, subs: string[], monthly, annual }
 *   users/{uid}/budgetSummaries/{yyyy-mm}     單月各次要項目花費彙總：{ spentBySub: { 早餐: 1234, ... } }
 *   users/{uid}/budgetSummariesAnnual/{yyyy}  單年各次要項目花費彙總：{ spentBySub: {...} }
 *   users/{uid}/meta/netWorthCounter          目前淨資產即時累計值：{ value }
 *   users/{uid}/meta/netWorthTrend            歷史每月結算點（給圖表用）：{ points: [{month, value}] }
 *   users/{uid}/meta/currentMonthStats        本月收支即時累計：{ month, income, expense }
 *
 * 設計重點：帳戶餘額、淨資產走勢、預算花費，平常開啟App都只讀「彙總文件」，
 * 讀取次數固定（幾份文件），跟累積了多少筆交易明細完全無關。
 * 只有「查詢明細」才會真的去讀 transactions，而且限定月份／區間＋筆數上限。
 */

const col = (uid, name) => collection(db, "users", uid, name);
const docRef = (uid, name, id) => doc(db, "users", uid, name, id);
const metaRef = (uid, id) => doc(db, "users", uid, "meta", id);

export const monthKey = (dateStr) => dateStr.slice(0, 7);
export const yearKey = (dateStr) => dateStr.slice(0, 4);
export const thisMonthKey = () => new Date().toISOString().slice(0, 7);
export const thisYearKey = () => new Date().toISOString().slice(0, 4);

/* ---------------------------- 帳戶 ---------------------------- */
export function subscribeAccounts(uid, cb) {
  return onSnapshot(col(uid, "accounts"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addAccount(uid, account) {
  const r = doc(col(uid, "accounts"));
  await setDoc(r, account);
  // 新帳戶的起始餘額要併入淨資產累計值，否則總資產會少算
  await setDoc(metaRef(uid, "netWorthCounter"), { value: increment(account.balance) }, { merge: true });
}

export async function updateAccountMeta(uid, id, patch) {
  // 只改名稱／額度等「非餘額」欄位
  await setDoc(docRef(uid, "accounts", id), patch, { merge: true });
}

export async function correctAccountBalance(uid, id, oldBalance, newBalance) {
  // 手動校正餘額（例如對帳），直接設定絕對值，並同步調整淨資產累計值的差額
  const diff = newBalance - oldBalance;
  await setDoc(docRef(uid, "accounts", id), { balance: newBalance }, { merge: true });
  await setDoc(metaRef(uid, "netWorthCounter"), { value: increment(diff) }, { merge: true });
}

export async function deleteAccount(uid, id, currentBalance) {
  await deleteDoc(docRef(uid, "accounts", id));
  await setDoc(metaRef(uid, "netWorthCounter"), { value: increment(-currentBalance) }, { merge: true });
}

/* ---------------------------- 淨資產 / 本月統計（各只有 1 份文件） ---------------------------- */
export function subscribeNetWorthCounter(uid, cb) {
  return onSnapshot(metaRef(uid, "netWorthCounter"), (snap) => {
    cb(snap.exists() ? snap.data().value || 0 : 0);
  });
}
export function subscribeNetWorthTrend(uid, cb) {
  return onSnapshot(metaRef(uid, "netWorthTrend"), (snap) => {
    cb(snap.exists() ? snap.data().points || [] : []);
  });
}
export function subscribeCurrentMonthStats(uid, cb) {
  return onSnapshot(metaRef(uid, "currentMonthStats"), (snap) => {
    cb(snap.exists() ? snap.data() : { month: thisMonthKey(), income: 0, expense: 0 });
  });
}

/* ---------------------------- 預算群組 ---------------------------- */
export function subscribeBudgetGroups(uid, cb) {
  return onSnapshot(col(uid, "budgetGroups"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
export async function addBudgetGroup(uid, group) {
  const r = doc(col(uid, "budgetGroups"));
  await setDoc(r, group);
}
export async function updateBudgetGroup(uid, id, patch) {
  await setDoc(docRef(uid, "budgetGroups", id), patch, { merge: true });
}
export async function deleteBudgetGroup(uid, id) {
  await deleteDoc(docRef(uid, "budgetGroups", id));
}

/* ---------------------------- 預算花費彙總（月 / 年各 1 份文件） ---------------------------- */
export function subscribeBudgetSummary(uid, ym, cb) {
  return onSnapshot(doc(db, "users", uid, "budgetSummaries", ym), (snap) => {
    cb(snap.exists() ? snap.data().spentBySub || {} : {});
  });
}
export function subscribeBudgetSummaryAnnual(uid, y, cb) {
  return onSnapshot(doc(db, "users", uid, "budgetSummariesAnnual", y), (snap) => {
    cb(snap.exists() ? snap.data().spentBySub || {} : {});
  });
}

/* ---------------------------- 明細查詢（只在使用者查詢時讀取，且限制筆數） ---------------------------- */
export async function queryTransactionsByMonth(uid, ym, max = 500) {
  const q = query(col(uid, "transactions"), where("month", "==", ym), orderBy("date", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function queryTransactionsByRange(uid, start, end, max = 1000) {
  const q = query(
    col(uid, "transactions"),
    where("date", ">=", start),
    where("date", "<=", end),
    orderBy("date", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function fetchRecentTransactions(uid, max = 6) {
  const q = query(col(uid, "transactions"), orderBy("date", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ---------------------------- 新增批次交易 ----------------------------
 * 用「一次 writeBatch」寫入所有交易明細＋同步更新帳戶餘額／淨資產／本月統計／預算彙總。
 * 全部用 increment()，完全不需要先讀舊值，離線時也能排隊、恢復連線後自動送出。
 */
export async function addTransactionsBatch(uid, txs) {
  const batch = writeBatch(db);

  txs.forEach((t) => {
    const txRef = doc(col(uid, "transactions"));
    const month = monthKey(t.date);
    const year = yearKey(t.date);
    batch.set(txRef, {
      date: t.date,
      month,
      year,
      type: t.type,
      category: t.category,
      sub: t.sub,
      amount: t.amount,
      accountId: t.accountId,
      note: t.note || "",
      createdAt: Date.now(),
    });

    const delta = t.type === "income" ? t.amount : -t.amount;
    batch.set(docRef(uid, "accounts", t.accountId), { balance: increment(delta) }, { merge: true });

    if (t.type === "expense") {
      batch.set(
        doc(db, "users", uid, "budgetSummaries", month),
        { spentBySub: { [t.sub]: increment(t.amount) } },
        { merge: true }
      );
      batch.set(
        doc(db, "users", uid, "budgetSummariesAnnual", year),
        { spentBySub: { [t.sub]: increment(t.amount) } },
        { merge: true }
      );
    }
  });

  const totalDelta = txs.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  batch.set(metaRef(uid, "netWorthCounter"), { value: increment(totalDelta) }, { merge: true });

  const nowMonth = thisMonthKey();
  const incomeThisMonth = txs.filter((t) => t.type === "income" && monthKey(t.date) === nowMonth).reduce((s, t) => s + t.amount, 0);
  const expenseThisMonth = txs.filter((t) => t.type === "expense" && monthKey(t.date) === nowMonth).reduce((s, t) => s + t.amount, 0);
  if (incomeThisMonth || expenseThisMonth) {
    batch.set(
      metaRef(uid, "currentMonthStats"),
      { month: nowMonth, income: increment(incomeThisMonth), expense: increment(expenseThisMonth) },
      { merge: true }
    );
  }

  await batch.commit();
}

/* ---------------------------- 月份翻頁時的「結算」 ----------------------------
 * 每次打開App檢查一次：如果 currentMonthStats 記錄的月份已經不是這個月了，
 * 代表已經跨月，就把「上個月結束時的淨資產」寫進 netWorthTrend 的歷史陣列裡，
 * 然後把 currentMonthStats 歸零重新開始。只有真的跨月才會多讀寫幾份文件，
 * 平常同一個月裡開好幾次App，這段完全不會執行。
 */
export async function ensureMonthRollover(uid) {
  const statsSnap = await getDoc(metaRef(uid, "currentMonthStats"));
  const nowMonth = thisMonthKey();

  if (!statsSnap.exists()) {
    await setDoc(metaRef(uid, "currentMonthStats"), { month: nowMonth, income: 0, expense: 0 });
    return;
  }

  const stats = statsSnap.data();
  if (stats.month && stats.month !== nowMonth) {
    const [counterSnap, trendSnap] = await Promise.all([
      getDoc(metaRef(uid, "netWorthCounter")),
      getDoc(metaRef(uid, "netWorthTrend")),
    ]);
    const value = counterSnap.exists() ? counterSnap.data().value || 0 : 0;
    const points = trendSnap.exists() ? trendSnap.data().points || [] : [];
    const withoutOld = points.filter((p) => p.month !== stats.month);
    const nextPoints = [...withoutOld, { month: stats.month, value }].slice(-24); // 只保留近24個月

    await setDoc(metaRef(uid, "netWorthTrend"), { points: nextPoints });
    await setDoc(metaRef(uid, "currentMonthStats"), { month: nowMonth, income: 0, expense: 0 });
  }
}

/* ---------------------------- 初次登入：建立預設資料 ---------------------------- */
export async function ensureSeedData(uid) {
  const accSnap = await getDocs(col(uid, "accounts"));
  if (!accSnap.empty) return false; // 已經有資料了，不重複建立

  const batch = writeBatch(db);
  const defaultAccounts = [
    { name: "現金", type: "cash", balance: 0 },
    { name: "銀行帳戶", type: "bank", balance: 0 },
    { name: "信用卡", type: "credit", balance: 0, limit: 100000 },
  ];
  defaultAccounts.forEach((a) => batch.set(doc(col(uid, "accounts")), a));

  const defaultGroups = [
    { name: "餐飲", subs: ["早餐", "午餐", "晚餐", "點心", "飲料"], monthly: 8000, annual: 96000 },
    { name: "交通", subs: ["捷運", "公車", "計程車", "加油", "停車"], monthly: 2000, annual: 24000 },
    { name: "購物", subs: ["服飾", "3C", "日用品"], monthly: 3000, annual: 36000 },
    { name: "娛樂", subs: ["電影", "遊戲", "旅遊"], monthly: 2500, annual: 30000 },
    { name: "居家", subs: ["房租", "水電", "網路", "家具"], monthly: 15000, annual: 180000 },
  ];
  defaultGroups.forEach((g) => batch.set(doc(col(uid, "budgetGroups")), g));

  batch.set(metaRef(uid, "netWorthCounter"), { value: 0 });
  batch.set(metaRef(uid, "netWorthTrend"), { points: [] });
  batch.set(metaRef(uid, "currentMonthStats"), { month: thisMonthKey(), income: 0, expense: 0 });

  await batch.commit();
  return true;
}
