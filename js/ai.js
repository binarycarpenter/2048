function AI(gameManager) {
  this.gameManager = gameManager;
}

AI.prototype.runAI = function(movesToMake, movesMade, minTime) {
  if((movesToMake === false || movesMade < movesToMake) && !this.gameManager.game.over && this.gameManager.AIrunning) {
    movesMade++;
    if(movesToMake !== false) this.gameManager.actuator.setMovesLeft(movesToMake - movesMade);
    this.makeMove(minTime);
    var self = this;
    setTimeout(function(){ self.runAI(movesToMake, movesMade, minTime); }, 400);
  }
  else {
    if(movesToMake !== false) this.gameManager.actuator.setMovesLeft(movesToMake);
    this.gameManager.stopAI();
  }
};

AI.prototype.makeMove = function(minSearchTime) {
  this.gameManager.move(this.getBestMove(minSearchTime));
};

AI.prototype.getBestMove = function(minSearchTime) {
  var startTime = new Date().getTime();
  finishTime = startTime + minSearchTime;
  var depth = 1;
  var bestMove;
  var bestScore;
  while(new Date().getTime() < finishTime) {
    var result = this.recursiveBestMove(this.gameManager.game, depth);
    bestMove = result.move;
    bestScore = result.score;
    depth++;
  }
  console.log("Looked " + depth + " moves ahead and found best score ", bestScore);
  return bestMove;
};

AI.prototype.recursiveBestMove = function(game, depth) {
  var bestMove = -1;
  var bestScore = false;
  var result;
  for(var direction = 1; direction < 4; direction++) {
    var newGame = game.clone();
    if(newGame.move(direction)) {
      var eval = this.evalMoveAndAddTile(newGame);
      var score = eval.score;
      if(depth > 0) {
        result = this.recursiveBestMove(eval.game, depth-1);
        score += result.score;
      }

      if(bestScore === false || score > bestScore) {
        bestScore = score;
        bestMove  = direction;
      }
    }
  }
  if(bestMove === -1) bestMove = 0; // go up if there were no other possibilities
  return {move:bestMove, score:bestScore};
};

AI.prototype.evalMoveAndAddTile = function(game) {
  if(!game.grid.cellsAvailable()) return {game:game, score:-1000000};

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
      score = this.calcScore(game);
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

AI.prototype.calcScore = function(game) {
  if(!game) game = this.gameManager.game;
  var cells = this.snakedCells(game.grid);
  var score = this.orderScore(cells);
  var emptyCells = game.grid.availableCells().length;
  //score += (emptyCells * 5);
  //if(emptyCells < 6) score -= Math.floor((500 / (emptyCells + 1)));
  //if(!game.grid.cells[0][3]) score -= 100000;

  return score;
};

AI.prototype.orderScore = function(cells) {
  var score = 0;
  var lastVal = false;
  for(var i = 0; i < cells.length; i++) {
    var tile = cells[i];
    if(!tile) {
      if(i < 4) score -= 100;
      return score;
    }
    if(!lastVal || tile.value <= lastVal)  {
      score += tile.value;
    }
    else if(lastVal && tile.value > lastVal) {
      score -= (5 * (tile.value - lastVal));
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

