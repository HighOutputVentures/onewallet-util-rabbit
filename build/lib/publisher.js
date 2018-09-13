"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
class Publisher {
    constructor(connection, exchange) {
        this.connection = connection;
        this.exchange = exchange;
    }
    async send(topic, ...args) {
        const payload = {
            arguments: args,
            timestamp: Date.now(),
        };
        debug('rabbit:publisher')(payload);
        await this.channel.publish(this.exchange, topic, new Buffer(JSON.stringify(payload)), { persistent: true });
    }
    async start() {
        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(this.exchange, 'topic', {
            durable: true,
        });
    }
    async stop() {
        await this.channel.close();
    }
}
exports.default = Publisher;
//# sourceMappingURL=publisher.js.map