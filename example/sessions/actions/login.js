'use strict';

const Bcrypt = require('bcrypt');
const Boom = require('boom');
const Uuid = require('uuid');

const User = require('../../database').User;

module.exports = () => {
  return (request, reply) => {
    if (request.auth.isAuthenticated) {
      return reply('Already logged in !');
    }

    if (!request.payload || !request.payload.email || !request.payload.password) {
      return reply(Boom.unauthorized('Email or password invalid...'));
    }

    User
      .findOne({
        where: {
          email: request.payload.email
        }
      })
      .then(({ id, email, name, password }) => {
        Bcrypt.compare(request.payload.password, password, (err, isValid) => {
          if (!isValid || err) {
            return reply(Boom.unauthorized('Email or Password invalid...'));
          }

          const sid = Uuid.v4();

          request.redis
            .set(sid, {
              account: { id, email, name }
            })
            .then(() => {
              reply('Successfuly logged in !').state(request.redis.cookieName, sid);
            })
            .catch((err) => {
              reply(Boom.badImplementation(err));
            });
        });
      })
      .catch(() => {
        reply(Boom.unauthorized('Email or Password invalid...'));
      });
  };
};
