function AI(gameManager) {
  this.gameManager = gameManager;
}

AI.prototype.ohFuckThatsBad = -100000;

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

AI.prototype.evalMoveAndAddTile = function(game) {
  if(!game.grid.cellsAvailable()) return {game:game, score: this.ohFuckThatsBad};

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
      score = this.calcScore(game, true);
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

AI.prototype.calcScore = function(game, judgingWorstNewTile) {
  if(!game) game = this.gameManager.game;
  var cells = this.snakedCells(game.grid);
  var score = this.orderScore(cells);
  var emptyCells = game.grid.availableCells().length;
  //score += (emptyCells * 25);
  if(emptyCells < 4) score += Math.floor((this.ohFuckThatsBad / (emptyCells + 1)));
  //if(!game.grid.cells[0][3]) score -= 100000;

  return score;
};

AI.prototype.orderScore = function(cells, judgingWorstNewTile) {
  var score = 0;
  var lastVal = false;
  for(var i = 0; i < cells.length; i++) {
    var tile = cells[i];
    if(!tile) {
      if(i === 0 && !judgingWorstNewTile) score += this.ohFuckThatsBad;
      return score;
    }
    if(!lastVal || tile.value <= lastVal)  {
      score += ((tile.value * tile.value) / 4);
    }
    else if(lastVal && tile.value > lastVal) {
      var difference = (tile.value - lastVal);
      score -= (2 * difference);
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

