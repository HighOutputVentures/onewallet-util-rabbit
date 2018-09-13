"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = require("amqplib");
const retry = require("retry");
const debug = require("debug");
const client_1 = require("./lib/client");
const worker_1 = require("./lib/worker");
const publisher_1 = require("./lib/publisher");
const subscriber_1 = require("./lib/subscriber");
class Rabbit {
    constructor(options) {
        this.stopping = false;
        this.options = {
            uri: 'amqp://localhost',
            prefix: '',
        };
        this.channels = [];
        if (options) {
            this.options = Object.assign({}, this.options, options);
        }
        if (this.options.uri) {
            this.establishConnection();
        }
    }
    async establishConnection() {
        this.connecting = new Promise(resolve => {
            const operation = retry.operation({
                forever: true,
                factor: 2,
                minTimeout: 1000,
                maxTimeout: 10000,
                randomize: true,
            });
            operation.attempt(() => {
                amqplib_1.connect(this.options.uri)
                    .then(connection => {
                    connection.on('close', () => {
                        debug('rabbit:info')('disconnected');
                        if (!this.stopping) {
                            this.establishConnection();
                        }
                    });
                    connection.on('error', err => {
                        debug('rabbit:error')(err.message);
                    });
                    for (const channel of this.channels) {
                        channel.connection = connection;
                        channel.start();
                    }
                    debug('rabbit:info')('connected');
                    resolve(connection);
                })
                    .catch(err => {
                    debug('rabbit:error')(err.message);
                    operation.retry(err);
                });
            });
        });
    }
    async createClient(scope, options) {
        const connection = await this.connecting;
        const client = new client_1.default(connection, `${this.options.prefix}${scope}`, options);
        await client.start();
        this.channels.push(client);
        return async function (...args) {
            return client.send.apply(client, args);
        };
    }
    async createWorker(scope, handler, options) {
        const connection = await this.connecting;
        const worker = new worker_1.default(connection, `${this.options.prefix}${scope}`, handler, options);
        await worker.start();
        this.channels.push(worker);
        return worker;
    }
    async createPublisher(scope) {
        const connection = await this.connecting;
        const publisher = new publisher_1.default(connection, `${this.options.prefix}${scope}`);
        await publisher.start();
        this.channels.push(publisher);
        return async function (topic, ...args) {
            return publisher.send.apply(publisher, [topic, ...args]);
        };
    }
    async createSubscriber(scope, handler, options) {
        const connection = await this.connecting;
        const subscriber = new subscriber_1.default(connection, `${this.options.prefix}${scope}`, handler, options);
        await subscriber.start();
        this.channels.push(subscriber);
        return subscriber;
    }
    async stop() {
        this.stopping = true;
        await Promise.all(this.channels.map(channel => channel.stop()));
        if (this.connection) {
            await this.connection.close();
        }
    }
}
exports.default = Rabbit;
//# sourceMappingURL=index.js.map