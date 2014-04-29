function AI(game, config) {
  debugger;
  this.gameManager = {game:game, AIrunning:true};

  this.config = this.defaultConfig;
  if(config) {
    for(prop in config) {
      this.config[prop] = config[prop];
    }
  }

  this.scoreMap = {};
  var lastVal = 1;
  for(n = 2; n < 8192 * 16; n *= 2) {
    // needs to be a bit bigger that lastVal * 2 so that we give incentive to merge tiles
    var val = Math.floor(lastVal * this.config.scoreMapMultiplier);
    this.scoreMap[n] = val;
    lastVal = val;
  }
}

AI.prototype.reallyBad = -100000;

AI.prototype.defaultConfig = {
  scoreMapMultiplier: 2.5,
  addRecursiveScores: true,
  evalWithWorst: true,
  emptyCellInPathPenalty: 0,
  lookAheadInEval: false,
  forcedMovePenalty: 4
};

AI.prototype.runHeadless = function(minTime) {
  this.numMoves = 0;
  this.totalDepth = 0;
  while(!this.gameManager.game.over && this.gameManager.AIrunning) {
    this.numMoves++;
    this.gameManager.game.computerMove();
    if(this.config.minTime) minTime = this.config.minTime;
    this.gameManager.game.move(this.getBestMove(minTime));
    if(!this.gameManager.game.movesAvailable()) {
      this.gameManager.game.over = true; // Game over!
    }
    if(this.numMoves % 100 === 0) console.log("grid after " + this.numMoves + " moves:\n" + this.gameManager.game.grid.toString(true));
  }
};

AI.prototype.getStats = function(minTime) {
  var statString = this.gameManager.game.score + ",";
  statString += this.getMaxTile() + ",";
  statString += this.gameManager.game.grid.toString() + ",";
  for(var prop in this.defaultConfig) {
    statString += this.defaultConfig[prop] + ",";
  }
  statString += this.numMoves + ",";
  if(this.config.minTime) statString += this.config.minTime + ",";
  else statString += minTime + ',';
  statString += (this.totalDepth / this.numMoves) + '\n';
  return statString;
};

AI.prototype.getMaxTile = function() {
  var maxTile = 0;
  var grid = this.gameManager.game.grid;
  for(var x = 0; x < grid.size; x++) {
    for(var y = 0; y < grid.size; y++) {
      if(grid.cells[x][y] && grid.cells[x][y].value > maxTile) maxTile = grid.cells[x][y].value;
    }
  }
  return maxTile;
};

AI.prototype.getBestMove = function(minSearchTime) {
  if(this.goDownToFillRow(this.gameManager.game.grid)) {
    return 2;
  }

  var startTime = new Date().getTime();
  var finishTime = startTime + minSearchTime;
  var depth = 2;
  var bestMove = null;

  // iterative deepening, but also cuts off when we hit finish time
  while(new Date().getTime() < finishTime) {
    var recursiveBestMove = this.recursiveBestMove(this.gameManager.game, depth, finishTime).move;
    // if this is the final iteration was cut off prematurely, don't trust the results
    if(bestMove === null || new Date().getTime() < finishTime) {
      bestMove = recursiveBestMove;
      depth++;
    }
  }
  this.totalDepth += (depth - 1);
  return bestMove;
};

AI.prototype.goDownToFillRow = function(grid) {
  return grid.cells[0][3] && grid.cells[1][3] && grid.cells[2][3] && !grid.cells[3][3] &&
         (grid.cells[3][0] || grid.cells[3][1] || grid.cells[3][2]);

    /*
  if(grid.cells[0][3] && grid.cells[1][3] && grid.cells[2][3]) {
    if(!grid.cells[3][3]) {
      return grid.cells[3][0] || grid.cells[3][1] || grid.cells[3][2];
    }
    else {
      return grid.cells[3][2] && grid.cells[3][2].value <= grid.cells[3][3].value &&
             grid.cells[2][2] && grid.cells[2][2].value <= grid.cells[3][2].value &&
             grid.cells[1][2] && grid.cells[1][2].value <= grid.cells[2][2].value &&
             !grid.cells[0][2] && (grid.cells[0][1] || grid.cells[0][0]);
    }
  }
  return false;
  /*
  var y = grid.size - 1;
  var x = 0;
  while(x < grid.size - 1) {
    if(!grid.cells[x++][y]) return false;
  }
  if(!grid.cells[x][y]) {
    for(y = y - 1; y >= 0; y--) {
      if(grid.cells[x][y]) return true;
    }
  }
  // bottom row is full, check the next one up
  else {
    y--;
    while(x > 0) {
      if(!grid.cells[x--][y]) return false;
    }
    if(!grid.cells[x][y]) {
      for(y = y - 1; y >= 0; y--) {
        if(grid.cells[x][y]) return true;
      }
    }
  }
  return false;  */
};

AI.prototype.recursiveBestMove = function(game, depth, finishTime) {
  var bestMove = null;
  var bestScore = null;

  // The directions to attempt. Because we're in the bottom left corner working to the right,
  // down in the event of a tie, down is preferred, then left, then right
  // We'll never want to go up unless we're forced to, so don't even bother searching on that
  var directions = [2,3,1];

  for(var i = 0; i < directions.length; i++) {
    if(new Date().getTime() > finishTime) return {score:0, move:0};

    var newGame = game.clone();
    if(newGame.move(directions[i])) {
      // add the worst tile to the board and evaluate the score
      var score = this.addTileAndEvalMove(newGame);

      // continue to search recursively until we hit the target depth or we run out of time
      // we'll have to invalidate runs that ran out of time since their search depth is not balanced
      // but it's better than allowing a large depth to run on way too long and freeze the browser
      if(depth > 0 && new Date().getTime() < finishTime) {
        if(this.config.addRecursiveScores) {
          score += this.recursiveBestMove(newGame, depth-1, finishTime).score;
        }
        else {
          score = this.recursiveBestMove(newGame, depth-1, finishTime).score;
        }
      }

      if(bestScore === null || score > bestScore) {
        bestScore = score;
        bestMove  = directions[i];
      }
    }
  }

  if(bestMove === null) {
    bestMove = 0; // go up if there were no other possibilities, this is bad
    bestScore = this.reallyBad;
  }
  return {score:bestScore, move:bestMove};
};

AI.prototype.addTileAndEvalMove = function(game) {
  var grid = game.grid;
  var availableCells = grid.availableCells();
  if(!availableCells) return this.reallyBad; // game is over

  var total = 0;
  // the tile values we need to attempt to add, and their probabilities
  var values = [{val:2, probability:.9}, {val:4, probability:.1}];
  var worstTile = null;
  var worstScore = null;

  // for every empty cell...
  for(var i = 0; i < availableCells.length; i++) {
    // try inserting both a 2 and a 4...
    for(var j = 0; j < values.length; j++) {
      var tile = new Tile(availableCells[i], values[j].val);
      grid.insertTile(tile);

      // calculate the score of the resulting grid,
      var score = this.calcScore(grid);
      if(this.config.lookAheadInEval) {
        score = this.evalLookAhead(game, score);
      }
      // and weight it based on the probability that this will be the tile randomly added
      var weightedScore = score * (1/availableCells.length) * values[j].probability;
      // accumulate the overall score
      total += weightedScore;
      // remove the tile for the next iteration
      grid.removeTile(tile);

      // remember which tile resulted in the worst score
      if(worstScore === null || score < worstScore) {
        worstScore = score;
        worstTile = tile;
      }
    }
  }

  // when things go bad with this strategy, it can often mean the game is over soon
  // so try to be risk averse by assuming the worst
  // this also greatly reduces the search space compared to searching through each possible new tile
  grid.insertTile(worstTile);
  return this.config.evalWithWorst? worstScore : Math.floor(total);
};

AI.prototype.evalLookAhead = function(game, score) {
  var legalMoves = [];
  for(var i = 0; i < 4; i++) {
    if(game.isLegalMove(i)) {
      legalMoves.push(i);
    }
  }

  if(legalMoves.length === 0) return this.reallyBad;
  if(legalMoves.length === 1 && legalMoves[0] !== 2) {
    var newGame = game.clone();
    newGame.move(legalMoves[0]);
    var newScore = this.calcScore(newGame.grid);
    if(newScore < score) return newScore / this.config.forcedMovePenalty;
  }
  return score;
};

/*
 * The idea is to keep the largest number in the bottom left corner, and build a sequence of decreasing
 * tiles in a path that snakes to the right through the bottom row, up and left through the 3rd row and so on.
 * When the decreasing path is blocked by a number larger than the previous, go up to the next row, and proceed
 * in whichever direction gives us further to traverse
 */
AI.prototype.calcScore = function(grid) {
  var score = 0;
  var lastVal = null;

  // start in the bottom left corner and traverse row by row
  var x = 0;
  var y = grid.size - 1;

  while(grid.withinBounds({x:x, y:y})) {
    var increment = (x < (grid.size / 2))? 1 : -1; // go the direction that has more space
    var hasMovedInRow = false;
    while(grid.withinBounds({x:x, y:y})) {
      var tile = grid.cells[x][y];
      if(tile && lastVal !== null && tile.value > lastVal) { // descending path is blocked
        if(!hasMovedInRow) return score; // path is dead
        break; // if we've moved laterally in this row already, we can take that move back and try going up instead
      }

      if(tile) {
        lastVal = tile.value;
        score += this.scoreMap[tile.value];
      }
      else {
        score -= this.config.emptyCellInPathPenalty;
      }
      x += increment;
      hasMovedInRow = true;
    }

    // x is now one move past the bounds of the grid, or on the cell of the blocking tile,
    // move back to the last cell still in the path, and then up to the next row
    x -= increment;
    y--;
  }
  return score;
};

AI.prototype.recursiveCalcScore = function(grid) {
  return this.recursiveCalcScoreHelper(grid, {x:0, y:grid.size - 1}, null, null, 0);
};

AI.prototype.recursiveCalcScoreHelper = function(grid, position, lastPosition, lastVal, score) {
  if(!grid.withinBounds(position)) return score;

  var tile = grid.cellContent(position);
  if(tile && lastVal !== null && tile.value > lastVal) return score; // path blocked

  //var accumScore = score;
  //var myLastVal = lastVal;
  if(tile) {
    lastVal = tile.value;
    score += this.scoreMap[tile.value];
  }

  var bestScore = null;
  var nextPositions = [{x:position.x - 1, y:position.y},
                       {x:position.x + 1, y:position.y},
                       {x:position.x, y:position.y - 1}];
  for(var i = 0; i < nextPositions.length; i++) {
    var nextPosition = nextPositions[i];
    if(!grid.withinBounds(nextPosition) ||
       (lastPosition !== null && nextPosition.x === lastPosition.x && nextPosition.y === lastPosition.y)) {
      continue;
    }

    var recursiveScore = this.recursiveCalcScoreHelper(grid, nextPosition, position, lastVal, score);
    if(bestScore === null || recursiveScore > bestScore) bestScore = recursiveScore;
  }

  return bestScore;
};

function Grid(size, previousState) {
  this.size = size;
  this.cells = previousState ? this.fromState(previousState) : this.empty();
}

// Build a grid of the specified size
Grid.prototype.empty = function () {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }

  return cells;
};

Grid.prototype.fromState = function (state) {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      var tile = state[x][y];
      row.push(tile ? new Tile(tile.position, tile.value) : null);
    }
  }

  return cells;
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[Math.floor(Math.random() * cells.length)];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];

  this.eachCell(function (x, y, tile) {
    if (!tile) {
      cells.push({ x: x, y: y });
    }
  });

  return cells;
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      callback(x, y, this.cells[x][y]);
    }
  }
};

// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  return !!this.availableCells().length;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (cell) {
  return !this.cellOccupied(cell);
};

Grid.prototype.cellOccupied = function (cell) {
  return !!this.cellContent(cell);
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size;
};

Grid.prototype.clone = function() {
  newGrid = new Grid(this.size);
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      if (this.cells[x][y]) {
        newGrid.insertTile(this.cells[x][y].clone());
      }
    }
  }
  return newGrid;
};

Grid.prototype.serialize = function () {
  var cellState = [];

  for (var x = 0; x < this.size; x++) {
    var row = cellState[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(this.cells[x][y] ? this.cells[x][y].serialize() : null);
    }
  }

  return {
    size: this.size,
    cells: cellState
  };
};

Grid.prototype.toString = function(alignPretty) {
  var ret = "";
  for(var y = 0; y < this.size; y++) {
    if(!alignPretty) ret += "(";
    for(var x = 0; x < this.size; x++) {
      var tile = this.cells[x][y];
      var val = tile? tile.value.toString() : "";
      if(alignPretty) {
        var prefix = true;
        for(var i = val.length; i < 4; i++) {
          val = prefix? " " + val : val + " ";
          prefix = !prefix;
        }
      }
      ret += "[" + val + "]";
    }
    if(alignPretty) ret += "\n";
    else ret += ")";
  }
  return ret;
};

function Game(grid, score, over, won, keepPlaying) {
  this.grid        = grid;
  this.score       = score;
  this.over        = over;
  this.won         = won;
  this.keepPlaying = keepPlaying;
  this.startTiles  = 2;
  this.size        = this.grid.size;
}

// Return true if the game is lost, or has won and the user hasn't kept playing
Game.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
    return true;
  } else {
    return false;
  }
};

// Set up the initial tiles to start the game with
Game.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
Game.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

Game.prototype.computerMove = function() {
  this.addRandomTile();
};

// Save all tile positions and remove merger info
Game.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
Game.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

Game.prototype.move = function(direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return false; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  if(!vector || !traversals || !traversals.x || !traversals.y) {
    console.log("bad vector!");
  }

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });
  return moved;
};

Game.prototype.isLegalMove = function(direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return false; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);

  if(!vector || !traversals || !traversals.x || !traversals.y) {
    console.log("bad vector!");
  }

  moved = false;

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        if (next && next.value === tile.value) {
          moved = true;
        }
        else if(!self.positionsEqual(positions.farthest, tile)){
          moved = true;
        }
      }
    });
  });
  return moved;
};

// Get the vector representing the chosen direction
Game.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
Game.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.grid.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  if(!vector || !traversals || !traversals.x || !traversals.y) {
    console.log("bad vector!");
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

Game.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

Game.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
Game.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

Game.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

Game.prototype.clone = function() {
  var gameClone = new Game(this.grid.clone(), this.score, this.over, this.won, this.keepPlaying);
  return gameClone;
}

// Represent the current game as an object
Game.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};


function Tile(position, value) {
  this.x                = position.x;
  this.y                = position.y;
  this.value            = value || 2;

  this.previousPosition = null;
  this.mergedFrom       = null; // Tracks tiles that merged together
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (position) {
  this.x = position.x;
  this.y = position.y;
};

Tile.prototype.clone = function() {
  newTile = new Tile({ x: this.x, y: this.y }, this.value);
  //newTile.previousPosition = { x: this.previousPosition.x, y: this.previousPosition.y };
  //newTile.mergedFrom = { x: this.previousPosition.x, y: this.previousPosition.y };
  return newTile;
}

Tile.prototype.serialize = function () {
  return {
    position: {
      x: this.x,
      y: this.y
    },
    value: this.value
  };
};

Tile.prototype.toString = function() {
  return this.x + " " + this.y + " " + this.value;
};

/*
AI.prototype.defaultConfig = {
  scoreMapMultiplier: 2.5,
  addRecursiveScores: true,
  evalWithWorst: true,
  emptyCellInPathPenalty: 0,
  lookAheadInEval: false,
  forcedMovePenalty: 4
}; */

var fs = require('fs');
var minTime = 100;
var properties = [{}, {scoreMapMultiplier:2.1}, {scoreMapMultiplier:2}, {evalWithWorst:false}, {minTime:300}];
var games = 1;
while(true) {
  for(var i = 0; i < properties.length; i++) {
    console.log('Starting game ' + games + '\n');
    var game = new Game(new Grid(4, false), 0, false, false, true);
    var ai = new AI(game, properties[i]);
    ai.runHeadless(minTime);
    fs.appendFileSync("data.csv", ai.getStats(minTime));
    games++;
  }
}
