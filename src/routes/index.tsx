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
import { LogOut, Trophy, ListChecks, BarChart3, Wallet, Users, Swords, Coins, ClipboardCheck, BookOpen } from "lucide-react";
import heroCup from "@/assets/hero-cup.jpg";
import { MyBetsTab } from "@/components/MyBetsTab";
import { RulesTab } from "@/components/RulesTab";


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
          <TabsList className="flex sm:grid sm:grid-cols-8 w-full overflow-x-auto sm:overflow-visible gap-1 p-1 h-auto">
            <TabsTrigger value="bolao" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><ListChecks className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Bolão</span></TabsTrigger>
            <TabsTrigger value="individual" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Coins className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Individual</span></TabsTrigger>
            <TabsTrigger value="minhas" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><ClipboardCheck className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Minhas</span></TabsTrigger>
            <TabsTrigger value="groups" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Users className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Grupos</span></TabsTrigger>
            <TabsTrigger value="bracket" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Swords className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Mata-mata</span></TabsTrigger>
            <TabsTrigger value="ranking" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><BarChart3 className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Ranking</span></TabsTrigger>
            <TabsTrigger value="payment" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><Wallet className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Pagar</span></TabsTrigger>
            <TabsTrigger value="rules" className="flex-shrink-0 flex-col sm:flex-row px-2 sm:px-3 py-1.5 h-auto min-w-[60px]"><BookOpen className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Regras</span></TabsTrigger>
          </TabsList>
          <TabsContent value="bolao"><MatchesTab userId={userId} /></TabsContent>
          <TabsContent value="individual"><IndividualBetsTab userId={userId} /></TabsContent>
          <TabsContent value="minhas"><MyBetsTab userId={userId} /></TabsContent>
          <TabsContent value="groups"><GroupsTab /></TabsContent>
          <TabsContent value="bracket"><KnockoutTab /></TabsContent>
          <TabsContent value="ranking"><RankingTab currentUserId={userId} /></TabsContent>
          <TabsContent value="payment"><PaymentTab userId={userId} email={email} /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>
        </Tabs>
        <div className="text-center text-xs text-muted-foreground mt-8 space-y-1">
          <p><strong>Bolão de pontos (R$ 50):</strong> 20 placar exato · 15 vencedor + 1 placar · 10 só vencedor · 5 só um placar — líder leva 80% do acumulado ao fim da Copa.</p>
          <p><strong>Palpite individual (R$ 2/palpite):</strong> 80% do bolo do jogo para o placar exato · 60% para acerto só do vencedor (dividido se houver mais de um acertador).</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

