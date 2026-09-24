import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { seedDataIfEmpty } from "@/lib/seed";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [session, loading, navigate]);

  useEffect(() => {
    const cid = profile?.company_id;
    if (!cid || seededFor.current === cid) return;
    seededFor.current = cid;
    seedDataIfEmpty(cid)
      .then((did) => {
        if (did) qc.invalidateQueries();
      })
      .catch(console.error);
  }, [profile?.company_id, qc]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <Sidebar />
      <main className="ml-60 min-h-screen p-6">
        <Outlet />
      </main>
    </div>
  );
}
