'use strict';

const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Lab = require('@hapi/lab');

const HOST = '127.0.0.1';

const lab = (exports.lab = Lab.script());
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const startServer = async (config, callback) => {
  const server = new Hapi.Server();

  await server.register(require('../lib/'));

  server.auth.strategy('default', 'redis', config);
  server.auth.default('default');

  return server;
};

const setLoginRoute = (server, makeRedisClientFail = false) => {
  server.route({
    method: 'GET',
    path: '/login',
    config: {
      auth: false
    },
    handler: (request, h) => {
      const sid = makeRedisClientFail ? 'makeredisclientfail' : 'sessionid';

      return request.redis
        .set(sid, {
          name: 'user1'
        })
        .then(() => {
          return h
            .response('Successfuly logged in !')
            .state(request.redis.cookieName, sid);
        });
    }
  });
};

const setLogoutRoute = (server, makeRedisClientFail = false) => {
  server.route({
    method: 'GET',
    path: '/logout',
    handler: (request, h) => {
      return request.redis
        .expire(
          makeRedisClientFail
            ? 'makeredisclientfail'
            : request.state[request.redis.cookieName]
        )
        .then(() => {
          return h.response('logged out.');
        });
    }
  });
};

const setResourceRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/resource',
    handler: (request, h) => {
      expect(request.state.authentication).to.equal('sessionid');
      return h.response('resource');
    }
  });
};

describe('authentication mecanism', () => {
  if (process.env.NODE_ENV === 'functional') {
    const Mockery = require('mockery');
    Mockery.registerMock('redis', require('./mocks/redis.mock'));

    lab.beforeEach(() => {
      Mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false
      });
    });

    lab.afterEach(() => {
      Mockery.disable();
    });
  }

  it('authenticates a request', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 }
    });

    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: cookie[0].split(';')[0] }
    });
    expect(res2.statusCode).to.equal(200);
    expect(res2.headers['set-cookie']).to.not.exist();
    expect(res2.result).to.equal('resource');
  });

  it('should logout the user and return 401 when requesting resource after logout', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 }
    });
    setLoginRoute(server);
    setResourceRoute(server);
    setLogoutRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];
    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');
    const res2 = await server.inject({
      url: '/logout',
      headers: { cookie: cookie[0].split(';')[0] }
    });

    expect(res2.statusCode).to.equal(200);
    expect(res2.headers['set-cookie']).to.not.exist();
    expect(res2.result).to.equal('logged out.');

    const res3 = await server.inject({
      url: '/resource',
      headers: { cookie: cookie[0].split(';')[0] }
    });

    expect(res3.statusCode).to.equal(401);
  });

  it('should logout the user and clear the request (clearInvalid set)', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000, clearInvalid: true }
    });
    setLoginRoute(server);
    setResourceRoute(server);
    setLogoutRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];
    const authCookie = cookie[0].split(';')[0];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: authCookie }
    });
    expect(res2.statusCode).to.equal(200);
    expect(res2.headers['set-cookie']).to.not.exist();

    const res3 = await server.inject({
      url: '/logout',
      headers: { cookie: authCookie }
    });
    expect(res3.statusCode).to.equal(200);
    expect(res3.headers['set-cookie'][0]).to.equal(
      'authentication=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict'
    );
    expect(res3.result).to.equal('logged out.');
  });

  it('should return 401 when no cookie is set', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 }
    });

    setResourceRoute(server);

    const res = await server.inject({ url: '/resource' });
    expect(res.statusCode).to.equal(401);
  });

  it('should return 401 when auth cookie is invalid', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 }
    });

    setResourceRoute(server);

    const res = await server.inject({
      url: '/resource',
      headers: { cookie: 'authentication=fakecookie' }
    });
    expect(res.statusCode).to.equal(401);
  });

  it('should extend ttl automatically', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      keepAlive: true,
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 }
    });
    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];
    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: cookie[0].split(';')[0] }
    });

    const cookie2 = res2.headers['set-cookie'];
    expect(res2.statusCode).to.equal(200);
    expect(cookie2.length).to.equal(1);
    expect(cookie2[0]).to.contain('Max-Age=60');
    expect(res2.result).to.equal('resource');
  });

  it('should extend ttl automatically when validateFunc is set', async () => {
    const validateFunc = (request, session) => {
      return {
        valid: true,
        credentials: {
          username: 'tada'
        }
      };
    };

    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      keepAlive: true,
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 },
      validateFunc
    });

    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: cookie[0].split(';')[0] }
    });

    const cookie2 = res2.headers['set-cookie'];
    expect(res2.statusCode).to.equal(200);
    expect(cookie2.length).to.equal(1);
    expect(cookie2[0]).to.contain('Max-Age=60');
    expect(res2.result).to.equal('resource');
  });

  it("should return 401 when validateFunc doesn't validate the request", async () => {
    const validateFunc = (request, session) => {
      return {
        valid: false,
        credentials: { username: 'tada' }
      };
    };

    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      keepAlive: true,
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 },
      validateFunc
    });

    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: cookie[0].split(';')[0] }
    });
    expect(res2.statusCode).to.equal(401);
  });

  it('should extend ttl automatically when validateFunc is set', async () => {
    const validateFunc = (request, session) => {
      return {
        valid: true
      };
    };

    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 },
      validateFunc
    });
    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject('/login');
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: cookie[0].split(';')[0] }
    });
    expect(res2.statusCode).to.equal(200);
    expect(res2.headers['set-cookie']).to.not.exist();
    expect(res2.result).to.equal('resource');
  });

  it('should not clear a request with invalid session (clearInvalid not set)', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000 }
    });
    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject({ url: '/login' });
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: 'authentication=invalid' }
    });
    expect(res2.headers['set-cookie']).to.not.exist();
    expect(res2.statusCode).to.equal(401);
  });

  it('should clear a request with invalid session (clearInvalid set)', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000, clearInvalid: true }
    });
    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject({ url: '/login' });
    const cookie = res.headers['set-cookie'];

    expect(res.result).to.equal('Successfuly logged in !');
    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: 'authentication=invalid' }
    });

    expect(res2.statusCode).to.equal(401);
    expect(res2.headers['set-cookie'][0]).to.equal(
      'authentication=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict'
    );
  });

  it('should set SameSite to Lax', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000, clearInvalid: true, isSameSite: 'Lax' }
    });
    setLoginRoute(server);
    setResourceRoute(server);

    const res = await server.inject({
      remoteAddress: 'example.com',
      url: '/login'
    });
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie[0]).to.contain('SameSite=Lax');
  });

  it('should set Path into the cookie', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000, path: '/admin' }
    });
    setLoginRoute(server);
    setResourceRoute(server);
    const res = await server.inject({
      remoteAddress: 'example.com',
      url: '/login'
    });
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie[0]).to.contain('Path=/admin');
  });

  it('should set Domain into the cookie', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: { ttl: 60 * 1000, domain: 'example.com' }
    });
    setLoginRoute(server);
    setResourceRoute(server);
    const res = await server.inject({
      remoteAddress: 'example.com',
      url: '/login'
    });
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie[0]).to.contain('Domain=example.com');
  });

  it('should login when encryption setup to iron', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: {
        encoding: 'iron',
        password: '6toKy7VQ9T2hpKMkij808IX55mI92mN8',
        ttl: 60 * 1000
      }
    });
    setLoginRoute(server);
    setResourceRoute(server);
    const res = await server.inject({
      remoteAddress: 'example.com',
      url: '/login'
    });
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');
  });

  it('should return 400 when cookie is invalid', async () => {
    const server = await startServer({
      redis: { host: HOST, port: 6379, db: 0 },
      ttl: 60 * 1000,
      cookie: {
        encoding: 'iron',
        password: '6toKy7VQ9T2hpKMkij808IX55mI92mN8',
        ttl: 60 * 1000
      }
    });
    setLoginRoute(server);
    setResourceRoute(server);
    const res = await server.inject({
      remoteAddress: 'example.com',
      url: '/login'
    });
    expect(res.result).to.equal('Successfuly logged in !');
    const cookie = res.headers['set-cookie'];

    expect(cookie.length).to.equal(1);
    expect(cookie[0]).to.contain('Max-Age=60');

    const res2 = await server.inject({
      url: '/resource',
      headers: { cookie: 'authentication=invalid' }
    });
    expect(res2.statusCode).to.equal(400);
  });

  if (process.env.NODE_ENV === 'functional') {
    it('should fail when RedisClient returns an error', async () => {
      const server = await startServer({
        redis: { host: HOST, port: 6379, db: 0 },
        ttl: 60 * 1000,
        cookie: { ttl: 60 * 1000 }
      });

      setLoginRoute(server, true);
      setResourceRoute(server);

      const res = await server.inject('/login');
      expect(res.result.statusCode).to.equal(503);
      expect(res.result.message).to.equal(
        'Redis Client Error when calling set method'
      );
    });

    it('should fail on logout when RedisClient returns an error', async () => {
      const server = await startServer({
        redis: { host: HOST, port: 6379, db: 0 },
        ttl: 60 * 1000,
        cookie: { ttl: 60 * 1000 }
      });
      setLoginRoute(server);
      setResourceRoute(server);
      setLogoutRoute(server, true);

      const res = await server.inject('/login');

      expect(res.result).to.equal('Successfuly logged in !');
      const cookie = res.headers['set-cookie'];
      expect(cookie.length).to.equal(1);
      expect(cookie[0]).to.contain('Max-Age=60');

      const res2 = await server.inject({
        url: '/logout',
        headers: { cookie: cookie[0].split(';')[0] }
      });

      expect(res2.result.statusCode).to.equal(503);
      expect(res2.result.message).to.equal(
        'Redis Client Error when calling expire method'
      );
    });
  }
});
