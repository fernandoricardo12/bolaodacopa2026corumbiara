import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { MatchesTab } from "@/components/MatchesTab";
import { RankingTab } from "@/components/RankingTab";
import { PaymentTab } from "@/components/PaymentTab";
import { AdminPanel } from "@/components/AdminPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Trophy, ListChecks, BarChart3, Wallet, Shield } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!user) return <AuthScreen />;
  return <Dashboard userId={user.id} isAdmin={isAdmin} email={user.email ?? ""} />;
}

function Dashboard({ userId, isAdmin, email }: { userId: string; isAdmin: boolean; email: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-yellow-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white grid place-items-center">
              <Trophy className="h-4 w-4" />
            </div>
            Bolão Copa 2026
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{email}</span>
            <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Tabs defaultValue="matches" className="space-y-4">
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="matches"><ListChecks className="h-4 w-4 mr-1" />Jogos</TabsTrigger>
            <TabsTrigger value="ranking"><BarChart3 className="h-4 w-4 mr-1" />Ranking</TabsTrigger>
            <TabsTrigger value="payment"><Wallet className="h-4 w-4 mr-1" />Pagar</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin"><Shield className="h-4 w-4 mr-1" />Admin</TabsTrigger>}
          </TabsList>
          <TabsContent value="matches"><MatchesTab userId={userId} /></TabsContent>
          <TabsContent value="ranking"><RankingTab currentUserId={userId} /></TabsContent>
          <TabsContent value="payment"><PaymentTab userId={userId} /></TabsContent>
          {isAdmin && <TabsContent value="admin"><AdminPanel /></TabsContent>}
        </Tabs>
        <p className="text-center text-xs text-muted-foreground mt-8">
          Pontuação: <strong>10</strong> placar exato · <strong>5</strong> vencedor + saldo · <strong>3</strong> só vencedor
        </p>
      </main>
    </div>
  );
}
