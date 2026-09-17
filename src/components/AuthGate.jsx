import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { C, serif, sans } from "../lib/theme";
import { Seal } from "./Shared";

export default function AuthGate() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError("登入失敗，請再試一次（" + e.code + "）");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `repeating-linear-gradient(${C.paper}, ${C.paper} 27px, ${C.line}55 28px), ${C.paper}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: sans,
        padding: 20,
      }}
    >
      <div
        className="flex flex-col items-center gap-4 px-8 py-10 text-center"
        style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 14, maxWidth: 340 }}
      >
        <Seal>帳</Seal>
        <div>
          <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink }}>Chase的帳務本</div>
          <div style={{ fontFamily: sans, fontSize: 13, color: C.inkSoft, marginTop: 6 }}>
            登入後資料會安全地存到你自己的帳本裡，換裝置也能同步查看
          </div>
        </div>
        <button
          onClick={login}
          disabled={busy}
          className="px-5 py-2.5 text-sm font-semibold"
          style={{ background: C.red, color: "#fff", borderRadius: 8, fontFamily: sans, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "登入中…" : "使用 Google 登入"}
        </button>
        {error && <div style={{ color: C.red, fontSize: 12 }}>{error}</div>}
      </div>
    </div>
  );
}
