export const EXPENSE_TREE = {
  餐飲: ["早餐", "午餐", "晚餐", "點心", "飲料"],
  交通: ["捷運", "公車", "計程車", "加油", "停車"],
  購物: ["服飾", "3C", "日用品"],
  娛樂: ["電影", "遊戲", "旅遊"],
  居家: ["房租", "水電", "網路", "家具"],
  醫療: ["看診", "藥品"],
  其他支出: ["其他"],
};
export const INCOME_TREE = { 收入: ["薪資", "獎金", "投資", "其他收入"] };
export const ALL_TREE = { ...EXPENSE_TREE, ...INCOME_TREE };
export const ALL_SUBCATS = Object.values(ALL_TREE).flat();
export const EXPENSE_SUBCATS = Object.values(EXPENSE_TREE).flat();

export const SUB_TO_MAIN = {};
Object.entries(ALL_TREE).forEach(([main, subs]) => subs.forEach((s) => (SUB_TO_MAIN[s] = main)));
