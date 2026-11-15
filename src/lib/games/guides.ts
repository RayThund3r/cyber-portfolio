// src/lib/games/guides.ts — "How to play" data for every game. One typed source of truth: the Guide modal on /games,
// the first-time hint, and the chat assistant's game knowledge (utils/chatEngine/gameKnowledge.ts) all read from here.

export interface GameGuide {
  id: string;
  /** One sentence: what you are trying to do. */
  goal: string;
  controls: { keyboard: string[]; touch: string[] };
  rules: string[];
  /** 3 to 5 practical pro tips. */
  tips: string[];
  mistakes: string[];
  scoring: string;
  /** One short line shown the first time a game is opened. */
  hint: string;
}

const G = (g: GameGuide): GameGuide => g;

export const GUIDES: GameGuide[] = [
  G({
    id: 'chess', goal: 'Checkmate the AI king: attack it so it cannot escape capture.',
    controls: { keyboard: ['Tab to a square then Enter to pick up and drop a piece'], touch: ['Tap a piece, then tap a highlighted square'] },
    rules: ['White moves first and players alternate.', 'Each piece moves in its own way; pawns capture diagonally and can promote on the last rank.', 'You cannot leave your own king in check.', 'Castling, en passant and promotion are supported.', 'Stalemate, repetition, the 50-move rule and insufficient material are draws.'],
    tips: ['Control the centre with pawns and knights early.', 'Develop every minor piece before moving one twice, and castle by move ten.', 'Before each move ask: what does this let the AI do?', 'Trade pieces when you are ahead in material.', 'Use the hint button to learn, then try to find the idea yourself.'],
    mistakes: ['Moving the queen out too early.', 'Leaving a piece undefended ("hanging").', 'Ignoring the AI threat to focus on your own attack.'],
    scoring: 'Win, loss and draw are counted in your record. Pick an engine strength to match your level.',
    hint: 'Tap a piece, then a highlighted square. Try the hint button if you get stuck.',
  }),
  G({
    id: 'connect4', goal: 'Get four of your discs in a row, in any direction, before the AI does.',
    controls: { keyboard: ['Tab to a column and press Enter or Space to drop'], touch: ['Tap a column to drop a disc'] },
    rules: ['Players alternate dropping one disc into a column; it falls to the lowest free slot.', 'Four in a row horizontally, vertically or diagonally wins.', 'A full board with no four is a draw.'],
    tips: ['The centre column is the strongest: it belongs to the most lines.', 'Build two threats at once so the AI can only block one.', 'Look at what square sits above your threat: a threat the AI cannot reach until later is gold.', 'Always scan for the AI three-in-a-row before making your move.', 'Use Analyse to see the engine score for each column.'],
    mistakes: ['Only looking at your own lines and missing a diagonal.', 'Playing under a square the AI needs.', 'Filling the edges early.'],
    scoring: 'Wins, losses and draws are recorded per difficulty level.',
    hint: 'Pick a column to drop a disc. Take the centre first.',
  }),
  G({
    id: 'reversi', goal: 'Finish with more discs of your colour than the AI when the board fills up.',
    controls: { keyboard: ['Tab to a highlighted square and press Enter'], touch: ['Tap a highlighted square'] },
    rules: ['You must place a disc that traps a straight line of enemy discs between it and one of yours.', 'All trapped discs flip.', 'If you have no legal move you pass.', 'The game ends when neither side can move; most discs wins.'],
    tips: ['Corners can never be flipped, so grab them.', 'Fewer discs mid-game is fine: keep your options (mobility) high and the AI options low.', 'Avoid the squares next to empty corners.', 'Flip few discs early; the count only matters at the end.', 'Count parity near the end so you get the last move.'],
    mistakes: ['Grabbing lots of discs early.', 'Giving the AI a corner by playing next to it.', 'Forgetting that a pass is possible.'],
    scoring: 'Disc count decides each game; wins, losses and draws are recorded.',
    hint: 'Highlighted squares are legal moves. Corners are gold.',
  }),
  G({
    id: 'tictactoe', goal: 'Get three of your marks in a row before the AI does.',
    controls: { keyboard: ['Tab to a cell and press Enter'], touch: ['Tap a cell'] },
    rules: ['Players alternate marking a cell in the 3 by 3 grid.', 'Three in a row, column or diagonal wins.', 'A full grid with no line is a draw.'],
    tips: ['Open with a corner or the centre.', 'Create a fork: two lines that each need one more mark.', 'Always block the AI two-in-a-row unless you can win this turn.', 'Against Perfect, a draw is the best result: play safe.'],
    mistakes: ['Opening on an edge square.', 'Missing a block.', 'Expecting to beat the Perfect level.'],
    scoring: 'Wins, losses and draws are recorded.',
    hint: 'Tap a cell. Corners and the centre are the strongest openings.',
  }),
  G({
    id: 'sudoku', goal: 'Fill the 9 by 9 grid so every row, column and 3 by 3 box holds the digits 1 to 9 once.',
    controls: { keyboard: ['Arrow keys move', '1-9 enter a digit', 'Backspace or 0 clears', 'N toggles notes'], touch: ['Tap a cell then tap a number', 'Notes button for pencil marks'] },
    rules: ['Every row, column and box contains each digit exactly once.', 'Each puzzle has exactly one solution.', 'Given digits cannot be changed.'],
    tips: ['Start by scanning for rows, columns or boxes that are nearly full.', 'Use notes: write every candidate, then eliminate.', 'Look for a digit that can go in only one place in a unit (hidden single).', 'Use the hint button, which names the technique, and learn it.', 'If you are stuck, switch to a different digit instead of staring at one cell.'],
    mistakes: ['Guessing instead of deducing.', 'Not removing notes after placing a digit.', 'Ignoring the boxes.'],
    scoring: 'Best time per difficulty is saved.',
    hint: 'Pick a cell, then a number. Turn on notes to pencil in candidates.',
  }),
  G({
    id: 'minesweeper', goal: 'Open every safe square without touching a mine.',
    controls: { keyboard: ['Tab to a cell and press Enter to open it (use Flag mode to flag)'], touch: ['Tap opens, use Flag mode then tap to flag', 'Tap a satisfied number to chord'] },
    rules: ['A number tells how many of its 8 neighbours are mines.', 'Your first click is always safe.', 'Flag squares you know are mines.', 'Open all non-mine squares to win.'],
    tips: ['A 1 touching one unopened square means that square is a mine.', 'When a number has all its mines flagged, open the rest of its neighbours (chord).', 'Compare neighbouring numbers: the difference reveals mines (the 1-2-1 pattern).', 'Use the AI hint to see why a square is certain.', 'Guess only when nothing is certain, and pick the lowest risk square.'],
    mistakes: ['Flagging by guess.', 'Rushing, because time counts.', 'Ignoring the mine counter.'],
    scoring: 'Best clear time per board size is saved.',
    hint: 'Numbers count neighbouring mines. Your first click is safe.',
  }),
  G({
    id: '2048', goal: 'Slide and merge equal tiles until you make a 2048 tile (and keep going for a higher score).',
    controls: { keyboard: ['Arrow keys or W A S D'], touch: ['Swipe in a direction'] },
    rules: ['Every move slides all tiles as far as they go.', 'Two equal tiles that collide merge into one of double value.', 'A new 2 or 4 appears after each move.', 'The game ends when the board is full and nothing can merge.'],
    tips: ['Keep your biggest tile in a corner and never move it out.', 'Prefer moves in two directions (for example down and left) and use the others rarely.', 'Keep a row of descending values along the edge.', 'Merge small tiles early to keep the board open.', 'Use the AI to watch how it handles a locked corner.'],
    mistakes: ['Swiping towards the side opposite your corner.', 'Chasing a merge that frees your big tile.', 'Spreading big tiles around the board.'],
    scoring: 'Each merge adds the value of the new tile to your score. Best score is saved.',
    hint: 'Swipe or use arrow keys. Equal tiles merge. Keep your biggest tile in a corner.',
  }),
  G({
    id: 'memory', goal: 'Find all the matching pairs in as few moves as possible.',
    controls: { keyboard: ['Tab to a card and press Enter'], touch: ['Tap two cards to flip them'] },
    rules: ['Flip two cards per turn.', 'A matching pair stays face up.', 'A non-match flips back.', 'Clear the board to finish.'],
    tips: ['Start in a corner and sweep in a fixed order so you remember what you have seen.', 'Say the positions in your head ("row 2, column 3").', 'When you flip a card you have seen before, flip its twin right away.', 'Group cards mentally by region.'],
    mistakes: ['Flipping randomly.', 'Rushing, because moves count more than time.'],
    scoring: 'Fewer moves earn more stars. Best result is saved.',
    hint: 'Flip two cards at a time. Remember where each one is.',
  }),
  G({
    id: 'simon', goal: 'Repeat a growing sequence of lights and sounds from memory.',
    controls: { keyboard: ['Q W A S press the four pads'], touch: ['Tap the pads'] },
    rules: ['Watch the pattern, then repeat it in order.', 'Each round adds one step.', 'In strict mode a mistake ends the game.'],
    tips: ['Chunk the pattern into groups of three or four.', 'Say colours quietly or tap along with a finger.', 'Turn the sound on: pitch is a second memory aid.', 'Practice on Chill before Fast.'],
    mistakes: ['Pressing before the pattern finishes.', 'Trying to memorise the whole thing as one block.'],
    scoring: 'Your round number is your score; best is saved.',
    hint: 'Watch the pattern, then repeat it. Keys: Q W A S.',
  }),
  G({
    id: 'math', goal: 'Answer as many arithmetic questions as you can in 60 seconds.',
    controls: { keyboard: ['Type the answer, it submits itself (Enter also works)'], touch: ['Use the on-screen number pad or keyboard'] },
    rules: ['Answers are whole numbers.', 'A wrong answer resets your streak.', 'Higher levels add multiplication, division, squares and mixed operations.'],
    tips: ['Round and adjust: 49 x 6 is 50 x 6 minus 6.', 'Learn squares to 15 and tables to 12.', 'Keep your streak: the multiplier is worth more than speed.', 'Do not skip: a quick guess costs only the streak.'],
    mistakes: ['Typing too fast and mistyping.', 'Dwelling on one hard question.'],
    scoring: 'Points grow with streak (up to x10) and level multiplier. Best score is saved.',
    hint: 'Type the answer. Streaks multiply your points.',
  }),
  G({
    id: 'checkers', goal: 'Capture all of the AI pieces or leave it with no legal move.',
    controls: { keyboard: ['Tab to a piece then to a highlighted square, Enter'], touch: ['Tap a piece, then a highlighted square'] },
    rules: ['Pieces move diagonally forward one square.', 'Captures are compulsory and may chain.', 'Reach the far row to be crowned a king, which moves both ways.', 'Eighty quiet half-moves is a draw.'],
    tips: ['Keep your back row as long as you can to stop kings.', 'Trade when you are ahead.', 'Control the centre squares.', 'Look for forced captures that set up a double jump.', 'Advance in pairs so pieces protect each other.'],
    mistakes: ['Forgetting captures are forced.', 'Leaving gaps behind advancing pieces.'],
    scoring: 'Wins, losses and draws are recorded.',
    hint: 'Captures are compulsory. Reach the far row to get a king.',
  }),
  G({
    id: 'gomoku', goal: 'Make an unbroken line of five stones before the AI does.',
    controls: { keyboard: ['Tab to an intersection and press Enter'], touch: ['Tap an intersection'] },
    rules: ['Players alternate placing a stone.', 'Five or more in a row (any direction) wins.', 'Black moves first.'],
    tips: ['Make an open three: it forces a reply.', 'Build two open threes at once (a double threat).', 'Always block an open four immediately; block open threes early.', 'Play near the centre and near the last stones.'],
    mistakes: ['Blocking too late.', 'Playing far from the action.'],
    scoring: 'Wins, losses and draws are recorded per level.',
    hint: 'Get five in a row. Block the AI open threes.',
  }),
  G({
    id: 'mastermind', goal: 'Crack the hidden four-colour code in as few guesses as possible.',
    controls: { keyboard: ['Tab through colour buttons and Enter'], touch: ['Tap four colours, then Guess'] },
    rules: ['Pick four colours and press Guess.', 'A white dot means right colour in the right place.', 'A ring means right colour in the wrong place.', 'Solve it before you run out of rows.'],
    tips: ['Start with two colours twice (AABB).', 'Use each result to rule colours in or out.', 'Never guess a code that contradicts earlier feedback.', 'Use the hint to see the AI pick.'],
    mistakes: ['Repeating information you already have.', 'Changing too many pegs at once.'],
    scoring: 'Fewer guesses is better. Best is saved.',
    hint: 'Pick four colours, press Guess. White dot = right place.',
  }),
  G({
    id: 'lightsout', goal: 'Switch every light off.',
    controls: { keyboard: ['Tab to a cell and press Enter'], touch: ['Tap a cell'] },
    rules: ['Pressing a cell flips it and its four neighbours.', 'Press order does not matter.', 'Pressing a cell twice cancels out.'],
    tips: ['Work row by row: clear the top row using presses in the row below.', 'Use the solver to see the fewest presses.', 'Chase the lights downward, then solve the last row with the known patterns.'],
    mistakes: ['Pressing cells twice.', 'Random pressing.'],
    scoring: 'Fewer presses is better. Best is saved.',
    hint: 'Each tap flips a cell and its neighbours.',
  }),
  G({
    id: 'sliding', goal: 'Slide the tiles into order, with the blank in the last corner.',
    controls: { keyboard: ['Arrow keys slide a tile into the gap'], touch: ['Tap a tile next to the gap'] },
    rules: ['Only tiles next to the blank can move.', 'Reach the numbers in order to win.', 'Every board dealt is solvable.'],
    tips: ['Solve the top row first, then the next, keeping finished rows fixed.', 'Finish the last two of a row together.', 'Use the solver to see the shortest solution.'],
    mistakes: ['Breaking a finished row to fix one tile.', 'Random shuffling.'],
    scoring: 'Fewer moves and less time are better; bests are saved.',
    hint: 'Slide a tile next to the gap. Solve row by row.',
  }),
  G({
    id: 'twentyfour', goal: 'Combine four numbers with + - x / and brackets to make exactly 24.',
    controls: { keyboard: ['Type the expression and press Enter'], touch: ['Tap numbers and operators'] },
    rules: ['Use each of the four numbers exactly once.', 'Fractions in between are allowed (8 / (3 - 8 / 3) = 24).', 'Every hand dealt can be solved.'],
    tips: ['Look for pairs that make 8 and 3, 4 and 6, or 12 and 2.', 'Try making 24 from factors: 3 x 8, 4 x 6.', 'If you get stuck, try division to make fractions.', 'Use the hint for the first step.'],
    mistakes: ['Ignoring division.', 'Forgetting a number.'],
    scoring: 'Solving time counts; best is saved.',
    hint: 'Use all four numbers once to make 24.',
  }),
  G({
    id: 'nim', goal: 'Take the last stone (or make the AI take it, depending on the mode shown).',
    controls: { keyboard: ['Tab to a stone and press Enter'], touch: ['Tap stones to select, then Take'] },
    rules: ['On your turn take any number of stones from one pile.', 'You must take at least one.', 'The player who makes the last move wins.'],
    tips: ['Learn the nim-sum: XOR the pile sizes. If it is zero the player to move is losing.', 'Make a move that leaves a nim-sum of zero.', 'Use the hint to see the exact move.', 'The first player can always win from the start position.'],
    mistakes: ['Taking from the biggest pile by habit.', 'Not counting the piles in binary.'],
    scoring: 'Wins and losses are recorded per level.',
    hint: 'Take stones from one pile. Aim to leave a nim-sum of zero.',
  }),

  /* -------- arcade games -------- */
  G({
    id: 'snake', goal: 'Eat as much food as you can without hitting a wall or yourself.',
    controls: { keyboard: ['Arrow keys or W A S D', 'P or Space pauses'], touch: ['Swipe on the board or use the arrow pad'] },
    rules: ['The snake always moves; you only steer.', 'Eating food grows the snake and speeds it up a little.', 'Hitting a wall or your own body ends the game.', 'You cannot reverse straight into yourself.'],
    tips: ['Hug the walls and keep the middle open.', 'Plan two moves ahead before turning.', 'Make long even sweeps (like mowing a lawn) once the snake is long.', 'Queue turns: two quick taps make a U-turn.', 'Use Wrap mode to practise for free.'],
    mistakes: ['Trapping yourself in a spiral.', 'Chasing food across the open space.', 'Mashing two directions in one tick.'],
    scoring: 'Each food is worth 10 points, with a bonus for fast streaks. Best score is saved.',
    hint: 'Swipe or use arrow keys. Eat food, avoid walls and your tail.',
  }),
  G({
    id: 'tetris', goal: 'Drop and rotate falling blocks to complete full rows and clear them.',
    controls: { keyboard: ['Left and Right move', 'Up or X rotates, Z rotates back', 'Down soft-drops', 'Space hard-drops', 'C or Shift holds', 'P pauses'], touch: ['On-screen buttons: move, rotate, drop, hold', 'Tap the board to rotate'] },
    rules: ['Seven shapes fall in a random bag order.', 'A complete row clears.', 'The ghost piece shows where it will land.', 'Hold stores one piece; you can swap once per drop.', 'The game ends when the stack reaches the top.'],
    tips: ['Keep the stack flat and avoid holes.', 'Leave one column open for the I piece and aim for four-line Tetrises (800 points).', 'Look at the next piece before placing.', 'Use Hold to save an I piece or rescue a bad one.', 'Hard-drop only after checking the ghost.'],
    mistakes: ['Stacking towards the middle.', 'Covering holes you cannot reach.', 'Rotating at the last second against the wall.'],
    scoring: '1 line = 100, 2 = 300, 3 = 500, 4 = 800, times your level. Level rises every 10 lines. Best score is saved.',
    hint: 'Complete rows to clear them. The ghost shows where a piece lands.',
  }),
  G({
    id: 'breakout', goal: 'Bounce the ball off your paddle to break every brick.',
    controls: { keyboard: ['Left and Right or A D move the paddle', 'Space launches the ball', 'P pauses'], touch: ['Drag on the board to move the paddle', 'Tap to launch'] },
    rules: ['You have three lives.', 'The ball bounces off walls, bricks and the paddle.', 'Where the ball hits the paddle changes its angle.', 'Missing the ball loses a life.', 'Clearing all bricks moves you to the next level.'],
    tips: ['Hit the ball with the paddle edge to control the angle.', 'Dig a tunnel up one side: the ball will clear bricks from above.', 'Stay under the ball, not where it will end up.', 'Do not chase every ball: position early.'],
    mistakes: ['Hitting with the centre every time (straight, boring and slow).', 'Moving late.', 'Ignoring the ball speed rising.'],
    scoring: 'Each brick scores by its row, higher rows more. Best score is saved.',
    hint: 'Move the paddle, launch with Space or tap.',
  }),
  G({
    id: 'pong', goal: 'Beat the AI by getting the ball past its paddle first to 7 points.',
    controls: { keyboard: ['Up and Down or W S move your paddle', 'P pauses'], touch: ['Drag up and down on the board'] },
    rules: ['Hit the ball back with your paddle.', 'If the ball passes a paddle, the other side scores.', 'First to 7 points wins.', 'The ball speeds up with each hit.', 'Difficulty changes how fast and accurate the AI is.'],
    tips: ['Hit the ball with the paddle edges to change the angle.', 'Aim for corners; the AI is slowest to reach them.', 'Return to the centre between hits.', 'Start on Easy to learn the rhythm.'],
    mistakes: ['Following the ball rather than predicting it.', 'Staying at the edges.'],
    scoring: 'First to 7. Your record counts wins and losses per difficulty.',
    hint: 'Move your paddle (left side). First to 7 wins.',
  }),
  G({
    id: 'flappy', goal: 'Flap through the gaps in the pipes for as long as you can.',
    controls: { keyboard: ['Space, Up or W flaps', 'P pauses'], touch: ['Tap anywhere on the board'] },
    rules: ['Gravity pulls the bird down; each flap gives a small hop up.', 'Passing through a gap scores one point.', 'Touching a pipe, the floor or the ceiling ends the game.'],
    tips: ['Small, rhythmic taps beat big ones.', 'Aim for the middle of each gap.', 'Look at the next gap, not at the bird.', 'Do not panic after a big drop: wait one beat.'],
    mistakes: ['Tapping too fast.', 'Watching the bird instead of the pipe.'],
    scoring: 'One point per pipe. Best score is saved.',
    hint: 'Tap or press Space to flap. Aim for the middle of each gap.',
  }),
  G({
    id: 'whack', goal: 'Whack as many moles as you can in 30 seconds.',
    controls: { keyboard: ['Number keys 1-9 hit the matching hole (like a number pad)'], touch: ['Tap the moles'] },
    rules: ['Moles pop up from the nine holes for a short time.', 'Hit a mole to score; a miss costs nothing.', 'Do not hit the bomb: it takes points away.', 'Moles get faster as time runs out.'],
    tips: ['Keep your eyes in the centre and use peripheral vision.', 'Do not tap holes that are empty.', 'Build a streak for a score multiplier.', 'Hit golden moles first: they give extra.'],
    mistakes: ['Hitting the bomb in a hurry.', 'Aiming at a mole that is already gone.'],
    scoring: '10 points per mole, bonus for streaks, golden mole 30, bomb minus 20. Best score is saved.',
    hint: 'Tap the moles. Avoid the bombs.',
  }),
  G({
    id: 'typing', goal: 'Type the words as fast and accurately as you can before time runs out.',
    controls: { keyboard: ['Type the highlighted word; Space or Enter submits; Backspace to fix'], touch: ['Tap the box to open your keyboard, then type'] },
    rules: ['A sprint lasts 45 seconds.', 'Type each word exactly.', 'Correct words extend your streak.', 'Speed is shown in words per minute (WPM) and accuracy as a percentage.'],
    tips: ['Look one word ahead.', 'Keep a steady rhythm instead of bursts.', 'Accuracy beats speed: a mistyped word costs more than a slow one.', 'Keep your hands on the home row.'],
    mistakes: ['Typing quickly then fixing many mistakes.', 'Looking at the keyboard.'],
    scoring: 'WPM = correct characters / 5 per minute, shown with accuracy. Best WPM is saved.',
    hint: 'Type the word shown. Space submits it.',
  }),
];

export const GUIDE_BY_ID: Record<string, GameGuide> = Object.fromEntries(GUIDES.map((g) => [g.id, g]));
export const guideFor = (id: string | null | undefined): GameGuide | undefined => (id ? GUIDE_BY_ID[id] : undefined);

/** A compact text rendering, used by the chat (markdown-lite: **bold** and "- " lists). */
export function guideText(g: GameGuide, part: 'all' | 'rules' | 'controls' | 'tips' | 'scoring' | 'goal' = 'all'): string {
  const list = (a: string[]) => a.map((x) => `- ${x}`).join('\n');
  const parts: Record<string, string> = {
    goal: `**Goal:** ${g.goal}`,
    controls: `**Controls**\n- Keyboard: ${g.controls.keyboard.join('; ')}\n- Touch: ${g.controls.touch.join('; ')}`,
    rules: `**Rules**\n${list(g.rules)}`,
    tips: `**Pro tips**\n${list(g.tips)}\n\n**Common mistakes**\n${list(g.mistakes)}`,
    scoring: `**Scoring:** ${g.scoring}`,
  };
  if (part !== 'all') return parts[part] || parts.goal;
  return [parts.goal, parts.controls, parts.rules, parts.tips, parts.scoring].join('\n\n');
}
