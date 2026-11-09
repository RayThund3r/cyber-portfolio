// src/lib/games/chessEngine.ts
//
// Fast chess search engine. Works on a private mutable board with make/unmake, an incremental Zobrist
// hash, a typed-array transposition table and a tapered hand-crafted evaluation. Features:
//   - iterative deepening with aspiration windows and principal-variation search (PVS)
//   - transposition table, internal iterative reduction
//   - null-move pruning, reverse futility, futility and late-move pruning, late-move reductions
//   - killer + history move ordering with history malus
//   - quiescence search with delta pruning
//   - repetition / fifty-move awareness (game history can be supplied)
//   - tapered evaluation: PSTs, mobility, pawn structure, passed pawns, king safety, bishop pair,
//     rook files, mop-up for basic mates
// Only `import type` from ./chess so there is no runtime import cycle.

import type { State, Move } from './chess';

const MATE = 100000;
const MATE_BOUND = MATE - 1000;
const MAXPLY = 96;
const INF = MATE + 10;

/* ------------------------------------------------------------------------------------------------
 * Tables
 * ---------------------------------------------------------------------------------------------- */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
}
const rng = mulberry32(0x2f6e2b1);
const ZA = new Int32Array(12 * 64), ZB = new Int32Array(12 * 64);
for (let i = 0; i < 12 * 64; i++) { ZA[i] = rng(); ZB[i] = rng(); }
const ZSA = rng(), ZSB = rng();
const ZCA = new Int32Array(16), ZCB = new Int32Array(16);
for (let i = 0; i < 16; i++) { ZCA[i] = rng(); ZCB[i] = rng(); }
const ZEA = new Int32Array(8), ZEB = new Int32Array(8);
for (let i = 0; i < 8; i++) { ZEA[i] = rng(); ZEB[i] = rng(); }

const DIRS = [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [-1, -1], [1, 1], [1, -1]];
const KNT: Int8Array[] = [], KGT: Int8Array[] = [], RAYS: Int8Array[] = [];
const PCAP: Int8Array[][] = [[], []];
{
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  for (let s = 0; s < 64; s++) {
    const r = s >> 3, c = s & 7;
    const kn: number[] = [], kg: number[] = [];
    for (const [dc, dr] of KN) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) kn.push(rr * 8 + cc); }
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) kg.push(rr * 8 + cc);
    }
    KNT[s] = Int8Array.from(kn); KGT[s] = Int8Array.from(kg);
    for (const col of [0, 1]) {
      const rr = r + (col === 0 ? -1 : 1), list: number[] = [];
      if (rr >= 0 && rr < 8) for (const dc of [-1, 1]) { const cc = c + dc; if (cc >= 0 && cc < 8) list.push(rr * 8 + cc); }
      PCAP[col][s] = Int8Array.from(list);
    }
  }
  for (let d = 0; d < 8; d++) for (let s = 0; s < 64; s++) {
    const list: number[] = [];
    let r = (s >> 3) + DIRS[d][0], c = (s & 7) + DIRS[d][1];
    while (r >= 0 && r < 8 && c >= 0 && c < 8) { list.push(r * 8 + c); r += DIRS[d][0]; c += DIRS[d][1]; }
    RAYS[d * 64 + s] = Int8Array.from(list);
  }
}
// castling rights: K=1 Q=2 k=4 q=8
const CMASK = new Uint8Array(64).fill(15);
CMASK[60] = 15 & ~3; CMASK[63] = 15 & ~1; CMASK[56] = 15 & ~2;
CMASK[4] = 15 & ~12; CMASK[7] = 15 & ~4; CMASK[0] = 15 & ~8;

/* Evaluation tables (index 0 = a8, White's point of view) */
const VMG = [0, 100, 320, 330, 500, 900, 0];
const VEG = [0, 112, 310, 335, 520, 940, 0];
const PST_MG: Record<number, number[]> = {
  1: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
const PST_EG: Record<number, number[]> = {
  1: [0,0,0,0,0,0,0,0, 85,85,85,85,85,85,85,85, 48,48,48,48,48,48,48,48, 26,26,26,26,26,26,26,26, 12,12,12,12,12,12,12,12, 4,4,4,4,4,4,4,4, 0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0],
  2: PST_MG[2].map((v) => Math.round(v * 1.25)),
  3: PST_MG[3],
  4: new Array(64).fill(0),
  5: PST_MG[5].map((v) => Math.round(v * 0.8)),
  6: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
const PMG = new Int16Array(7 * 64), PEG = new Int16Array(7 * 64);
for (let t = 1; t <= 6; t++) for (let i = 0; i < 64; i++) { PMG[t * 64 + i] = VMG[t] + PST_MG[t][i]; PEG[t * 64 + i] = VEG[t] + PST_EG[t][i]; }
const PHASEW = [0, 0, 1, 1, 2, 4, 0];
const PASS_MG = [0, 4, 8, 14, 26, 46, 74, 0];
const PASS_EG = [0, 8, 16, 32, 58, 96, 150, 0];
const CMD = new Int8Array(64); // distance from centre (0..6)
for (let s = 0; s < 64; s++) { const f = s & 7, r = s >> 3; CMD[s] = 3 - Math.min(f, 7 - f) + 3 - Math.min(r, 7 - r); }
const LMR = new Int8Array(64 * 64);
for (let d = 1; d < 64; d++) for (let m = 1; m < 64; m++) LMR[d * 64 + m] = Math.floor(0.7 + (Math.log(d) * Math.log(m)) / 2.3);

/* ------------------------------------------------------------------------------------------------
 * Engine state (module level for speed; the search is synchronous so this is safe)
 * ---------------------------------------------------------------------------------------------- */
const board = new Int8Array(64);
let side = 0; // 0 white, 1 black
let castle = 0;
let ep = -1;
let half = 0;
let hA = 0, hB = 0;
const kingSq = [60, 4];
let sp = 0;
const HN = 4096;
const histA = new Int32Array(HN), histB = new Int32Array(HN);
const uCap = new Int8Array(HN), uCast = new Uint8Array(HN), uEp = new Int8Array(HN), uHalf = new Int16Array(HN);

const MV: Int32Array[] = Array.from({ length: MAXPLY + 4 }, () => new Int32Array(256));
const SC: Int32Array[] = Array.from({ length: MAXPLY + 4 }, () => new Int32Array(256));
const QT: Int32Array[] = Array.from({ length: MAXPLY + 4 }, () => new Int32Array(64));
const killers = new Int32Array((MAXPLY + 4) * 2);
const hist = new Int32Array(2 * 64 * 64);

// transposition table
const TT_BITS = 19, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
let tKey: Int32Array | null = null, tScore: Int32Array, tMove: Int32Array, tDepth: Int8Array, tFlag: Uint8Array;
function ensureTT() {
  if (tKey) return;
  tKey = new Int32Array(TT_SIZE); tScore = new Int32Array(TT_SIZE); tMove = new Int32Array(TT_SIZE);
  tDepth = new Int8Array(TT_SIZE); tFlag = new Uint8Array(TT_SIZE);
}
export function clearEngine() {
  if (tKey) { tFlag.fill(0); }
  hist.fill(0);
}

let nodes = 0;
let stop = false;
let deadline = 0;

/* ------------------------------------------------------------------------------------------------
 * Position set-up
 * ---------------------------------------------------------------------------------------------- */
const zIndex = (p: number) => (p > 0 ? p - 1 : 5 - p);

function hashOf(b: Int8Array, sd: number, cs: number, e: number): [number, number] {
  let a = 0, c = 0;
  for (let i = 0; i < 64; i++) { const p = b[i]; if (p) { const k = zIndex(p) * 64 + i; a ^= ZA[k]; c ^= ZB[k]; } }
  if (sd) { a ^= ZSA; c ^= ZSB; }
  a ^= ZCA[cs]; c ^= ZCB[cs];
  if (e >= 0) { a ^= ZEA[e & 7]; c ^= ZEB[e & 7]; }
  return [a, c];
}
const castleBits = (c: State['castling']) => (c.K ? 1 : 0) | (c.Q ? 2 : 0) | (c.k ? 4 : 0) | (c.q ? 8 : 0);

function load(s: State, history: State[] = []) {
  sp = 0;
  for (const h of history.slice(-Math.min(history.length, 600))) {
    const [a, c] = hashOf(h.board, h.turn === 'w' ? 0 : 1, castleBits(h.castling), h.ep);
    histA[sp] = a; histB[sp] = c; sp++;
  }
  board.set(s.board);
  side = s.turn === 'w' ? 0 : 1;
  castle = castleBits(s.castling);
  ep = s.ep;
  half = s.half;
  kingSq[0] = board.indexOf(6);
  kingSq[1] = board.indexOf(-6);
  [hA, hB] = hashOf(board, side, castle, ep);
}

/* ------------------------------------------------------------------------------------------------
 * Attacks and move generation
 * ---------------------------------------------------------------------------------------------- */
function isAttacked(s: number, by: number): boolean {
  const sign = by === 0 ? 1 : -1;
  const pa = PCAP[1 - by][s];
  for (let i = 0; i < pa.length; i++) if (board[pa[i]] === sign) return true;
  const kn = KNT[s];
  for (let i = 0; i < kn.length; i++) if (board[kn[i]] === sign * 2) return true;
  const kg = KGT[s];
  for (let i = 0; i < kg.length; i++) if (board[kg[i]] === sign * 6) return true;
  for (let d = 4; d < 8; d++) {
    const ray = RAYS[d * 64 + s];
    for (let i = 0; i < ray.length; i++) {
      const v = board[ray[i]];
      if (v) { if (v === sign * 3 || v === sign * 5) return true; break; }
    }
  }
  for (let d = 0; d < 4; d++) {
    const ray = RAYS[d * 64 + s];
    for (let i = 0; i < ray.length; i++) {
      const v = board[ray[i]];
      if (v) { if (v === sign * 4 || v === sign * 5) return true; break; }
    }
  }
  return false;
}

// move: from | to<<6 | promo<<12 | flag<<15   (flag 1 ep, 2 castle K, 3 castle Q, 4 double push)
function gen(ply: number, caps: boolean): number {
  const ms = MV[ply];
  let n = 0;
  const white = side === 0;
  const dir = white ? -8 : 8, startRow = white ? 6 : 1, promoRow = white ? 0 : 7;
  const pc = PCAP[side];
  const enemy = 1 - side;
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (p === 0 || p > 0 !== white) continue;
    const t = p > 0 ? p : -p;
    if (t === 1) {
      const one = from + dir;
      if (board[one] === 0) {
        if (one >> 3 === promoRow) {
          ms[n++] = from | (one << 6) | (5 << 12);
          if (!caps) { ms[n++] = from | (one << 6) | (2 << 12); ms[n++] = from | (one << 6) | (4 << 12); ms[n++] = from | (one << 6) | (3 << 12); }
        } else if (!caps) {
          ms[n++] = from | (one << 6);
          if (from >> 3 === startRow && board[from + 2 * dir] === 0) ms[n++] = from | ((from + 2 * dir) << 6) | (4 << 15);
        }
      }
      const cp = pc[from];
      for (let i = 0; i < cp.length; i++) {
        const to = cp[i], tp = board[to];
        if (tp !== 0 && tp > 0 !== white) {
          if (to >> 3 === promoRow) {
            ms[n++] = from | (to << 6) | (5 << 12);
            if (!caps) { ms[n++] = from | (to << 6) | (2 << 12); ms[n++] = from | (to << 6) | (4 << 12); ms[n++] = from | (to << 6) | (3 << 12); }
          } else ms[n++] = from | (to << 6);
        } else if (to === ep) ms[n++] = from | (to << 6) | (1 << 15);
      }
    } else if (t === 2 || t === 6) {
      const tb = t === 2 ? KNT[from] : KGT[from];
      for (let i = 0; i < tb.length; i++) {
        const to = tb[i], tp = board[to];
        if (tp !== 0) { if (tp > 0 !== white) ms[n++] = from | (to << 6); }
        else if (!caps) ms[n++] = from | (to << 6);
      }
      if (t === 6 && !caps) {
        if (white && from === 60 && !isAttacked(60, 1)) {
          if (castle & 1 && !board[61] && !board[62] && board[63] === 4 && !isAttacked(61, 1) && !isAttacked(62, 1)) ms[n++] = 60 | (62 << 6) | (2 << 15);
          if (castle & 2 && !board[59] && !board[58] && !board[57] && board[56] === 4 && !isAttacked(59, 1) && !isAttacked(58, 1)) ms[n++] = 60 | (58 << 6) | (3 << 15);
        } else if (!white && from === 4 && !isAttacked(4, 0)) {
          if (castle & 4 && !board[5] && !board[6] && board[7] === -4 && !isAttacked(5, 0) && !isAttacked(6, 0)) ms[n++] = 4 | (6 << 6) | (2 << 15);
          if (castle & 8 && !board[3] && !board[2] && !board[1] && board[0] === -4 && !isAttacked(3, 0) && !isAttacked(2, 0)) ms[n++] = 4 | (2 << 6) | (3 << 15);
        }
      }
    } else {
      const d0 = t === 3 ? 4 : 0, d1 = t === 4 ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        const ray = RAYS[d * 64 + from];
        for (let i = 0; i < ray.length; i++) {
          const to = ray[i], tp = board[to];
          if (tp === 0) { if (!caps) ms[n++] = from | (to << 6); }
          else { if (tp > 0 !== white) ms[n++] = from | (to << 6); break; }
        }
      }
    }
  }
  void enemy;
  return n;
}

function make(m: number) {
  const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 15;
  const p = board[from], cap = board[to];
  const k = sp;
  histA[k] = hA; histB[k] = hB; uCap[k] = cap; uCast[k] = castle; uEp[k] = ep; uHalf[k] = half;
  sp++;
  if (ep >= 0) { hA ^= ZEA[ep & 7]; hB ^= ZEB[ep & 7]; }
  hA ^= ZCA[castle]; hB ^= ZCB[castle];
  const white = p > 0;
  let ki = zIndex(p) * 64;
  hA ^= ZA[ki + from]; hB ^= ZB[ki + from];
  board[from] = 0;
  const np = promo ? (white ? promo : -promo) : p;
  if (cap) { const ck = zIndex(cap) * 64 + to; hA ^= ZA[ck]; hB ^= ZB[ck]; }
  board[to] = np;
  ki = zIndex(np) * 64;
  hA ^= ZA[ki + to]; hB ^= ZB[ki + to];
  ep = -1;
  if (fl === 1) {
    const cs = white ? to + 8 : to - 8;
    const cp = board[cs];
    const ck = zIndex(cp) * 64 + cs; hA ^= ZA[ck]; hB ^= ZB[ck];
    board[cs] = 0;
  } else if (fl === 4) {
    ep = (from + to) >> 1;
  } else if (fl === 2 || fl === 3) {
    const rf = fl === 2 ? (white ? 63 : 7) : (white ? 56 : 0);
    const rt = fl === 2 ? (white ? 61 : 5) : (white ? 59 : 3);
    const r = board[rf];
    board[rf] = 0; board[rt] = r;
    const rk = zIndex(r) * 64;
    hA ^= ZA[rk + rf] ^ ZA[rk + rt]; hB ^= ZB[rk + rf] ^ ZB[rk + rt];
  }
  if (p === 6 || p === -6) kingSq[white ? 0 : 1] = to;
  castle &= CMASK[from] & CMASK[to];
  hA ^= ZCA[castle]; hB ^= ZCB[castle];
  if (ep >= 0) { hA ^= ZEA[ep & 7]; hB ^= ZEB[ep & 7]; }
  half = p === 1 || p === -1 || cap !== 0 ? 0 : half + 1;
  side ^= 1;
  hA ^= ZSA; hB ^= ZSB;
}

function unmake(m: number) {
  sp--;
  const k = sp;
  side ^= 1;
  const white = side === 0;
  const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 15;
  const orig = promo ? (white ? 1 : -1) : board[to];
  board[from] = orig;
  board[to] = uCap[k];
  if (fl === 1) board[white ? to + 8 : to - 8] = white ? -1 : 1;
  else if (fl === 2 || fl === 3) {
    const rf = fl === 2 ? (white ? 63 : 7) : (white ? 56 : 0);
    const rt = fl === 2 ? (white ? 61 : 5) : (white ? 59 : 3);
    board[rf] = board[rt]; board[rt] = 0;
  }
  if (orig === 6 || orig === -6) kingSq[side] = from;
  castle = uCast[k]; ep = uEp[k]; half = uHalf[k]; hA = histA[k]; hB = histB[k];
}

function nullMake() {
  const k = sp;
  histA[k] = hA; histB[k] = hB; uEp[k] = ep; uHalf[k] = half;
  sp++;
  if (ep >= 0) { hA ^= ZEA[ep & 7]; hB ^= ZEB[ep & 7]; }
  ep = -1;
  half++;
  side ^= 1;
  hA ^= ZSA; hB ^= ZSB;
}
function nullUnmake() {
  sp--;
  side ^= 1;
  ep = uEp[sp]; half = uHalf[sp]; hA = histA[sp]; hB = histB[sp];
}

/* ------------------------------------------------------------------------------------------------
 * Evaluation
 * ---------------------------------------------------------------------------------------------- */
const wMin = new Int8Array(10), wMax = new Int8Array(10), bMin = new Int8Array(10), bMax = new Int8Array(10);
const cnt0 = new Int8Array(10), cnt1 = new Int8Array(10);
const pcs = new Int8Array(32), pws = new Int8Array(20);
const zone0 = new Uint8Array(64), zone1 = new Uint8Array(64); // squares around the white / black king

function evalPos(): number {
  let mg = 0, eg = 0, phase = 0;
  let np0 = 0, np1 = 0, pn0 = 0, pn1 = 0, nb0 = 0, nb1 = 0, q0 = 0, q1 = 0, heavy = 0, minors = 0;
  let pcN = 0, pwN = 0;
  wMin.fill(8); bMin.fill(8); wMax.fill(-1); bMax.fill(-1); cnt0.fill(0); cnt1.fill(0);
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (!p) continue;
    const t = p > 0 ? p : -p;
    if (p > 0) { mg += PMG[t * 64 + s]; eg += PEG[t * 64 + s]; }
    else { const i2 = ((7 - (s >> 3)) << 3) | (s & 7); mg -= PMG[t * 64 + i2]; eg -= PEG[t * 64 + i2]; }
    phase += PHASEW[t];
    if (t === 1) {
      pws[pwN++] = s;
      const f = (s & 7) + 1, rk = 7 - (s >> 3);
      if (p > 0) { pn0++; cnt0[f]++; if (rk < wMin[f]) wMin[f] = rk; if (rk > wMax[f]) wMax[f] = rk; }
      else { pn1++; cnt1[f]++; if (rk < bMin[f]) bMin[f] = rk; if (rk > bMax[f]) bMax[f] = rk; }
    } else if (t !== 6) {
      pcs[pcN++] = s;
      if (p > 0) { np0 += VMG[t]; if (t === 3) nb0++; if (t === 5) q0++; } else { np1 += VMG[t]; if (t === 3) nb1++; if (t === 5) q1++; }
      if (t === 4 || t === 5) heavy++; else minors++;
    }
  }
  if (pwN === 0 && heavy === 0 && minors <= 1) return 0; // insufficient material

  zone0.fill(0); zone1.fill(0);
  {
    const k0 = kingSq[0], k1 = kingSq[1];
    zone0[k0] = 1; zone1[k1] = 1;
    const a = KGT[k0], b = KGT[k1];
    for (let i = 0; i < a.length; i++) zone0[a[i]] = 1;
    for (let i = 0; i < b.length; i++) zone1[b[i]] = 1;
  }
  let au0 = 0, au1 = 0, an0 = 0, an1 = 0;

  for (let k = 0; k < pcN; k++) {
    const s = pcs[k], p = board[s], white = p > 0, t = white ? p : -p;
    const zn = white ? zone1 : zone0;
    let c = 0, units = 0, hit = false;
    const wgt = t === 2 ? 2 : t === 3 ? 2 : t === 4 ? 3 : 5;
    if (t === 2) {
      const tb = KNT[s];
      for (let i = 0; i < tb.length; i++) {
        const q = tb[i], v = board[q];
        if (v === 0 || v > 0 !== white) { c++; if (zn[q]) { units += wgt; hit = true; } }
      }
      const m = (c - 4) * 4;
      if (white) { mg += m; eg += m; } else { mg -= m; eg -= m; }
    } else {
      const d0 = t === 3 ? 4 : 0, d1 = t === 4 ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        const ray = RAYS[d * 64 + s];
        for (let i = 0; i < ray.length; i++) {
          const q = ray[i], v = board[q];
          if (v === 0) { c++; if (zn[q]) { units += wgt; hit = true; } }
          else { if (v > 0 !== white) { c++; if (zn[q]) { units += wgt; hit = true; } } break; }
        }
      }
      let m0: number, m1: number;
      if (t === 3) { m0 = (c - 6) * 3; m1 = (c - 6) * 3; }
      else if (t === 4) { m0 = (c - 7) * 2; m1 = (c - 7) * 4; }
      else { m0 = (c - 13); m1 = (c - 13) * 2; }
      if (white) { mg += m0; eg += m1; } else { mg -= m0; eg -= m1; }
      if (t === 4) {
        const f = (s & 7) + 1;
        const own = white ? cnt0[f] : cnt1[f], opp = white ? cnt1[f] : cnt0[f];
        let rg = 0, re = 0;
        if (own === 0) { if (opp === 0) { rg = 22; re = 12; } else { rg = 10; re = 8; } }
        const rel = white ? 7 - (s >> 3) : s >> 3;
        if (rel === 6) { rg += 14; re += 24; }
        if (white) { mg += rg; eg += re; } else { mg -= rg; eg -= re; }
      }
    }
    if (hit) { if (white) { au0 += units; an0++; } else { au1 += units; an1++; } }
  }
  // king danger (attacker bonus)
  if (an0 >= 2) { let d = Math.min(380, (au0 * au0) / 6) | 0; if (!q0) d >>= 1; mg += d; }
  if (an1 >= 2) { let d = Math.min(380, (au1 * au1) / 6) | 0; if (!q1) d >>= 1; mg -= d; }

  // pawn structure
  for (let k = 0; k < pwN; k++) {
    const s = pws[k], p = board[s], white = p > 0;
    const f = (s & 7) + 1, rk = 7 - (s >> 3);
    let g = 0, e = 0;
    const own = white ? cnt0 : cnt1;
    if (own[f] > 1) { g -= 6; e -= 10; }
    if (own[f - 1] === 0 && own[f + 1] === 0) { g -= 12; e -= 16; }
    let passed = true;
    if (white) {
      for (let ff = f - 1; ff <= f + 1; ff++) if (bMax[ff] > rk) { passed = false; break; }
    } else {
      for (let ff = f - 1; ff <= f + 1; ff++) if (wMin[ff] < rk) { passed = false; break; }
    }
    if (passed) {
      const rel = white ? rk : 7 - rk;
      g += PASS_MG[rel]; e += PASS_EG[rel];
      // protected passer / blocked passer
      const ahead = white ? s - 8 : s + 8;
      if (ahead >= 0 && ahead < 64 && board[ahead] !== 0) { g -= 4; e -= 12; }
    }
    if (white) { mg += g; eg += e; } else { mg -= g; eg -= e; }
  }

  // bishop pair
  if (nb0 >= 2) { mg += 28; eg += 48; }
  if (nb1 >= 2) { mg -= 28; eg -= 48; }

  // pawn shield
  {
    const ks = kingSq[0], f = ks & 7, r = 7 - (ks >> 3);
    if (r <= 1) {
      let sh = 0;
      for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1); ff++) {
        if (board[(7 - (r + 1)) * 8 + ff] === 1) sh += 9;
        else if (r + 2 <= 7 && board[(7 - (r + 2)) * 8 + ff] === 1) sh += 4;
        else sh -= 10;
        if (cnt0[ff + 1] === 0) sh -= 8;
      }
      mg += sh;
    }
    const kb = kingSq[1], fb = kb & 7, rb = kb >> 3;
    if (rb >= 6) {
      let sh = 0;
      for (let ff = Math.max(0, fb - 1); ff <= Math.min(7, fb + 1); ff++) {
        if (board[(rb - 1) * 8 + ff] === -1) sh += 9;
        else if (rb - 2 >= 0 && board[(rb - 2) * 8 + ff] === -1) sh += 4;
        else sh -= 10;
        if (cnt1[ff + 1] === 0) sh -= 8;
      }
      mg -= sh;
    }
  }

  const ph = phase > 24 ? 24 : phase;
  let sc = ((mg * ph + eg * (24 - ph)) / 24) | 0;

  // mop-up: drive a lone king to the edge when the other side is clearly winning
  {
    const m0 = np0 + pn0 * 100, m1 = np1 + pn1 * 100;
    const k0 = kingSq[0], k1 = kingSq[1];
    const kd = Math.abs((k0 & 7) - (k1 & 7)) + Math.abs((k0 >> 3) - (k1 >> 3));
    if (pn1 === 0 && np1 <= 330 && m0 >= m1 + 300) sc += CMD[k1] * 10 + (14 - kd) * 4;
    else if (pn0 === 0 && np0 <= 330 && m1 >= m0 + 300) sc -= CMD[k0] * 10 + (14 - kd) * 4;
  }
  return side === 0 ? sc + 10 : -sc + 10;
}

/* ------------------------------------------------------------------------------------------------
 * Search
 * ---------------------------------------------------------------------------------------------- */
const toTT = (s: number, ply: number) => (s >= MATE_BOUND ? s + ply : s <= -MATE_BOUND ? s - ply : s);
const fromTT = (s: number, ply: number) => (s >= MATE_BOUND ? s - ply : s <= -MATE_BOUND ? s + ply : s);

function hasPieces(sd: number): boolean {
  for (let i = 0; i < 64; i++) { const p = board[i]; if (p && p > 0 === (sd === 0)) { const t = p > 0 ? p : -p; if (t >= 2 && t <= 5) return true; } }
  return false;
}

function scoreMoves(ply: number, n: number, ttMove: number) {
  const ms = MV[ply], sc = SC[ply];
  const k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
  for (let i = 0; i < n; i++) {
    const m = ms[i];
    if (m === ttMove) { sc[i] = 1 << 28; continue; }
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7;
    const cap = board[to];
    const att = board[from] > 0 ? board[from] : -board[from];
    let s: number;
    if (cap !== 0 || m >> 15 === 1) {
      const v = cap === 0 ? 1 : cap > 0 ? cap : -cap;
      s = 2000000 + v * 100 - att;
    } else if (promo) s = 1900000 + promo;
    else if (m === k1) s = 1000000;
    else if (m === k2) s = 900000;
    else s = hist[(side * 64 + from) * 64 + to];
    sc[i] = s;
  }
}
function pick(ply: number, i: number, n: number): number {
  const ms = MV[ply], sc = SC[ply];
  let bi = i, bs = sc[i];
  for (let j = i + 1; j < n; j++) if (sc[j] > bs) { bs = sc[j]; bi = j; }
  if (bi !== i) { const m = ms[bi]; ms[bi] = ms[i]; ms[i] = m; sc[bi] = sc[i]; sc[i] = bs; }
  return ms[i];
}

function qsearch(alpha: number, beta: number, ply: number): number {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
  if (stop) return 0;
  if (half >= 100) return 0;
  const se = evalPos();
  if (ply >= MAXPLY) return se;
  if (se >= beta) return se;
  if (se > alpha) alpha = se;
  let best = se;
  const n = gen(ply, true);
  scoreMoves(ply, n, 0);
  const ms = MV[ply];
  const us = side;
  for (let i = 0; i < n; i++) {
    const m = pick(ply, i, n);
    const to = (m >> 6) & 63, promo = (m >> 12) & 7;
    if (!promo) {
      const cv = board[to] === 0 ? 1 : board[to] > 0 ? board[to] : -board[to];
      if (se + VMG[cv] + 180 < alpha) continue;
    }
    make(m);
    if (isAttacked(kingSq[us], 1 - us)) { unmake(m); continue; }
    const sc = -qsearch(-beta, -alpha, ply + 1);
    unmake(m);
    if (stop) return 0;
    if (sc > best) { best = sc; if (sc > alpha) { alpha = sc; if (alpha >= beta) break; } }
  }
  void ms;
  return best;
}

function negamax(depth: number, alpha: number, beta: number, ply: number, nullOk: boolean): number {
  if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
  if (stop) return 0;
  const pv = beta - alpha > 1;
  if (ply > 0) {
    if (half >= 100) return 0;
    for (let i = sp - 2, lim = sp - half; i >= lim && i >= 0; i -= 2) if (histA[i] === hA && histB[i] === hB) return 0;
    if (alpha < -MATE + ply) alpha = -MATE + ply;
    if (beta > MATE - ply - 1) beta = MATE - ply - 1;
    if (alpha >= beta) return alpha;
  }
  if (ply >= MAXPLY) return evalPos();
  const us = side, them = 1 - us;
  const inChk = isAttacked(kingSq[us], them);
  if (inChk) depth++;
  if (depth <= 0) return qsearch(alpha, beta, ply);

  const tt = tKey!;
  const idx = hA & TT_MASK;
  let ttMove = 0;
  if (tFlag[idx] !== 0 && tt[idx] === hB) {
    ttMove = tMove[idx];
    if (!pv && tDepth[idx] >= depth) {
      const s = fromTT(tScore[idx], ply), f = tFlag[idx];
      if (f === 1 || (f === 2 && s >= beta) || (f === 3 && s <= alpha)) return s;
    }
  }
  const se = inChk ? -MATE : evalPos();
  if (!pv && !inChk) {
    if (depth <= 4 && se - 90 * depth >= beta && beta > -MATE_BOUND && se < MATE_BOUND) return se;
    if (nullOk && depth >= 3 && se >= beta && beta > -MATE_BOUND && hasPieces(us)) {
      const R = 2 + (depth >= 6 ? 1 : 0) + (se - beta > 200 ? 1 : 0);
      nullMake();
      const sc = -negamax(depth - 1 - R, -beta, -beta + 1, ply + 1, false);
      nullUnmake();
      if (stop) return 0;
      if (sc >= beta) return sc >= MATE_BOUND ? beta : sc;
    }
  }
  if (!ttMove && depth >= 5) depth--; // internal iterative reduction

  const n = gen(ply, false);
  scoreMoves(ply, n, ttMove);
  let best = -INF, bestM = 0, legal = 0, flag = 3, qn = 0;
  const origAlpha = alpha;
  const qt = QT[ply];
  for (let i = 0; i < n; i++) {
    const m = pick(ply, i, n);
    const from = m & 63, to = (m >> 6) & 63;
    const isCap = board[to] !== 0 || m >> 15 === 1;
    const quiet = !isCap && ((m >> 12) & 7) === 0;
    make(m);
    if (isAttacked(kingSq[us], them)) { unmake(m); continue; }
    legal++;
    const gc = isAttacked(kingSq[side], us);
    if (!pv && !inChk && quiet && !gc && legal > 1 && best > -MATE_BOUND) {
      if (depth <= 2 && se + 110 + 140 * depth <= alpha) { unmake(m); continue; }
      if (depth <= 3 && legal > 4 + depth * depth) { unmake(m); continue; }
    }
    const nd = depth - 1;
    let red = 0;
    if (depth >= 3 && legal > 3 && quiet && !inChk && !gc) {
      red = LMR[(depth > 63 ? 63 : depth) * 64 + (legal > 63 ? 63 : legal)];
      if (pv) red--;
      if (hist[(us * 64 + from) * 64 + to] > 4000) red--;
      if (red < 0) red = 0;
      if (red > nd - 1) red = nd - 1 < 0 ? 0 : nd - 1;
    }
    let sc: number;
    if (legal === 1) sc = -negamax(nd, -beta, -alpha, ply + 1, true);
    else {
      sc = -negamax(nd - red, -alpha - 1, -alpha, ply + 1, true);
      if (sc > alpha && red > 0) sc = -negamax(nd, -alpha - 1, -alpha, ply + 1, true);
      if (sc > alpha && sc < beta) sc = -negamax(nd, -beta, -alpha, ply + 1, true);
    }
    unmake(m);
    if (stop) return 0;
    if (sc > best) {
      best = sc; bestM = m;
      if (sc > alpha) {
        alpha = sc; flag = 1;
        if (alpha >= beta) {
          flag = 2;
          if (quiet) {
            if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
            const bonus = depth * depth;
            let h = hist[(us * 64 + from) * 64 + to] + bonus;
            if (h > 500000) h = 500000;
            hist[(us * 64 + from) * 64 + to] = h;
            for (let j = 0; j < qn; j++) {
              const q = qt[j], hi = (us * 64 + (q & 63)) * 64 + ((q >> 6) & 63);
              let v = hist[hi] - bonus; if (v < -500000) v = -500000;
              hist[hi] = v;
            }
          }
          break;
        }
      }
    }
    if (quiet && qn < 64) qt[qn++] = m;
  }
  if (legal === 0) return inChk ? -MATE + ply : 0;
  if (!stop) {
    if (tFlag[idx] === 0 || tt[idx] !== hB || tDepth[idx] <= depth + 2) {
      tt[idx] = hB; tScore[idx] = toTT(best, ply); tMove[idx] = bestM; tDepth[idx] = depth > 100 ? 100 : depth; tFlag[idx] = flag;
    }
  }
  void origAlpha;
  return best;
}

/* ------------------------------------------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------------------------------------- */
export interface EngineOptions {
  maxDepth: number;
  timeMs: number;
  noise: number;
  rand: () => number;
  history: State[];
}
export interface EngineResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  scored: Array<{ move: Move; score: number }>;
}

function toMove(m: number): Move {
  const out: Move = { from: m & 63, to: (m >> 6) & 63 };
  const promo = (m >> 12) & 7, fl = m >> 15;
  if (promo) out.promo = promo;
  if (fl === 1) out.ep = true;
  else if (fl === 2) out.castle = 'K';
  else if (fl === 3) out.castle = 'Q';
  return out;
}

/** Static evaluation from the side to move's point of view. */
export function evaluateState(s: State): number {
  load(s);
  return evalPos();
}

/** Fast legal-move perft over the engine's own generator (used by tests to cross-check movegen). */
export function perftFast(s: State, depth: number): number {
  load(s);
  const rec = (d: number, ply: number): number => {
    if (d === 0) return 1;
    const n = gen(ply, false);
    let total = 0;
    const us = side;
    for (let i = 0; i < n; i++) {
      const m = MV[ply][i];
      make(m);
      if (!isAttacked(kingSq[us], 1 - us)) total += d === 1 ? 1 : rec(d - 1, ply + 1);
      unmake(m);
    }
    return total;
  };
  return rec(depth, 0);
}

export function search(root: State, o: EngineOptions): EngineResult {
  ensureTT();
  load(root, o.history);
  const t0 = Date.now();
  deadline = t0 + o.timeMs;
  stop = false;
  nodes = 0;
  killers.fill(0);
  // decay history between searches
  for (let i = 0; i < hist.length; i++) hist[i] = hist[i] >> 2;

  // legal root moves
  const rootMoves: number[] = [];
  {
    const n = gen(0, false);
    const us = side;
    for (let i = 0; i < n; i++) {
      const m = MV[0][i];
      make(m);
      if (!isAttacked(kingSq[us], 1 - us)) rootMoves.push(m);
      unmake(m);
    }
  }
  if (!rootMoves.length) {
    const chk = isAttacked(kingSq[side], 1 - side);
    return { move: null, score: chk ? -MATE : 0, depth: 0, nodes: 0, scored: [] };
  }
  const R = rootMoves.length;
  const rs = new Array<number>(R).fill(0);
  let order = rootMoves.map((_, i) => i);
  // initial order: TT move / captures first
  {
    const tmp: Array<[number, number]> = rootMoves.map((m, i) => {
      const cap = board[(m >> 6) & 63] !== 0 ? 1000 : 0;
      return [i, cap + (((m >> 12) & 7) ? 500 : 0)];
    });
    tmp.sort((a, b) => b[1] - a[1]);
    order = tmp.map((x) => x[0]);
  }
  const exact = o.noise > 0;
  let bestIdx = order[0];
  let bestScore = 0;
  let doneDepth = 0;

  const rootIter = (d: number, a0: number, b0: number): number | null => {
    let alpha = a0, best = -INF, bi = -1;
    const us = side;
    for (let k = 0; k < R; k++) {
      const i = order[k], m = rootMoves[i];
      make(m);
      let sc: number;
      if (exact) sc = -negamax(d - 1, -INF, INF, 1, true);
      else if (k === 0) sc = -negamax(d - 1, -b0, -alpha, 1, true);
      else {
        sc = -negamax(d - 1, -alpha - 1, -alpha, 1, true);
        if (sc > alpha && sc < b0 && !stop) sc = -negamax(d - 1, -b0, -alpha, 1, true);
      }
      unmake(m);
      void us;
      if (stop) { if (!exact && bi >= 0) { iterBest = bi; iterScore = best; } return null; }
      rs[i] = sc;
      if (sc > best) { best = sc; bi = i; }
      if (!exact && sc > alpha) alpha = sc;
      if (!exact && alpha >= b0) break;
    }
    iterBest = bi; iterScore = best;
    return best;
  };
  let iterBest = -1, iterScore = 0;

  for (let d = 1; d <= o.maxDepth; d++) {
    let sc: number | null;
    iterBest = -1;
    if (!exact && d >= 5) {
      let delta = 28, a = bestScore - delta, b = bestScore + delta;
      for (;;) {
        if (delta > 400) { a = -INF; b = INF; }
        sc = rootIter(d, a, b);
        if (sc === null) break;
        if (sc <= a && a > -INF) { b = (a + b) >> 1; a = sc - delta; delta *= 2; }
        else if (sc >= b && b < INF) { if (iterBest >= 0) { order = [iterBest, ...order.filter((x) => x !== iterBest)]; } b = sc + delta; delta *= 2; }
        else break;
      }
    } else sc = rootIter(d, -INF, INF);

    if (sc === null) {
      // interrupted: a move that beat the previous best in this iteration is still trustworthy
      if (iterBest >= 0 && !exact && d > 1) { bestIdx = iterBest; bestScore = iterScore; }
      break;
    }
    bestIdx = iterBest; bestScore = sc; doneDepth = d;
    order = [bestIdx, ...order.filter((x) => x !== bestIdx).sort((x, y) => rs[y] - rs[x])];
    if (Math.abs(sc) >= MATE_BOUND && MATE - Math.abs(sc) <= d) break; // forced mate found
    if (R === 1 && d >= 3) break;
    if (Date.now() - t0 > o.timeMs * 0.55) break;
  }

  const scored = order.map((i) => ({ move: toMove(rootMoves[i]), score: rs[i] }));
  const bestFirst = scored.findIndex((x) => x.move.from === (rootMoves[bestIdx] & 63) && x.move.to === ((rootMoves[bestIdx] >> 6) & 63) && (x.move.promo || 0) === ((rootMoves[bestIdx] >> 12) & 7));
  if (bestFirst > 0) { const [b] = scored.splice(bestFirst, 1); scored.unshift(b); }
  if (scored.length) scored[0].score = bestScore;
  if (!exact) scored.slice(1).sort((a, b) => b.score - a.score);
  return { move: toMove(rootMoves[bestIdx]), score: bestScore, depth: doneDepth, nodes, scored };
}
