
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type WordResult = {
  word: string;
  recognized: boolean;
};

type ProgressRow = {
  exercise_id: string;
  completed: boolean;
  progress_status: string;
};

type PracticeQuestion = {
  id: string;
  language: string;
  title: string;
  description: string | null;
  reference_text: string;
  locale: string;
  access_tier: "free" | "premium";
  status: string;
  created_at: string;
};

async function getStudentContext() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const adminDb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return { user, adminDb };
}

function tokenize(text: string): string[] {
  return (
    text.normalize("NFC").match(
      /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
    ) || []
  ).map((word: string) => word.toLocaleLowerCase());
}

// Checks access to an individual question.
// Free questions do not require language enrollment.
async function getAccessibleQuestion(
  adminDb: any,
  userId: string,
  questionId: string
) {
  const { data: question, error } = await adminDb
    .from("practice_questions")
    .select(
      "id, language, title, reference_text, locale, access_tier, status"
    )
    .eq("id", questionId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return {
      error: "Unable to retrieve practice question.",
      status: 500,
    };
  }

  if (!question) {
    return {
      error: "Published practice question not found.",
      status: 404,
    };
  }

  // FREE QUESTIONS: No enrollment required.
  if (question.access_tier === "free") {
    return { question };
  }

  // PREMIUM QUESTIONS: Check enrollment and subscription.
  if (question.access_tier === "premium") {
    const { data: enrolment, error: enrolmentError } =
      await adminDb
        .from("user_languages")
        .select("selected_plan, subscription_status")
        .eq("user_id", userId)
        .eq("language", question.language)
        .maybeSingle();

    if (enrolmentError) {
      return {
        error: "Unable to verify your language subscription.",
        status: 500,
      };
    }

    if (!enrolment) {
      return {
        error: "You need an active Premium subscription to access this question.",
        status: 403,
      };
    }

    const hasPremium =
      enrolment.selected_plan === "premium" &&
      enrolment.subscription_status === "active";

    if (!hasPremium) {
      return {
        error: "This question requires an active Premium subscription.",
        status: 403,
      };
    }

    return { question };
  }

  return {
    error: "Invalid practice question access setting.",
    status: 403,
  };
}

export async function GET(request: NextRequest) {
  const context = await getStudentContext();

  if (!context) {
    return NextResponse.json(
      { error: "Please log in." },
      { status: 401 }
    );
  }

  const language = request.nextUrl.searchParams.get("language");

  if (!language || !["English", "Hindi"].includes(language)) {
    return NextResponse.json(
      { error: "Choose English or Hindi." },
      { status: 400 }
    );
  }

  // Enrollment is optional for free questions.
  // If there is no enrollment, the user simply has no Premium access.
  const { data: enrolment, error: enrolmentError } =
    await context.adminDb
      .from("user_languages")
      .select("selected_plan, subscription_status")
      .eq("user_id", context.user.id)
      .eq("language", language)
      .maybeSingle();

  if (enrolmentError) {
    return NextResponse.json(
      { error: "Unable to verify language enrollment." },
      { status: 500 }
    );
  }

  const hasPremium =
    enrolment?.selected_plan === "premium" &&
    enrolment?.subscription_status === "active";

  // Fetch published questions.
  const { data, error } = await context.adminDb
    .from("practice_questions")
    .select(
      "id, language, title, description, reference_text, locale, access_tier, status, created_at"
    )
    .eq("language", language)
    .eq("status", "published")
    .not("reference_text", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  // Free questions are always accessible.
  // Premium questions are returned only to active Premium users.
  const accessibleQuestions = (
    (data || []) as PracticeQuestion[]
  ).filter(
    (question) =>
      question.access_tier === "free" ||
      (question.access_tier === "premium" && hasPremium)
  );

  const questionIds = accessibleQuestions.map(
    (question) => question.id
  );

  let progressRows: ProgressRow[] = [];

  if (questionIds.length > 0) {
    const { data: progress, error: progressError } =
      await context.adminDb
        .from("user_practice_progress")
        .select("exercise_id, completed, progress_status")
        .eq("user_id", context.user.id)
        .eq("language", language)
        .in("exercise_id", questionIds)
        .order("created_at", { ascending: false });

    if (progressError) {
      return NextResponse.json(
        { error: progressError.message },
        { status: 500 }
      );
    }

    progressRows = (progress || []) as ProgressRow[];
  }

  // Keep the latest progress entry for each question.
  const latestProgress = new Map<
    string,
    {
      completed: boolean;
      progress_status: string;
    }
  >();

  for (const row of progressRows) {
    if (!latestProgress.has(row.exercise_id)) {
      latestProgress.set(row.exercise_id, {
        completed: row.completed,
        progress_status: row.progress_status,
      });
    }
  }

  const questions = accessibleQuestions.map((question) => {
    const progress = latestProgress.get(question.id);

    return {
      ...question,
      completed: progress?.completed || false,
      progress_status: progress?.progress_status || "in_progress",
    };
  });

  return NextResponse.json({ questions });
}

export async function POST(request: NextRequest) {
  const context = await getStudentContext();

  if (!context) {
    return NextResponse.json(
      { error: "Please log in." },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();

    const action = String(formData.get("action") || "transcribe");
    const questionId = String(formData.get("questionId") || "");

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required." },
        { status: 400 }
      );
    }

    const access = await getAccessibleQuestion(
      context.adminDb,
      context.user.id,
      questionId
    );

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const question = access.question;
    const targetWords = tokenize(question.reference_text || "");

    if (targetWords.length === 0) {
      return NextResponse.json(
        { error: "This question has no valid reference sentence." },
        { status: 400 }
      );
    }

    // Handle skipped questions.
    if (action === "skip") {
      const { error } = await context.adminDb
        .from("user_practice_progress")
        .insert({
          user_id: context.user.id,
          language: question.language,
          exercise_id: question.id,
          score: 0,
          total_questions: targetWords.length,
          completed: false,
          progress_status: "skipped",
        });

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        completed: false,
        progress_status: "skipped",
      });
    }

    if (action !== "transcribe") {
      return NextResponse.json(
        { error: "Invalid practice action." },
        { status: 400 }
      );
    }

    const audio = formData.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json(
        { error: "A valid audio recording is required." },
        { status: 400 }
      );
    }

    if (audio.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "Recording is too large. Please record a shorter sentence.",
        },
        { status: 413 }
      );
    }

    if (!process.env.SARVAM_API_KEY) {
      return NextResponse.json(
        { error: "Sarvam API key is not configured on the server." },
        { status: 500 }
      );
    }

    // Normalize MIME type before sending the recording to Sarvam.
    const normalizedMimeType = (
      audio.type || "application/octet-stream"
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    const allowedMimeTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/mpeg3",
      "audio/x-mpeg-3",
      "audio/x-mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/pcm_s16le",
      "audio/l16",
      "audio/raw",
      "application/octet-stream",
      "audio/aac",
      "audio/x-aac",
      "audio/aiff",
      "audio/x-aiff",
      "audio/ogg",
      "audio/opus",
      "audio/flac",
      "audio/x-flac",
      "audio/mp4",
      "audio/x-m4a",
      "audio/amr",
      "audio/x-ms-wma",
      "audio/webm",
      "video/webm",
    ];

    if (!allowedMimeTypes.includes(normalizedMimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported audio format: ${normalizedMimeType}`,
        },
        { status: 415 }
      );
    }

    const audioBytes = await audio.arrayBuffer();

    const normalizedAudio = new Blob([audioBytes], {
      type: normalizedMimeType,
    });

    const sarvamForm = new FormData();

    sarvamForm.append(
      "file",
      normalizedAudio,
      audio.name || "recording.webm"
    );

    sarvamForm.append("model", "saaras:v4");
    sarvamForm.append("mode", "transcribe");
    sarvamForm.append(
      "language_code",
      question.locale || "en-IN"
    );

    const sarvamResponse = await fetch(
      "https://api.sarvam.ai/speech-to-text",
      {
        method: "POST",
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
        },
        body: sarvamForm,
        cache: "no-store",
      }
    );

    const sarvamResult = await sarvamResponse.json();

    if (!sarvamResponse.ok) {
      console.error("Sarvam transcription error:", sarvamResult);

      return NextResponse.json(
        {
          error:
            sarvamResult.error?.message ||
            sarvamResult.message ||
            "Sarvam could not process this recording.",
        },
        { status: 502 }
      );
    }

    const transcript = String(
      sarvamResult.transcript || ""
    ).trim();

    if (!transcript) {
      return NextResponse.json(
        {
          error:
            "No speech was recognised. Please try speaking again.",
        },
        { status: 422 }
      );
    }

    const spokenWords = tokenize(transcript);

    const referenceTokens =
      question.reference_text.match(
        /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
      ) || [];

    const words: WordResult[] = referenceTokens.map(
      (word: string, index: number) => ({
        word,
        recognized: spokenWords[index] === targetWords[index],
      })
    );

    const exactMatch =
      spokenWords.length === targetWords.length &&
      targetWords.every(
        (word: string, index: number) =>
          word === spokenWords[index]
      );

    const matchedCount = words.filter(
      (word) => word.recognized
    ).length;

    const score = Math.round(
      (matchedCount / targetWords.length) * 100
    );

    // Record the assessment result.
    const { error: progressError } = await context.adminDb
      .from("user_practice_progress")
      .insert({
        user_id: context.user.id,
        language: question.language,
        exercise_id: question.id,
        score,
        total_questions: targetWords.length,
        completed: exactMatch,
        progress_status: exactMatch
          ? "completed"
          : "in_progress",
      });

    if (progressError) {
      return NextResponse.json(
        { error: progressError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transcript,
      words,
      score,
      completed: exactMatch,
      progress_status: exactMatch
        ? "completed"
        : "in_progress",
      recognized_language: sarvamResult.language_code || null,
    });
  } catch (error) {
    console.error("Practice API error:", error);

    return NextResponse.json(
      { error: "Unable to process this practice request." },
      { status: 500 }
    );
  }
}
