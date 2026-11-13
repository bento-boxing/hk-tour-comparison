// The source of truth for every UI string. dict.en.ts must have exactly the same keys.
const zh = {
  'site.name': '旅行團比較',
  'nav.search': '搜尋旅行團',
  'nav.chain': '連續行程',
  'footer.disclaimer': '本網站與各旅行社並無任何關連。價錢及出發日期以旅行社網站為準。',
  'length.daysNights': '{days}日{nights}夜',
  'length.days': '{days}日',
  'updated.today': '更新：今日 {time}',
  'updated.on': '更新：{month}月{day}日 {time}',
  'dest.placeholder': '輸入國家、地區或城市',
  'dest.none': '沒有相符地區',
  'dest.includes': '包括 {cities}',
  'dest.clear': '清除',
  'dest.byCountry': '按國家選擇',
  'dest.allRegions': '全部地區', // must equal ALL_REGIONS_LABEL in @hktours/core (pinned by a test)
  'dest.back': '← 返回',
  'dest.listSeparator': '、',
};

export default zh;
