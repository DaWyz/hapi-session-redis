'use strict';

const User = require('../../users/models/user.model');

module.exports = (request, reply) => {
  reply(User.findAll());
};
