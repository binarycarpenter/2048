function GameManager(size, InputManager, Actuator, StorageManager, AI) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;
  this.ai             = AI ? new AI(this) : null;
  this.allowAI        = true;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("playAI", this.playAI.bind(this));
  this.inputManager.on("undo", this.undo.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.game.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

GameManager.prototype.playAI = function() {
  if(this.ai && this.allowAI) {
    var time = 1000;
    var timeEl = document.getElementById("time");
    if(timeEl && parseInt(timeEl.value) > 0) {
      time = parseInt(timeEl.value);
    }

    var moves = 1;
    var movesEl = document.getElementById("moves");
    if(movesEl && parseInt(movesEl.value) > 0) {
      moves = parseInt(movesEl.value);
    }
    this.ai.runAI(moves, time);
  }
}

GameManager.prototype.undo = function() {
  this.game.undo();
  this.actuate();
}

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.game = new Game(new Grid(previousState.grid.size, previousState.grid.cells), // Reload grid
                         previousState.score, previousState.over, previousState.won,
                         previousState.keepPlaying);
  } else {
    this.game = new Game(new Grid(this.size), 0, false, false, false);
    // Add the initial tiles
    this.game.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.game.score) {
    this.storageManager.setBestScore(this.game.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.game.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.game.serialize());
  }

  this.actuator.actuate(this.game.grid, {
    score:      this.game.score,
    over:       this.game.over,
    won:        this.game.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.game.isGameTerminated()
  });

};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  if(this.game.isLegalMove(direction)) {
    this.game.move(direction);
    this.game.addRandomTile();
    if(!this.game.movesAvailable()) {
      this.game.over = true; // Game over!
    }
    this.actuate();
  }
};


