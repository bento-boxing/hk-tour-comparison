/**
 * Raw Big Line API answers for tests: the public facts, surrounded by the kinds of personal and internal
 * fields the real API sends (docs/operators/bigline.md, "Do not take"). Every such value is one of SECRETS.
 */

/** Strings that stand for what must never be kept: names, staff notes, suppliers, costs. */
export const SECRETS = ['LEADER-NAME-陳大文', 'SALE-REMARK-測試備註甲乙', 'INTERNAL-REMARK-x', 'SUPPLIER-NAME-y', 'COST-PRICE-1234567', 'GUIDE-REMARK-z'];

/** A detail response as the API sends it: the public facts, with personal and internal fields around them. */
export function rawDetail(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 200, msg: 'success',
    data: {
      id: 9109, productId: null, memberFee: 5799, adultFee: 5809, availableMonths: ['2026-11', '2026-12'],
      internalRemark: SECRETS[2], gatheringPlace: '',
      guideLeader: [{ guideName: SECRETS[0] }], leaders: [{ name: SECRETS[0] }],
      basic: {
        tourNo: 'CSIAA06', nameCn: '【純玩•西安】  直航6天', tourDays: 6, memberFee: null,
        internalRemark: SECRETS[2], guideRemark: SECRETS[5], adultProfit: SECRETS[4],
      },
      projectItinerary: {
        dailyTripList: [
          { days: 1, sort: 1, remark: SECRETS[2], tripContent: '.香港機場集合~西安機場~入住酒店' },
          { days: 2, sort: 2, remark: null, tripContent: '.酒店~【華山】(包索道)~西安' },
        ],
        projectItineraryList: [{ supplierName: SECRETS[3], costPrice: SECRETS[4] }],
      },
      signUp: {
        settlementCurrencyCode: 'HKD',
        locationGroupList: [{ locationName: '香港國際機場', startTime: '待定', addressDetail: 'x', locationId: 1 }],
        estimateIdentity: SECRETS[0],
      },
      ...patch,
    },
  };
}

/** One month's dates response as the API sends it. */
export function rawDates(rows: Record<string, unknown>[]): Record<string, unknown> {
  return { code: 200, msg: 'success', data: { total: rows.length, pageNum: 1, pageSize: 1000, list: rows } };
}

/** One departure row as the API sends it, open (seats left) unless patched. */
export function rawRow(scheduleDate: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    productId: 9109, tourNo: 'CSIAA06', nameCn: '西安6天', scheduleDate, memberFee: 5799.0, adultFee: 5809.0,
    seatRemain: 12, soldTotal: 8, maxPersonTotal: 20, registrationStatus: 0, tourFlag: '1,2', isCutofftour: false,
    tourStatus: '1', releaseStatusDaily: '已成團',
    tourLeader: [{ guideName: SECRETS[0] }], tourLeader1: SECRETS[0], internalSaleRemark: SECRETS[1],
    internalRemark: SECRETS[2], agencySupplier: [{ name: SECRETS[3] }], guideRemark: SECRETS[5],
    departurePlace: [{ locationName: '香港國際機場', startTime: '待定' }],
    ...patch,
  };
}
