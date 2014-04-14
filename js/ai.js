function AI(gameManager) {
  this.gameManager = gameManager;
}

AI.prototype.runAI = function(movesToMake, movesMade, minTime) {
  if(movesMade < movesToMake && !this.gameManager.game.over && this.gameManager.AIrunning) {
    movesMade++;
    this.gameManager.actuator.setMovesLeft(movesToMake - movesMade);
    this.makeMove(minTime);
    var self = this;
    setTimeout(function(){ self.runAI(movesToMake, movesMade, minTime); }, 500);
  }
  else {
    this.gameManager.actuator.setMovesLeft(movesToMake);
    this.gameManager.stopAI();
  }
};

AI.prototype.makeMove = function(minSearchTime) {
  this.gameManager.move(this.getBestMove(minSearchTime));
};

AI.prototype.getBestMove = function(minSearchTime) {
  var startTime = new Date().getTime();
  finishTime = startTime + minSearchTime;
  var result = this.recursiveBestMove(this.gameManager.game, null, 0, finishTime);
  console.log("Looked " + result.depth + " moves ahead and found best score ", result.score);
  return result.direction;
};

AI.prototype.recursiveBestMove = function(game, bestScore, depth, finishTime) {
  var bestDirection= null;
  for(var direction = 0; direction < 4; direction++) {
    var newGame = game.clone();
    if(newGame.move(direction)) {
      this.addWorstTile(newGame);
      var score = this.calcScore(newGame);
      if(bestScore === null || score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
      /*
      if(new Date().getTime() < finishTime) {
        var bests = this.recursiveBestMove(newGame, bestScore, depth + 1);
        if(bests.score > bestScore) {
          bestScore = bests.score;
          bestDirection = direction;
        }
      } */
    }
  }
  return {score:bestScore, direction:bestDirection, depth:depth};
};

AI.prototype.addWorstTile = function(game) {
  var cells = game.grid.availableCells();
  var worstScore = null;
  var worstTile = null;
  for (var value = 2; value <= 4; value *= 2) {
    for (var i in cells) {
      var cell = cells[i];
      var tile = new Tile(cell, parseInt(value, 10));
      game.grid.insertTile(tile);
      var score = this.calcScore(game);
      if(worstScore === null || score < worstScore) {
        if(worstTile) {
          game.grid.removeTile(worstTile);
        }
        worstTile = tile;
        worstScore = score;
      }
      else {
        game.grid.removeTile(tile);
      }
    }
  }
};

AI.prototype.calcScore = function(game) {
  if(!game) game = this.gameManager.game;
  var cells = this.snakedCells(game.grid);
  var score = this.orderScore(cells);
  return score;
};

AI.prototype.orderScore = function(cells) {
  var score = 0;
  var lastVal = false;
  for(var i = 0; i < cells.length; i++) {
    var tile = cells[i];
    if(!tile) return score;
    if(!lastVal || tile.value <= lastVal)  {
      score += tile.value;
    }
    else if(lastVal && tile.value > lastVal) {
      score -= (tile.value - lastVal);
    }
    lastVal = tile.value;
  }
  return score;
};

AI.prototype.snakedCells = function(grid) {
  var snakedCells = [];
  var leftToRight = true;
  for(var y = grid.size - 1; y >= 0; y--) {
    if(leftToRight) {
      for(var x = 0; x < grid.size; x++) snakedCells.push(grid.cells[x][y]);
    }
    else{
      for(var x = grid.size - 1; x >= 0; x--) snakedCells.push(grid.cells[x][y]);
    }
    leftToRight = !leftToRight;
  }
  return snakedCells;
};

