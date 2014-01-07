var express = require('express');
var NeDB = require('nedb');

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

var init = [
  {'position': 'a1', 'piece': 'rook', player: 0},
  {'position': 'b1', 'piece': 'knight', player: 0},
  {'position': 'c1', 'piece': 'bishop', player: 0},
  {'position': 'd1', 'piece': 'king', player: 0},
  {'position': 'e1', 'piece': 'queen', player: 0},
  {'position': 'f1', 'piece': 'bishop', player: 0},
  {'position': 'g1', 'piece': 'knight', player: 0},
  {'position': 'h1', 'piece': 'rook', player: 0},
  {'position': 'a2', 'piece': 'pawn', player: 0},
  {'position': 'b2', 'piece': 'pawn', player: 0},
  {'position': 'c2', 'piece': 'pawn', player: 0},
  {'position': 'd2', 'piece': 'pawn', player: 0},
  {'position': 'e2', 'piece': 'pawn', player: 0},
  {'position': 'f2', 'piece': 'pawn', player: 0},
  {'position': 'g2', 'piece': 'pawn', player: 0},
  {'position': 'h2', 'piece': 'pawn', player: 0},
  {'position': 'a7', 'piece': 'pawn', player: 1},
  {'position': 'b7', 'piece': 'pawn', player: 1},
  {'position': 'c7', 'piece': 'pawn', player: 1},
  {'position': 'd7', 'piece': 'pawn', player: 1},
  {'position': 'e7', 'piece': 'pawn', player: 1},
  {'position': 'f7', 'piece': 'pawn', player: 1},
  {'position': 'g7', 'piece': 'pawn', player: 1},
  {'position': 'h7', 'piece': 'pawn', player: 1},
  {'position': 'a8', 'piece': 'rook', player: 1},
  {'position': 'b8', 'piece': 'knight', player: 1},
  {'position': 'c8', 'piece': 'bishop', player: 1},
  {'position': 'd8', 'piece': 'king', player: 1},
  {'position': 'e8', 'piece': 'queen', player: 1},
  {'position': 'f8', 'piece': 'bishop', player: 1},
  {'position': 'g8', 'piece': 'knight', player: 1},
  {'position': 'h8', 'piece': 'rook', player: 1}
];

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
    owner: req.user._id
  };
  db.games.insert(data, function(err, doc) {
    if (err) return next(err);
    res.redirect(303, req.base + '/games/' + doc._id);
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
    owner: {
      href: req.base + '/users/' + game.owner
    }
  };

  if (game.opponent) {
    json.opponent = {
      href: req.base + '/users/' + game.opponent
    };

    json.state = {
      href: req.base + '/games/' + req.params.game + '/state'
    };
  }

  if (!game.opponent && game.owner !== req.user._id) {
    json.join = {
      method: 'POST',
      action: req.base + '/games/' + req.params.game
    };
  }

  if (game.opponent === req.user._id || game.owner === req.user._id) {
    json.chat = {
      href: req.base + '/games/' + req.params.game + '/chat'
    };
  }

  res.json(json);
});

app.post('/games/:game', restrict(), function(req, res, next) {
  var game = res.locals.game;
  // There's probably a race condition here
  if (game.opponent) return res.send(409);
  game.opponent = req.user._id;
  db.games.update({_id: req.params.game}, game, function(err) {
    var state = {
      turn: 0,
      pieces: init,
      game: game._id
    };
    db.state.insert(state, function(err) {
      if (err) return next(err);
      res.redirect(req.base + '/games/' + req.params.game);
    });
  });
});

app.get('/games/:game/state', function(req, res, next) {
  db.state.findOne({game: req.params.game}, function(err, state) {
    if (err) return next(err);
    if (!state) return res.send(404);

    var game = res.locals.game;
    var isOwner = game.owner === req.user._id;
    var isOpp = game.opponent === req.user._id;
    res.json({
      data: state.pieces.map(function(piece) {
        var pstate = {
          type: piece.piece,
          position: piece.position,
          player: {
            href: req.base + '/users/' + (piece.player ? game.opponent : game.owner)
          }
        };

        if (isOwner && piece.player === 0 && state.turn % 2 === 0
           || isOpp && piece.player === 1 && state.turn % 2 === 1) {
          pstate.move = {
            action: req.base + '/games/' + req.params.game + '/state',
            method: 'POST',
            input: {
              prev: {
                value: pstate.position,
                type: 'hidden'
              },
              position: {
                type: 'select',
                options: computeMoves(piece, state.pieces)
              }
            }
          };
        }

        return pstate;
      }),
      turn: state.turn
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
    res.redirect(303, req.base + '/users/' + doc._id);
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

function computeMoves(piece, pieces) {
  return [];
}
