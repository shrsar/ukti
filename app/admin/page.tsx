
import Link from "next/link";
import ProfileMenu from "@/components/ProfileMenu";

const adminSections = [
  {
    title: "Manage Lessons",
    description: "Create, edit, publish and manage language lessons.",
    href: "/admin/lessons",
    icon: "📚",
  },
  {
    title: "Import Lessons",
    description: "Upload lesson documents and import learning content.",
    href: "/admin/lessons/import",
    icon: "📤",
  },
  {
    title: "Speaking Practice",
    description: "Manage speaking questions and practice content.",
    href: "/admin/practice",
    icon: "🎙️",
  },
  {
    title: "Payment Settings",
    description: "Manage payment configuration and subscription settings.",
    href: "/admin/payment-settings",
    icon: "💳",
  },
];

export default function AdminDashboard() {
  return (
    <main className="premium-page">
      <header className="navbar">
        <nav className="nav-links">
          <Link href="/admin" className="active">
            Admin Dashboard
          </Link>
        </nav>

        <div className="nav-actions">
          <ProfileMenu />
        </div>
      </header>

      <section
        className="premium-container"
        style={{ maxWidth: "1100px" }}
      >
        <div style={{ marginBottom: "35px" }}>
          <p
            style={{
              color: "#a47751",
              fontWeight: 700,
              letterSpacing: "2px",
              fontSize: "12px",
            }}
          >
            UKTI ADMINISTRATION
          </p>

          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 42px)",
              margin: "10px 0",
            }}
          >
            Admin Dashboard
          </h1>

          <p style={{ color: "#777", lineHeight: 1.7 }}>
            Manage your Ukti platform from one place.
            Select an administrative section below.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <article
                className="checkout-card"
                style={{
                  height: "100%",
                  minHeight: "190px",
                  padding: "25px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  transition: "transform 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "32px" }}>
                  {section.icon}
                </span>

                <h2
                  style={{
                    fontSize: "20px",
                    margin: 0,
                  }}
                >
                  {section.title}
                </h2>

                <p
                  style={{
                    color: "#777",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {section.description}
                </p>

                <span
                  style={{
                    color: "#a47751",
                    fontWeight: 700,
                    fontSize: "14px",
                    marginTop: "auto",
                  }}
                >
                  Open section →
                </span>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
