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
  games: createDB('games')
};

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

    json.chat = {
      href: req.base + '/games/' + req.params.game + 'chat'
    };
  }

  if (!game.opponent && game.owner !== req.user._id) {
    json.join = {
      method: 'POST',
      action: req.base + '/games/' + req.params.game
    };
  }

  res.json(json);
});

app.post('/games/:game', restrict(), function(req, res) {
  var game = res.locals.game;
  if (game.opponent) return res.send(409);
  game.opponent = req.user._id;
  game.turn = 0;
  db.games.update({_id: req.params.game}, game, function(err) {
    res.redirect(req.base + '/games/' + req.params.game);
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

