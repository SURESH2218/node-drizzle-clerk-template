// config/kafka.config.ts

import { Kafka, Producer, Consumer } from "kafkajs";
import { EventType } from "../types/kafka.types";

export const kafka = new Kafka({
  clientId: "drugboard-service",
  brokers: ["localhost:9092"],
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// export const createProducer = async (): Promise<Producer> => {
//   const producer = kafka.producer();

//   try {
//     await producer.connect();
//     console.log("✅ Kafka Producer connected successfully");
//     return producer;
//   } catch (error) {
//     console.error("❌ Failed to connect Kafka Producer:", error);
//     throw error;
//   }
// };

// export const createConsumer = async (groupId: string): Promise<Consumer> => {
//   const consumer = kafka.consumer({ groupId });

//   try {
//     await consumer.connect();
//     console.log(`✅ Kafka Consumer (${groupId}) connected successfully`);
//     return consumer;
//   } catch (error) {
//     console.error(`❌ Failed to connect Kafka Consumer (${groupId}):`, error);
//     throw error;
//   }
// };

export const KAFKA_TOPICS = Object.values(EventType);

export const initializeKafkaTopics = async () => {
  const admin = kafka.admin();

  try {
    await admin.connect();

    const existingTopics = await admin.listTopics();
    const topicsToCreate = KAFKA_TOPICS.filter(
      (topic) => !existingTopics.includes(topic)
    );

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map((topic) => ({
          topic,
          numPartitions: 3, // Adjust based on your needs
          replicationFactor: 1, // Adjust based on your needs
        })),
      });
    }

    console.log("✅ Kafka Topics initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Kafka Topics:", error);
    throw error;
  } finally {
    await admin.disconnect();
  }
};