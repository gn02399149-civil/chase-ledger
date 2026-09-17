import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// 這些是 Firebase 專案的「用戶端識別資訊」，本來就是公開設計給前端程式使用的，
// 真正的存取控管是靠 Firestore 安全規則（見 firestore.rules）＋ Authentication 登入驗證，
// 所以直接寫在程式碼、上傳到公開 GitHub repo 都沒關係。
const firebaseConfig = {
  apiKey: "AIzaSyAo-A_VNYRn63cyNWR89QTgWxiehXWJLi0",
  authDomain: "chase-ledger.firebaseapp.com",
  projectId: "chase-ledger",
  storageBucket: "chase-ledger.firebasestorage.app",
  messagingSenderId: "1015463072794",
  appId: "1:1015463072794:web:113c759134bd8336deada3",
};

export const app = initializeApp(firebaseConfig);

// 開啟本機持久化快取＋支援多分頁：
// 資料只有「第一次讀取」或「內容真的改變時」才會消耗 Firestore 讀取次數，
// 之後重新整理頁面、切換分頁都是直接從本機快取顯示，不會再算一次讀取。
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
