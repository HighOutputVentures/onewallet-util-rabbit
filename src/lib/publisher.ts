import { Connection, Channel } from 'amqplib';
import * as debug from 'debug';
import { PublishMessage } from './types';

export default class Publisher {
  public channel: Channel;
  constructor(public connection: Connection, private exchange: string) {}

  async send(topic: string, ...args: Array<any>) {
    const payload: PublishMessage = {
      arguments: args,
      timestamp: Date.now(),
    };
    debug('rabbit:publisher')(payload);

    await this.channel.publish(
      this.exchange,
      topic,
      new Buffer(JSON.stringify(payload)),
      { persistent: true }
    );
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
