function GameManager(size, InputManager, Actuator, StorageManager, AI) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;
  this.allowAI        = true;
  this.aiMS           = 100;
  this.AIrunning      = false;
  this.pastStates     = [];
  this.maxPastStates  = 0;
  this.loadSaved      = false;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("playAI", this.playAI.bind(this));
  this.inputManager.on("undo", this.undo.bind(this));
  this.inputManager.on("oneMove", this.oneMove.bind(this));

  this.setup();
};

GameManager.prototype.saved = {score: 1811336,
                               grid: [[2,2,8,16],
                                      [256,128,64,32],
                                      [512,1024,2048,4096],
                                      [65536,32768,16384,8192]]
                              };

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
    if(this.AIrunning) { // already running, so it was actually the stop button that was clicked
      this.stopAI();
    }
    else {
      this.AIrunning = true;
      this.actuator.setRunButton("Stop AI");
      this.actuate();
      this.makeAIMove();
    }
  }
};

GameManager.prototype.makeAIMove = function() {
  if(!this.game.over && this.AIrunning) {
    this.move(this.ai.getBestMove(this.aiMS));
    var self = this;
    setTimeout(function(){ self.makeAIMove(); }, 125); // allow ui to update
  }
  else this.stopAI();
};

GameManager.prototype.oneMove = function() {
  if(!this.ai || this.AIrunning || !this.allowAI) return;
  this.move(this.ai.getBestMove(this.aiMS));
};

GameManager.prototype.stopAI = function() {
  this.AIrunning = false;
  this.actuator.setRunButton("Run AI");
};

GameManager.prototype.undo = function() {
  var lastState = this.pastStates[0];
  if(lastState) {
    this.pastStates = this.pastStates.splice(1, this.maxPastStates);
    this.game = lastState;
    this.actuate();
  }
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  if(this.loadSaved) {
    this.game = new Game(new Grid(this.size, this.saved.grid), this.saved.score, false, false, true);
  }
  // Reload the game from a previous game if present
  else if (previousState) {
    this.game = new Game(new Grid(previousState.grid.size, previousState.grid.cells), // Reload grid
                         previousState.score, previousState.over, previousState.won,
                         previousState.keepPlaying);
  }
  else {
    this.game = new Game(new Grid(this.size, false), 0, false, false, true);
    // Add the initial tiles
    this.game.addStartTiles();
  }

  this.ai = AI ? new AI(this.game) : null;
  // Update the actuator
  this.actuate();

  this.playAI();
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
    pathCells:  this.ai.getPathCells(this.game.grid),
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
    this.pastStates.unshift(this.game.clone());
    this.pastStates = this.pastStates.splice(0, this.maxPastStates);
    this.game.move(direction);
    this.game.computerMove();
    if(!this.game.movesAvailable()) {
      this.game.over = true; // Game over!
    }
    this.actuate();
  }
};


