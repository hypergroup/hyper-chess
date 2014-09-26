/**
 * Module dependencies
 */

var hyperagent = require('hyperagent');

module.exports = function(root, name, secret) {
  var client = hyperagent(root);

  client.submit('.login', {name: name, secret: secret}, function(err) {
    if (err) throw err;

    client.set('authorization', 'Bearer ' + secret);

    client('.games.open', function(err, games) {
      if (games.length !== 0) return join(games[0]);
      create();
    });
  });

  function join(game) {
    client
      .submit('game.join', {})
      .scope({game: game})
      .get(function(err, value) {
        if (err) throw err;
        console.log('Joining game: ', game);
        ready(game);
      });
  }

  function create() {
    var game = name + "'s game";
    console.log('Creating game: ' + game);
    client
      .submit('.games.create', {name: game}, function(err, value) {
        if (err) throw err;
        ready(value);
      });
  }

  function ready(game) {
    client('game.state')
      .scope({game: game})
      .get(function(err, state) {
        // no one has joined our game yet
        if (!state) return setTimeout(ready.bind(null, game), 5000);

        var shuffled = shuffle(state);
        var piece, move;
        for (var i = 0; i < shuffled.length; i++) {
          piece = shuffled[i];
          if (!piece.move) continue;
          move = piece.move;
          break;
        }
        if (!move) return setTimeout(ready.bind(null, game), 2000);

        var position = shuffle(move.input.position.options)[0].value;

        client
          .submit('move', {position: position})
          .scope({move: move})
          .get(function(err) {
            if (err) console.error(err.stack || err.message);
            setTimeout(ready.bind(null, game), 2000);
          });
      });
  }

};

function shuffle(arr) {
  return arr.sort(function() {return Math.random() > .5 ? 1 : -1;});
}
