import { describe, expect, it } from 'vitest';
import { publicDates, publicDetail, routeChunks } from './public';
import { rawDates, rawDetail, rawRow, SECRETS } from './test-responses';


describe('publicDetail', () => {
  it('keeps only the facts the parser reads, rebuilt key by key', () => {
    expect(publicDetail(rawDetail())).toEqual({
      code: 200,
      data: {
        id: 9109, memberFee: 5799, availableMonths: ['2026-11', '2026-12'],
        basic: { tourNo: 'CSIAA06', nameCn: '【純玩•西安】  直航6天', tourDays: 6 },
        projectItinerary: {
          dailyTripList: [
            { days: 1, tripContent: '香港機場集合 | 西安機場 | 入住酒店' },
            { days: 2, tripContent: '酒店 | 【華山】 | 西安' },
          ],
        },
        signUp: { settlementCurrencyCode: 'HKD', locationGroupList: [{ locationName: '香港國際機場' }] },
      },
    });
  });
  it('never keeps a name, note, supplier or cost', () => {
    const kept = JSON.stringify(publicDetail(rawDetail()));
    for (const secret of SECRETS) expect(kept).not.toContain(secret);
  });
  it('keeps no object or array where a plain value belongs', () => {
    const detail = rawDetail({ id: { name: SECRETS[0] }, memberFee: [SECRETS[4]], availableMonths: ['2026-11', { x: SECRETS[0] }] });
    const kept = publicDetail(detail);
    expect(kept.data).toMatchObject({ id: null, memberFee: null, availableMonths: ['2026-11', null] });
    expect(JSON.stringify(kept)).not.toContain(SECRETS[0]);
  });
  it('keeps the code and no data for an answer that is not a tour', () => {
    expect(publicDetail({ code: 401, msg: '未授权' })).toEqual({ code: 401, data: null });
    expect(publicDetail('junk')).toEqual({ code: null, data: null });
    expect(publicDetail(null)).toEqual({ code: null, data: null });
  });
});

describe('publicDates', () => {
  it('keeps only each departure\'s date, price and seat facts', () => {
    expect(publicDates(rawDates([rawRow('2026-12-04')]))).toEqual({
      code: 200,
      data: {
        list: [{
          productId: 9109, scheduleDate: '2026-12-04', memberFee: 5799,
          seatRemain: 12, soldTotal: 8, maxPersonTotal: 20, registrationStatus: 0, tourFlag: '1,2', isCutofftour: false,
        }],
      },
    });
  });
  it('never keeps a name, note, supplier or cost', () => {
    const kept = JSON.stringify(publicDates(rawDates([rawRow('2026-12-04'), rawRow('2026-12-09')])));
    for (const secret of SECRETS) expect(kept).not.toContain(secret);
  });
  it('keeps the code and no data for an answer that is not a dates list', () => {
    expect(publicDates({ code: 401, msg: '未授权' })).toEqual({ code: 401, data: null });
    expect(publicDates({ code: 200, data: { list: 'x' } })).toEqual({ code: 200, data: null });
  });
});

describe('routeChunks', () => {
  it.each([
    ['the places of a route line, without its leading dot', '.香港機場集合~西安機場~入住酒店', ['香港機場集合', '西安機場', '入住酒店']],
    ['split at ~, ～, |, ｜, → and runs of two or more hyphens', 'A~B～C|D｜E→F--G —— H-I', ['A', 'B', 'C', 'D', 'E', 'F', 'G —— H-I']],
    ['without notes in round or angle brackets, mixed widths and nested', '西安(包電瓶車）~華山（包(北上)索道）~雷克雅維克〈外觀:珍珠樓~音樂廳〉', ['西安', '華山', '雷克雅維克']],
    ['keeping attraction names in 【】 and 「」', '酒店~【兵馬俑】~「大召寺」', ['酒店', '【兵馬俑】', '「大召寺」']],
    ['cut at the first sentence mark, so prose after it is left out', '「敕勒川草原」冬日草原，陰山腳下雪原遼闊。打卡~西安', ['「敕勒川草原」冬日草原', '西安']],
    ['only the first line: later lines are notes', '西安~華山\n#註：以上行程以現場為準', ['西安', '華山']],
    ['the first line that has text', '\n \n西安~華山\n註', ['西安', '華山']],
    ['without chunks over 16 characters: descriptions, not names', '「成吉思汗陵」探尋蒙古帝王創立者的英雄地~泰北傳統少數民族-長頸族村~西安', ['泰北傳統少數民族-長頸族村', '西安']],
    ['with spaces collapsed and empty chunks dropped', '  D1   香港機場集合 || ~ - 哥本哈根 ', ['D1 香港機場集合', '哥本哈根']],
  ])('are %s', (_name, text, expected) => {
    expect(routeChunks(text)).toEqual(expected);
  });
  it('give the same chunks when read again from their own output', () => {
    for (const text of ['A(x~y)~B〈z〉|C，prose~(open|close)~)(', '酒店 --「大召寺」（包門票），感受--「敕勒川草原」']) {
      const once = routeChunks(text);
      expect(routeChunks(once.join(' | '))).toEqual(once);
    }
  });
  it('are empty for no text', () => {
    expect(routeChunks('')).toEqual([]);
    expect(routeChunks(null)).toEqual([]);
  });
});
