'use strict';

const Sequelize = require('sequelize');
const Path = require('path');

const sequelize = new Sequelize('scorekeeper-db', 'postgres', 'postgres', {
  host: 'localhost',
  dialect: 'postgres',
  pool: {
    max: 5,
    min: 0,
    idle: 10000
  }
});

const getModelPath = (filepath) => Path.join(__dirname, ...filepath);

const models = [
  ['users', 'models', 'user.model']
].map(getModelPath);

const db = {};

models
  .forEach((filepath) => {
    const model = sequelize.import(filepath);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
