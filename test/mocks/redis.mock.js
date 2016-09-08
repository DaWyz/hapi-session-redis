'use strict';

const Redis = {
  RedisClient: function (settings) {
    this.settings = settings;
    this.db = {};
    this.currentDb;
  },
  Multi: function () {}
};

Redis.createClient = (settings) => {
  return new Redis.RedisClient(settings);
};

Redis.RedisClient.prototype.select = function (dbName, callback) {
  if (this.db[dbName]) {
    this.currentDb = this.db[dbName];
    return callback(null, this.currentDb);
  }
  this.db[dbName] = {};
  this.currentDb = this.db[dbName];

  callback(null, this.currentDb);
};

Redis.RedisClient.prototype.expire = function (key, ttl, callback) {
  if (ttl === 0) {
    delete this.currentDb[key];
  }
  callback(null, key);
};

Redis.RedisClient.prototype.get = function (key, callback) {
  callback(null, this.currentDb[key] || null);
};

Redis.RedisClient.prototype.set = function (key, value, callback) {
  this.currentDb[key] = value;

  callback(null, this.currentDb);
};

Redis.RedisClient.prototype.on = function (event, action) {

};

module.exports = Redis;
