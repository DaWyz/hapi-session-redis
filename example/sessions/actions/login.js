'use strict';

const Boom = require('@hapi/boom');
const Uuid = require('uuid');

const User = require('../../users/models/user.model');

module.exports = async (request, h) => {
  if (request.auth.isAuthenticated) {
    return 'Already logged in !';
  }

  if (!request.payload || !request.payload.email || !request.payload.password) {
    return Boom.unauthorized('Email or password invalid...');
  }

  const { id, email, name, password } = User.findByEmail(request.payload.email);
  if (request.payload.password !== password) {
    return Boom.unauthorized('Email or Password invalid...');
  }

  const sid = Uuid.v4();

  try {
    await request.redis.set(sid, {
      account: { id, email, name }
    });
    return 'Successfuly logged in !';
  } catch (err) {
    return Boom.badImplementation(err);
  }
};
