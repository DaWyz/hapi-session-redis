'use strict';

const Unauthorized = require('./unauthorized');
const Validation = require('./validation');

module.exports = (client = {}, settings = {}) => ({
  authenticate: async (request, h) => {
    const cookie = request.state[request.redis.cookieName];
    if (!cookie) {
      return h.unauthenticated(Unauthorized(settings, h));
    }

    await client.selectAsync(settings.redis.db);

    const cookieValue = await request.redis.get(cookie);

    const validate = Validation(settings, request, h);

    return await validate(cookieValue);
  }
});
