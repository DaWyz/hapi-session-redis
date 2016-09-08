'use strict';

const Unauthorized = require('./unauthorized');
const Validation = require('./validation');

module.exports = (client = {}, settings = {}) => ({
  authenticate: (request, reply) => {
    const cookie = request.state[request.redis.cookieName];
    if (!cookie) {
      return Unauthorized(settings, reply);
    }

    client
      .selectAsync(settings.redis.db)
      .then(() => {
        return request.redis.get(cookie);
      })
      .then(Validation(settings, request, reply))
      .catch(() => {
        Unauthorized(settings, reply);
      });
  }
});
