"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const TaskQueue = require("p-queue");
const debug = require("debug");
const delay_1 = require("./delay");
const error_1 = require("./error");
class Client {
    constructor(connection, queue, options) {
        this.connection = connection;
        this.queue = queue;
        this.options = {
            timeout: 60000,
            noResponse: false,
        };
        if (options) {
            this.options = Object.assign({}, this.options, options);
        }
        this.callback = `callback.${uuid_1.v1().replace('-', '')}`;
        this.callbacks = new Map();
        this.taskQueue = new TaskQueue();
    }
    async send(...args) {
        return this.taskQueue.add(async () => {
            const correlationId = uuid_1.v1().replace(/-/g, '');
            const request = {
                correlationId,
                arguments: args,
                noResponse: this.options.noResponse,
                timestamp: Date.now(),
            };
            debug('rabbit:client:request')(request);
            await this.channel.sendToQueue(this.queue, new Buffer(JSON.stringify(request)), {
                correlationId,
                replyTo: this.callback,
                persistent: true,
                expiration: this.options.timeout,
            });
            if (this.options.noResponse) {
                return;
            }
            let callback;
            const promise = new Promise((resolve, reject) => {
                callback = { resolve, reject };
            });
            this.callbacks.set(correlationId, callback);
            return Promise.race([
                promise,
                (async () => {
                    await delay_1.default(this.options.timeout);
                    this.callbacks.delete(correlationId);
                    throw new error_1.default('TIMEOUT', 'Request timeout.', {
                        queue: this.queue,
                        arguments: args,
                    });
                })(),
            ]);
        });
    }
    async start() {
        this.channel = await this.connection.createChannel();
        if (this.options.noResponse) {
            return;
        }
        await this.channel.assertQueue(this.callback, {
            messageTtl: this.options.timeout,
            expires: 600000,
            durable: true,
        });
        await this.channel.consume(this.callback, async (message) => {
            if (!message) {
                return;
            }
            const { properties: { correlationId }, } = message;
            const response = JSON.parse(message.content.toString());
            debug('rabbit:client:response')(response);
            const callback = this.callbacks.get(correlationId);
            if (callback) {
                if (response.result) {
                    callback.resolve(response.result);
                }
                else {
                    callback.reject(new error_1.default('WORKER_ERROR', 'Worker error', response.error));
                }
                this.callbacks.delete(correlationId);
            }
        }, { noAck: true });
    }
    async stop() {
        await this.taskQueue.onEmpty();
        await this.channel.close();
    }
}
exports.default = Client;
//# sourceMappingURL=client.js.map