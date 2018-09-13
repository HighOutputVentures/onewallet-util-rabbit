"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const R = require("ramda");
const TaskQueue = require("p-queue");
const debug = require("debug");
class Worker {
    constructor(connection, queue, handler, options) {
        this.connection = connection;
        this.queue = queue;
        this.handler = handler;
        this.options = {
            concurrency: 1,
        };
        if (options) {
            this.options = Object.assign({}, this.options, options);
        }
        this.taskQueue = new TaskQueue();
    }
    async start() {
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(this.queue, {
            exclusive: false,
            durable: true,
            autoDelete: false,
        });
        await this.channel.prefetch(this.options.concurrency);
        await this.channel.consume(this.queue, async (message) => {
            await this.taskQueue.add(async () => {
                if (!message) {
                    return;
                }
                const { properties: { correlationId }, } = message;
                const request = JSON.parse(message.content.toString());
                debug('rabbit:worker:request')(request);
                let response = { correlationId };
                try {
                    let result = this.handler.apply(this.handler, request.arguments);
                    if (!R.isNil(result) && typeof result.then === 'function') {
                        result = await result;
                    }
                    response.result = result;
                }
                catch (err) {
                    const error = { message: err.message };
                    for (const key in err) {
                        error[key] = err[key];
                    }
                    response.error = error;
                }
                await this.channel.ack(message);
                if (request.noResponse) {
                    return;
                }
                await this.channel.sendToQueue(message.properties.replyTo, new Buffer(JSON.stringify(response)), { correlationId, persistent: true });
            });
        }, { noAck: false });
    }
    async stop() {
        await this.taskQueue.onEmpty();
        await this.channel.close();
    }
}
exports.default = Worker;
//# sourceMappingURL=worker.js.map