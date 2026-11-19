// Raw answers shaped like Taste Travel's (docs/operators/taste.md), for tests. Each carries marketing text, booking
// notes, a contact link and scripts that the allow-list must drop (SECRETS). Titles and day lines are invented.

export const SECRETS = [
  'SECRET-DESCRIPTION', 'SECRET-HIGHLIGHTS', 'SECRET-FEES', 'SECRET-NOTES', 'SECRET-REMARKS', 'SECRET-PHONE', 'SECRET-TAG',
];

const SITE = 'https://tastetravel.com.hk';

export interface RawCard {
  /** The card's link; a number is a tour page's id. */
  href?: string | number;
  /** `.list-tour-desc-title`: `<code> - <title>`. */
  title?: string;
  /** `span.desc-day`, `3天`; null for none. */
  days?: string | null;
}

/** One card of the list (`GET /tour/select/page/<offset>`). */
function rawCard(card: RawCard): string {
  const href = typeof card.href === 'number' || card.href === undefined ? `${SITE}/tour/detail/tour_id/${card.href ?? 693}` : card.href;
  const days = card.days === undefined ? '3天' : card.days;
  return `<a href="${href}" class="list-tour row">`
    + `<div class="list-tour-pic col-xs-12 col-md-3 col-sm-3" style="background-image: url(/assets/uploads/tour/1/pic.jpg);"></div>`
    + '<div class="list-tour-desc col-xs-12 col-md-9 col-sm-9">'
    + `<div class="list-tour-desc-title">${card.title ?? 'CAK03 - 江門三天'}</div>`
    + '<div class="list-tour-desc-text">SECRET-DESCRIPTION</div>'
    + '<div class="list-tour-desc-tag"><span>SECRET-TAG</span></div>'
    + '<div class="list-tour-desc-price-box row"><div class="col-xs-12 col-md-6 col-sm-6">'
    + '<div class="tour-date"><span class="date-status-yes">已成團</span><span>21/11</span></div>'
    + '<div class="tour-date"><span class="date-status-no">快成團</span><span>24/12</span></div></div>'
    + '<div class="col-xs-12 col-md-6 col-sm-6"><div class="list-tour-desc-price">'
    + (days === null ? '' : `<span class="desc-day">${days}</span>`)
    + '<span class="desc-price">$699<span style="font-size:18px;">&nbsp;&nbsp;起</span></span></div></div></div></div></a>';
}

/**
 * A list page. `next`: whether it links a next page (`下一頁`), as every page but the last does. `offset` sets the
 * page links around it, as CodeIgniter writes them.
 */
export function rawListPage(
  opts: { cards?: RawCard[]; offset?: number; next?: boolean; total?: number | null; current?: number | null } = {},
): string {
  const offset = opts.offset ?? 0;
  const cards = opts.cards ?? [{}];
  const next = opts.next ?? false;
  const pager = (offset > 0
    ? `<a href="${SITE}/tour/select/page" data-ci-pagination-page="1">首頁</a><a href="${SITE}/tour/select/page/${offset - 10}" data-ci-pagination-page="${offset - 10}">上一頁</a>`
    : '')
    + (opts.current === null ? '' : `<a class="selected">${opts.current ?? offset / 10 + 1}</a>`)
    + (next
      ? `<a href="${SITE}/tour/select/page/${offset + 10}" data-ci-pagination-page="${offset + 10}">${offset / 10 + 2}</a>`
        + `<a href="${SITE}/tour/select/page/${offset + 10}" data-ci-pagination-page="${offset + 10}">下一頁</a>`
        + `<a href="${SITE}/tour/select/page/310" data-ci-pagination-page="310">尾頁</a>`
      : '');
  return '<!DOCTYPE html><html><head><title>味力之旅</title><script>var secret = "SECRET-DESCRIPTION";</script></head><body>'
    + (opts.total === null ? '' : `<div class="list-num col-xs-12 col-md-6 col-sm-6">共為您找到<span>${opts.total ?? 311}</span>條商品</div>`)
    + `<div class="list-tour-box">${cards.map(rawCard).join('')}</div>`
    + `<div class="list-page-box row">${pager}</div>`
    + '<!-- <div class="list-page-box row"><a href="javascript:;" class="next">下一页</a></div> -->'
    + '<div class="footer"><a href="https://wa.me/SECRET-PHONE">SECRET-PHONE</a></div></body></html>';
}

export interface RawTourPage {
  title?: string | null;
  /** `.detail-number` text, `團號：CAK03`; null for none. */
  number?: string | null;
  /** The days line, `行程天數：3天`; null for none. */
  days?: string | null;
  /** The number inside `.tig span`; null for none. */
  price?: string | null;
  /** Each day's `.detail-desc-desc`, HTML. */
  dayLines?: string[];
  /** The booking notes' first `.detail-desc-text`, HTML. */
  notice?: string | null;
}

/** A tour page (`GET /tour/detail/tour_id/<n>`). */
export function rawTourPage(opts: RawTourPage = {}): string {
  const title = opts.title === undefined ? '【江門】三天美食團' : opts.title;
  const number = opts.number === undefined ? '團號：CAK03' : opts.number;
  const days = opts.days === undefined ? '行程天數：3天' : opts.days;
  const price = opts.price === undefined ? '699' : opts.price;
  const dayLines = opts.dayLines ?? [
    '深圳關口集合 → 午餐 → 江門 → 入住酒店',
    '酒店自助早餐 → 開平 → 新會',
    '酒店自助早餐 → 鶴山 → 深圳解散',
  ];
  const notice = opts.notice === undefined
    ? '行程編號: CAK03-010926<br />\n集合時間地點<br />\nA: 早上 07:30AM 福田口岸<br />\n'
      + 'B: 早上 08:30AM 深圳灣口岸出門後SECRET-NOTES<br />\n<br />\n留意:SECRET-NOTES<br />\n1.SECRET-NOTES<br />\n'
    : opts.notice;
  return '<!DOCTYPE html><html><head><title>味力之旅</title></head><body>'
    + '<div class="detail-main row"><div class="detail-info row"><div class="detail-right">'
    + (title === null ? '' : `<div class="detail-name">${title}</div>`)
    + '<div class="detail-desc">SECRET-DESCRIPTION</div>'
    + '<div class="detail-tag row"><div class="tag-a"><a href="javascript:;">SECRET-TAG</a></div></div>'
    + '<div class="detail-more row"><div class="detail-t">產品資訊</div><div class="detail-c"><div class="detail-day">'
    + (number === null ? '' : `<div class="detail-number">${number}</div>`)
    + (days === null ? '' : `<div>${days}</div>`)
    + '</div></div></div>'
    + '<div class="detail-more row"><div class="detail-t">行程特色</div><div class="detail-c"><div class="detail-text">SECRET-HIGHLIGHTS</div></div></div>'
    + '<div class="detail-more row"><div class="detail-t">行程PDF</div><div class="detail-c"><div class="detail-text">'
    + '<a id="showPDF" href="https://tastetravel.com.hk/assets/uploads/tour/693/pdf.pdf" target="_blank" class="btn btn-danger">瀏覽行程PDF</a>'
    + '</div></div></div></div></div></div>'
    + '<div class="detail-main detail-booking row"><div class="detail-calendar"><div id=\'calendar\'></div></div>'
    + '<div class="detail-button"><input type="hidden" name="date" value="2026-11-20" /><span id="booking-date">2026-11-20</span>'
    + '<div class="detail-price">'
    + (price === null ? '<div class="tig">HKD 起</div>' : `<div class="tig">HKD<span>${price}</span> 起</div>`)
    + '<div class="price-button"><a class="btn btn-danger" id="bookig_whatsapp" href="https://wa.me/SECRET-PHONE">SECRET-PHONE</a></div>'
    + '</div></div></div>'
    + '<div class="detail-desc"><div id="tour_days_detail" class="detail-desc-content">'
    + dayLines.map((line, i) => '<div class="detail-desc-day-box">'
      + `<div class="detail-desc-day">第 ${i + 1} 天</div><div class="detail-desc-desc">${line}</div></div>`).join('')
    + '</div>'
    + '<div id="tour_fee" class="detail-desc-content"><div class="detail-desc-title">團費説明</div><div class="detail-desc-text">SECRET-FEES</div></div>'
    + (notice === null ? ''
      : `<div id="tour_notice" class="detail-desc-content"><div class="detail-desc-title">預定須知</div><div class="detail-desc-text">${notice}</div></div>`)
    + '<div id="tour_notice" class="detail-desc-content"><div class="detail-desc-title">行程備註</div><div class="detail-desc-text">SECRET-REMARKS</div></div>'
    + '</div>'
    + '<script>$.get("https://tastetravel.com.hk/tour/event/tour_id/693", function(result) { var events = eval(result); });</script>'
    + '</body></html>';
}

const COLOURS: Record<string, string> = { 已成團: '#d9534f', 快成團: '#4E8BEE', 收客中: '#ff9900' };

/** One element of the dates answer. */
export function rawDate(date: string, title = '收客中'): Record<string, string> {
  const colour = COLOURS[title] ?? '#999999';
  return { backgroundColor: colour, borderColor: colour, textColor: '#fff', title, date };
}

/** The dates answer (`GET /tour/event/tour_id/<n>`): a JSON array, served as text/html, escaped as PHP writes it. */
export function rawDates(dates: Record<string, unknown>[] = [rawDate('2026-11-27')]): string {
  return JSON.stringify(dates).replace(/[\u007f-￿]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
