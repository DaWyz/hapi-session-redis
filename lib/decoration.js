'use strict';

const Boom = require('@hapi/boom');
const Hoek = require('@hapi/hoek');

module.exports = (client, settings) => {
  return (request) => ({
    cookieName: settings.cookieName,
    expire: async (key = request.state[settings.cookieName]) => {
      Hoek.assert(key, 'A key must be specified.');
      Hoek.assert(request.auth.artifacts, 'Invalid cookie.');

      try {
        await client.selectAsync(settings.redis.db);
        await client.expireAsync(`${settings.prefixKey}:${key}`, 0);

        request.auth.artifacts = null;

        if (settings.cookie.clearInvalid) {
          request.redis.h.unstate(settings.cookieName);
        }
      } catch (err) {
        throw Boom.serverUnavailable(err);
      }
    },
    get: async (key) => {
      return await client.getAsync(`${settings.prefixKey}:${key}`);
    },
    set: async (key, session) => {
      Hoek.assert(key, 'Invalid token.');
      Hoek.assert(typeof session === 'object', 'Invalid session.');
      try {
        await client.selectAsync(settings.redis.db);
        await client.setAsync(
          `${settings.prefixKey}:${key}`,
          JSON.stringify(session)
        );
        await client.expireAsync(`${settings.prefixKey}:${key}`, settings.ttl);

        request.redis.h.state(request.redis.cookieName, key);
        request.auth.artifacts = session;
      } catch (err) {
        throw Boom.serverUnavailable(err);
      }
    }
  });
};
