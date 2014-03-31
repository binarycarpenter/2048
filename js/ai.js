function AI(gameManager) {
  this.gameManager = gameManager;
}

AI.prototype.playGame = function() {
  while(!this.gameManager.game.over) {
    this.gameManager.move(this.getBestMove());
  }
};

AI.prototype.getBestMove = function() {
  var startTime = new Date().getTime();
  var minSearchTime = 500;
  var depth = 3;
  var move;
  while((new Date().getTime() - startTime) < minSearchTime) {
    move = this.recursiveBestMove(this.gameManager.game, null, depth).direction;
    depth++;
  }
  return move;
};

AI.prototype.recursiveBestMove = function(game, bestScore, depth) {
  var bestDirection = -1;
  for(var direction = 1; direction < 4; direction++) {
    var newGame = game.clone();
    if(newGame.move(direction)) {
      if(bestDirection < 0) bestDirection = direction;
      this.addWorstTile(newGame);
      var score = this.calcScore(newGame);
      if(bestScore === null || score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
      if(depth > 0) {
        var bests = this.recursiveBestMove(newGame, bestScore, depth - 1);
        if(bests.score > bestScore) {
          bestScore = bests.score;
          bestDirection = direction;
        }
      }
    }
  }
  return {score:bestScore, direction:bestDirection};
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
  var cells = this.snakedCells(game.grid);
  var score = 0;
  var lastVal = -1;
  var foundEmpty = false;
  for(var i = 0; i < cells.length; i++) {
    var tile = cells[i];
    if(tile && !foundEmpty) {
      if(lastVal > 0) {
        var factor = lastVal / tile.value;
        if(factor < 1) score -= 50;
        else score += (200 / factor);
      }
      lastVal = tile.value;
    }
    else {
      if(lastVal < 0 && !foundEmpty) score -= 100;
      else score += 100;
      foundEmpty = true;
    }
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

