'use strict';

const Boom = require('boom');
const Uuid = require('uuid');

const User = require('../../users/models/user.model');

module.exports = (request, reply) => {
  if (request.auth.isAuthenticated) {
    return reply('Already logged in !');
  }

  if (!request.payload || !request.payload.email || !request.payload.password) {
    return reply(Boom.unauthorized('Email or password invalid...'));
  }

  const { id, email, name, password } = User.findByEmail(request.payload.email);
  if (request.payload.password !== password) {
    return reply(Boom.unauthorized('Email or Password invalid...'));
  }

  const sid = Uuid.v4();

  request.redis
    .set(sid, {
      account: { id, email, name }
    })
    .then(() => {
      reply('Successfuly logged in !');
    })
    .catch((err) => {
      reply(Boom.badImplementation(err));
    });
};
