
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET: Fetch payment settings
export async function GET() {
  try {
    const context = await getAdminContext();

    if (!context.authorized) {
      return NextResponse.json(
        { error: context.reason },
        { status: context.reason === "NOT_LOGGED_IN" ? 401 : 403 }
      );
    }

    const { data, error } = await context.adminDb
      .from("payment_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Fetch payment settings error:", error.message);

      return NextResponse.json(
        { error: "Unable to fetch payment settings." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Payment settings have not been configured." },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Payment settings GET error:", error);

    return NextResponse.json(
      { error: "Unable to fetch payment settings." },
      { status: 500 }
    );
  }
}

// PUT: Update payment settings
export async function PUT(request: Request) {
  try {
    const context = await getAdminContext();

    if (!context.authorized) {
      return NextResponse.json(
        { error: context.reason },
        { status: context.reason === "NOT_LOGGED_IN" ? 401 : 403 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request data." },
        { status: 400 }
      );
    }

    const settings = body as Record<string, unknown>;

    const admin_email = String(settings.admin_email || "")
      .trim()
      .toLowerCase();

    const account_holder = String(settings.account_holder || "").trim();
    const bank_name = String(settings.bank_name || "").trim();
    const account_number = String(settings.account_number || "").trim();

    const ifsc_code = String(settings.ifsc_code || "")
      .trim()
      .toUpperCase();

    const upi_id = String(settings.upi_id || "").trim();
    const upi_qr_url = String(settings.upi_qr_url || "").trim();

    // Validate administrator email.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
      return NextResponse.json(
        { error: "Enter a valid administrator email." },
        { status: 400 }
      );
    }

    // Bank details must either all be provided or all be empty.
    if (
      (account_number || bank_name || account_holder || ifsc_code) &&
      (!account_number || !bank_name || !account_holder || !ifsc_code)
    ) {
      return NextResponse.json(
        {
          error:
            "Complete all bank account fields or leave them empty.",
        },
        { status: 400 }
      );
    }

    // Validate IFSC when bank details are provided.
    if (
      ifsc_code &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code)
    ) {
      return NextResponse.json(
        { error: "Enter a valid IFSC code." },
        { status: 400 }
      );
    }

    // Validate UPI QR URL.
    if (upi_qr_url) {
      try {
        const url = new URL(upi_qr_url);

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "Enter a valid UPI QR image URL." },
          { status: 400 }
        );
      }
    }

    // Update settings using the authorized admin database client.
    const { data, error } = await context.adminDb
      .from("payment_settings")
      .update({
        admin_email,
        account_holder,
        bank_name,
        account_number,
        ifsc_code,
        upi_id,
        upi_qr_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Update payment settings error:", error.message);

      return NextResponse.json(
        { error: "Unable to update payment settings." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Payment settings record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment settings updated successfully.",
    });
  } catch (error) {
    console.error("Payment settings PUT error:", error);

    return NextResponse.json(
      { error: "Invalid request. Please try again." },
      { status: 400 }
    );
  }
}
