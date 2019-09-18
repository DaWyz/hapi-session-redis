'use strict';

const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');

const server = new Hapi.Server({ port: 3000 });

server
  .register({
    plugin: require('../lib/')
  })
  .then((err) => {
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
      cookie: {
        ttl: 60 * 1000,
        isSecure: false
      },
      ttl: 60 * 1000
    });
    server.auth.default('default');

    require('./sessions/routes')(server);
    require('./users/routes')(server);

    server.start(() => {
      console.log('Hapi server started @', server.info.uri);
    });
  });
