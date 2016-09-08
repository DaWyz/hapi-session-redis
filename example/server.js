'use strict';

const Hapi = require('hapi');
const Boom = require('boom');

const server = new Hapi.Server();
const Db = require('./database');

server.connection({ port: 3000 });

server.register({
  register: require('../lib/')
}, (err) => {
  if (err) {
    Boom.badImplementation('Failed to load plugin', err);
    throw err;
  }

  server.auth.strategy('default', 'redis', {
    redis: {
      host: '127.0.0.1',
      db: 0,
      port: 6379
    },
    isSecure: false,
    clearInvalid: true
  });
  server.auth.default('default');

  require('./sessions/routes')(server);
  require('./users/routes')(server);

  Db.sequelize
    .sync()
    .then(() => {
      server.start(() => {
        console.log('Hapi server started @', server.info.uri);
      });
    })
    .catch((err) => {
      console.log('Unable to connect to the database:', err);
    });
});
