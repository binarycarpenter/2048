function AI(gameManager) {
  this.gameManager = gameManager;
}

AI.prototype.runAI = function(movesToMake, movesMade, minTime) {
  if(movesMade < movesToMake && !this.gameManager.game.over && this.gameManager.AIrunning) {
    movesMade++;
    this.gameManager.actuator.setMovesLeft(movesToMake - movesMade);
    this.makeMove(minTime);
    var self = this;
    setTimeout(function(){ self.runAI(movesToMake, movesMade, minTime); }, 300);
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
  var result = this.recursiveBestMove(this.gameManager.game, 0, -1000000, 1000000, finishTime);
  console.log("Looked " + result.depth + " moves ahead and found best score ", result.score);
  return result.move;
};

AI.prototype.recursiveBestMove = function(game, depth, alpha, beta, finishTime) {
  var bestScore;
  var bestMove = -1;
  var result;
  var maxDepth = depth;
  // the maxing player
  if(game.playerTurn) {
    bestScore = alpha;
    for(var direction = 0; direction < 4; direction++) {
      var newGame = game.clone();
      if(newGame.move(direction)) {
        if(new Date().getTime() < finishTime) {
          result = this.recursiveBestMove(newGame, depth+1, bestScore, beta, finishTime);
          maxDepth = result.depth;
        }
        else {
          result = {score:this.calcScore(newGame), direction:direction, depth:maxDepth};
        }

        if(result.score > bestScore) {
          bestScore = result.score;
          bestMove  = direction;
        }
        if(bestScore > beta) {
          return {move:bestMove, score: beta, depth:result.depth};
        }
      }
    }
  }
  else { // computer turn
    var candidates = this.getAICandidates(game);
    for(var i = 0; i < candidates.length; i++) {
      var position = candidates[i].position;
      var value = candidates[i].value;
      var newGame = game.clone();
      var tile = new Tile(position, value);
      newGame.grid.insertTile(tile);
      newGame.playerTurn = true;
      result = this.recursiveBestMove(newGame, depth, alpha, bestScore, finishTime);
      maxDepth = result.depth;

      if(result.score < bestScore) {
        bestScore = result.score;
      }
      if (bestScore < alpha) {
        return { move: null, score: alpha, depth: result.depth};
      }
    }
  }
  return {move:bestMove, score:bestScore, depth:maxDepth};
};

AI.prototype.getAICandidates = function(game) {
  var candidates = [];
  var cells = game.grid.availableCells();
  var scores = {2:[], 4:[]};
  for(var value in scores)  {
    for(var i in cells) {
      scores[value].push(null);
      var cell = cells[i];
      var tile = new Tile(cell, parseInt(value, 10));
      game.grid.insertTile(tile);
      scores[value][i] = this.calcScore(game);
      game.grid.removeTile(tile);
    }
  }

  var maxScore = Math.max(Math.max.apply(null, scores[2]), Math.max.apply(null, scores[4]));
  for(var value in scores) {
    for(var i = 0; i < scores[value].length; i++) {
      if(scores[value][i] === maxScore) {
        candidates.push({position: cells[i], value: parseInt(value, 10)});
      }
    }
  }
  return candidates;
};

AI.prototype.calcScore = function(game) {
  if(!game) game = this.gameManager.game;
  var cells = this.snakedCells(game.grid);
  var score = this.orderScore(cells);
  var emptyCells = game.grid.availableCells().length;
  score += (emptyCells * 25);
  if(emptyCells < 6) score -= 500;
  if(!game.isLegalMove(1) && !game.isLegalMove(2) && !game.isLegalMove(3)) score -= 100000;

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
      score -= (10 * (tile.value - lastVal));
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

