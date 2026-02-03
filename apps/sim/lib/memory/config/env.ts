
import { z } from "zod";

export const env = {
  // Qdrant
  QDRANT_URL: process.env.QDRANT_URL || "http://localhost:6333",
  QDRANT_API_KEY: process.env.QDRANT_API_KEY,
  EMBEDDING_DIM: parseInt(process.env.EMBEDDING_DIM || "1536"),
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "text-embedding-3-small",

  // Postgres
  DATABASE_URL: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/sim",

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_BASE_URL: process.env.AI_BASE_URL,
  LLM_MODEL: process.env.LLM_MODEL || "gpt-4-turbo-preview",
};
