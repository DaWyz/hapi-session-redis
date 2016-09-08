'use strict';

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

const startServer = (config, callback) => {
  const server = new Hapi.Server();
  server.connection();
  server.register(require('../lib/'), (err) => {
    expect(err).to.not.exist();
    server.auth.strategy('default', 'redis', config);
    server.auth.default('default');
    callback(server);
  });
};

const setLoginRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/login',
    config: {
      auth: false
    },
    handler: (request, reply) => {
      const sid = 'sessionid';

      request.redis
        .set(sid, {
          name: 'user1'
        })
        .then(() => {
          reply('Successfuly logged in !').state(request.redis.cookieName, sid);
        });
    }
  });
};

const setLogoutRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/logout',
    handler: (request, reply) => {
      request.redis
        .expire(request.state[request.redis.cookieName])
        .then(() => {
          return reply('logged out.');
        });
    }
  });
};

const setResourceRoute = (server) => {
  server.route({
    method: 'GET',
    path: '/resource',
    handler: (request, reply) => {
      expect(request.state.authentication).to.equal('sessionid');
      return reply('resource');
    }
  });
};

describe('authentication mecanism', () => {
  it('authenticates a request', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000 }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(res2.headers['set-cookie']).to.not.exist();
          expect(res2.result).to.equal('resource');
          done();
        });
      });
    });
  });

  it('should logout the user and return 401 when requesting resource after logout', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000 }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);
      setLogoutRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];
        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');
        server.inject({ url: '/logout', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(res2.headers['set-cookie']).to.not.exist();
          expect(res2.result).to.equal('logged out.');

          server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res3) => {
            expect(res3.statusCode).to.equal(401);
            done();
          });
        });
      });
    });
  });

  it('should logout the user and clear the request (clearInvalid set)', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000, clearInvalid: true }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);
      setLogoutRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];
        const authCookie = cookie[0].split(';')[0];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: authCookie } }, (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(res2.headers['set-cookie']).to.not.exist();

          server.inject({ url: '/logout', headers: { cookie: authCookie } }, (res3) => {
            expect(res3.statusCode).to.equal(200);
            expect(res3.headers['set-cookie'][0]).to.equal('authentication=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict');
            expect(res3.result).to.equal('logged out.');
            done();
          });
        });
      });
    });
  });

  it('should return 401 when no cookie is set', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000 }, (server) => {
      setResourceRoute(server);

      server.inject({ url: '/resource' }, (res) => {
        expect(res.statusCode).to.equal(401);
        done();
      });
    });
  });

  it('should return 401 when auth cookie is invalid', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000 }, (server) => {
      setResourceRoute(server);

      server.inject({ url: '/resource', headers: { cookie: 'authentication=fakecookie' } }, (res) => {
        expect(res.statusCode).to.equal(401);
        done();
      });
    });
  });

  it('should extend ttl automatically', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, keepAlive: true, ttl: 60 * 1000 }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(cookie.length).to.equal(1);
          expect(cookie[0]).to.contain('Max-Age=60');
          expect(res2.result).to.equal('resource');
          done();
        });
      });
    });

  });

  it('should extend ttl automatically when validateFunc is set', (done) => {
    const validateFunc = (request, session, callback) => {
      callback(null, true, { username: 'tada' });
    };

    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, keepAlive: true, ttl: 60 * 1000, validateFunc }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(cookie.length).to.equal(1);
          expect(cookie[0]).to.contain('Max-Age=60');
          expect(res2.result).to.equal('resource');
          done();
        });
      });
    });
  });

  it('should return 401 when validateFunc doesn\'t validate the request', (done) => {
    const validateFunc = (request, session, callback) => {
      callback(null, false, { username: 'tada' });
    };

    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, keepAlive: true, ttl: 60 * 1000, validateFunc }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(401);
          done();
        });
      });
    });
  });

  it('should return 401 when validateFunc return an error', (done) => {
    const validateFunc = (request, session, callback) => {
      callback({ error: 'failing' }, true, { username: 'tada' });
    };

    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, keepAlive: true, ttl: 60 * 1000, validateFunc }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(401);
          done();
        });
      });
    });
  });

  it('should extend ttl automatically when validateFunc is set', (done) => {
    const validateFunc = (request, session, callback) => {
      callback(null, true);
    };

    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000, validateFunc }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);

      server.inject('/login', (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');

        server.inject({ url: '/resource', headers: { cookie: cookie[0].split(';')[0] } }, (res2) => {
          expect(res2.statusCode).to.equal(200);
          expect(res2.headers['set-cookie']).to.not.exist();
          expect(res2.result).to.equal('resource');
          done();
        });
      });
    });
  });

  it('should not clear a request with invalid session (clearInvalid not set)', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000 }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);
      server.inject({ url: '/login' }, (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');
        server.inject({ url: '/resource', headers: { cookie: 'authentication=invalid' } }, (res2) => {
          expect(res2.headers['set-cookie']).to.not.exist();
          expect(res2.statusCode).to.equal(401);
          done();
        });
      });
    });
  });

  it('should clear a request with invalid session (clearInvalid set)', (done) => {
    startServer({ redis: { host: '127.0.0.1', port: 6379, db: 0 }, ttl: 60 * 1000, clearInvalid: true }, (server) => {
      setLoginRoute(server);
      setResourceRoute(server);
      server.inject({ url: '/login' }, (res) => {
        expect(res.result).to.equal('Successfuly logged in !');
        const cookie = res.headers['set-cookie'];

        expect(cookie.length).to.equal(1);
        expect(cookie[0]).to.contain('Max-Age=60');
        server.inject({ url: '/resource', headers: { cookie: 'authentication=invalid' } }, (res2) => {
          expect(res2.headers['set-cookie'][0]).to.equal('authentication=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Strict');
          expect(res2.statusCode).to.equal(401);
          done();
        });
      });
    });
  });
});
