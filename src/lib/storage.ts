import { getSupabaseServerClient } from "@/lib/supabase/server";

export type UploadResult = {
  success: boolean;
  url?: string;
  error?: string;
};

/**
 * Upload image to Supabase Storage
 * @param file File to upload
 * @param bucket Bucket name (default: 'question-images')
 * @param folder Folder path in bucket (e.g., 'questions', 'options')
 * @returns Upload result with public URL
 */
export async function uploadImage(
  file: File,
  bucket: string = "question-images",
  folder: string = "questions"
): Promise<UploadResult> {
  try {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { success: false, error: "File harus berupa gambar" };
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "Ukuran file maksimal 5MB" };
    }

    const supabase = await getSupabaseServerClient("write");

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${folder}/${timestamp}-${randomStr}.${ext}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      console.error("Upload error:", error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error("Upload exception:", error);
    return { success: false, error: "Gagal upload gambar" };
  }
}

/**
 * Delete image from Supabase Storage
 * @param url Public URL of the image
 * @param bucket Bucket name
 */
export async function deleteImage(url: string, bucket: string = "question-images"): Promise<boolean> {
  try {
    const supabase = await getSupabaseServerClient("write");

    // Extract path from URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
    if (!pathMatch) {
      console.error("Invalid URL format");
      return false;
    }

    const filePath = pathMatch[1];

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error("Delete error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Delete exception:", error);
    return false;
  }
}
