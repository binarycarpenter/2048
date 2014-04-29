function AI(gameManager, config) {
  this.gameManager = gameManager;
  this.config = this.defaultConfig;

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

AI.prototype.runAI = function(minTime) {
  if(!this.gameManager.game.over && this.gameManager.AIrunning) {
    this.gameManager.move(this.getBestMove(minTime));
    var self = this;
    setTimeout(function(){ self.runAI(minTime); }, 200); // allow ui to update
  }
  else {
    this.gameManager.stopAI();
  }
};

AI.prototype.runHeadless = function(minTime) {
  if(!this.gameManager.game.over && this.gameManager.AIrunning) {
    this.gameManager.game.move(this.getBestMove(minTime));
    this.gameManager.game.computerMove();
    if(!this.gameManager.game.movesAvailable()) {
      this.gameManager.game.over = true; // Game over!
    }
    this.runHeadless(minTime);
  }
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
    }
    depth++;
  }
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

Grid.prototype.toString = function() {
  var ret = "";
  for(var y = 0; y < this.size; y++) {
    ret += "(";
    for(var x = 0; x < this.size; x++) {
      var tile = this.cells[x][y];
      var val = tile? tile.value.toString() : "";
      ret += "[" + val + "]";
    }
    ret += ")"
  }
  return ret;
};
