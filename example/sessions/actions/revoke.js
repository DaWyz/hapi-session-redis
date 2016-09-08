'use strict';

module.exports = (request, reply) => {
  request.redis
    .expire(request.state[request.redis.cookieName])
    .then(() => {
      return reply('logged out.');
    });
};
