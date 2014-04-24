function AI(gameManager) {
  this.gameManager = gameManager;
  this.scoreMap = this.generateScoreMap();
}

AI.prototype.ohFuckThatsBad = -100000;

AI.prototype.generateScoreMap = function(){
  var map = {};
  var lastVal = 1;
  for(n = 2; n < 8192 * 16; n *= 2) {
    var val = Math.floor((lastVal * 2) + lastVal / 2);
    map[n] = val;
    lastVal = val;
  }
  return map;
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

AI.prototype.getBestMove = function(minSearchTime) {
  var startTime = new Date().getTime();
  finishTime = startTime + minSearchTime;
  var depth = 2;
  var bestMove = -1;
  var bestScore;
  var log;
  var logInit = false; //{score:this.calcScore(this.gameManager.game.grid), grid:this.gameManager.game.grid.toString()};
  while(new Date().getTime() < finishTime) {
    var result = this.recursiveBestMove(this.gameManager.game, depth, finishTime, logInit);
    if(bestMove === -1 || new Date().getTime() < finishTime) {
      bestMove = result.move;
      bestScore = result.score;
      log = result.log;
    }
    depth++;
  }
  currentLog = log;
  return bestMove;
};

AI.prototype.translate = function(direction) {
  return ["up", "right", "down", "left"][direction];
};

AI.prototype.recursiveBestMove = function(game, depth, finishTime, log) {
  var bestMove = -1;
  var bestScore = false;
  var result;
  var outOfTime = false;
  var directions = [2,3,1];

  for(var i = 0; i < directions.length; i++) {
    var newGame = game.clone();
    var direction = directions[i];
    if(newGame.move(direction)) {
      var score = this.evalMoveAndAddTile(game.grid, newGame.grid);
      var logObj = false;
      if(log) logObj = {depth:depth, grid:newGame.grid.toString(), score:score};
      outOfTime = new Date().getTime() > finishTime;
      if(depth > 0 && !outOfTime) {
        result = this.recursiveBestMove(newGame, depth-1, finishTime, logObj);
        score += result.score;
        logObj = result.log;
      }
      if(logObj) logObj["total"] = score;

      if(bestScore === false || score > bestScore) {
        bestScore = score;
        bestMove  = direction;
      }
      if(log) log[this.translate(direction)] = logObj;
    }
  }

  if(bestMove === -1) {
    bestMove = 0; // go up if there were no other possibilities
    bestScore = this.ohFuckThatsBad;
  }
  return {move:bestMove, score:bestScore, log:log};
};

AI.prototype.evalMoveAndAddTile = function(oldGrid, grid) {
  var availableCells = grid.availableCells();
  if(!availableCells) return this.ohFuckThatsBad;

  var total = 0;
  var values = [2,4];
  var probabilities = [.9, .1];

  var oldPath = this.getDescendingPath(oldGrid);
  var oldScore = this.calcScoreFromPath(oldPath);
  var foundPathBlocker = false;
  var worstTile;
  var worstScore = false;

  for(var i = 0; i < availableCells.length; i++) {
    for(var j = 0; j < values.length; j++) {
      var val = values[j];
      var tile = new Tile(availableCells[i], val);
      grid.insertTile(tile);
      var newPath = this.getDescendingPath(grid);
      var score = this.calcScoreFromPath(newPath);
      var weightedScore = score * (1/availableCells.length) * probabilities[j];
      total += weightedScore;
      grid.removeTile(tile);

      if(worstScore === false || score < worstScore) {
        worstScore = score;
        worstTile = tile;
      }
    }
  }

  grid.insertTile(worstTile);
  return Math.floor(total);
};

AI.prototype.calcScore = function(grid) {
  return this.calcScoreFromPath(this.getDescendingPath(grid));
};

AI.prototype.calcScoreFromPath = function(path) {
  var score = 0;
  for(var i = 0; i < path.length; i++) {
    if(path[i]) score += this.scoreMap[path[i].value];
  }
  return score;
};

AI.prototype.getDescendingPath = function(grid) {
  var path = [];
  var lastVal = false;

  // start in the bottom left corner and traverse row by row
  var x = 0;
  var y = grid.size - 1;

  while(grid.withinBounds({x:x, y:y})) {
    var increment = (x < 2)? 1 : -1; // go the direction that has more space
    var firstInRow = true;
    while(grid.withinBounds({x:x, y:y})) {
      var tile = grid.cells[x][y];
      if(tile && lastVal !== false && tile.value > lastVal) { // descending path is blocked
        if(firstInRow) return path; // path is dead
        break; // if we've moved laterally in this row already, we can take that move back and try going up instead
      }

      if(tile) lastVal = tile.value;

      path.push(tile);
      x += increment;
      firstInRow = false;
    }

    // x is now just outside of the bounds, or the blockage, move back to the last good path square
    x -= increment;
    y--; // and up to the next row
  }
  return path;
};

