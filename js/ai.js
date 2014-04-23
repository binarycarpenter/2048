function AI(gameManager) {
  this.gameManager = gameManager;
}

AI.prototype.ohFuckThatsBad = -100000;

AI.prototype.runAI = function(minTime) {
  if(!this.gameManager.game.over && this.gameManager.AIrunning) {
    this.gameManager.move(this.getBestMove(minTime));
    var self = this;
    setTimeout(function(){ self.runAI(movesToMake, movesMade, minTime); }, 100); // allow ui to update
  }
  else {
    this.gameManager.stopAI();
  }
};

AI.prototype.getBestMove = function(minSearchTime) {
  if(this.needToFillBottomRow(this.gameManager.game.grid.cells)) {
    return 2;
  }

  var startTime = new Date().getTime();
  finishTime = startTime + minSearchTime;
  var depth = 1;
  var bestMove = -1;
  var bestScore;
  while(new Date().getTime() < finishTime) {
    var result = this.recursiveBestMove(this.gameManager.game, depth, finishTime);
    if(bestMove === -1 || !result.outOfTime) {
      bestMove = result.move;
      bestScore = result.score;
    }
    depth++;
  }
  console.log("Looked " + depth + " moves ahead and found best score ", bestScore);
  return bestMove;
};

AI.prototype.recursiveBestMove = function(game, depth, finishTime) {
  var bestMove = -1;
  var bestScore = false;
  var result;
  var outOfTime = false;
  var directions = [2,3,1]
  for(var i = 0; i < directions.length; i++) {
    var newGame = game.clone();
    var direction = directions[i];
    if(newGame.move(direction)) {
      var eval = this.evalMoveAndAddTile(newGame);
      var score = eval.score;
      outOfTime = new Date().getTime() > finishTime;
      if(depth > 0 && !outOfTime) {
        result = this.recursiveBestMove(eval.game, depth-1, finishTime);
        score += result.score;
      }

      if(bestScore === false || score > bestScore) {
        bestScore = score;
        bestMove  = direction;
      }
    }
  }

  if(bestMove === -1) {
    bestMove = 0; // go up if there were no other possibilities
    bestScore = this.ohFuckThatsBad;
  }
  return {move:bestMove, score:bestScore, outOfTime:outOfTime};
};

AI.prototype.needToFillBottomRow = function(cells) {
  return(cells[0][3] && cells[1][3] && cells[2][3] && !cells[3][3] &&
    (cells[3][0] || cells[3][2] || cells[3][1]));
};

AI.prototype.evalMoveAndAddTile = function(game) {
  if(!game.grid.cellsAvailable()) return {game:game, score:this.ohFuckThatsBad};

  var numTries = 20;
  var total = 0;
  var worstTile;
  var worstScore = false;
  var map = {};
  for(var tries = 0; tries < numTries; tries++) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(game.grid.randomAvailableCell(), value);
    game.grid.insertTile(tile);

    var score = map[tile.toString()];
    if(typeof score === "undefined") {
      score = this.calcScore(game.grid);
      map[tile.toString()] = score;
    }
    total += score;

    if(worstScore === false || score < worstScore) {
      worstScore = score;
      worstTile = tile;
    }
    game.grid.removeTile(tile);
  }

  var newGame = game.clone();
  newGame.grid.insertTile(worstTile);
  var avgScore = Math.floor(total / numTries);
  return {game:newGame, score:avgScore};
};

AI.prototype.calcScore = function(grid) {
  var score = 0;
  var lastVal = false;

  // start in the bottom left corner and traverse row by row
  var x = 0;
  var y = grid.size - 1;

  while(grid.withinBounds({x:x, y:y})) {
    // calculate score for a row
    var increment = (x < 2)? 1 : -1; // go the direction that has more space
    var firstInRow = true;
    while(grid.withinBounds({x:x, y:y})) {
      var tile = grid.cells[x][y];
      if(!tile) return score;

      if(lastVal === false || tile.value <= lastVal) {
        score += ((tile.value * tile.value) / 4);
        x += increment;
        lastVal = tile.value;
      }
      else { // tile.value > lastVal, path is blocked, stop with this row
        if(firstInRow) return score; // path is dead
        break; // if we've moved laterally in this row already, we can take that move back and try going up instead
      }
      firstInRow = false;
    }

    // x is now just outside of the bounds, or the blockage, move back to the last good path square
    x -= increment;
    y--; // and up to the next row
  }
  return score;
};

