
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabase
    .from("payment_settings")
    .select("account_holder, bank_name, account_number, ifsc_code, upi_id, upi_qr_url")
    .eq("id", 1)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Payment details are unavailable." },
      { status: 500 }
    );
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
