"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const R = require("ramda");
const uuid_1 = require("uuid");
const TaskQueue = require("p-queue");
const debug = require("debug");
class Subscriber {
    constructor(connection, exchange, handler, options) {
        this.connection = connection;
        this.exchange = exchange;
        this.handler = handler;
        this.options = {
            topic: '*',
            concurrency: 1,
        };
        if (options) {
            this.options = Object.assign({}, this.options, options);
        }
        this.queue = `subscriber.${uuid_1.v1().replace('-', '')}`;
        this.taskQueue = new TaskQueue();
    }
    async start() {
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(this.queue, {
            exclusive: false,
            durable: true,
            expires: 600000,
        });
        await this.channel.assertExchange(this.exchange, 'topic', {
            durable: true,
        });
        await this.channel.bindQueue(this.queue, this.exchange, this.options.topic);
        await this.channel.prefetch(this.options.concurrency);
        await this.channel.consume(this.queue, async (message) => {
            await this.taskQueue.add(async () => {
                if (!message) {
                    return;
                }
                const payload = JSON.parse(message.content.toString());
                debug('rabbit:subscriber')(payload);
                try {
                    let result = this.handler.apply(this.handler, payload.arguments);
                    if (!R.isNil(result) && typeof result.then === 'function') {
                        result = await result;
                    }
                }
                catch (err) { }
                await this.channel.ack(message);
            });
        }, { noAck: false });
    }
    async stop() {
        await this.taskQueue.onEmpty();
        await this.channel.close();
    }
}
exports.default = Subscriber;
//# sourceMappingURL=subscriber.js.map