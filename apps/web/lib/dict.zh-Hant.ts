// The source of truth for every UI string. dict.zh-Hans.ts and dict.en.ts must have exactly the same keys,
// each with the same {placeholders} (pinned by a test).
const zh = {
  'site.name': '跟邊團',
  // What search engines and link previews show under the title (<meta name="description">, og:description).
  'site.description': '集合多間香港旅行社的旅行團，可按出發日期、日數、目的地及價錢篩選。報名請到旅行社自己的網站。',
  // Task 64 (wording chosen by the owner, 2026-11-22). The site's other name in this language, for search engines
  // only (structured data: the home page's WebSite alternateName); 跟边团 in Simplified, Gan Bin Tuen in English.
  'site.alternateName': '香港旅行團比較',
  // The home page's <title> and description, with the counts from the data: {operators} operators listing tours now,
  // {tours} tours listed now (with thousands commas); {site} is site.name. The title: the searched words first, the
  // site name last, within about 30 full-width characters (pinned by a test).
  'home.title': '香港旅行團比較｜比較 {operators} 間旅行社的旅行團｜{site}',
  'home.description': '香港旅行團比較及格價：現時列出 {operators} 間旅行社的 {tours} 個旅行團，可按目的地、出發日期、日數及價錢篩選。網站由個人製作，報名請到旅行社自己的網站。',
  // The sharing image (public/share/, made by scripts/make-share-images.mjs from this line): its line under the name,
  // and its description for screen readers (og:image:alt).
  'share.line': '香港旅行團比較',
  'share.imageAlt': '跟邊團：香港旅行團比較',
  'lang.label': '語言', // the language switch's accessible name
  'theme.toDark': '切換至深色模式', // the theme switch's accessible name while the page is light
  'theme.toLight': '切換至淺色模式', // … and while it is dark
  'notice.cantonese': '旅行團一般以粵語進行，詳情請向旅行社查詢。', // shown only in the other languages
  'nav.search': '搜尋旅行團',
  'nav.chain': '連續行程',
  'nav.saved': '已收藏', // the header's link to the saved tours, their number after it
  'nav.savedCount': '({n})',
  'notFound.title': '找不到這一頁', // the 404 page (app/global-not-found.tsx), which shows it in all three languages
  'notFound.text': '這個地址沒有頁面。', // the 404 inside a language's pages (an unknown /tours/<id>), under notFound.title
  // The error page inside a language's pages (app/(zh-hant)/error.tsx): a page could not be made, as when the database
  // is down and the page has no stored copy yet. The heading, error.text under it, then the button.
  'error.title': '暫時未能顯示這一頁',
  'error.text': '暫時未能載入資料，請稍後再試。', // as search.error; its own key, since the English must not say "tours"
  'error.retry': '再試一次',
  // A destination's page (/tours/<id>). {place} is the country ('日本') or the region with its country (dest.regionOf).
  'dest.regionOf': '{country}{region}',
  'dest.heading': '{place}旅行團', // the page's <h1>
  'dest.title': '{place}旅行團比較', // the page's <title>, before ' | 跟邊團'
  'dest.description': '比較香港多間旅行社的{place}旅行團，可按出發日期、日數及價錢篩選，再到旅行社自己的網站報名。',
  // Task 67: the description with the destination's own facts before any filter (the canonical page's): {tours} listed
  // now, from {operators} operators, {days} their lengths (dest.daysRange or dest.daysOne), {price} the lowest
  // (HK$3,999). dest.descriptionCounts when the lengths and price are not known; dest.description with no tours.
  'dest.descriptionFacts': '比較香港 {operators} 間旅行社的 {tours} 個{place}旅行團，行程 {days}，團費由 {price} 起。可按出發日期、日數及價錢篩選，報名請到旅行社自己的網站。',
  'dest.descriptionCounts': '比較香港 {operators} 間旅行社的 {tours} 個{place}旅行團。可按出發日期、日數及價錢篩選，報名請到旅行社自己的網站。',
  'dest.daysRange': '{min} 至 {max} 日',
  'dest.daysOne': '{days} 日',
  'dest.count': '現時列出 {tours} 個旅行團，來自 {operators} 間旅行社。', // under the <h1>, before any filter
  'dest.countNone': '現時沒有列出旅行團。',
  'dest.tours': '{n} 團', // a destination's count beside its link
  'home.heading': '比較香港旅行團', // the search page's <h1>
  // The gold band on the home page (task 47). {n} is the number of operators listing tours now, as a Chinese
  // numeral (lib/format.ts headlineCount); {tours} the tours listed now. 一次過 is the owner's choice of Cantonese here.
  'band.headline': '{n}間旅行社，一次過比較',
  'band.subline': '現有 {tours} 個旅行團 · 報名請到旅行社自己的網站',
  // Under them, what the site does in the words people search (task 64, the owner's): one line on a phone 360px wide
  // in Chinese (the English may take two).
  'band.lede': '按目的地、出發日期、日數及價錢比較香港旅行團',
  'band.placeholder': '想去邊？輸入國家、地區或城市', // the band's search box (colloquial on purpose, the owner's wish)
  // Task 68: the label of the row of destination shortcuts, which names it (shown on phones; on wide screens it only
  // names the row for screen readers). The seasons' row is labelled tours.seasons.
  'band.popular': '熱門目的地',
  // Task 69 (drawing W3): row 1's label on a chosen country's (or region's) page: {place} is the country.
  'band.regionsOf': '{place}地區',
  // A chosen country's regions beyond those shown: the disclosure that shows them, closed and open.
  'band.allRegions': '全部 {n} 個地區',
  'band.fewerRegions': '收起',
  // A chosen box's accessible name, in either row ({count} is dest.tours: '1,306 團'): pressing it un-chooses it.
  'band.selected': '{name} {count}，已選取，按此取消',
  // The destinations index (/tours).
  'tours.title': '旅行團目的地',
  'tours.description': '按國家及地區瀏覽香港多間旅行社的旅行團，並查看每個目的地現時列出多少個旅行團。',
  'tours.byOperator': '按旅行社瀏覽', // after the index's line of counts: the operators index
  'tours.jumpTo': '跳到', // the accessible name of the row of links to each part of the world on the page
  // Task 67: a season's page (/seasons/<id>): the search with the departure window fixed to the season's days in its
  // current year ({year}: the December's for Christmas). {season} is season.<id> in the heading and title, and
  // season.<id>.description in the descriptions; {dates} is date.rangeSameMonth or date.range.
  'season.christmas': '聖誕',
  'season.lunar-new-year': '農曆新年',
  'season.easter': '復活節',
  'season.christmas.description': '聖誕',
  'season.lunar-new-year.description': '農曆新年',
  'season.easter.description': '復活節',
  'season.heading': '{year} {season}旅行團', // the page's <h1>: '2026 聖誕旅行團'
  'season.headingPlace': '{year} {season}{place}旅行團', // with a destination chosen: '2026 聖誕日本旅行團'
  'season.title': '{season}旅行團 {year} 比較', // its <title>, before ' | 跟邊團'
  'season.count': '{dates}出發。現時列出 {tours} 個旅行團，來自 {operators} 間旅行社。', // beside the <h1>, before any other filter
  'season.countNone': '{dates}出發。現時沒有列出旅行團。',
  'season.description': '{year}年{season}旅行團：{dates}出發，比較香港 {operators} 間旅行社的 {tours} 個旅行團，團費由 {price} 起。報名請到旅行社自己的網站。',
  'season.descriptionNone': '{year}年{season}旅行團：{dates}出發，比較香港多間旅行社的旅行團。報名請到旅行社自己的網站。',
  'tours.seasons': '節日旅行團', // the destinations index's row of links to the season pages with tours now
  // An operator's page (/operators/<id>). {operator} is its name as the rows show it (lib/place-names.ts operatorName).
  'operator.title': '{operator}旅行團一覽｜{site}', // the whole <title> (the owner's form, full-width bar); {site} is site.name
  // The description (search results show it under the title): first what the site is, then the data. {places}: the
  // operator's top countries, '日本、韓國及台灣'.
  'operator.description': '跟邊團是個人製作的旅行團比較網站，並非{operator}官方網站。現時列出{operator}的 {tours} 個旅行團，目的地包括{places}。',
  'operator.descriptionNoPlaces': '跟邊團是個人製作的旅行團比較網站，並非{operator}官方網站。現時列出{operator}的 {tours} 個旅行團。',
  'operator.descriptionNone': '跟邊團是個人製作的旅行團比較網站，並非{operator}官方網站。現時沒有列出{operator}的旅行團。',
  'operator.heading': '{operator}的旅行團', // the page's <h1>, on the gold band
  'operator.count': '現時列出 {tours} 個旅行團。', // beside the <h1>, before any filter
  'operator.notOfficial': '本頁並非{operator}的網站，本網站與{operator}並無任何關連。', // under the <h1>
  'operator.official': '去{operator}的官方網站 ↗', // the link to the operator's own home page
  'operator.none': '現時沒有列出{operator}的旅行團。', // the page of an operator listing no tours now, under the band
  'operator.allTours': '查看所有旅行團', // … then a link to the search page
  // The operators index (/operators).
  'operators.heading': '旅行社一覽', // its <h1>, and its <title> before ' | 跟邊團'
  'operators.description': '按旅行社瀏覽香港多間旅行社的旅行團，並查看每間旅行社現時列出多少個旅行團。',
  'operators.notOfficial': '本網站並非任何旅行社的網站，與各旅行社並無任何關連。',
  'operators.byDestination': '按目的地瀏覽', // after the index's line of counts: the destinations index
  'footer.links': '網站資訊', // the footer's links' accessible name
  'footer.operators': '所有旅行社',
  'footer.destinations': '所有目的地',
  // The footer's link to the destinations index; footer.destinations is the 404 page's. The same here; English
  // keeps this one short (Destinations) so the footer's three links stay on one line on a 320px phone.
  'footer.destinationsShort': '所有目的地',
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
  'card.datesPassed': '出發日期已過', // a row's dates when all of them have passed since the stored page was made (just after midnight); also in its picker
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
  'card.add': '加入行程 +',
  'card.startsAt': '{place}出發',
  'card.endsAt': '{place}解散',
  'card.moreRegions': '+{n}',
  'card.linkLabel': '{operator}：{route}，{length}，{price}起', // the card link's accessible name
  // A row's save button (a toggle) and its accessible name, which says which tour: '收藏「東瀛遊：大阪、京都，5日4夜」'.
  'save.save': '收藏',
  'save.saved': '已收藏',
  'save.name': '收藏「{tour}」', // the same in both states: aria-pressed says whether it is saved
  'save.failed': '空間已滿', // on the button when a change could not be kept (storage full)
  'save.failedLong': '瀏覽器的儲存空間已滿，未能更改收藏。',
  'save.tour': '{operator}：{route}，{length}',
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
  'date.rangeSameMonth': '{monthName}{from}日至{to}日', // two days of one month: '12月19日至27日'
  'date.range': '{from}至{to}', // two date.monthDay texts: '3月28日至4月3日'
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
  // The saved page (/saved): its title, the line under it, its states and the no-longer-listed tours.
  'saved.title': '已收藏的旅行團',
  'saved.intro': '收藏只保存在這個瀏覽器內，本網站不設帳戶。只有打開這一頁時，清單才會傳送到本網站，用來顯示這些旅行團，網站不會儲存它。',
  'saved.empty': '未有收藏的旅行團。',
  'saved.emptyHow': '在任何旅行團按「收藏」，它就會留在這裏，方便日後比較或再看。',
  'saved.unavailable': '這個瀏覽器不讓本網站保存資料（例如封鎖了網站資料），所以未能在這裏收藏旅行團。',
  'saved.fromLink': '這個清單來自一個連結，未必是你自己的收藏。按「收藏」可把旅行團加入你的收藏。',
  'saved.fromLinkOnly': '這個清單來自一個連結。', // … where the browser can save nothing
  'saved.yours': '查看你的收藏 ({n})',
  'saved.dropped': '連結內有部分項目無法讀取，已略去。',
  'saved.goneHeading': '已不再列出',
  'saved.goneNote': '旅行社已不再列出以下旅行團，或它們已沒有將來的出發日期。',
  'saved.goneUnnamed': '一個已收藏的旅行團', // an old entry kept without its label
  'saved.goneCount': '連結內有 {n} 個旅行團已不再列出。',
  'saved.nothingReadable': '連結內沒有可讀取的旅行團，以下是你自己的收藏。',
  'saved.remove': '移除',
  'saved.removeName': '移除 {tour}',
  'saved.noscript': '收藏保存在瀏覽器內，需要開啟 JavaScript 才能顯示。',
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
