function AI(game) {
  this.game = game;

  this.scoreMap = {};
  var lastVal = 1;
  for(n = 2; n < 8192 * 16; n *= 2) {
    // needs to be a bit bigger that lastVal * 2 so that we give incentive to merge tiles
    var val = Math.floor(lastVal * 4);
    this.scoreMap[n] = val;
    lastVal = val;
  }
};

AI.prototype.reallyBad = -100000;

AI.prototype.runHeadless = function(maxTime, printInterval) {
  var numMoves = 0;
  while(!this.game.over) {
    numMoves++;
    this.game.computerMove();
    this.game.move(this.getBestMove(maxTime));
    if(!this.game.movesAvailable()) {
      this.game.over = true; // Game over!
      console.log("Game Over!\n");
      this.printUpdate();
    }
    else if(printInterval && numMoves % printInterval === 0) this.printUpdate();
  }
};

AI.prototype.printUpdate = function() {
  console.log("score: " + this.game.score + "\n" + this.game.grid.toString(true));
};

AI.prototype.getStats = function() {
  var statString = this.game.score + ",";
  statString += this.getMaxTile() + ",";
  statString += this.game.grid.toString() + "\n";
  return statString;
};

AI.prototype.getMaxTile = function() {
  var maxTile = 0;
  var grid = this.game.grid;
  for(var x = 0; x < grid.size; x++) {
    for(var y = 0; y < grid.size; y++) {
      if(grid.cells[x][y] && grid.cells[x][y].value > maxTile) maxTile = grid.cells[x][y].value;
    }
  }
  return maxTile;
};

AI.prototype.getBestMove = function(maxTime) {
  if(this.canFillRow(this.game.grid)) {
    return 2;
  }

  var startTime = new Date().getTime();
  var finishTime = startTime + maxTime;
  var depth = 2;
  var bestMove = null;

  // iterative deepening, but also cuts off when we hit finish time
  while(new Date().getTime() < finishTime) {
    var recursiveBestMove = this.recursiveBestMove(this.game, depth, finishTime).move;
    // if this is the final iteration was cut off prematurely, don't trust the results
    if(bestMove === null || new Date().getTime() < finishTime) {
      bestMove = recursiveBestMove;
      depth++;
    }
  }
  return bestMove;
};

AI.prototype.canFillRow = function(grid) {
  return grid.cells[0][3] && grid.cells[1][3] && grid.cells[2][3] && !grid.cells[3][3] &&
         (grid.cells[3][0] || grid.cells[3][1] || grid.cells[3][2]);
};

AI.prototype.recursiveBestMove = function(game, depth, finishTime) {
  var bestMove = null;
  var bestScore = null;

  // The directions to attempt. Because we're in the bottom left corner working to the right,
  // in the event of a tie, down is preferred, then left, then right
  // We'll never want to go up unless we're forced to, so don't even bother searching on that
  var directions = [2,3,1];
  for(var i = 0; i < directions.length; i++) {
    var newGame = game.clone();
    if(newGame.move(directions[i])) {
      // add the worst tile to the board and evaluate the resulting board score
      var score = this.addWorstTileAndEvalMove(newGame.grid);

      // continue to search recursively until we hit the target depth or we run out of time
      // if time runs out we won't use this search as its depth will be unbalanced
      if(depth > 0 && new Date().getTime() < finishTime) {
        score += this.recursiveBestMove(newGame, depth-1, finishTime).score;
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

AI.prototype.addWorstTileAndEvalMove = function(grid) {
  var availableCells = grid.availableCells();
  if(!availableCells) return this.reallyBad; // game is over

  // for each empty cell, add a 2 tile and calculate the board score, keeping track of the worst score and tile
  // looking at 4's too doesn't help enough to make it worth twice the computation
  var worstTile = null;
  var worstScore = null;
  for(var i = 0; i < availableCells.length; i++) {
    var tile = new Tile(availableCells[i], 2);
    // calculate the score of the resulting grid, then remove the tile for the next iteration
    grid.insertTile(tile);
    var score = this.calcScore(grid);
    grid.removeTile(tile);

    // remember which tile resulted in the worst score
    if(worstScore === null || score < worstScore) {
      worstScore = score;
      worstTile = tile;
    }
  }

  // when things go bad with this strategy, it can often go real bad
  // so try to be risk averse by assuming the worst
  // this also greatly reduces the search space compared to searching through each possible new tile
  grid.insertTile(worstTile);
  return worstScore;
};

/*
 * The idea is to keep the largest number in the bottom left corner, and build a sequence of decreasing
 * tiles in a path that snakes to the right through the bottom row, up and left through the 3rd row and so on.
 * When the decreasing path is blocked by a number larger than the previous, go up to the next row, and proceed
 * in whichever direction gives us further to traverse
 */
AI.prototype.calcScore = function(grid) {
  // start in the bottom left corner and traverse row by row
  var pos = {x:0, y:grid.size - 1};
  var score = 0;
  var lastVal = null;

  while(grid.withinBounds(pos)) {
    var increment = (pos.x < (grid.size / 2))? 1 : -1; // go the direction that has more space
    var rowStartX = pos.x;
    while(grid.withinBounds(pos)) {
      var tile = grid.cellContent(pos);
      if(tile && lastVal !== null && tile.value > lastVal) { // descending path is blocked
        if(rowStartX === pos.x) return score; // path is dead
        break; // if we've moved laterally in this row already, we can take that move back and try going up instead
      }
      if(tile) {
        lastVal = tile.value;
        score += this.scoreMap[tile.value];
      }
      pos = {x:pos.x + increment, y:pos.y};
    }
    // x is now one move past the bounds of the grid, or on the cell of the blocking tile,
    // move back to the last cell still in the path, and then up to the next row
    pos = {x:pos.x - increment, y:pos.y - 1};
  }
  return score;
};
