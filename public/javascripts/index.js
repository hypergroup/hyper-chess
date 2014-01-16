/**
 * Module dependencies
 */

var app = module.exports = require('simple-ui')('hyper-chess', [
  require('ng-hyper-emitter-ws').name
], require);

/**
 * Initialize the controller
 */

app.initController('login');

/**
 * Start the app
 */

app.start(function($injector) {
  var emitter = $injector.get('hyperEmitterWs');
  emitter({port: 80, host: 'hyper-emitter.herokuapp.com'});
});
