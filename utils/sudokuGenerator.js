// Generate a valid Sudoku puzzle
function generateSudoku() {
  // Start with an empty grid
  const grid = Array(9)
    .fill()
    .map(() => Array(9).fill(0));

  // Fill the diagonal 3x3 boxes first (these can be filled independently)
  fillDiagonalBoxes(grid);

  // Solve the rest of the grid
  solveSudoku(grid);

  // Store the solution
  const solution = JSON.parse(JSON.stringify(grid));

  // Remove some numbers to create the puzzle
  const puzzle = createPuzzle(grid);

  return { puzzle, solution };
}

// Fill the diagonal 3x3 boxes
function fillDiagonalBoxes(grid) {
  for (let box = 0; box < 3; box++) {
    fillBox(grid, box * 3, box * 3);
  }
}

// Fill a 3x3 box with random numbers
function fillBox(grid, startRow, startCol) {
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  shuffleArray(nums);

  let index = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      grid[startRow + row][startCol + col] = nums[index++];
    }
  }
}

// Solve the Sudoku grid using backtracking
function solveSudoku(grid) {
  const emptyCell = findEmptyCell(grid);
  if (!emptyCell) return true; // Grid is full

  const [row, col] = emptyCell;

  for (let num = 1; num <= 9; num++) {
    if (isValid(grid, row, col, num)) {
      grid[row][col] = num;

      if (solveSudoku(grid)) {
        return true;
      }

      grid[row][col] = 0; // Backtrack
    }
  }

  return false;
}

// Find an empty cell in the grid
function findEmptyCell(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        return [row, col];
      }
    }
  }
  return null;
}

// Check if a number is valid in a specific cell
function isValid(grid, row, col, num) {
  // Check row
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) {
      return false;
    }
  }

  // Check column
  for (let y = 0; y < 9; y++) {
    if (grid[y][col] === num) {
      return false;
    }
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[boxRow + r][boxCol + c] === num) {
        return false;
      }
    }
  }

  return true;
}

// Create a puzzle by removing numbers from the solved grid
function createPuzzle(grid) {
  const puzzle = JSON.parse(JSON.stringify(grid));
  const cellsToRemove = 50; // Difficulty level - adjust as needed

  let count = 0;
  while (count < cellsToRemove) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);

    if (puzzle[row][col] !== 0) {
      puzzle[row][col] = 0;
      count++;
    }
  }

  return puzzle;
}

// Shuffle an array in place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = { generateSudoku };
