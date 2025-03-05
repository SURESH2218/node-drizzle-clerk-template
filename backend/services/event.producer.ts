// services/kafka/producer.service.ts

import { Producer } from "kafkajs";
import { kafka } from "../config/kafka.config";
import { v4 as uuidv4 } from "uuid";
import {
  KafkaEvent,
  EventType,
  PostEventData,
  FollowEventData,
  FanoutEventData,
} from "../types/kafka.types";
import APIErrorResponse from "../lib/APIErrorResponse";

let producer: Producer = kafka.producer();
let isConnected: boolean = false;

export const initialize = async () => {
  try {
    await producer.connect();
    isConnected = true;
    console.log("✅ Kafka Producer connected successfully");
  } catch (error) {
    console.error("❌ Producer connection failed:", error);
    throw new APIErrorResponse(500, "Failed to initialize Kafka producer");
  }
};

const ensureConnection = async () => {
  if (!isConnected) {
    await initialize();
  }
};

const produceEvent = async (event: KafkaEvent) => {
  try {
    await ensureConnection();
    await producer.send({
      topic: event.type,
      messages: [
        {
          key: event.id,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
    console.log(`Event produced: ${event.type} (${event.id})`);
  } catch (error) {
    console.error(`Failed to produce event ${event.type}:`, error);
    throw new APIErrorResponse(500, "Failed to produce Kafka event");
  }
};

export const shutdown = async () => {
  try {
    await producer.disconnect();
    isConnected = false;
  } catch (error) {
    console.error("❌ Producer disconnection failed:", error);
  }
};

// Post Events
export const postCreated = async (data: PostEventData) => {
  await produceEvent({
    id: uuidv4(),
    type: EventType.POST_CREATED,
    data,
    timestamp: Date.now(),
  });
};

export const postUpdated = async (data: PostEventData) => {
  await produceEvent({
    id: uuidv4(),
    type: EventType.POST_UPDATED,
    data,
    timestamp: Date.now(),
  });
};

// Follow Events
export const userFollowed = async (data: FollowEventData) => {
  await produceEvent({
    id: uuidv4(),
    type: EventType.USER_FOLLOWED,
    data,
    timestamp: Date.now(),
  });
};

export const userUnfollowed = async (data: FollowEventData) => {
  await produceEvent({
    id: uuidv4(),
    type: EventType.USER_UNFOLLOWED,
    data,
    timestamp: Date.now(),
  });
};

// Fan-out Events
export const fanoutPost = async (data: FanoutEventData) => {
  await produceEvent({
    id: uuidv4(),
    type: data.isPopular ? EventType.FANOUT_POPULAR : EventType.FANOUT_REGULAR,
    data,
    timestamp: Date.now(),
  });
};

// Popular Post Events
export const postPopular = async (data: PostEventData) => {
  await produceEvent({
    id: uuidv4(),
    type: EventType.POST_POPULAR,
    data,
    timestamp: Date.now(),
  });
};
