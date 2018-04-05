const path = require('path');
const express = require('express');

const mysql = require('mysql');
const inMemoryCache = require('memory-cache');
const MemCached = require('memcached');
const redis = require('redis');
const fileCache = require('flat-cache');
const PORT = process.env.PORT || 3000;

const app = express();

const connection = mysql.createPool({
    host: 'localhost',
    user: 'cachingUser',
    password: 'testuser',
    database: 'sakila'
});

/*
 * Memory Cache
 */
let inMemCache = new inMemoryCache.Cache();
let cacheMw = (duration) => {
    return (req, res, next) => {
        let key = "_sakila_film_inMem_" + req.originalUrl || req.url;
        let content = inMemCache.get(key);
        if (content) {
            res.send(content);
            return;
        } else {
            res.sendResponse = res.send;
            res.send = (body) => {
                inMemCache.put(key, body, duration * 500);
                res.sendResponse(body);
            };
            next();
        }
    }
};
app.get('/items/inMemCache', cacheMw(30), function (req, res) {
    setTimeout(() => {
        connection.getConnection(function (err, connection) {
            connection.query('SELECT * FROM film LIMIT 300', function (errors, results, fields) {
                res.send(results);
            });
            connection.release();
        });
    }, 1000);
});
/*
 * Memory Cache
 */


/*
 * File Cache
 */
let flatCache = fileCache.load('films', path.resolve('films'));
let flatCacheMW = (req, res, next) => {
    let key = "_sakila_film_file_" + req.originalUrl || req.url;
    let content = flatCache.getKey(key);
    if (content) {
        res.send(content);
    } else {
        res.sendResponse = res.send;
        res.send = (body) => {
            flatCache.setKey(key, body);
            flatCache.save();
            res.sendResponse(body);
        };
        next();
    }
};

app.get('/items/fileCache', flatCacheMW, function (req, res) {
    setTimeout(() => {
        connection.getConnection(function (err, connection) {
            connection.query('SELECT * FROM film LIMIT 300', function (errors, results, fields) {
                res.send(results);
            });
            connection.release();
        });
    }, 1000);
});
/*
 * File Cache
 */

/*
* MemcCached
* */
let memcached = new MemCached('127.0.0.1:11211');
memcached.on('failure', function( details ){ sys.error( "Server " + details.server + "went down due to: " + details.messages.join( '' ) ) });

let memcachedMw = duration => {
    return (req, res, next) => {
        let key = "_sakila_film_memcachedd_" + req.originalUrl || req.url;
        memcached.get(key, function (err, data) {
            if (data) {
                res.send(data);
                return;
            } else {
                res.sendResponse = res.send;
                res.send = body => {
                    memcached.set(key, body, duration * 120, function (err) {
                        if (err) {
                            console.log(err);
                        }
                    });
                    res.sendResponse(body);
                };
                next();
            }
        });
    };
};
app.get('/items/memCached', memcachedMw(30), function (req, res) {
    setTimeout(() => {
        connection.getConnection(function (err, connection) {
            connection.query('SELECT * FROM film LIMIT 300', function (errors, results, fields) {
                res.send(results);
            });
            connection.release();
        });
    }, 1000);
});
/*
* MemcCached
* */

/*
* Redis
* */
const redisClient = redis.createClient();
let redisMw = (req,res,next) => {
    let key = "_sakila_films_redis" + req.originalUrl || req.url;
    redisClient.get(key, function (err, response) {
        if (response) {
            res.send(response);
            return;
        } else {
            res.sendResponse = res.send;
            res.send = body => {
                redisClient.set(key, JSON.stringify(body));
                res.sendResponse(body);
            };
            next();
        }
    })
};
app.get('/items/redis', redisMw, function (req, res) {
    setTimeout(() => {
        connection.getConnection(function (err, connection) {
            connection.query('SELECT * FROM film LIMIT 300', function (errors, results, fields) {
                res.send(results);
            });
            connection.release();
        });
    }, 1000);
});
/*
* Redis
* */


/*
 * No cache at all
 */
app.get('/items', function (req, res) {
    setTimeout(() => {
        connection.getConnection(function (err, connection) {
            connection.query('SELECT * FROM film LIMIT 300', function (errors, results, fields) {
                res.send(results);
            });
            connection.release();
        });
    }, 1000);
});


app.listen(PORT, function () {
    console.log(`Running on port ${PORT}`);
});
