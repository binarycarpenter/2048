function Game(grid, score, over, won, keepPlaying) {
  this.grid        = grid;
  this.score       = score;
  this.over        = over;
  this.won         = won;
  this.keepPlaying = keepPlaying;
  this.startTiles  = 2;
  this.size        = this.grid.size;
}

// Return true if the game is lost, or has won and the user hasn't kept playing
Game.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
    return true;
  } else {
    return false;
  }
};

// Set up the initial tiles to start the game with
Game.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
Game.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Save all tile positions and remove merger info
Game.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
Game.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

Game.prototype.move = function(direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return false; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  if(!vector || !traversals || !traversals.x || !traversals.y) {
    console.log("bad vector!");
  }

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved && !this.movesAvailable()) {
    this.over = true; // Game over!
  }
  return moved;
};  

// Get the vector representing the chosen direction
Game.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
Game.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.grid.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

Game.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

Game.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
Game.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

Game.prototype.undo = function() {
  var cells = this.grid.empty();
  var hasPreviousData = false;
  for(var x = 0; x < this.size; x++) {
    for(var y = 0; y < this.size; y++) {
      var tile = this.grid.cells[x][y];
      if(tile) {
        if(tile.mergedFrom) {
          hasPreviousData = true;
          this.score -= tile.value;
          tile0 = tile.mergedFrom[0];
          tile1 = tile.mergedFrom[1];
          cells[tile0.previousPosition.x][tile0.previousPosition.y] =
            new Tile({x:tile0.previousPosition.x, y:tile0.previousPosition.y}, tile0.value);
          cells[tile1.previousPosition.x][tile1.previousPosition.y] =
            new Tile({x:tile1.previousPosition.x, y:tile1.previousPosition.y}, tile1.value);
        }
        else if(tile.previousPosition) {
          hasPreviousData = true;
          cells[tile.previousPosition.x][tile.previousPosition.y] =
            new Tile({x:tile.previousPosition.x, y:tile.previousPosition.y}, tile.value);
        }
      }
    }
  }
  if(hasPreviousData) this.grid.cells = cells;
}

Game.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

Game.prototype.clone = function() {
  return new Game(this.grid.clone(), this.score, this.over, this.won, this.keepPlaying);
}

// Represent the current game as an object
Game.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};


