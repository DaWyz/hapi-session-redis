'use strict';

const Unauthorized = require('./unauthorized');

module.exports = (settings, request, reply) => {
  return (redisSession) => {
    if (redisSession === null) {
      return Unauthorized(settings, reply);
    }

    const session = JSON.parse(redisSession);

    if (!settings.validateFunc) {
      if (settings.keepAlive) {
        reply.state(settings.cookieName, request.state[request.redis.cookieName]);
      }

      return reply.continue({ credentials: session, artifacts: session });
    }

    settings.validateFunc(request, session, (err, isValid, credentials) => {
      if (err || !isValid) {
        return Unauthorized(settings, reply);
      }

      if (settings.keepAlive) {
        reply.state(settings.cookieName, request.state[request.redis.cookieName]);
      }

      return reply.continue({ credentials: credentials || session, artifacts: session });
    });
  };
};
