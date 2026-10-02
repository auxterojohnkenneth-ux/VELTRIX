import { ReactNode } from "react";

export function AdminManagementHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="management-page-header">
      <div>
        <p className="page-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function AdminManagementFeedback({
  error,
  success,
}: {
  error: string;
  success: string;
}) {
  return (
    <>
      {error && <p className="management-feedback error" role="alert">{error}</p>}
      {success && <p className="management-feedback success" role="status">{success}</p>}
    </>
  );
}
