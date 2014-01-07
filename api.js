var express = require('express');
var uuid = require('uuid').v4;

var app = module.exports = express();

app.use(express.json());
app.use(express.urlencoded());

app.use(function(req, res, next) {
  req.base = req.base + '/api';
  next();
});

var tokens = {};
app.use(function(req, res, next) {
  var token = (req.get('authorization') || '').replace('Bearer ', '');
  if (!token) return next();
  var user = tokens[token];
  if (!user) return res.send(401);
  req.user = users[user];
  next();
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

var games = {};
app.get('/games', restrict(), function(req, res) {
  res.json({
    data: Object.keys(games).map(function(id) {
      return {
        href: req.base + '/games/' + id
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

app.post('/games', restrict(), function(req, res, next) {
  var game = req.body;
  if (!game.name) return next(new Error('request missing "name" parameter'));
  var id = uuid();
  games[id] = {
    name: game.name,
    owner: req.user.id
  };
  res.redirect(303, req.base + '/games/' + id);
});

app.param('game', function(req, res, next, id) {
  if (!games[id]) return res.send(404);
  res.locals.game = games[id];
  next();
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

    json.chat = {
      href: req.base + '/games/' + req.params.game + 'chat'
    };
  } else if (game.owner !== req.user.id) {
    json.join = {
      method: 'POST',
      action: req.base + '/games/' + req.params.game
    };
  }

  res.json(json);
});

app.post('/games/:game', restrict(), function(req, res) {
  if (res.locals.game.opponent) return res.send(409);
  res.locals.game.oppponent = res.user.id;
  res.locals.game.turn = 0;
  res.redirect(req.base + '/games/' + req.params.game);
});

var users = {};

app.get('/users', function(req, res) {
  res.json({
    data: [] // TODO
  });
});

app.post('/users', function(req, res, next) {
  var user = req.body;
  if (!user) return next(new Error('missing body'));
  if (!user.name) return next(new Error('missing name'));
  if (!user.secret) return next(new Error('missing secret'));
  var id = uuid();
  users[id] = {
    name: user.name,
    secret: user.secret
  };
  tokens[user.secret] = id;
  res.redirect(303, req.base + '/users/' + id);
});

app.param('user', function(req, res, next, id) {
  var user = users[id];
  if (!user) return res.send(404);
  res.locals.user = user;
  next();
});

app.get('/users/:user', function(req, res) {
  var user = res.locals.user;

  var json = {
    name: user.name,
    wins: user.wins || 0,
    losses: user.losses || 0
  };

  if (req.user && req.user.id === req.params.user) {
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

