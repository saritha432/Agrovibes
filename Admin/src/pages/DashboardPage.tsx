import { AdminLayout } from "../components/AdminLayout";

export function DashboardPage() {
  return (
    <AdminLayout
      title="Overview"
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "Platform" },
        { label: "Overview" }
      ]}
    >
      <div className="admin-page-card">
        <p>
          <strong>Welcome to Cropvibe Admin</strong>
        </p>
        <p>Use the sidebar to manage verification, users, listings, and help desk.</p>
        <p>Open <strong>KYC Verification</strong> to review applicant submissions.</p>
      </div>
    </AdminLayout>
  );
}
