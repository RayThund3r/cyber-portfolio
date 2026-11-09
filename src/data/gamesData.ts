// src/data/gamesData.ts
//
// The games catalogue: what the /games page lists and what the chat / terminal understand ("play chess").
// Data only (no components), so the chat engine can import it cheaply. Components are mapped in app/games/page.tsx.
import type { IconName } from '@/components/ui/Icon';

export type GameGroup = 'ai' | 'puzzle' | 'memory' | 'speed';

export interface GameInfo {
  id: string;
  title: string;
  group: GameGroup;
  icon: IconName;
  tagline: string;
  /** What the "AI" does in this game (shown on the card). */
  ai: string;
  skills: string;
  /** Words visitors use for it in chat / terminal ("tic tac toe", "noughts and crosses"). */
  aliases: string[];
}

export const GROUP_LABEL: Record<GameGroup, string> = {
  ai: 'Versus AI',
  puzzle: 'Puzzles',
  memory: 'Memory',
  speed: 'Speed',
};

export const GAMES: GameInfo[] = [
  {
    id: 'chess',
    title: 'Chess',
    group: 'ai',
    icon: 'cpu',
    tagline: 'Full rules, four engine strengths, hints and move list.',
    ai: 'Principal-variation search with null-move pruning, late-move reductions, a transposition table, tapered evaluation and an opening book (beats the previous engine 13–0).',
    skills: 'Planning · tactics',
    aliases: ['chess'],
  },
  {
    id: 'connect4',
    title: 'Connect Four',
    group: 'ai',
    icon: 'disk',
    tagline: 'Drop discs, block threats, and out-think the engine.',
    ai: 'Depth-limited alpha-beta, up to 10 plies at the top level.',
    skills: 'Foresight · pattern spotting',
    aliases: ['connect four', 'connect 4', 'connect4', 'four in a row', 'four in a line'],
  },
  {
    id: 'reversi',
    title: 'Reversi',
    group: 'ai',
    icon: 'spark',
    tagline: 'Flip the board. Corners and mobility decide everything.',
    ai: 'Alpha-beta with corner, mobility and stability weighting.',
    skills: 'Strategy · patience',
    aliases: ['reversi', 'othello'],
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    group: 'ai',
    icon: 'check',
    tagline: 'Three levels, up to a perfect opponent that cannot lose.',
    ai: 'Full minimax: at the top level it plays perfectly.',
    skills: 'Logic',
    aliases: ['tic tac toe', 'tictactoe', 'tic-tac-toe', 'noughts and crosses', 'naughts and crosses', 'xo', 'x and o'],
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    group: 'puzzle',
    icon: 'search',
    tagline: 'Fresh puzzles with a single solution, notes and smart hints.',
    ai: 'Generates unique-solution grids and explains the next logical step.',
    skills: 'Deduction',
    aliases: ['sudoku'],
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    group: 'puzzle',
    icon: 'bolt',
    tagline: 'First click is always safe. Ask the solver when you are stuck.',
    ai: 'Constraint solver finds certain mines and safe cells, or the best guess.',
    skills: 'Probability · deduction',
    aliases: ['minesweeper', 'mine sweeper', 'mines'],
  },
  {
    id: '2048',
    title: '2048',
    group: 'puzzle',
    icon: 'arrow',
    tagline: 'Slide, merge, chase the 2048 tile. Undo and hints included.',
    ai: 'Expectimax lookahead suggests the strongest slide.',
    skills: 'Planning · spatial sense',
    aliases: ['2048', 'two thousand forty eight'],
  },
  {
    id: 'memory',
    title: 'Memory Match',
    group: 'memory',
    icon: 'shield',
    tagline: 'Flip pairs on growing boards. Fewer moves, higher score.',
    ai: 'Tracks your best runs per board size.',
    skills: 'Recall',
    aliases: ['memory', 'memory match', 'pairs', 'match the cards', 'concentration'],
  },
  {
    id: 'simon',
    title: 'Pattern Echo',
    group: 'memory',
    icon: 'clock',
    tagline: 'Watch the sequence, repeat it. It only gets longer.',
    ai: 'Builds ever-longer random sequences and tracks your streak.',
    skills: 'Sequence memory',
    aliases: ['pattern echo', 'simon', 'simon says', 'pattern memory', 'sequence game'],
  },
  {
    id: 'math',
    title: 'Math Sprint',
    group: 'speed',
    icon: 'bolt',
    tagline: '60 seconds. Streaks multiply your score.',
    ai: 'Generates fresh problems, scaling with your streak.',
    skills: 'Mental arithmetic',
    aliases: ['math sprint', 'maths sprint', 'math', 'maths', 'mental math', 'mental maths', 'arithmetic'],
  },
  {
    id: 'checkers',
    title: 'Checkers',
    group: 'ai',
    icon: 'grid',
    tagline: 'Compulsory jumps, multi-captures and kings against a deep-searching AI.',
    ai: 'Iterative-deepening alpha-beta with a transposition table and quiescence, up to ~10 plies.',
    skills: 'Tactics · foresight',
    aliases: ['checkers', 'draughts'],
  },
  {
    id: 'gomoku',
    title: 'Gomoku',
    group: 'ai',
    icon: 'star',
    tagline: 'Five in a row on a 15×15 board. Build open threes before the AI does.',
    ai: 'Threat-pattern evaluation with alpha-beta over candidate moves; always takes or blocks a five.',
    skills: 'Pattern sense · attack',
    aliases: ['gomoku', 'five in a row', 'connect five', 'renju'],
  },
  {
    id: 'mastermind',
    title: 'Mastermind',
    group: 'puzzle',
    icon: 'key',
    tagline: 'Crack the hidden four-colour code, or let the AI crack yours.',
    ai: 'Knuth minimax guesses: solves any code in five tries or fewer. Also powers your hints.',
    skills: 'Deduction · logic',
    aliases: ['mastermind', 'code breaker', 'codebreaker', 'bulls and cows'],
  },
  {
    id: 'lightsout',
    title: 'Lights Out',
    group: 'puzzle',
    icon: 'bolt',
    tagline: 'Switch every light off. Each press flips its neighbours too.',
    ai: 'Exact GF(2) linear-algebra solver that finds the minimum-press solution.',
    skills: 'Systems thinking',
    aliases: ['lights out', 'lightsout', 'lights'],
  },
  {
    id: 'sliding',
    title: 'Sliding Puzzle',
    group: 'puzzle',
    icon: 'puzzle',
    tagline: '8-puzzle and 15-puzzle with an optimal-solution hint.',
    ai: 'IDA* search with Manhattan distance and linear-conflict heuristics finds shortest solutions.',
    skills: 'Planning · spatial',
    aliases: ['sliding puzzle', 'sliding', '15 puzzle', '8 puzzle', 'fifteen puzzle', 'n puzzle', 'slide puzzle'],
  },
  {
    id: 'twentyfour',
    title: '24 Game',
    group: 'speed',
    icon: 'brain',
    tagline: 'Make 24 from four numbers using + − × ÷ and brackets.',
    ai: 'Exhaustive exact-fraction solver deals only solvable hands and shows the answer on demand.',
    skills: 'Mental maths',
    aliases: ['24', '24 game', 'twenty four', 'twentyfour', 'make 24'],
  },
  {
    id: 'nim',
    title: 'Nim',
    group: 'ai',
    icon: 'cube',
    tagline: 'Take stones from piles, last one wins (or loses). Pure strategy.',
    ai: 'Solves the game exactly with the nim-sum (XOR) strategy, in normal and misère play.',
    skills: 'Strategy · maths',
    aliases: ['nim', 'stones', 'matchsticks'],
  },
];

export const GAME_IDS = GAMES.map((g) => g.id);

export function findGame(text: string): GameInfo | null {
  const q = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  let best: [GameInfo, number] | null = null;
  for (const g of GAMES) {
    for (const a of [g.id, ...g.aliases]) {
      const rx = new RegExp(`(^|\\s)${a.replace(/[-\s]/g, '[-\\s]?')}(\\s|$)`);
      if (rx.test(q) && (!best || a.length > best[1])) best = [g, a.length];
    }
  }
  return best ? best[0] : null;
}
