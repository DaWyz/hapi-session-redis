'use strict';

const Boom = require('@hapi/boom');

module.exports = (settings, h) => {
  if (settings.cookie.clearInvalid) {
    h.unstate(settings.cookieName);
  }

  return Boom.unauthorized('Invalid cookie.');
};
