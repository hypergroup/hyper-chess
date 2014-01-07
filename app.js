/**
 * Module dependencies
 */

var stack = require('simple-stack-ui');
var envs = require('envs');

/**
 * Expose the app
 */

var app = module.exports = stack({
  restricted: false
});

/**
 * Setup app-wide locals
 */

app.env('API_URL', '/api');
app.env('WS_URL', envs('EMITTER_URL'));

/**
 * Mount the api
 */

app.useBefore('router', '/api', require('./api'));
