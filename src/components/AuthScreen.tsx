import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy, Radio, BarChart3, Users, Wallet, Sparkles } from "lucide-react";
import heroCup from "@/assets/hero-cup.jpg";

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) {
      const msg = error.message?.toLowerCase().includes("invalid")
        ? "Email ou senha incorretos"
        : error.message;
      toast.error(msg);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName.trim() },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Faça login.");
  }

  function isInAppBrowser() {
    const ua = navigator.userAgent || "";
    return /(FBAN|FBAV|Instagram|Line|MicroMessenger|WhatsApp|Snapchat|Twitter|TikTok)/i.test(ua);
  }

  async function handleGoogle() {
    if (isInAppBrowser()) {
      toast.error("Abra este link no navegador (Chrome/Safari) — o Google bloqueia login dentro do WhatsApp/Instagram.");
      try { await navigator.clipboard.writeText(window.location.href); toast.success("Link copiado — cole no navegador."); } catch {}
      return;
    }
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setLoading(false);
      toast.error("Falha no login com Google. Tente email/senha.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-yellow-500 dark:from-slate-950 dark:via-emerald-950 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 grid lg:grid-cols-2 gap-8 items-center min-h-screen">
        {/* Coluna esquerda: propaganda / temática */}
        <div className="text-white space-y-6 order-2 lg:order-1">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-yellow-400">
            <img src={heroCup} alt="Troféu Copa 2026" className="w-full h-40 sm:h-56 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/90 via-emerald-800/50 to-transparent flex items-end p-5">
              <div>
                <div className="inline-flex items-center gap-1 rounded-full bg-yellow-400 text-emerald-900 px-3 py-1 text-xs font-bold mb-2">
                  <Sparkles className="h-3 w-3" /> COPA 2026
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold drop-shadow">Viva cada gol com seus amigos! ⚽🏆</h1>
                <p className="text-sm sm:text-base text-yellow-100 drop-shadow mt-1">A plataforma definitiva para o bolão da Copa do Mundo.</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
              <Radio className="h-5 w-5 text-yellow-300 mb-2" />
              <h3 className="font-bold text-sm">Resultados em tempo real</h3>
              <p className="text-xs text-emerald-50/90">Acompanhe todos os jogos e placares ao vivo, direto na palma da mão.</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
              <BarChart3 className="h-5 w-5 text-yellow-300 mb-2" />
              <h3 className="font-bold text-sm">Ranking dinâmico</h3>
              <p className="text-xs text-emerald-50/90">Veja sua posição subir a cada acerto e dispute o topo até a final.</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
              <Users className="h-5 w-5 text-yellow-300 mb-2" />
              <h3 className="font-bold text-sm">Bolão entre amigos</h3>
              <p className="text-xs text-emerald-50/90">Reúna a galera, palpite junto e celebre cada vitória com quem você ama.</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
              <Wallet className="h-5 w-5 text-yellow-300 mb-2" />
              <h3 className="font-bold text-sm">Bolão de pontos + palpites individuais</h3>
              <p className="text-xs text-emerald-50/90">R$ 50 no bolão geral ou R$ 5 por palpite avulso. Prêmios para quem acerta!</p>
            </div>
          </div>

          <p className="text-xs text-yellow-100/90 italic text-center lg:text-left">
            "Mais do que um bolão — é a Copa do Mundo vivida em comunidade."
          </p>
        </div>

        {/* Coluna direita: card de login */}
        <div className="order-1 lg:order-2 flex justify-center">
          <Card className="w-full max-w-md shadow-2xl border-2 border-yellow-400">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-yellow-300 shadow-lg">
                <Trophy className="h-7 w-7" />
              </div>
              <CardTitle className="text-2xl">Bolão Copa 2026</CardTitle>
              <CardDescription>Entre e comece a palpitar agora</CardDescription>
            </CardHeader>
            <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3 pt-4">
                <div className="space-y-1">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="si-pass">Senha</Label>
                  <Input id="si-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3 pt-4">
                <div className="space-y-1">
                  <Label htmlFor="su-name">Seu nome</Label>
                  <Input id="su-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="su-pass">Senha</Label>
                  <Input id="su-pass" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continuar com Google
          </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
