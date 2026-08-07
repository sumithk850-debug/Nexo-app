import { db } from "./firebase.server";
import { FieldValue } from "firebase-admin/firestore";

export async function addMemory(userId: string, content: string, embedding: number[]) {
  const docRef = await db.collection("memory_embeddings").add({
    userId,
    content,
    embedding: FieldValue.vector(embedding),
    createdAt: FieldValue.serverTimestamp()
  });
  return { id: docRef.id };
}

export async function searchMemories(userId: string, queryEmbedding: number[], threshold = 0.7, limit = 5) {
  const snapshot = await db.collection("memory_embeddings")
    .where("userId", "==", userId)
    .findNearest("embedding", FieldValue.vector(queryEmbedding), {
      limit,
      distanceMeasure: "COSINE"
    })
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    content: doc.data().content
  }));
}
