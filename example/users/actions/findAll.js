'use strict';

const User = require('../../database').User;

module.exports = (request, reply) => {
  reply(User.findAll());
};
