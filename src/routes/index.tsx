import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { MatchesTab } from "@/components/MatchesTab";
import { IndividualBetsTab } from "@/components/IndividualBetsTab";
import { GroupsTab } from "@/components/GroupsTab";
import { KnockoutTab } from "@/components/KnockoutTab";
import { RankingTab } from "@/components/RankingTab";
import { PaymentTab } from "@/components/PaymentTab";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Trophy, ListChecks, BarChart3, Wallet, Users, Swords, Coins, ClipboardCheck } from "lucide-react";
import heroCup from "@/assets/hero-cup.jpg";
import { MyBetsTab } from "@/components/MyBetsTab";


export const Route = createFileRoute("/")({ component: Index, ssr: false });

function Index() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Admin é separado: apenas gerencia, NÃO aposta. Redireciona para /admin.
  useEffect(() => {
    if (!loading && user && isAdmin) navigate({ to: "/admin", replace: true });
  }, [loading, user, isAdmin, navigate]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!user) return <AuthScreen />;
  if (isAdmin) return <div className="min-h-screen grid place-items-center text-muted-foreground">Abrindo painel do administrador…</div>;
  return <Dashboard userId={user.id} email={user.email ?? ""} />;
}

function Dashboard({ userId, email }: { userId: string; email: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-yellow-50 to-emerald-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b-2 border-yellow-400 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-full bg-yellow-400 text-emerald-800 grid place-items-center shadow">
              <Trophy className="h-4 w-4" />
            </div>
            Bolão Copa 2026
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-50 hidden sm:inline">{email}</span>
            <Button size="sm" variant="ghost" className="text-white hover:bg-emerald-800" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="relative rounded-2xl overflow-hidden shadow-lg border-2 border-yellow-400">
          <img src={heroCup} alt="Troféu Copa 2026" className="w-full h-32 sm:h-48 object-cover" width={1536} height={768} />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/80 via-emerald-700/40 to-transparent flex items-center px-5">
            <div className="text-white">
              <h1 className="text-xl sm:text-3xl font-bold drop-shadow">Vamos pra cima, Copa 2026! 🏆</h1>
              <p className="text-xs sm:text-sm text-yellow-200 drop-shadow">Aposte, acompanhe o ranking e dispute prêmios com os amigos.</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-4">
        <Tabs defaultValue="bolao" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="bolao"><ListChecks className="h-4 w-4 mr-1" />Bolão</TabsTrigger>
            <TabsTrigger value="individual"><Coins className="h-4 w-4 mr-1" />Individual</TabsTrigger>
            <TabsTrigger value="groups"><Users className="h-4 w-4 mr-1" />Grupos</TabsTrigger>
            <TabsTrigger value="bracket"><Swords className="h-4 w-4 mr-1" />Mata-mata</TabsTrigger>
            <TabsTrigger value="ranking"><BarChart3 className="h-4 w-4 mr-1" />Ranking</TabsTrigger>
            <TabsTrigger value="payment"><Wallet className="h-4 w-4 mr-1" />Pagar</TabsTrigger>
          </TabsList>
          <TabsContent value="bolao"><MatchesTab userId={userId} /></TabsContent>
          <TabsContent value="individual"><IndividualBetsTab userId={userId} /></TabsContent>
          <TabsContent value="groups"><GroupsTab /></TabsContent>
          <TabsContent value="bracket"><KnockoutTab /></TabsContent>
          <TabsContent value="ranking"><RankingTab currentUserId={userId} /></TabsContent>
          <TabsContent value="payment"><PaymentTab userId={userId} /></TabsContent>
        </Tabs>
        <div className="text-center text-xs text-muted-foreground mt-8 space-y-1">
          <p><strong>Bolão de pontos (R$ 50):</strong> 20 placar exato · 15 vencedor + 1 placar · 10 só vencedor · 5 só um placar</p>
          <p><strong>Palpite individual (R$ 10/jogo):</strong> 80% do bolo p/ placar exato · 60% p/ acerto de vencedor · 20% taxa admin</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

