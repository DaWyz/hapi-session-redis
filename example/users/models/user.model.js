'use strict';

const users = [{
  id: 1,
  email: 'john@company.com',
  password: 'supersafe',
  name: 'John'
}, {
  id: 2,
  email: 'jack@company.com',
  password: 'megasafe',
  name: 'Jack'
}];

module.exports = {
  findAll: () => (users.map((user) => ({ id: user.id, email: user.email, name: user.name }))),
  findByEmail: (email) => (
    users
    .find((user) => user.email === email)
  )
};
