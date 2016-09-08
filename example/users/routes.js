'use strict';

module.exports = (server) => {
  server.route([{
    method: 'GET',
    path: '/users',
    handler: require('./actions/findAll')
  }, {
    method: 'POST',
    path: '/users',
    config: {
      auth: false
    },
    handler: require('./actions/create')
  }]);
};
