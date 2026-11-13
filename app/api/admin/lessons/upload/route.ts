
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { getAdminContext } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE = 200 * 1024 * 1024;
const MAX_FILES = 20;

const ALLOWED_FILES: Record<
  string,
  {
    fileType: string;
    mimeTypes: string[];
    category: "document" | "audio" | "video";
  }
> = {
  docx: {
    fileType: "docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    category: "document",
  },
  pdf: {
    fileType: "pdf",
    mimeTypes: ["application/pdf"],
    category: "document",
  },
  mp3: {
    fileType: "mp3",
    mimeTypes: ["audio/mpeg"],
    category: "audio",
  },
  wav: {
    fileType: "wav",
    mimeTypes: ["audio/wav", "audio/x-wav"],
    category: "audio",
  },
  m4a: {
    fileType: "m4a",
    mimeTypes: ["audio/mp4", "audio/x-m4a"],
    category: "audio",
  },
  mp4: {
    fileType: "mp4",
    mimeTypes: ["video/mp4"],
    category: "video",
  },
  mov: {
    fileType: "mov",
    mimeTypes: ["video/quicktime"],
    category: "video",
  },
  webm: {
    fileType: "webm",
    mimeTypes: ["video/webm"],
    category: "video",
  },
};

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function safeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-150);
}

export async function POST(request: NextRequest) {
  let lessonId: string | null = null;
  let adminDb: SupabaseClient | null = null;

  const uploadedPaths: string[] = [];

  try {
    // Verify administrator access.
    const context = await getAdminContext();

    if (!context.authorized) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    // Assign the authorized administrator database client.
    adminDb = context.adminDb;

    const formData = await request.formData();

    const language = String(formData.get("language") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const lessonNumber = Number(formData.get("lesson_number"));
    const accessTier = String(formData.get("access_tier") || "free");

    const files = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((item): item is File => item instanceof File);

    if (
      !language ||
      !title ||
      !Number.isSafeInteger(lessonNumber) ||
      lessonNumber < 1
    ) {
      return NextResponse.json(
        { error: "Please provide a language, title and valid lesson number." },
        { status: 400 }
      );
    }

    if (!["free", "premium"].includes(accessTier)) {
      return NextResponse.json(
        { error: "Invalid lesson access tier." },
        { status: 400 }
      );
    }

    if (files.length === 0 || files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Select between 1 and ${MAX_FILES} files.` },
        { status: 400 }
      );
    }

    const totalSize = files.reduce(
      (total, file) => total + file.size,
      0
    );

    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: "Combined upload size cannot exceed 200 MB." },
        { status: 413 }
      );
    }

    // Validate all files before creating the lesson.
    for (const file of files) {
      const extension = getExtension(file.name);
      const config = ALLOWED_FILES[extension];

      if (!config) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.name}` },
          { status: 400 }
        );
      }

      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${file.name} must be between 1 byte and 100 MB.` },
          { status: 400 }
        );
      }

      if (!config.mimeTypes.includes(file.type)) {
        return NextResponse.json(
          {
            error: `The file type of ${file.name} does not match its extension.`,
          },
          { status: 400 }
        );
      }
    }

    // Create the lesson as a draft.
    const { data: lesson, error: lessonError } = await adminDb!
      .from("lessons")
      .insert({
        language,
        title,
        description,
        lesson_number: lessonNumber,
        access_tier: accessTier,
        status: "draft",
        content: {
          source: "document_upload",
          sections: [],
        },
      })
      .select("id")
      .single();

    if (lessonError || !lesson) {
      if (lessonError?.code === "23505") {
        return NextResponse.json(
          {
            error: "That lesson number already exists for this language.",
          },
          { status: 409 }
        );
      }

      throw new Error(lessonError?.message || "Could not create lesson.");
    }

    lessonId = lesson.id;

    const extractedSections: {
      heading: string;
      explanation: string;
      examples: string[];
    }[] = [];

    const documentRows = [];

    // Process and upload files.
    for (const file of files) {
      const extension = getExtension(file.name);
      const config = ALLOWED_FILES[extension];
      const buffer = Buffer.from(await file.arrayBuffer());

      let extractedText = "";

      if (extension === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.trim();
      }

      if (extension === "pdf") {
        const result = await pdfParse(buffer);
        extractedText = result.text.trim();
      }

      if (config.category === "document" && !extractedText) {
        throw new Error(
          `${file.name} did not contain extractable text. Scanned PDFs may need OCR.`
        );
      }

      if (config.category === "document") {
        extractedSections.push({
          heading: file.name,
          explanation: extractedText,
          examples: [],
        });
      }

      const storagePath =
        `${lesson.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

      const { error: storageError } = await adminDb!
        .storage
        .from("lesson-documents")
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (storageError) {
        throw new Error(
          `Could not upload ${file.name}: ${storageError.message}`
        );
      }

      uploadedPaths.push(storagePath);

      documentRows.push({
        lesson_id: lesson.id,
        uploaded_by: context.user.id,
        file_name: file.name,
        storage_path: storagePath,
        file_type: config.fileType,
        extraction_status: "completed",
        extracted_text: extractedText,
      });
    }

    // Save attachment records.
    const { error: documentsError } = await adminDb!
      .from("lesson_documents")
      .insert(documentRows);

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    // Save extracted document text.
    const { error: updateError } = await adminDb!
      .from("lessons")
      .update({
        content: {
          source: "document_upload",
          sections: extractedSections,
        },
      })
      .eq("id", lesson.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      lessonId: lesson.id,
      uploadedFiles: files.length,
      message: "Lesson and files uploaded successfully.",
    });
  } catch (error) {
    console.error("Lesson upload error:", error);

    // Clean up uploaded files.
    if (adminDb && uploadedPaths.length > 0) {
      try {
        const { error: cleanupError } = await adminDb.storage
          .from("lesson-documents")
          .remove(uploadedPaths);

        if (cleanupError) {
          console.error("Storage cleanup error:", cleanupError.message);
        }
      } catch (cleanupError) {
        console.error("Storage cleanup error:", cleanupError);
      }
    }

    // Clean up incomplete lesson.
    if (adminDb && lessonId) {
      try {
        const { error: deleteError } = await adminDb
          .from("lessons")
          .delete()
          .eq("id", lessonId);

        if (deleteError) {
          console.error("Lesson cleanup error:", deleteError.message);
        }
      } catch (cleanupError) {
        console.error("Lesson cleanup error:", cleanupError);
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong during upload.",
      },
      { status: 500 }
    );
  }
}
