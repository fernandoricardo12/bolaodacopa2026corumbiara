import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { AuthScreen } from "@/components/AuthScreen";
import { MatchesTab } from "@/components/MatchesTab";
import { IndividualBetsTab } from "@/components/IndividualBetsTab";
import { GroupsTab } from "@/components/GroupsTab";
import { GroupsCompareTab } from "@/components/GroupsCompareTab";
import { KnockoutTab } from "@/components/KnockoutTab";
import { RankingTab } from "@/components/RankingTab";
import { PaymentTab } from "@/components/PaymentTab";
import { Footer } from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Trophy, ListChecks, BarChart3, Wallet, Users, Swords, Coins, ClipboardCheck, BookOpen, GitCompare, Sparkles } from "lucide-react";
import { SimulatorTab } from "@/components/SimulatorTab";
import heroCup from "@/assets/hero-cup.jpg";
import { MyBetsTab } from "@/components/MyBetsTab";
import { RulesTab } from "@/components/RulesTab";
import { WhatsAppPromptDialog } from "@/components/WhatsAppPromptDialog";
import { FeaturedMatchCard } from "@/components/FeaturedMatchCard";



export const Route = createFileRoute("/")({ component: Index, ssr: false });

function Index() {
  // Gate de hidratação: durante SSR/prerender e na primeira render do cliente
  // mostramos o mesmo loader. Evita mismatch que estava deixando a tela branca
  // em alguns navegadores quando o usuário já estava logado.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (mounted && !loading && user && isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [mounted, loading, user, isAdmin, navigate]);

  if (!mounted || loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!user) return <AuthScreen />;
  if (isAdmin) return <div className="min-h-screen grid place-items-center text-muted-foreground">Abrindo painel do administrador…</div>;
  return <Dashboard userId={user.id} email={user.email ?? ""} isAdmin={isAdmin} />;
}

function Dashboard({ userId, email, isAdmin }: { userId: string; email: string; isAdmin: boolean }) {
  const [activeTab, setActiveTab] = useState("bolao");

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-yellow-50 to-emerald-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <WhatsAppPromptDialog userId={userId} />

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
            {isAdmin && (
              <Button size="sm" variant="ghost" className="text-white hover:bg-emerald-800" asChild>
                <Link to="/admin">Admin</Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-white hover:bg-emerald-800" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-5 sm:grid-cols-10 w-full gap-1 p-1 h-auto">
            <TabsTrigger value="bolao" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-yellow-400 data-[state=active]:text-emerald-950"><ListChecks className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">🏆 Bolão</span></TabsTrigger>
            <TabsTrigger value="payment" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-emerald-500 data-[state=active]:text-emerald-950"><Wallet className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">💳 Pagar</span></TabsTrigger>
            <TabsTrigger value="individual" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><Coins className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Individual</span></TabsTrigger>
            <TabsTrigger value="minhas" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><ClipboardCheck className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Minhas</span></TabsTrigger>
            <TabsTrigger value="groups" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><Users className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Grupos</span></TabsTrigger>
            <TabsTrigger value="compare" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><GitCompare className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Comparar</span></TabsTrigger>
            <TabsTrigger value="bracket" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><Swords className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Mata-mata</span></TabsTrigger>
            <TabsTrigger value="simulator" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-yellow-400 data-[state=active]:text-emerald-950"><Sparkles className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">✨ Simulador</span></TabsTrigger>
            <TabsTrigger value="ranking" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><BarChart3 className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Ranking</span></TabsTrigger>
            <TabsTrigger value="rules" className="flex-col sm:flex-row px-1 sm:px-3 py-1.5 h-auto"><BookOpen className="h-4 w-4 mb-0.5 sm:mb-0 sm:mr-1" /><span className="text-[10px] sm:text-sm leading-tight">Regras</span></TabsTrigger>
          </TabsList>
          <TabsContent value="bolao">{activeTab === "bolao" && <MatchesTab userId={userId} />}</TabsContent>
          <TabsContent value="individual">{activeTab === "individual" && <IndividualBetsTab userId={userId} />}</TabsContent>
          <TabsContent value="minhas">{activeTab === "minhas" && <MyBetsTab userId={userId} />}</TabsContent>
          <TabsContent value="groups">{activeTab === "groups" && <GroupsTab />}</TabsContent>
          <TabsContent value="compare">{activeTab === "compare" && <GroupsCompareTab userId={userId} />}</TabsContent>
          <TabsContent value="bracket">{activeTab === "bracket" && <KnockoutTab />}</TabsContent>
          <TabsContent value="simulator">{activeTab === "simulator" && <SimulatorTab userId={userId} />}</TabsContent>
          <TabsContent value="ranking">{activeTab === "ranking" && <RankingTab currentUserId={userId} />}</TabsContent>
          <TabsContent value="payment">{activeTab === "payment" && <PaymentTab userId={userId} email={email} />}</TabsContent>
          <TabsContent value="rules">{activeTab === "rules" && <RulesTab />}</TabsContent>

        </Tabs>
        <div className="mt-6 rounded-md border border-yellow-400/60 bg-gradient-to-r from-emerald-600/10 via-yellow-400/10 to-emerald-600/10 px-3 py-1.5 text-center text-[11px] leading-tight text-emerald-900 dark:text-yellow-100">
          🏆 <strong>Bolão R$ 50</strong>: 20/15/10/5 pts · líder leva 80% + R$ 100 bônus · 🪙 <strong>Individual R$ 2 ou R$ 5</strong> (jogos destaque): placar exato 80% (proporcional) · R$ 5 cravando exato = bônus extra
        </div>

        <div className="mt-6 relative rounded-xl overflow-hidden shadow border-2 border-yellow-400">
          <img src={heroCup} alt="Troféu Copa 2026" className="w-full h-20 sm:h-24 object-cover" width={1536} height={768} loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/80 via-emerald-700/40 to-transparent flex items-center px-4">
            <div className="text-white">
              <h2 className="text-sm sm:text-lg font-bold drop-shadow">Vamos pra cima, Copa 2026! 🏆</h2>
              <p className="text-[10px] sm:text-xs text-yellow-200 drop-shadow">Aposte, acompanhe o ranking e dispute prêmios com os amigos.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

