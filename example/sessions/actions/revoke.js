'use strict';

const Boom = require('@hapi/boom');

module.exports = async (request, h) => {
  try {
    await request.redis.expire(request.state[request.redis.cookieName]);
    return 'logged out';
  } catch (err) {
    return Boom.badImplementation(err);
  }
};
