# Chase的帳務本

溫暖帳本風格的個人記帳網頁應用，串接 Firebase（Firestore + Authentication），並用 GitHub Pages 免費部署。

## 這個專案怎麼省 Firestore 讀寫次數

- 帳戶餘額、淨資產走勢、預算花費都**不是**每次打開App去掃描全部交易明細算出來的，而是每次記帳時順便用 `increment()` 更新幾份「彙總文件」。平常開App只讀那幾份固定的小文件，跟你累積了多少筆交易完全無關。
- 「明細查詢」才會真的去讀交易資料，而且預設只讀「當月」，自訂區間或翻頁到更早月份才會多讀，並有筆數上限。
- 開啟了 Firestore 本機持久化快取，資料讀過一次、且內容沒變的話，重新整理頁面不會再消耗讀取次數。

詳細資料結構寫在 `src/lib/db.js` 檔案最上方的註解裡。

## 本機開發

```bash
npm install
npm run dev
```

會啟動一個本機網址（通常是 http://localhost:5173），打開後應該會看到「使用 Google 登入」畫面。

## 部署前，還要在 Firebase 後台做兩件事

### 1. 套用 Firestore 安全規則

到 [Firebase 主控台](https://console.firebase.google.com) → 選你的專案 → 左側「Firestore Database」→ 上方「規則」分頁，把 `firestore.rules` 這個檔案的內容整個貼上去覆蓋，按「發布」。
這樣可以確保：**只有登入的本人，才能讀寫自己的資料**（其他人即使知道你的 Firebase 設定值，也讀不到你的帳本）。

### 2. 把部署後的網址加進「已授權網域」

Google 登入需要 Firebase 知道你的網站網址是「自己人」。到「Authentication」→「Settings」→「Authorized domains」，把之後 GitHub Pages 給你的網址加進去，例如：

```
你的帳號.github.io
```

（只要加網域本身，不用加後面的路徑）

## 部署到 GitHub Pages

1. 到 GitHub 建立一個新的 repository（例如叫 `chase-ledger`，設為 Public 或 Private 都可以）
2. 把這個資料夾推上去：

```bash
git init
git add .
git commit -m "init: Chase的帳務本"
git branch -M main
git remote add origin https://github.com/<你的帳號>/chase-ledger.git
git push -u origin main
```

3. 到 repo 的 **Settings → Pages**，「Build and deployment」的 Source 選擇 **GitHub Actions**（不是選分支）。
4. 專案裡已經幫你寫好 `.github/workflows/deploy.yml`，只要推上 `main` 分支，GitHub 就會自動建置＋部署。第一次 push 完，到 repo 的「Actions」分頁看進度，跑完後到 **Settings → Pages** 就會看到網址，長得像：

```
https://<你的帳號>.github.io/chase-ledger/
```

5. **重要**：如果你的 repo 名稱不是 `chase-ledger`，要把 `vite.config.js` 裡的 `base: "/chase-ledger/"` 改成 `"/你的repo名稱/"`，否則畫面會讀不到資源變成空白頁。
6. 把這個網址加進上一節「已授權網域」，這樣 Google 登入才會生效。

之後每次你想更新App，只要改完程式碼、`git push` 上去，GitHub Actions 就會自動重新部署，不用手動操作。

## 之後想加功能？

- `src/lib/categories.js`：記帳分類（大項目／次要項目）都在這裡改
- `src/lib/db.js`：所有跟 Firestore 讀寫有關的邏輯
- `src/components/`：五個分頁的畫面元件
