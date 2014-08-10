function AI(game) {
  this.game = game;
};

AI.prototype.reallyBad = -100000;

AI.prototype.getBestMove = function(maxTime) {
  var depth = 2;
  var bestMove = null;
  var startTime = new Date().getTime();
  var finishTime = startTime + maxTime;

  // iterative deepening, but also cuts off when we hit finish time
  while(new Date().getTime() < finishTime) {
    var recursiveBestMove = this.recursiveBestMove(this.game, depth++, finishTime).move;
    // if time has ran out, calculation was cut off prematurely, don't trust the results
    if(bestMove === null || new Date().getTime() < finishTime) {
      bestMove = recursiveBestMove;
    }
  }
  return bestMove;
};

/* search through the given game to find the best move, looking ahead as many moves as the given depth param,
 * or until we've reached the given finishTime. Returns a tuple of the best move and score found
 */
AI.prototype.recursiveBestMove = function(game, depth, finishTime) {
  var bestMove = null;
  var bestScore = null;

  // The directions to attempt. Because we're in the bottom left corner working to the right,
  // in the event of a tie, down is preferred, then left, then right
  // We'll never want to go up unless we're forced to, so don't even bother searching on that
  var directions = [2,3,1];
  for(var i = 0; i < directions.length; i++) {
    var newGame = game.clone(); // copy the game so we don't mess with the original
    if(newGame.move(directions[i])) { // if moving this direction was a legal move
      // add the worst tile to the board and evaluate the score of the resulting board
      var score = this.addWorstTileAndEvalMove(newGame.grid);

      // continue to search recursively until we hit the target depth or we run out of time
      // if time runs out we won't use this search, since its depth will be unbalanced
      if(depth > 0 && new Date().getTime() < finishTime) {
        score += this.recursiveBestMove(newGame, depth - 1, finishTime).score;
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

/* when things go bad with this strategy, it can often mean game over,
 * so try to be risk averse by assuming the worst
 * this also greatly reduces the search space compared to recursing for each possible new tile
 */
AI.prototype.addWorstTileAndEvalMove = function(grid) {
  var availableCells = grid.availableCells();
  if(!availableCells) return this.reallyBad; // game is over

  // for each empty cell, add a 2 tile and calculate the board score, keeping track of the worst score and tile
  // looking at 4's doesn't change calcScore results enough to make it worth twice the computation
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
  grid.insertTile(worstTile);
  return worstScore;
};

/* The idea is to keep the largest number in the bottom left corner, and build a sequence of decreasing
 * tiles in a path that snakes to the right through the bottom row, up and left through the 3rd row and so on.
 * When the decreasing path is blocked by a number larger than the previous, go up to the next row, and proceed
 * in whichever direction gives us further to traverse. Returns a score based on accumulating the values of all
 * tiles in this decreasing path.
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
        score += tile.value * 2.5;
      }
      pos = {x:pos.x + increment, y:pos.y}; // increment our x pos
    }
    // x is now one move past the bounds of the grid, or on the cell of the blocking tile,
    // move back to the last cell still in the path, and up to the next row
    pos = {x:pos.x - increment, y:pos.y - 1};
  }
  return score;
};