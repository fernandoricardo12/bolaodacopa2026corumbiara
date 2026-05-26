import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/admin")({ component: AdminRoute, ssr: false });

function AdminRoute() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [loading, user, isAdmin, navigate]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!user) return <AuthScreen />;
  if (!isAdmin) return <div className="min-h-screen grid place-items-center text-muted-foreground">Acesso restrito</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-full bg-amber-600 text-white grid place-items-center">
              <Shield className="h-4 w-4" />
            </div>
            Painel do Administrador
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Voltar ao app</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}>Sair</Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <AdminPanel />
      </main>
    </div>
  );
}
