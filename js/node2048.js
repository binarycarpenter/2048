var fs = require('fs');

eval(fs.readFileSync('ai.js') + '');
eval(fs.readFileSync('grid.js') + '');
eval(fs.readFileSync('game.js') + '');
eval(fs.readFileSync('tile.js') + '');

/*
AI.prototype.defaultConfig = {
  scoreMapMultiplier: 2.5,
  addRecursiveScores: true,
  evalWithWorst: true,
  emptyCellInPathPenalty: 0,
  maxTime: 100
}; */

var fs = require('fs');
var properties = [{},
                  {scoreMapMultiplier:2.1},
                  {scoreMapMultiplier:2},
                  {evalWithWorst:false},
                  {maxTime:300},
                  {addRecursiveScores:false},
                  {emptyCellInPathPenalty: 6}];
var games = 1;
while(true) {
  for(var i = 0; i < properties.length; i++) {
    console.log('Starting game ' + games + '\n');
    var game = new Game(new Grid(4, false), 0, false, false, true);
    var ai = new AI(game, properties[i]);
    ai.runHeadless();
    fs.appendFileSync("data.csv", ai.getStats());
    games++;
  }
}
