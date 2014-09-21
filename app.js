/**
 * Module dependencies
 */

var stack = require('poe-ui');
var envs = require('envs');

/**
 * Expose the app
 */

var app = module.exports = stack({
  restricted: false // TODO enable this
});

/**
 * Setup app-wide locals
 */

app.env('API_URL', '/api');
app.env('EMITTER_URL', envs('EMITTER_URL'));

app.useBefore('router', '/api', require('./api'));
