'use strict';

const Bcrypt = require('bcrypt');
const Boom = require('boom');
const Hoek = require('hoek');

const User = require('../../database').User;

module.exports = (request, reply) => {
  Bcrypt
    .hash(request.payload.password, 10, (err, hashedPassword) => {
      Hoek.assert(!err, err);

      User
        .create({
          name: request.payload.name,
          email: request.payload.email,
          password: hashedPassword
        })
        .then(reply)
        .catch((err) => {
          reply(Boom.conflict(err));
        });
    });
};
