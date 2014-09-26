/**
 * Module dependencies
 */

var App = require('poe-ui');

/**
 * Expose the app
 */

var app = module.exports = App('hyper-chess');

app.use(require('ng-hyper-emitter-ws'));

app.configure(function($injector) {
  var emitter = $injector.get('hyperEmitterWs');
  emitter({port: 80, host: 'hyper-emitter.herokuapp.com'});
});
