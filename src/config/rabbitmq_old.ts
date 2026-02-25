import amqplib from 'amqplib';

let connection: amqplib.ChannelModel | null = null;
let channel: amqplib.Channel | null = null;

export async function getRabbitMQChannel(): Promise<amqplib.Channel> {
  if (channel) return channel;

  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  connection = await amqplib.connect(url);
  channel = await connection.createChannel();

  connection.on('error', (err: Error) => {
    console.error('RabbitMQ connection error:', err.message);
    channel = null;
    connection = null;
  });

  connection.on('close', () => {
    console.log('RabbitMQ connection closed');
    channel = null;
    connection = null;
  });

  console.log('RabbitMQ connected');
  return channel;
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
  channel = null;
  connection = null;
}
