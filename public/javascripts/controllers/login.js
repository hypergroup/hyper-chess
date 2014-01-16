/**
 * Module dependencies
 */

var cookie = require('cookie');

module.exports = function(app) {
  function LoginController($scope) {
    $scope.setSecret = function(err, res) {
      if (err) return;
      cookie('_access_token', $scope.values.secret);
      // TODO somehow refresh all of the current apis...
      window.location.reload();
    };
  }

  app.controller('LoginController', [
    '$scope',
    LoginController
  ]);
};
