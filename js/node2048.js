var fs = require('fs');

eval(fs.readFileSync('ai.js') + '');
eval(fs.readFileSync('grid.js') + '');
eval(fs.readFileSync('game.js') + '');
eval(fs.readFileSync('tile.js') + '');

var fs = require('fs');

dataFile = "dataUp.csv";
var games = 1;
var aiTime = 100;
var updateInterval = process.argv[2];
while(true) {
    console.log('Starting game ' + games + '\n');
    var game = new Game(new Grid(4, false), 0, false, false, true);
    var ai = new AI(game);
    ai.runHeadless(aiTime, updateInterval);
    fs.appendFileSync(dataFile, ai.getStats());
    games++;
}
