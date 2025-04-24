const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { generateSudoku } = require("./utils/sudokuGenerator");
const { generateWordGrid } = require("./utils/wordGridGenerator");
const { validateWord } = require("./utils/wordValidator");

// Load environment variables
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Game rooms storage
const rooms = {};

// Socket to username mapping
const socketUserMap = {};

// Max players per room based on game type
const MAX_PLAYERS = {
  sudoku: 4,
  wordgrid: 6,
};

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle active rooms request
  socket.on("get_active_rooms", () => {
    const activeRooms = Object.keys(rooms).map((roomName) => {
      const room = rooms[roomName];
      return {
        id: roomName,
        name: roomName,
        gameType: room.gameType,
        players: room.players.length,
        maxPlayers: MAX_PLAYERS[room.gameType] || 4,
        createdAt: room.startTime,
      };
    });

    // Send active rooms to the client
    socket.emit("active_rooms", activeRooms);
  });

  // Handle room joining
  socket.on("join_room", ({ room, username, gameType }) => {
    socket.join(room);

    // Store the socket to username mapping
    socketUserMap[socket.id] = { username, room };

    // Create room if it doesn't exist
    if (!rooms[room]) {
      rooms[room] = {
        players: [],
        gameType,
        gameState: initializeGame(gameType),
        leaderboard: [],
        startTime: Date.now(),
      };
    }

    // Add player to room if they're not already in it
    if (!rooms[room].players.includes(username)) {
      rooms[room].players.push(username);
    }

    // Send room data to the new player
    socket.emit("room_joined", {
      room,
      gameType: rooms[room].gameType,
      gameState: rooms[room].gameState,
      players: rooms[room].players,
    });

    // Notify all clients in the room about new player
    io.to(room).emit("players_update", rooms[room].players);
    io.to(room).emit("leaderboard_update", rooms[room].leaderboard);

    // Broadcast updated active rooms to all connected clients
    broadcastActiveRooms();

    console.log(`${username} joined room: ${room}`);
  });

  // Handle Sudoku cell updates
  socket.on("cell_update", ({ room, row, col, value, player }) => {
    if (!rooms[room] || rooms[room].gameType !== "sudoku") return;

    // Update the board
    rooms[room].gameState.board[row][col] = value;

    // Track cell ownership
    if (value !== 0) {
      rooms[room].gameState.cellOwners[row][col] = player;
    } else {
      rooms[room].gameState.cellOwners[row][col] = null;
    }

    // Send updated game state to all clients in the room
    io.to(room).emit("game_update", rooms[room].gameState);

    // Check if the puzzle is complete
    if (isSudokuComplete(rooms[room].gameState.board)) {
      // Calculate scores
      updateLeaderboard(room, player);

      // Notify all clients that the game is over
      io.to(room).emit("game_over", {
        winner: player,
      });
    }
  });

  // Handle word submissions
  socket.on("word_submit", async ({ room, word, path, player }) => {
    if (!rooms[room] || rooms[room].gameType !== "wordgrid") return;

    const wordLower = word.toLowerCase();

    try {
      // Use async validation from the wordValidator
      const isValid = await validateWord(wordLower);

      if (isValid) {
        // Check if word was already found
        const alreadyFound = rooms[room].gameState.foundWords.some(
          (w) => w.word === wordLower
        );

        if (!alreadyFound) {
          // Add word to found words
          rooms[room].gameState.foundWords.push({
            word: wordLower,
            player,
            path,
            points: calculateWordPoints(wordLower),
          });

          // Update player score
          const playerIndex = rooms[room].leaderboard.findIndex(
            (p) => p.username === player
          );
          if (playerIndex >= 0) {
            rooms[room].leaderboard[playerIndex].score +=
              calculateWordPoints(wordLower);
          } else {
            rooms[room].leaderboard.push({
              username: player,
              score: calculateWordPoints(wordLower),
            });
          }

          // Sort leaderboard by score (descending)
          rooms[room].leaderboard.sort((a, b) => b.score - a.score);

          // Send updated game state and leaderboard to all clients in the room
          io.to(room).emit("game_update", rooms[room].gameState);
          io.to(room).emit("leaderboard_update", rooms[room].leaderboard);

          // Check if enough words have been found to end the game
          if (rooms[room].gameState.foundWords.length >= 10) {
            // Determine winner
            const winner = rooms[room].leaderboard[0]?.username || null;

            // Notify all clients that the game is over
            io.to(room).emit("game_over", {
              winner,
            });
          }
        } else {
          // Let the client know the word was already found
          socket.emit("word_already_found", { word: wordLower });
        }
      } else {
        // Let the client know the word is invalid
        socket.emit("word_invalid", { word: wordLower });
      }
    } catch (error) {
      console.error(`Error validating word "${wordLower}":`, error);
      socket.emit("word_validation_error", {
        word: wordLower,
        error: error.message,
      });
    }
  });

  // Handle chat messages
  socket.on("send_message", (messageData) => {
    socket.to(messageData.room).emit("chat_message", messageData);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Get user info from the mapping
    const userInfo = socketUserMap[socket.id];

    if (userInfo) {
      const { username, room } = userInfo;

      // Check if the room exists
      if (rooms[room]) {
        // Find and remove the player from the room
        const playerIndex = rooms[room].players.indexOf(username);

        if (playerIndex !== -1) {
          rooms[room].players.splice(playerIndex, 1);

          // Notify remaining clients
          io.to(room).emit("players_update", rooms[room].players);

          console.log(`${username} left room: ${room}`);

          // Delete room if empty
          if (rooms[room].players.length === 0) {
            delete rooms[room];
            console.log(`Room deleted: ${room}`);
          }

          // Broadcast updated active rooms to all clients
          broadcastActiveRooms();
        }
      }

      // Remove the socket-to-user mapping
      delete socketUserMap[socket.id];
    }
  });
});

// Function to broadcast active rooms to all connected clients
function broadcastActiveRooms() {
  const activeRooms = Object.keys(rooms).map((roomName) => {
    const room = rooms[roomName];
    return {
      id: roomName,
      name: roomName,
      gameType: room.gameType,
      players: room.players.length,
      maxPlayers: MAX_PLAYERS[room.gameType] || 4,
      createdAt: room.startTime,
    };
  });

  io.emit("active_rooms", activeRooms);
}

// Initialize game based on type
function initializeGame(gameType) {
  if (gameType === "sudoku") {
    const { puzzle, solution } = generateSudoku();
    return {
      board: JSON.parse(JSON.stringify(puzzle)),
      solution: solution,
      prefilled: puzzle.map((row) => row.map((cell) => cell !== 0)),
      cellOwners: Array(9)
        .fill()
        .map(() => Array(9).fill(null)),
    };
  } else if (gameType === "wordgrid") {
    const grid = generateWordGrid(5); // Generate a 5x5 grid
    return {
      grid,
      foundWords: [],
      startTime: Date.now(),
    };
  }
}

// Check if Sudoku is complete
function isSudokuComplete(board) {
  // Check if all cells are filled
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        return false;
      }
    }
  }

  // Check if solution is valid
  return isSudokuValid(board);
}

// Validate Sudoku solution
function isSudokuValid(board) {
  // Check rows
  for (let row = 0; row < 9; row++) {
    const rowSet = new Set();
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0 || rowSet.has(board[row][col])) {
        return false;
      }
      rowSet.add(board[row][col]);
    }
  }

  // Check columns
  for (let col = 0; col < 9; col++) {
    const colSet = new Set();
    for (let row = 0; row < 9; row++) {
      if (board[row][col] === 0 || colSet.has(board[row][col])) {
        return false;
      }
      colSet.add(board[row][col]);
    }
  }

  // Check 3x3 boxes
  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const boxSet = new Set();
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const r = boxRow * 3 + row;
          const c = boxCol * 3 + col;
          if (board[r][c] === 0 || boxSet.has(board[r][c])) {
            return false;
          }
          boxSet.add(board[r][c]);
        }
      }
    }
  }

  return true;
}

// Calculate points for a word based on length
function calculateWordPoints(word) {
  if (word.length <= 3) return 1;
  if (word.length === 4) return 2;
  if (word.length === 5) return 3;
  if (word.length === 6) return 5;
  if (word.length === 7) return 7;
  return 10; // For words of length 8 or more
}

// Update leaderboard when Sudoku is complete
function updateLeaderboard(room, player) {
  // Find existing player in leaderboard
  const playerIndex = rooms[room].leaderboard.findIndex(
    (p) => p.username === player
  );

  // Calculate score based on time taken
  const timeTaken = Date.now() - rooms[room].startTime;
  const timeScore = Math.max(1000 - Math.floor(timeTaken / 1000), 100); // Max 1000 points, min 100 points

  if (playerIndex >= 0) {
    rooms[room].leaderboard[playerIndex].score += timeScore;
  } else {
    rooms[room].leaderboard.push({
      username: player,
      score: timeScore,
    });
  }

  // Sort leaderboard by score (descending)
  rooms[room].leaderboard.sort((a, b) => b.score - a.score);

  // Send updated leaderboard to all clients in the room
  io.to(room).emit("leaderboard_update", rooms[room].leaderboard);
}

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
