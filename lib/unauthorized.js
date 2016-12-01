'use strict';

const Boom = require('boom');

module.exports = (settings, reply) => {
  if (settings.cookie.clearInvalid) {
    reply.unstate(settings.cookieName);
  }

  return reply(Boom.unauthorized('Invalid cookie.'));
};
