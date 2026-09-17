export const C = {
  paper: "#F1E7D3",
  paperDeep: "#E9DABE",
  line: "#D9C6A3",
  ink: "#2B2420",
  inkSoft: "#8A7A63",
  red: "#A23B28",
  redSoft: "#C97A63",
  gold: "#93702F",
  goldSoft: "#B08F52",
  cardBg: "#FBF4E7",
  green: "#5B6B4E",
};
export const serif = "'Noto Serif TC','Iowan Old Style',Georgia,serif";
export const sans = "'Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif";

export const fmt = (n) => {
  const neg = n < 0;
  const v = Math.abs(Math.round(n || 0)).toLocaleString("zh-TW");
  return (neg ? "-" : "") + "NT$ " + v;
};

export const monthLabel = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
};
export const addMonths = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
