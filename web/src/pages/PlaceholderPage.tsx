import "./PlaceholderPage.css";

export function PlaceholderPage({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
