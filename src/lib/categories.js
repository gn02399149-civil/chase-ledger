export const EXPENSE_TREE = {
  餐飲食品:['早餐','午餐','晚餐','宵夜','飲料','點心零嘴','食材','水果'],
  服飾美容:['衣服褲子','配件','鞋子','剪髮','保養品'],
  居家生活:['傢俱','家電','房租','水費','電費','瓦斯費','網路費','電話費','保險費','稅務','阿曦','阿霄','訂閱支出','寶貝寵物','洗衣費用','生活用品','購屋費用'],
  運輸交通:['計程車','高鐵','飛機','火車','船費','過路費','公車'],
  教育學習:['文具','書籍','學貸','補習費'],
  休閒娛樂:['電影','KTV','玩具小物','旅行遊玩','遊戲','彩券','運動健身','出國費用-日本'],
  電子商品:['電腦及周邊','3C產品'],
  汽機車:['油錢','停車費','保養費用','洗車費用','購車費用'],
  醫療保健:['診所就醫','購買藥物','保健食品','健檢檢查'],
  人情交際:['送禮','紅包','白包'],
  理財投資:['股票','頭期貸款','房屋貸款'],
  其他:['捐款','雜支','悠遊卡加值'],
};
export const INCOME_TREE = { 收入: ['薪水','差旅費','利息','股票','其他'] };
export const ALL_TREE = { ...EXPENSE_TREE, ...INCOME_TREE };
export const ALL_SUBCATS = Object.values(ALL_TREE).flat();
export const EXPENSE_SUBCATS = Object.values(EXPENSE_TREE).flat();

export const SUB_TO_MAIN = {};
Object.entries(ALL_TREE).forEach(([main, subs]) => subs.forEach((s) => (SUB_TO_MAIN[s] = main)));
