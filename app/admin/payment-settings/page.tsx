
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  admin_email: string;
  account_holder: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
  upi_qr_url: string;
};

const emptySettings: Settings = {
  admin_email: "",
  account_holder: "",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  upi_id: "",
  upi_qr_url: "",
};

export default function PaymentSettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load saved payment settings
  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/payment-settings", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!active) return;

        if (!response.ok) {
          setMessage(data.error || "Unable to load settings.");
        } else {
          setSettings({
            admin_email: data.admin_email || "",
            account_holder: data.account_holder || "",
            bank_name: data.bank_name || "",
            account_number: data.account_number || "",
            ifsc_code: data.ifsc_code || "",
            upi_id: data.upi_id || "",
            upi_qr_url: data.upi_qr_url || "",
          });
        }
      } catch {
        if (active) {
          setMessage("Unable to connect to the server.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [router]);

  // Update form fields
  function updateField(field: keyof Settings, value: string) {
    setSettings((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // Save settings
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setMessage(data.error || "Unable to save settings.");
      } else {
        setMessage(
          "Settings saved successfully. Checkout will show the updated payment details."
        );
      }
    } catch {
      setMessage("Unable to connect to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="premium-page">
        <p>Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="premium-page">
      <section className="premium-container">

        {/* PAGE HEADING */}
        <div className="premium-heading">
          <p className="dashboard-eyebrow">Ukti ADMIN</p>

          <h1>Payment settings</h1>

          <p>
            Update the payment details customers see during checkout.
          </p>
        </div>

        <form
          className="admin-payment-form"
          onSubmit={saveSettings}
        >

          {/* ADMINISTRATOR */}
          <h2>Administrator</h2>

          <label>
            Administrator email

            <input
              type="email"
              value={settings.admin_email}
              onChange={(e) =>
                updateField("admin_email", e.target.value)
              }
              required
            />
          </label>

          <p className="admin-payment-note">
            Changing this email changes who can access this page.
            Make sure the new email belongs to an account registered
            with Ukti.
          </p>

          {/* UPI DETAILS */}
          <h2>UPI payment details</h2>

          <label>
            UPI ID

            <input
              type="text"
              value={settings.upi_id}
              onChange={(e) =>
                updateField("upi_id", e.target.value)
              }
              placeholder="yourname@bank"
            />
          </label>

          <label>
            UPI QR Image URL

            <input
              type="url"
              value={settings.upi_qr_url}
              onChange={(e) =>
                updateField("upi_qr_url", e.target.value)
              }
              placeholder="Paste your UPI QR public image URL"
            />
          </label>

          {/* QR PREVIEW */}
          {settings.upi_qr_url.trim() && (
            <div className="upi-qr-container">
              <h3>UPI QR Preview</h3>

              <img
                src={settings.upi_qr_url}
                alt="UPI payment QR preview"
                className="upi-qr-image"
                onError={() =>
                  setMessage("Unable to load the QR image. Check the URL.")
                }
              />

              <p>
                This QR code will be displayed on the customer checkout page.
              </p>
            </div>
          )}

          {/* BANK DETAILS */}
          <h2>Bank transfer details</h2>

          <label>
            Account holder name

            <input
              type="text"
              value={settings.account_holder}
              onChange={(e) =>
                updateField("account_holder", e.target.value)
              }
              placeholder="Account holder name"
            />
          </label>

          <label>
            Bank name

            <input
              type="text"
              value={settings.bank_name}
              onChange={(e) =>
                updateField("bank_name", e.target.value)
              }
              placeholder="Bank name"
            />
          </label>

          <label>
            Account number

            <input
              type="text"
              value={settings.account_number}
              onChange={(e) =>
                updateField("account_number", e.target.value)
              }
              placeholder="Bank account number"
              inputMode="numeric"
            />
          </label>

          <label>
            IFSC code

            <input
              type="text"
              value={settings.ifsc_code}
              onChange={(e) =>
                updateField("ifsc_code", e.target.value.toUpperCase())
              }
              placeholder="ABCD0123456"
            />
          </label>

          {/* SAVE */}
          <button
            type="submit"
            className="continue-premium-button"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save payment settings"}
          </button>

          {message && (
            <p
              className="premium-save-message"
              role="status"
            >
              {message}
            </p>
          )}

        </form>
      </section>
    </main>
  );
}
