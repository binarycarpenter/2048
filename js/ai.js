function AI(game, config) {
  this.gameManager = {game:game, AIrunning:true};
  this.running = true;
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
  forcedMovePenalty: 4,
  maxTime:100
};

AI.prototype.runAI = function(maxTime) {
  if(!this.gameManager.game.over && this.running) {
    this.gameManager.move(this.getBestMove(maxTime));
    var self = this;
    setTimeout(function(){ self.runAI(); }, 200); // allow ui to update
  }
  else {
    this.gameManager.stopAI();
  }
};

AI.prototype.runHeadless = function() {
  this.numMoves = 0;
  this.totalDepth = 0;
  while(!this.gameManager.game.over && this.gameManager.AIrunning) {
    this.numMoves++;
    this.gameManager.game.computerMove();
    this.gameManager.game.move(this.getBestMove());
    if(!this.gameManager.game.movesAvailable()) {
      this.gameManager.game.over = true; // Game over!
    }
    if(this.numMoves % 100 === 0) console.log("grid after " + this.numMoves + " moves:\n" + this.gameManager.game.grid.toString(true));
  }
};

AI.prototype.getStats = function() {
  var statString = this.gameManager.game.score + ",";
  statString += this.getMaxTile() + ",";
  statString += this.gameManager.game.grid.toString() + ",";
  for(var prop in this.defaultConfig) {
    statString += this.defaultConfig[prop] + ",";
  }
  statString += this.numMoves + ",";
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

AI.prototype.getBestMove = function(maxTime) {
  if(maxTime) this.config.maxTime = maxTime;

  if(this.goDownToFillRow(this.gameManager.game.grid)) {
    return 2;
  }

  var startTime = new Date().getTime();
  var finishTime = startTime + this.config.maxTime;
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