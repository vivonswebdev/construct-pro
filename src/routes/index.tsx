import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/login", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
