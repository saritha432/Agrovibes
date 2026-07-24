import { AdminLayout } from "../components/AdminLayout";

type Props = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: Props) {
  return (
    <AdminLayout title={title} breadcrumbs={[{ label: "Home", to: "/overview" }, { label: title }]}>
      <div className="admin-page-card">
        <p>
          <strong>{title}</strong>
        </p>
        <p>{description}</p>
      </div>
    </AdminLayout>
  );
}
