'use strict';

module.exports = (server) => {
  server.route([{
    method: 'GET',
    path: '/users',
    handler: require('./actions/findAll')
  }]);
};
