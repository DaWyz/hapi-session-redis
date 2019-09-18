'use strict';

const Unauthorized = require('./unauthorized');

module.exports = (settings, request, h) => {
  return async (redisSession) => {
    if (redisSession === null) {
      return h.unauthenticated(Unauthorized(settings, h));
    }

    const session = JSON.parse(redisSession);
    if (!settings.validateFunc) {
      if (settings.keepAlive) {
        h.state(settings.cookieName, request.state[request.redis.cookieName]);
      }

      return h.authenticated({ credentials: session, artifacts: session });
    }

    const { valid, credentials } = await settings.validateFunc(
      request,
      session
    );

    if (!valid) {
      return h.unauthenticated(Unauthorized(settings, h));
    }

    if (settings.keepAlive) {
      h.state(settings.cookieName, request.state[request.redis.cookieName]);
    }

    return h.authenticated({
      credentials: credentials || session,
      artifacts: session
    });
  };
};
