"use server";

import { uploadImage, deleteImage } from "@/lib/storage";

export async function uploadQuestionImage(formData: FormData) {
  const file = formData.get("file") as File;
  const folder = (formData.get("folder") as string) || "questions";

  if (!file) {
    return { success: false, error: "No file provided" };
  }

  return await uploadImage(file, "question-images", folder);
}

export async function deleteQuestionImage(imageUrl: string) {
  return await deleteImage(imageUrl, "question-images");
}
