// The source of truth for every UI string. dict.zh-Hans.ts and dict.en.ts must have exactly the same keys,
// each with the same {placeholders} (pinned by a test).
const zh = {
  'site.name': '跟邊團',
  // What search engines and link previews show under the title (<meta name="description">, og:description).
  'site.description': '集合多間香港旅行社的旅行團，可按出發日期、日數、目的地及價錢篩選。報名請到旅行社自己的網站。',
  'lang.label': '語言', // the language switch's accessible name
  'theme.toDark': '切換至深色模式', // the theme switch's accessible name while the page is light
  'theme.toLight': '切換至淺色模式', // … and while it is dark
  'notice.cantonese': '旅行團一般以粵語進行，詳情請向旅行社查詢。', // shown only in the other languages
  'nav.search': '搜尋旅行團',
  'nav.chain': '連續行程',
  'nav.destinations': '所有目的地', // the header's link to the destinations index
  'notFound.title': '找不到這一頁', // the 404 page (app/global-not-found.tsx), which shows it in all three languages
  'notFound.text': '這個地址沒有頁面。', // the 404 inside a language's pages (an unknown /tours/<id>), under notFound.title
  // A destination's page (/tours/<id>). {place} is the country ('日本') or the region with its country (dest.regionOf).
  'dest.regionOf': '{country}{region}',
  'dest.heading': '{place}旅行團', // the page's <h1>
  'dest.title': '{place}旅行團比較', // the page's <title>, before ' | 跟邊團'
  'dest.description': '比較香港多間旅行社的{place}旅行團，可按出發日期、日數及價錢篩選，再到旅行社自己的網站報名。',
  'dest.count': '現時列出 {tours} 個旅行團，來自 {operators} 間旅行社。', // under the <h1>, before any filter
  'dest.countNone': '現時沒有列出旅行團。',
  'dest.regions': '地區：', // before the links to a country's regions
  'dest.allOf': '{country}全部旅行團', // a region's link to its country
  'dest.tours': '{n} 團', // a destination's count beside its link
  'home.heading': '比較香港旅行團', // the search page's <h1>
  // The gold band on the home page (task 47). {n} is the number of operators listing tours now, as a Chinese
  // numeral (lib/format.ts headlineCount); {tours} the tours listed now. 一次過 is the owner's choice of Cantonese here.
  'band.headline': '{n}間旅行社，一次過比較',
  'band.subline': '現有 {tours} 個旅行團 · 報名請到旅行社自己的網站',
  'band.placeholder': '想去邊？輸入國家、地區或城市', // the band's search box (colloquial on purpose, the owner's wish)
  'band.shortcuts': '旅行團最多的目的地', // the accessible name of the row of destination shortcuts
  'band.allDestinations': '所有目的地 →', // the last shortcut: the destinations index
  // The destinations index (/tours).
  'tours.title': '旅行團目的地',
  'tours.description': '按國家及地區瀏覽香港多間旅行社的旅行團，並查看每個目的地現時列出多少個旅行團。',
  'footer.links': '網站資訊', // the footer's links' accessible name
  'footer.destinations': '所有目的地',
  'footer.about': '關於本網站',
  // The about page (/about). The wording follows 給旅行社的說明 in README.md.
  'about.title': '關於本網站',
  'about.description': '跟邊團是一個由個人製作的非牟利網站。本頁說明網站顯示甚麼、資料如何收集，以及如何更正或移除資料。',
  'about.intro': '「跟邊團」是一個由個人製作的非牟利網站，把香港多間旅行社的旅行團放在一起，方便用戶按出發日期、日數、目的地和價錢比較。網站不設廣告、不收佣金、不代售任何產品；所有報名均經連結返回旅行社自己的網頁進行。本網站與各旅行社並無任何關連。',
  'about.showHeading': '網站顯示甚麼',
  'about.show1': '只顯示事實資料：旅行社名稱、日數、途經城市、集合及解散地點、出發日期及團費。',
  'about.show2': '每個旅行團均連結到旅行社網站上的該團頁面。',
  'about.show3': '不會儲存或顯示行程描述、圖片或宣傳文字，亦不會使用旅行社的標誌。',
  'about.collectHeading': '資料如何收集',
  'about.collect1': '程式每晚運行一次，並以 tour-comparison-bot 表明身分，同時附上本網站的網址和聯絡電郵。', // the scraper's name (pinned by a test)
  'about.collect2': '讀取任何網頁前，先讀取該網站的 robots.txt，並遵守當中的限制；如因錯誤而未能取得 robots.txt，程式不會讀取該網站。沒有 robots.txt 檔案的網站則視作沒有限制。',
  'about.collect3': '對每個網站每次只發出一個請求，每個請求之間最少相隔三秒。',
  'about.collect4': '不會登入，不會繞過任何防止自動讀取的措施；如網站多次拒絕，程式當晚即停止讀取該網站。',
  'about.pricesHeading': '價錢及出發日期',
  'about.prices': '資料每晚更新一次。如某旅行社當晚的資料未能更新，其旅行團會保留之前的資料，並註明最後更新的日期。價錢及出發日期以旅行社網站為準，報名前請先在旅行社網站確認。',
  'about.fixHeading': '更正或移除資料',
  'about.fix': '如發現資料有誤，請電郵至 {email}，我們會盡快更正。', // {email} becomes a mailto link
  'about.remove': '旅行社如不希望被列出，請電郵至同一地址；我們會移除有關資料，並停止讀取該旅行社的網站。',
  'footer.disclaimer': '本網站與各旅行社並無任何關連。價錢及出發日期以旅行社網站為準。',
  'footer.contact': '如有意見或查詢，或旅行社需要更正或移除旅行團資料，請電郵至 {email}。', // {email} becomes a mailto link
  'length.daysNights': '{days}日{nights}夜',
  'length.days': '{days}日',
  'dest.placeholder': '輸入國家、地區或城市',
  'dest.none': '沒有相符地區',
  'dest.includes': '包括 {cities}',
  'dest.clear': '清除',
  'dest.byCountry': '按國家選擇',
  'dest.allRegions': '全部地區', // must equal ALL_REGIONS_LABEL in @hktours/core (pinned by a test)
  'dest.back': '← 返回',
  'dest.listSeparator': '、',
  'countryGroup.china': '中國內地及港澳台', // the countryGroup.* labels must equal COUNTRY_GROUPS in @hktours/core (pinned by a test)
  'countryGroup.northeast-asia': '日本及韓國',
  'countryGroup.southeast-asia': '東南亞',
  'countryGroup.south-central-asia': '南亞及中亞',
  'countryGroup.middle-east': '中東',
  'countryGroup.europe': '歐洲',
  'countryGroup.americas': '美洲',
  'countryGroup.africa': '非洲',
  'countryGroup.oceania': '大洋洲',
  'countryGroup.polar': '南北極',
  'card.priceFrom': '{price} 起', // a lowest price; components split it around {price} to style the marker
  'card.lower': '↓ 比{days}日前平 {amount}', // the price change under the price: one line in its column (the drawing's wording)
  'card.higher': '↑ 比{days}日前貴 {amount}',
  'card.moreDates': '+{n} 個出發日',
  'card.dates': '出發日期', // the accessible name of a card's row of dates (each shows its price on hover or focus)
  'card.openedEarlier': '已看過', // on a row whose operator page the visitor opened earlier in this tab
  'card.openedLatest': '上次打開', // … on the one opened most recently
  'card.moreDatesCell': '+{n} 個', // the sixth date cell when a tour has more than six dates; card.moreDates is read out
  'row.stale': '資料為 {date}', // on a row whose operator's data is old: {date} is date.monthDay
  'list.updated': '資料更新：{date} · 各旅行社每晚更新一次 · 價錢及出發日期以旅行社網站為準', // under the list
  // The list's column names, for screen readers only (the columns have no visible headings).
  'col.operator': '旅行社',
  'col.days': '日數',
  'col.region': '地區',
  'col.route': '路線',
  'col.dates': '出發日期',
  'col.price': '價錢',
  'col.actions': '操作',
  'row.goTo': '去旅行社網站 ↗', // a row's button to the operator's page
  'row.again': '再看一次 ↗', // … on a row the visitor has opened in this tab
  'card.add': '加入行程 ＋',
  'card.startsAt': '{place}出發',
  'card.endsAt': '{place}解散',
  'card.moreRegions': '+{n}',
  'card.linkLabel': '{operator}：{route}，{length}，{price}起', // the card link's accessible name
  'picker.title': '選擇出發日期',
  'picker.close': '關閉',
  'date.long': '{year}年{monthName}{day}日（{weekday}）', // {monthName} is a date.month.* text: '12月'
  'date.weekday.0': '日',
  'date.weekday.1': '一',
  'date.weekday.2': '二',
  'date.weekday.3': '三',
  'date.weekday.4': '四',
  'date.weekday.5': '五',
  'date.weekday.6': '六',
  'date.chipWeekday': '({weekday})', // a weekday on a date chip: '12/28 (一)' (a bare 一 or 二 reads as a dash)
  'date.monthDay': '{monthName}{day}日', // a day without its year: '11月19日'
  'date.month.1': '1月',
  'date.month.2': '2月',
  'date.month.3': '3月',
  'date.month.4': '4月',
  'date.month.5': '5月',
  'date.month.6': '6月',
  'date.month.7': '7月',
  'date.month.8': '8月',
  'date.month.9': '9月',
  'date.month.10': '10月',
  'date.month.11': '11月',
  'date.month.12': '12月',
  'search.listLabel': '旅行團', // the list's accessible name (an ARIA table)
  'search.empty': '找不到符合條件的旅行團',
  'search.clearAll': '清除所有篩選',
  'search.error': '暫時未能載入資料，請稍後再試。',
  'filter.dates': '出發日期',
  'filter.days': '日數',
  'filter.price': '價錢',
  'filter.operators': '旅行社',
  'filter.sort': '排序',
  'filter.all': '全部',
  'filter.daysRange': '{min}–{max}日',
  'filter.daysPlus': '{min}日以上',
  'filter.label': '{name}：{value}', // a pill: '日數：4–6日'
  'filter.pricePlus': '{min}以上', // {min} is a formatted price: 'HK$5,000以上'
  'filter.exclude': '排除',
  'filter.none': '無', // '排除：無'
  'filter.from': '由',
  'filter.to': '至',
  'filter.apply': '套用',
  'filter.reset': '清除',
  'filter.clearDestination': '清除目的地：{dest}', // the destination pill's accessible name
  'filter.travel': '可出行日期', // the visitor's free dates: only tours that leave and come back inside them
  'filter.travelHint': '只列出出發及回程都在這段日子內的旅行團',
  'sort.price': '價錢 低→高',
  'sort.price-desc': '價錢 高→低',
  'sort.days': '日數 短→長',
  'sort.days-desc': '日數 長→短',
  'sort.date': '出發日期 早→遲',
  'sort.date-desc': '出發日期 遲→早',
  'sort.destination': '目的地 筆劃少→多',
  'sort.destination-desc': '目的地 筆劃多→少',
  // The sort popover: one row per order (sort.by.*), with its two directions (sort.dir.*); each button's
  // accessible name is the full sort.* text.
  'sort.by.price': '價錢',
  'sort.by.days': '日數',
  'sort.by.date': '出發日期',
  'sort.by.destination': '目的地',
  'sort.dir.price': '低→高',
  'sort.dir.price-desc': '高→低',
  'sort.dir.days': '短→長',
  'sort.dir.days-desc': '長→短',
  'sort.dir.date': '早→遲',
  'sort.dir.date-desc': '遲→早',
  'sort.dir.destination': '筆劃少→多',
  'sort.dir.destination-desc': '筆劃多→少',
  'pager.prev': '上一頁',
  'pager.next': '下一頁',
  'pager.page': '第 {page} / {pages} 頁',
  'pager.first': '回到第 1 頁',
  'pager.label': '分頁',
  'pager.range': '第 {from}–{to} 個，共 {total} 個旅行團', // under the list
  'pager.size': '每頁顯示', // before the 24 / 48 / 96 choice
  'pager.goTo': '第 {page} 頁', // a page number's accessible name
  'pager.beyond': '這一頁沒有內容。', // a page past the last; the link back to page 1 follows
  'chain.empty': '先在「搜尋旅行團」選擇第一個旅行團，再回來加入下一程。',
  'chain.dropped': '部分旅行團已下架或日期已不適用，已從行程中移除。',
  'chain.yours': '你的行程',
  'chain.rest': '休息',
  'chain.restDays': '休息 {n} 日',
  'chain.gapMin': '最少',
  'chain.gapMax': '最多',
  'chain.days': '日', // the unit after the gap fields; called with { max } so English can say day or days
  'chain.pickNext': '＋ 從下方選擇下一個旅行團',
  'chain.window': '可出發日：{from} – {to}',
  'chain.total': '目前合計',
  'chain.totalDays': '{days}日',
  'chain.totalSpan': '{days}日（連休息共{span}日）',
  'chain.removeLast': '移除最後一程',
  'chain.nextHeading': '可接續的旅行團（{from} – {to} 出發）',
  'chain.afterRest': '休息 {n} 日後出發',
  'chain.afterRestRange': '休息 {a}–{b} 日後出發',
  'chain.full': '行程已達上限（8 程）。', // 8 is MAX_CHAIN_LEGS (pinned by a test)
  'chain.noNext': '這段休息期內沒有可接續的旅行團，可嘗試延長休息日數。',
};

export default zh;
