// Raw answers shaped like Sunflower's (docs/operators/sunflower.md), for tests. Each carries marketing text and
// promotion notes that the allow-list must drop (SECRETS).

export const SECRETS = ['SECRET-SUBTITLE', 'SECRET-DESCRIPTION', 'SECRET-PROMOTEXT', 'SECRET-PHOTO', 'SECRET-PROMO-CELL', 'SECRET-HOLIDAY'];

/** One listing entry (`GET /App/Tour/Get?…` → `data[]`), with the fields the site sends that we never keep. */
export function rawListingRow(code: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rID: 125, link: `${code || 'NOCODE'}.pdf`, ItinCode: code,
    Title: '暢遊冬日秘境釜山慶州食足13餐五天團', SubTitle: 'SECRET-SUBTITLE', Description: 'SECRET-DESCRIPTION',
    TourMainTourName: 'SECRET-DESCRIPTION', temptitle: 'SECRET-DESCRIPTION', promotext: 'SECRET-PROMOTEXT',
    photo: 'SECRET-PHOTO', region: '日韓', area: '韓國', subarea: '釜山、慶州',
    minprice: 3299, pricetext: '3,299', discount: 2699, discounttext: '2,699', discountamt: 600,
    tdp_confirm: '4/12,11/12', tdp_hardpush: '2/12,6/1...',
    ...overrides,
  };
}

export function rawListing(rows: Record<string, unknown>[]): { status: boolean; data: Record<string, unknown>[] } {
  return { status: true, data: rows };
}

export interface RawCell {
  date?: string;            // YYYYMMDD; a cell without one has no link (onclick="")
  status?: '' | '-G' | '-H' | '-F';
  price?: string;           // span.price text
  holiday?: boolean;
}

/** One calendar cell as the booking page writes it. */
function rawCell(day: number, cell: RawCell, code: string): string {
  const classes = ['Calcell', cell.holiday ? 'holcell' : '', `Ava-Calcell${cell.status ?? ''}`, 'monthtoday'].filter(Boolean).join(' ');
  const onclick = cell.date ? `window.location=&#39;?date=${cell.date}&amp;TourCode=${code}#ancPaxSelection&#39;` : '';
  const holiday = cell.holiday ? '<span class="holitext">&nbsp;&nbsp;SECRET-HOLIDAY</span>' : '';
  return `<td class="${classes}" align="left" valign="top" onclick="${onclick}" width="14%"><font size="2"><b>${day}${holiday}<br />`
    + '<span style="color:blue;font-size:8pt;text-align:left;">保證成團</span>'
    + `<div>優惠價<span class="price">${cell.price ?? '$2,999起'}</span>優惠已扣除</div>`
    + '<span class="promotext" style="color:red;font-size:8pt;text-align:right;"><span><span>[SECRET-PROMO-CELL -500.00]</span></span></span></b></font></td>';
}

/** A booking page (`GET /OnlineBooking/?TourCode=<code>`) with its days tag and a calendar of `month`. */
export function rawBookingPage(opts: { code?: string; days?: string | null; month?: string | null; cells?: RawCell[] } = {}): string {
  const code = opts.code ?? 'KKFE05WR';
  const days = opts.days === undefined ? '#5天團' : opts.days;
  const month = opts.month === undefined ? '2026年12月' : opts.month;
  const cells = opts.cells ?? [{ date: '20261201', price: '$2,999起' }];
  const daysTag = days === null ? '' : `<a id="Content_lbtnday" class="hashclass" href="javascript:WebForm_DoPostBackWithOptions(x)">${days}</a>`;
  const heading = month === null ? '' : `<tr><td colspan="7" bgcolor="White"><table class="CalendarStyle" cellspacing="0" width="100%"><tr>`
    + `<td width="15%"><a href="javascript:__doPostBack('ctl00$Content$cdrDateOfDeparture','V9801')" title="Go to the previous month"></a></td>`
    + `<td align="center" width="70%">${month}</td>`
    + `<td align="right" width="15%"><a href="javascript:__doPostBack('ctl00$Content$cdrDateOfDeparture','V9862')" title="Go to the next month"></a></td>`
    + '</tr></table></td></tr>';
  return '<html><head><title>新華旅遊</title><script>var secret = "SECRET-DESCRIPTION";</script></head><body>'
    + `<div class="SECRET-DESCRIPTION">SECRET-DESCRIPTION</div>${daysTag}`
    + '<td class="boxtext">優惠價 HKD: <div class="pricetab pricebox">2,699 <span class="priceboxtext">費用根據…</span></div></td>'
    + `<div id="Tcal"><table id="Content_cdrDateOfDeparture" class="CalendarStyle" cellspacing="0" cellpadding="2" Title="">${heading}`
    + '<tr><td class="Calcell" align="left" valign="top" width="14%"><font color="Transparent" size="2">30</font></td>'
    + cells.map((cell, i) => rawCell(i + 1, cell, code)).join('')
    + '<td class="Calcell monthtoday" align="left" valign="top" width="14%"><font size="2">28</font></td></tr></table></div>'
    + '<p>SECRET-PROMOTEXT</p></body></html>';
}
