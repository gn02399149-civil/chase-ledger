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
 * txs 裡每筆可以是 expense/income（category, sub, accountId）或 transfer（fromAccountId, toAccountId），沒有分類。
 */
export async function addTransactionsBatch(uid, txs) {
  const batch = writeBatch(db);

  txs.forEach((t) => {
    const txRef = doc(col(uid, "transactions"));
    const month = monthKey(t.date);
    const year = yearKey(t.date);

    if (t.type === "transfer") {
      batch.set(txRef, {
        date: t.date,
        month,
        year,
        type: "transfer",
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId,
        amount: t.amount,
        note: t.note || "",
        createdAt: Date.now(),
      });
      batch.set(docRef(uid, "accounts", t.fromAccountId), { balance: increment(-t.amount) }, { merge: true });
      batch.set(docRef(uid, "accounts", t.toAccountId), { balance: increment(t.amount) }, { merge: true });
      return; // 轉帳是使用者自己帳戶間互轉，不影響淨資產、不算收支、不進預算
    }

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

  const totalDelta = txs
    .filter((t) => t.type !== "transfer")
    .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  if (totalDelta) {
    batch.set(metaRef(uid, "netWorthCounter"), { value: increment(totalDelta) }, { merge: true });
  }

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

/* ---------------------------- 刪除單筆交易 ----------------------------
 * 刪除時要把它當初造成的影響「反著做一次」：帳戶餘額、淨資產、本月統計（只在同一個月才需要）、
 * 預算彙總（只有支出才會動到），最後才刪除這筆交易本身。
 */
export async function deleteTransaction(uid, t) {
  const batch = writeBatch(db);
  const txRef = docRef(uid, "transactions", t.id);
  batch.delete(txRef);

  if (t.type === "transfer") {
    batch.set(docRef(uid, "accounts", t.fromAccountId), { balance: increment(t.amount) }, { merge: true });
    batch.set(docRef(uid, "accounts", t.toAccountId), { balance: increment(-t.amount) }, { merge: true });
    await batch.commit();
    return;
  }

  const delta = t.type === "income" ? -t.amount : t.amount; // 反向操作
  batch.set(docRef(uid, "accounts", t.accountId), { balance: increment(delta) }, { merge: true });
  batch.set(metaRef(uid, "netWorthCounter"), { value: increment(delta) }, { merge: true });

  if (t.type === "expense") {
    batch.set(
      doc(db, "users", uid, "budgetSummaries", t.month),
      { spentBySub: { [t.sub]: increment(-t.amount) } },
      { merge: true }
    );
    batch.set(
      doc(db, "users", uid, "budgetSummariesAnnual", t.year),
      { spentBySub: { [t.sub]: increment(-t.amount) } },
      { merge: true }
    );
  }

  if (t.month === thisMonthKey()) {
    batch.set(
      metaRef(uid, "currentMonthStats"),
      { income: increment(t.type === "income" ? -t.amount : 0), expense: increment(t.type === "expense" ? -t.amount : 0) },
      { merge: true }
    );
  }

  await batch.commit();
}

/* ---------------------------- 修改單筆交易 ----------------------------
 * 做法：把舊資料的影響反向沖銷一次，再套用新資料的影響一次，全部包在同一個 batch 裡，
 * 最後直接覆蓋同一份交易文件（保留原本的 id），一次 commit。
 */
export async function updateTransaction(uid, oldTx, newTx) {
  const batch = writeBatch(db);
  const txRef = docRef(uid, "transactions", oldTx.id);

  // 反向沖銷舊資料
  if (oldTx.type === "transfer") {
    batch.set(docRef(uid, "accounts", oldTx.fromAccountId), { balance: increment(oldTx.amount) }, { merge: true });
    batch.set(docRef(uid, "accounts", oldTx.toAccountId), { balance: increment(-oldTx.amount) }, { merge: true });
  } else {
    const oldDelta = oldTx.type === "income" ? -oldTx.amount : oldTx.amount;
    batch.set(docRef(uid, "accounts", oldTx.accountId), { balance: increment(oldDelta) }, { merge: true });
    batch.set(metaRef(uid, "netWorthCounter"), { value: increment(oldDelta) }, { merge: true });
    if (oldTx.type === "expense") {
      batch.set(doc(db, "users", uid, "budgetSummaries", oldTx.month), { spentBySub: { [oldTx.sub]: increment(-oldTx.amount) } }, { merge: true });
      batch.set(doc(db, "users", uid, "budgetSummariesAnnual", oldTx.year), { spentBySub: { [oldTx.sub]: increment(-oldTx.amount) } }, { merge: true });
    }
    if (oldTx.month === thisMonthKey()) {
      batch.set(
        metaRef(uid, "currentMonthStats"),
        { income: increment(oldTx.type === "income" ? -oldTx.amount : 0), expense: increment(oldTx.type === "expense" ? -oldTx.amount : 0) },
        { merge: true }
      );
    }
  }

  // 套用新資料
  const month = monthKey(newTx.date);
  const year = yearKey(newTx.date);
  let newData;
  if (newTx.type === "transfer") {
    newData = {
      date: newTx.date, month, year, type: "transfer",
      fromAccountId: newTx.fromAccountId, toAccountId: newTx.toAccountId,
      amount: newTx.amount, note: newTx.note || "",
    };
    batch.set(docRef(uid, "accounts", newTx.fromAccountId), { balance: increment(-newTx.amount) }, { merge: true });
    batch.set(docRef(uid, "accounts", newTx.toAccountId), { balance: increment(newTx.amount) }, { merge: true });
  } else {
    newData = {
      date: newTx.date, month, year, type: newTx.type,
      category: newTx.category, sub: newTx.sub, amount: newTx.amount,
      accountId: newTx.accountId, note: newTx.note || "",
    };
    const newDelta = newTx.type === "income" ? newTx.amount : -newTx.amount;
    batch.set(docRef(uid, "accounts", newTx.accountId), { balance: increment(newDelta) }, { merge: true });
    batch.set(metaRef(uid, "netWorthCounter"), { value: increment(newDelta) }, { merge: true });
    if (newTx.type === "expense") {
      batch.set(doc(db, "users", uid, "budgetSummaries", month), { spentBySub: { [newTx.sub]: increment(newTx.amount) } }, { merge: true });
      batch.set(doc(db, "users", uid, "budgetSummariesAnnual", year), { spentBySub: { [newTx.sub]: increment(newTx.amount) } }, { merge: true });
    }
    if (month === thisMonthKey()) {
      batch.set(
        metaRef(uid, "currentMonthStats"),
        { income: increment(newTx.type === "income" ? newTx.amount : 0), expense: increment(newTx.type === "expense" ? newTx.amount : 0) },
        { merge: true }
      );
    }
  }

  batch.set(txRef, newData);
  await batch.commit();
}

/* ---------------------------- 帳戶間轉帳 ----------------------------
 * 轉帳不算收入也不算支出：只搬動兩個帳戶的餘額，不影響淨資產、不影響預算。
 * 一樣用 increment()，不需要先讀舊餘額。
 */
export async function addTransfer(uid, { date, fromAccountId, toAccountId, amount, note }) {
  const batch = writeBatch(db);
  const txRef = doc(col(uid, "transactions"));
  const month = monthKey(date);
  const year = yearKey(date);
  batch.set(txRef, {
    date,
    month,
    year,
    type: "transfer",
    fromAccountId,
    toAccountId,
    amount,
    note: note || "",
    createdAt: Date.now(),
  });
  batch.set(docRef(uid, "accounts", fromAccountId), { balance: increment(-amount) }, { merge: true });
  batch.set(docRef(uid, "accounts", toAccountId), { balance: increment(amount) }, { merge: true });
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
    const nextPoints = [...withoutOld, { month: stats.month, value }].slice(-600); // 最多保留50年，實務上不會被裁到

    await setDoc(metaRef(uid, "netWorthTrend"), { points: nextPoints });
    await setDoc(metaRef(uid, "currentMonthStats"), { month: nowMonth, income: 0, expense: 0 });
  }
}

/* ---------------------------- 一次性資料匯入 ----------------------------
 * 給「匯入舊記帳資料」的工具用。先清掉預設種子資料（3個預設帳戶＋5個預設預算群組），
 * 再寫入真正的帳戶／預算群組／各月與各年的預算彙總／淨資產走勢／本月統計，
 * 最後把所有交易明細分批（每批最多400筆）寫入，避免超過 Firestore 單次寫入500筆的上限。
 */
export async function clearSeedData(uid) {
  const [accSnap, groupSnap] = await Promise.all([getDocs(col(uid, "accounts")), getDocs(col(uid, "budgetGroups"))]);
  const batch = writeBatch(db);
  accSnap.docs.forEach((d) => batch.delete(d.ref));
  groupSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export async function importAccounts(uid, accounts) {
  const batch = writeBatch(db);
  accounts.forEach((a) => {
    batch.set(docRef(uid, "accounts", a.id), { name: a.name, type: a.type, balance: a.balance, ...(a.limit ? { limit: a.limit } : {}) });
  });
  await batch.commit();
}

export async function importBudgetGroups(uid, groups) {
  const batch = writeBatch(db);
  groups.forEach((g) => {
    batch.set(doc(col(uid, "budgetGroups")), { name: g.name, subs: g.subs, monthly: g.monthly, annual: g.annual });
  });
  await batch.commit();
}

export async function importBudgetSummaries(uid, monthly, annual) {
  const unwrap = (v) => v?.spentBySub || v || {}; // 匯入資料裡是 {spentBySub:{...}}，這裡把內層的map取出來，避免變成雙層包裝
  const entries = [
    ...Object.entries(monthly).map(([k, v]) => ["budgetSummaries", k, unwrap(v)]),
    ...Object.entries(annual).map(([k, v]) => ["budgetSummariesAnnual", k, unwrap(v)]),
  ];
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([col_, key, spentBySub]) => {
      batch.set(doc(db, "users", uid, col_, key), { spentBySub });
    });
    await batch.commit();
  }
}

/* ---------------------------- 修復預算彙總 ----------------------------
 * 不需要重新上傳檔案：直接讀取 Firestore 裡已經匯入好的 transactions（一次性讀取，只在修復時用），
 * 在瀏覽器裡重新算一次每月／每年各次要項目的花費，蓋掉舊的（可能是壞掉的）budgetSummaries。
 */
export async function repairBudgetSummaries(uid, onProgress) {
  onProgress?.("讀取現有交易明細中…");
  const snap = await getDocs(col(uid, "transactions"));
  const monthly = {};
  const annual = {};
  snap.docs.forEach((d) => {
    const t = d.data();
    if (t.type !== "expense") return;
    monthly[t.month] = monthly[t.month] || {};
    monthly[t.month][t.sub] = (monthly[t.month][t.sub] || 0) + t.amount;
    annual[t.year] = annual[t.year] || {};
    annual[t.year][t.sub] = (annual[t.year][t.sub] || 0) + t.amount;
  });

  onProgress?.("清除舊的預算彙總中…");
  const [bmSnap, bySnap] = await Promise.all([getDocs(col(uid, "budgetSummaries")), getDocs(col(uid, "budgetSummariesAnnual"))]);
  const toDelete = [...bmSnap.docs, ...bySnap.docs];
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = writeBatch(db);
    toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  onProgress?.("寫入重新計算好的預算彙總中…");
  const entries = [
    ...Object.entries(monthly).map(([k, v]) => ["budgetSummaries", k, v]),
    ...Object.entries(annual).map(([k, v]) => ["budgetSummariesAnnual", k, v]),
  ];
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([col_, key, spentBySub]) => {
      batch.set(doc(db, "users", uid, col_, key), { spentBySub });
    });
    await batch.commit();
  }
  onProgress?.("完成");
  return { transactionCount: snap.docs.length, monthCount: Object.keys(monthly).length };
}

export async function importMeta(uid, { netWorthCounter, netWorthTrend, currentMonthStats }) {
  const batch = writeBatch(db);
  batch.set(metaRef(uid, "netWorthCounter"), { value: netWorthCounter });
  batch.set(metaRef(uid, "netWorthTrend"), { points: netWorthTrend });
  batch.set(metaRef(uid, "currentMonthStats"), currentMonthStats);
  await batch.commit();
}

export async function importTransactionsChunked(uid, transactions, onProgress) {
  const CHUNK = 400;
  for (let i = 0; i < transactions.length; i += CHUNK) {
    const chunk = transactions.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    chunk.forEach((t) => {
      const data =
        t.type === "transfer"
          ? { date: t.date, month: t.month, year: t.year, type: "transfer", fromAccountId: t.fromAccountId, toAccountId: t.toAccountId, amount: t.amount, note: t.note || "" }
          : { date: t.date, month: t.month, year: t.year, type: t.type, category: t.category, sub: t.sub, amount: t.amount, accountId: t.accountId, note: t.note || "" };
      batch.set(doc(col(uid, "transactions")), data);
    });
    await batch.commit();
    onProgress?.(Math.min(i + CHUNK, transactions.length), transactions.length);
  }
}

/* ---------------------------- 覆蓋模式：只重置交易明細，保留帳戶清單／預算群組 ----------------------------
 * 用在「拿一份新的明細檔，整批覆蓋掉之前的明細資料」。跟上面完整匯入的差別：
 * 不會動 accounts / budgetGroups 這兩個集合本身（名稱、類型、額度、群組設定都保留），
 * 只清掉 transactions / budgetSummaries / budgetSummariesAnnual，並把每個帳戶的餘額重設成
 * 「這份新明細重新計算出來的結果」（等於每個帳戶從 0 開始，把這份明細全部重播一次）。
 */
export async function clearTransactionsAndSummaries(uid) {
  const [txSnap, bmSnap, bySnap] = await Promise.all([
    getDocs(col(uid, "transactions")),
    getDocs(col(uid, "budgetSummaries")),
    getDocs(col(uid, "budgetSummariesAnnual")),
  ]);
  const allDocs = [...txSnap.docs, ...bmSnap.docs, ...bySnap.docs];
  for (let i = 0; i < allDocs.length; i += 400) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function overwriteAccountBalances(uid, resetMap) {
  const accSnap = await getDocs(col(uid, "accounts"));
  const batch = writeBatch(db);
  accSnap.docs.forEach((d) => {
    const name = d.data().name;
    batch.set(d.ref, { balance: resetMap[name] ?? 0 }, { merge: true });
  });
  await batch.commit();
}

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
