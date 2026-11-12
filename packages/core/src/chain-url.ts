import { OPERATOR_IDS, tourKey, type IsoDate, type OperatorId } from './types';
import { isIsoDate } from './schema';
import { DEFAULT_GAP, sanitiseGap } from './chain';

/**
 * A chain stored in URL query parameters, so it survives a reload and can be
 * shared: `legs=egl:HTBKOK06@2026-12-18,jetour:THB@2026-12-24&gap=1-3`.
 * The gap applies to the next leg being chosen; gaps between existing legs
 * come from their dates.
 */

export interface ChainLegRef { tourKey: string; departure: IsoDate } // tourKey 'egl:HTBKOK06'
export interface ChainState { legs: ChainLegRef[]; gap: { min: number; max: number } }

export const MAX_CHAIN_LEGS = 8;

// `<operatorId>:<code>@<YYYY-MM-DD>`; the operator and the date are checked further below.
const LEG_PATTERN = /^([a-z]+):([A-Za-z0-9_-]{1,40})@(\d{4}-\d{2}-\d{2})$/;
const GAP_PATTERN = /^(\d+)-(\d+)$/;

const isOperatorId = (s: string): s is OperatorId => (OPERATOR_IDS as readonly string[]).includes(s);

/** Returns e.g. { legs: 'egl:HTBKOK06@2026-12-18,jetour:THB@2026-12-24', gap: '1-3' }. Omits `legs` when empty. */
export function encodeChain(state: ChainState): { legs?: string; gap: string } {
  const gap = `${state.gap.min}-${state.gap.max}`;
  if (state.legs.length === 0) return { gap };
  return { legs: state.legs.map((leg) => `${leg.tourKey}@${leg.departure}`).join(','), gap };
}

function decodeLeg(text: string): ChainLegRef | null {
  const match = LEG_PATTERN.exec(text);
  if (!match) return null;
  const [, operatorId, code, departure] = match;
  if (!isOperatorId(operatorId) || !isIsoDate(departure)) return null;
  return { tourKey: tourKey(operatorId, code), departure };
}

function decodeLegs(text: unknown): ChainLegRef[] {
  if (typeof text !== 'string') return [];
  const legs: ChainLegRef[] = [];
  for (const part of text.split(',')) {
    if (legs.length === MAX_CHAIN_LEGS) break;
    const leg = decodeLeg(part);
    if (leg === null) break; // the first invalid leg ends the chain
    legs.push(leg);
  }
  return legs;
}

function decodeGap(text: unknown): { min: number; max: number } {
  const match = typeof text === 'string' ? GAP_PATTERN.exec(text) : null;
  if (!match) return { ...DEFAULT_GAP };
  return sanitiseGap(Number(match[1]), Number(match[2]));
}

/**
 * Reads a chain back from URL query parameters. Never throws: a missing or
 * malformed gap gives DEFAULT_GAP, decoding stops at the first invalid leg,
 * and at most MAX_CHAIN_LEGS legs are kept. Does not check that tours exist
 * or that dates are in order.
 */
export function decodeChain(params: { legs?: string | null; gap?: string | null }): ChainState {
  return { legs: decodeLegs(params.legs), gap: decodeGap(params.gap) };
}
