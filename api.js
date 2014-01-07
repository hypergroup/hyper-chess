var express = require('express');
var NeDB = require('nedb');
var Chess = require('chess.js').Chess;
var superagent = require('superagent');
var envs = require('envs');

function createDB(name) {
  return new NeDB({
    filename: __dirname + '/' + name + '.db',
    autoload: true
  });
}

var db = {
  users: createDB('users'),
  games: createDB('games'),
  state: createDB('state')
};

var EMITTER_URL = envs('EMITTER_URL');
function notify(url, fn) {
  fn = fn || function(){};
  if (!EMITTER_URL) return fn();
  superagent
    .post(EMITTER_URL)
    .send({url: url})
    .end(function(err, res) {
      fn(err);
    });
}

var app = module.exports = express();

app.use(express.json());
app.use(express.urlencoded());

app.use(function(req, res, next) {
  req.base = req.base + '/api';
  var url = req.base + (req.url === '/' ? '' : req.url);
  var json = res.json;
  res.json = function(obj) {
    obj.href = url;
    json.call(res, obj);
  };
  next();
});

app.use(function(req, res, next) {
  var token = (req.get('authorization') || '').replace('Bearer ', '');
  if (!token) return next();
  db.users.findOne({secret: token}, function(err, user) {
    if (err) return next(err);
    if (!user) return res.send(401);
    req.user = user;
    next();
  });
});

app.get('/', function(req, res, next) {
  if (!req.user) return next('route');
  res.json({
    games: {
      href: req.base + '/games'
    }
  });
});

app.get('/', function(req, res) {
  res.send({
    login: {
      method: 'POST',
      action: req.base + '/users',
      input: {
        name: {
          type: 'text',
          required: true
        },
        secret: {
          type: 'password',
          required: true
        }
      }
    }
  });
});

app.get('/games', restrict(), function(req, res, next) {
  db.games.find({}, function(err, games) {
    if (err) return next(err);
    res.json({
      data: games.map(function(game) {
        return {
          href: req.base + '/games/' + game._id
        };
      }),
      create: {
        method: 'POST',
        action: req.base + '/games',
        input: {
          name: {
            type: 'text'
          }
        }
      }
    });
  });
});

app.post('/games', restrict(), function(req, res, next) {
  var game = req.body;
  if (!game.name) return next(new Error('request missing "name" parameter'));
  var data = {
    name: game.name,
    white: req.user._id
  };
  db.games.insert(data, function(err, doc) {
    if (err) return next(err);
    var url = req.base + '/games/' + doc._id;
    notify(url);
    res.redirect(303, url);
  });
});

app.param('game', function(req, res, next, id) {
  db.games.findOne({_id: id}, function(err, game) {
    if (err) return next(err);
    if (!game) return res.send(404);
    res.locals.game = game;
    next();
  });
});

app.get('/games/:game', restrict(), function(req, res) {
  var game = res.locals.game;

  var json = {
    name: game.name,
    white: {
      href: req.base + '/users/' + game.white
    }
  };

  if (game.black) {
    json.black = {
      href: req.base + '/users/' + game.black
    };

    json.state = {
      href: req.base + '/games/' + req.params.game + '/state'
    };
  }

  if (!game.black && game.white !== req.user._id) {
    json.join = {
      method: 'POST',
      action: req.base + '/games/' + req.params.game
    };
  }

  if (game.black === req.user._id || game.white === req.user._id) {
    json.chat = {
      href: req.base + '/games/' + req.params.game + '/chat'
    };
  }

  res.json(json);
});

app.post('/games/:game', restrict(), function(req, res, next) {
  var game = res.locals.game;
  // There's probably a race condition here
  if (game.black) return res.send(409);
  game.black = req.user._id;
  db.games.update({_id: req.params.game}, game, function(err) {
    var state = {
      board: (new Chess()).fen(),
      game: game._id
    };
    db.state.insert(state, function(err) {
      if (err) return next(err);
      var url = req.base + '/games/' + req.params.game;
      notify(url);
      res.redirect(url);
    });
  });
});

app.get('/games/:game/state', function(req, res, next) {
  db.state.findOne({game: req.params.game}, function(err, state) {
    if (err) return next(err);
    if (!state) return res.send(404);

    var game = res.locals.game;
    var isWhite = game.white === req.user._id;
    var isBlack = game.black === req.user._id;

    var board = new Chess(state.board);

    var turn = board.turn();

    var pieces = [];
    board.SQUARES.forEach(function(square) {
      var piece = board.get(square);
      if (!piece) return;
      var json = {
        position: square,
        type: piece.type,
        color: piece.color
      };
      if (isWhite && turn === 'w' && json.color === 'w'
       || isBlack && turn === 'b' && json.color === 'b') {
        var moves = board.moves({square: json.position});
        if (moves.length) {
          json.move = {
            method: 'POST',
            action: req.base + '/games/' + req.params.game + '/state',
            input: {
              position: {
                type: 'select',
                options: moves.map(function(move) {
                  return {
                    value: move,
                    text: move
                  };
                })
              }
            }
          };
        }
      };
      pieces.push(json);
    });

    res.json({
      data: pieces,
      turn: turn,
      check: board.in_check(),
      checkmake: board.in_checkmate(),
      draw: board.in_draw(),
      stalemate: board.in_stalemate(),
      threefold: board.in_threefold_repetition()
    });
  });
});

app.post('/games/:game/state', function(req, res, next) {
  var game = res.locals.game;
  if (!req.body || !req.body.position) return next(new Error('missing position parameter'));
  db.state.findOne({game: req.params.game}, function(err, state) {
    if (err) return next(err);
    if (!state) return res.send(404);

    var isWhite = game.white === req.user._id;
    var isBlack = game.black === req.user._id;

    var board = new Chess(state.board);
    var turn = board.turn();

    if (turn === 'w' && isBlack
     || turn === 'b' && isWhite) return res.send(409);

    var result = board.move(req.body.position);
    if (!result) return next(new Error('bad move'));

    // TODO check ending conditions

    db.state.update({_id: state._id}, {$set: {board: board.fen()}}, function(err) {
      var url = req.base + '/games/' + req.params.game + '/state';
      notify(url);
      res.redirect(url);
    });
  });
});

app.get('/users', function(req, res, next) {
  db.users.find({}, function(err, users) {
    if (err) return next(err);
    res.json({
      data: users.map(function(user) {
        return {
          href: req.base + '/users/' + user._id
        };
      })
    });
  });
});

app.post('/users', function(req, res, next) {
  var user = req.body;
  if (!user) return next(new Error('missing body'));
  if (!user.name) return next(new Error('missing name'));
  if (!user.secret) return next(new Error('missing secret'));
  var user = {
    name: user.name,
    secret: user.secret
  };
  db.users.insert(user, function(err, doc) {
    var url = req.base + '/users/' + doc._id;
    notify(url);
    res.redirect(303, url);
  });
});

app.param('user', function(req, res, next, id) {
  db.users.findOne({_id: id}, function(err, user) {
    if (err) return next(err);
    if (!user) return res.send(404);
    res.locals.user = user;
    next();
  });
});

app.get('/users/:user', function(req, res) {
  var user = res.locals.user;

  var json = {
    name: user.name,
    wins: user.wins || 0,
    losses: user.losses || 0
  };

  if (req.user && req.user._id === req.params.user) {
    json.update = {
      method: 'PUT',
      action: req.base + '/users/' + req.params.user,
      input: {
        name: {
          type: 'text',
          required: true,
          value: user.name
        },
        secret: {
          type: 'password',
          required: true,
          value: user.secret
        }
      }
    };
  }
  res.json(json);
});

function restrict() {
  return function(req, res, next) {
    if (!req.user) return res.send(401);
    next();
  };
}
