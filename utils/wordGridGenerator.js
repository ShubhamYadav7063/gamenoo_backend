// Generate a word grid (similar to Boggle)
function generateWordGrid(size = 4) {
  const grid = [];
  const dice = getBoggleDice(size);
  shuffleArray(dice);

  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      const diceIndex = i * size + j;
      const die = dice[diceIndex];
      const faceIndex = Math.floor(Math.random() * 6);
      const letter = die[faceIndex];
      row.push(letter.toLowerCase());
    }
    grid.push(row);
  }

  return grid;
}

// Boggle dice configurations
function getBoggleDice(size) {
  // Standard 4x4 Boggle dice
  const standardDice = [
    "AAEEGN",
    "ABBJOO",
    "ACHOPS",
    "AFFKPS",
    "AOOTTW",
    "CIMOTU",
    "DEILRX",
    "DELRVY",
    "DISTTY",
    "EEGHNW",
    "EEINSU",
    "EHRTVW",
    "EIOSST",
    "ELRTTY",
    "HIMNQU",
    "HLNNRZ",
  ];

  // Extra dice for 5x5 grid
  const extraDice = [
    "AAEEGN",
    "ABBJOO",
    "ACHOPS",
    "AFFKPS",
    "AOOTTW",
    "CIMOTU",
    "DEILRX",
    "DELRVY",
    "DISTTY",
    "EEGHNW",
    "EEINSU",
    "EHRTVW",
    "EIOSST",
    "ELRTTY",
    "HIMNQU",
    "HLNNRZ",
    "AACIOT",
    "ADEMNN",
    "BFIORX",
    "EGKLUY",
    "EGINTV",
    "EHINPS",
    "ELPSTU",
    "GILRUW",
    "ABILTY",
  ];

  return size === 4 ? standardDice : extraDice;
}

// Shuffle an array in place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = { generateWordGrid };
