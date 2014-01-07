/**
 * Module dependencies
 */

var app = require('.');
var routes = require('./routes');
var envs = require('/CamShaft-envs');
var hyper = require('hyper-emitter');
var ws = require('hyper-emitter-ws');

require('./controllers/login');

/**
 * Initialize aux partials
 */

loadPartial('header');
loadPartial('sidenav');
loadPartial('footer');

/**
 * Initialize real-time stuff
 */

var WS_URL = envs('WS_URL');
if (WS_URL) hyper.use(ws({
  host: WS_URL,
  port: 80
}));

/**
 * Start the app
 */

module.exports = require('simple-ui').run(app, {
  routes: routes,
  loader: loadPartial
});

/**
 * Helper function for resolving partial paths
 *
 * @api private
 */

function loadPartial(name) {
  return require('../partials/' + name);
}
