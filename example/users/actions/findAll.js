'use strict';

const User = require('../../users/models/user.model');

module.exports = (request, h) => {
  return User.findAll();
};
