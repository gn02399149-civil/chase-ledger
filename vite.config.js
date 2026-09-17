import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 部署到 GitHub Pages 專案頁面（https://<你的帳號>.github.io/<repo名稱>/）時，
// base 必須設成 "/<repo名稱>/"，否則資源路徑會抓不到。
// 如果之後改用 Firebase Hosting 或自訂網域，把 base 改回 "/" 即可。
export default defineConfig({
  base: "/chase-ledger/",
  plugins: [react(), tailwindcss()],
});
