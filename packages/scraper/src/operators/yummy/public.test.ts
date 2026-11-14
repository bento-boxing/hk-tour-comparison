import { describe, expect, it } from 'vitest';
import { publicDates, publicDetail, publicListing } from './public';
import { rawDates, rawDetail, rawGroup, rawListing, rawListingRow, SECRET_COUNT, SECRETS } from './test-responses';

const keepsNoSecret = (kept: unknown) => {
  const text = JSON.stringify(kept);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
  expect(text).not.toContain(String(SECRET_COUNT));
};

describe('publicDetail', () => {
  it('keeps only the facts the parser reads, rebuilt key by key', () => {
    expect(publicDetail(rawDetail())).toEqual({
      code: 1,
      data: {
        id: 5906, code: 'AA-J-TD05', name: '【關東巡遊】東京・富士・鎌倉古都(紅葉)溫泉五天團', is_website_name: 0, website_name: '',
        daycount: 5, price: 5399, dist_list: '日本,東京,富士',
      },
    });
  });
  it('never keeps prose, tips, image or PDF paths, or the booking count', () => {
    keepsNoSecret(publicDetail(rawDetail()));
  });
  it('keeps no object or array where a plain value belongs', () => {
    const kept = publicDetail(rawDetail({ id: { x: SECRETS[0] }, dist_list: [SECRETS[1]], price: { v: SECRETS[2] } }));
    expect(kept.data).toMatchObject({ id: null, dist_list: null, price: null });
    keepsNoSecret(kept);
  });
  it('keeps the code and no data for an answer that is not a tour', () => {
    expect(publicDetail({ code: 0, msg: '参数错误' })).toEqual({ code: 0, data: null });
    expect(publicDetail('junk')).toEqual({ code: null, data: null });
    expect(publicDetail(null)).toEqual({ code: null, data: null });
  });
});

describe('publicDates', () => {
  it('keeps only each group\'s id, dates, status and price', () => {
    expect(publicDates(rawDates([rawGroup('2026-12-10', { return_date: '2026-12-14' })]))).toEqual({
      code: 1,
      data: { list: [{ id: 197538, start_date: '2026-12-10', return_date: '2026-12-14', group_enroll_status: 0, price: 5699 }] },
    });
  });
  it('drops the booking counts (cur_enroll_headcount, start_headcount, early_prefer_used_headcount) and every other field', () => {
    const kept = publicDates(rawDates([rawGroup('2026-12-10'), rawGroup('2026-12-17', { group_enroll_status: 3 })]));
    for (const group of kept.data!.list) {
      expect(Object.keys(group).sort()).toEqual(['group_enroll_status', 'id', 'price', 'return_date', 'start_date']);
    }
    keepsNoSecret(kept);
  });
  it('keeps the code and no data for an answer that is not a dates list', () => {
    expect(publicDates({ code: 0, msg: 'x' })).toEqual({ code: 0, data: null });
    expect(publicDates({ code: 1, data: { list: 'x' } })).toEqual({ code: 1, data: null });
    expect(publicDates({ code: 1, data: { list: [7] } }).data!.list).toEqual([
      { id: null, start_date: null, return_date: null, group_enroll_status: null, price: null },
    ]);
  });
});

describe('publicListing', () => {
  it('keeps the counts and each row\'s id, code, titles, days and price, and nothing else', () => {
    expect(publicListing(rawListing([rawListingRow(5906)]))).toEqual({
      code: 1,
      data: {
        total: 1, last_page: 1, page: 1,
        rows: [{ id: 5906, code: 'AA-J-T5906', name: '東京5906五天團', is_website_name: 0, website_name: '', daycount: 5, price: 5399 }],
      },
    });
    keepsNoSecret(publicListing(rawListing([rawListingRow(5906), rawListingRow(5907)])));
  });
  it('keeps the code and no data for an answer that is not a listing', () => {
    expect(publicListing({ code: 0 })).toEqual({ code: 0, data: null });
    expect(publicListing({ code: 1, data: { rows: {} } })).toEqual({ code: 1, data: null });
  });
});
