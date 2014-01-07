var express = require('express');

var app = module.exports = express();

app.get('/', function(req, res) {
  res.json({
    games: {
      href: req.base + '/games'
    },
    create: {
      method: 'POST',
      action: req.base + '/',
      input: {
        name: {
          type: 'text'
        }
      }
    }
  });
});
