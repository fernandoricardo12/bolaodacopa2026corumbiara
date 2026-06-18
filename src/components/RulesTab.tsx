import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Trophy, Target, Coins, Wallet, AlertTriangle, Clock, Users,
  CheckCircle2, MessageCircle, BarChart3, Radio, ShieldCheck, Calculator, Info, Flame,
} from "lucide-react";

export function RulesTab() {
  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <Card className="border-2 border-yellow-400 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-6 w-6 text-yellow-300" />
            Regras do Bolão Copa 2026
          </CardTitle>
          <CardDescription className="text-yellow-100">
            Tudo o que você precisa saber para palpitar, pagar e disputar prêmios.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-emerald-50">
          Leia com atenção antes de começar. Ao registrar palpites e efetuar pagamento, você concorda com todas as regras abaixo.
        </CardContent>
      </Card>

      {/* Modalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" /> Modalidades de aposta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-lg border-l-4 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <div className="flex items-center gap-2 font-semibold">
              <BarChart3 className="h-4 w-4" /> Bolão de pontos <Badge className="bg-emerald-600">R$ 50</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Pagamento único de <strong>R$ 50</strong> que dá direito a palpitar em <strong>todos os jogos da Copa</strong>.
              A pontuação é acumulada em um ranking geral durante toda a competição.
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 p-3">
            <div className="flex items-center gap-2 font-semibold flex-wrap">
              <Coins className="h-4 w-4" /> Palpite individual <Badge className="bg-yellow-500 text-yellow-950">R$ 5 por palpite</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Valem somente os <strong>jogos marcados como destaque pelo administrador</strong>. Cada palpite avulso custa <strong>R$ 5</strong>.
              Pode fazer <strong>quantos palpites quiser</strong>, inclusive vários no mesmo jogo. Cada jogo tem o seu próprio bolo —
              quem acertar divide o prêmio daquela partida (sempre dividido em caso de mais de um ganhador).
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Você pode participar das <strong>duas modalidades ao mesmo tempo</strong> — uma não exclui a outra.</span>
          </div>
        </CardContent>
      </Card>

      {/* Pontuação do bolão de pontos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-600" /> Pontuação do bolão de pontos
          </CardTitle>
          <CardDescription>Quanto vale cada acerto no ranking geral</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">20</div>
              <div className="text-xs font-medium">pontos</div>
              <div className="text-[11px] text-muted-foreground mt-1">Placar exato (acertou tudo)</div>
            </div>
            <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">15</div>
              <div className="text-xs font-medium">pontos</div>
              <div className="text-[11px] text-muted-foreground mt-1">Vencedor + 1 placar correto</div>
            </div>
            <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">10</div>
              <div className="text-xs font-medium">pontos</div>
              <div className="text-[11px] text-muted-foreground mt-1">Só o vencedor (ou empate)</div>
            </div>
            <div className="rounded-lg border-2 border-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3 text-center">
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">5</div>
              <div className="text-xs font-medium">pontos</div>
              <div className="text-[11px] text-muted-foreground mt-1">Só um dos placares</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Exemplo: jogo termina <strong>2 × 1</strong>. Quem cravou 2×1 ganha <strong>20</strong>. Quem palpitou 2×0 ou 3×1 (acertou vencedor + um placar) ganha <strong>15</strong>.
            Quem só apontou que o time da casa venceria ganha <strong>10</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Premiação do bolão de pontos */}
      <Card className="border-2 border-emerald-400">
        <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Trophy className="h-5 w-5" /> Premiação do bolão de pontos
          </CardTitle>
          <CardDescription>Como o prêmio final é distribuído</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm pt-4">
          <div className="rounded-md border-l-4 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <p className="font-semibold">🏆 80% do valor acumulado + R$ 100,00 para o campeão</p>
            <p className="text-muted-foreground text-xs mt-1">
              Ao final da Copa do Mundo, quem fizer <strong>mais pontos no ranking geral</strong> leva
              <strong> 80% de todo o valor confirmado</strong> no bolão de pontos + <strong>R$ 100,00 de bônus do administrador</strong>.
            </p>
          </div>
          <div className="rounded-md border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-3">
            <p className="font-semibold">🤝 Empate técnico = prêmio dividido</p>
            <p className="text-muted-foreground text-xs mt-1">
              Se dois ou mais participantes terminarem com a <strong>mesma pontuação no topo</strong>,
              o prêmio final do bolão de pontos é <strong>dividido em partes iguais</strong> entre eles.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Palpite individual - premiação */}
      <Card className="border-2 border-amber-400">
        <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Coins className="h-5 w-5" /> Premiação do palpite individual
          </CardTitle>
          <CardDescription>Como o bolo de cada jogo é dividido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm pt-4">
          <div className="rounded-md border-l-4 border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <p className="font-semibold">⭐ Só valem os jogos marcados como destaque pelo administrador</p>
            <p className="text-muted-foreground text-xs mt-1">
              Cada jogo destaque recebe palpites de <strong>R$ 5</strong>. O administrador pode definir manualmente um <strong>bônus extra</strong> para a partida.
            </p>
          </div>
          <div className="rounded-md border-l-4 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <p className="font-semibold">🎯 Acertou o placar exato → 80% do bolo do jogo</p>
            <p className="text-muted-foreground text-xs mt-1">
              Os 80% são divididos <strong>igualmente</strong> entre quem cravou. Havendo mais de um ganhador, a premiação é
              <strong> sempre dividida</strong>.
            </p>
          </div>
          <div className="rounded-md border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-3">
            <p className="font-semibold">⭐ Bônus extra (quando o admin define)</p>
            <p className="text-muted-foreground text-xs mt-1">
              Quando o administrador adicionar um <strong>bônus extra</strong> para um jogo destaque, ele é distribuído <strong>entre quem cravou o placar exato</strong>.
              Havendo mais de um, o bônus também é dividido.
            </p>
          </div>
          <div className="rounded-md border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 p-3">
            <p className="font-semibold">🚫 Ninguém cravou o placar exato</p>
            <p className="text-muted-foreground text-xs mt-1">
              Caso ninguém acerte o <strong>placar exato</strong>, <strong>não há prêmio</strong> neste jogo — o prêmio <strong>não acumula</strong> para a próxima partida.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Jogo Top da Rodada */}
      <Card className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Flame className="h-5 w-5" /> Jogo Top da Rodada
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            A administração pode <strong>destacar jogos em alta</strong> (clássicos, decisões, partidas mais comentadas) marcando-os como
            <Badge className="ml-1 bg-yellow-500 text-yellow-950">Jogo Top da Rodada</Badge>.
          </p>
          <p className="text-muted-foreground text-xs">
            Apenas os <strong>jogos marcados como destaque</strong> aparecem na aba <strong>Individual</strong>. Cada palpite custa
            <strong> R$ 5</strong>. Premiação sempre dividida entre os ganhadores.
          </p>
        </CardContent>
      </Card>

      {/* Pagamento - REGRA CRÍTICA */}
      <Card className="border-2 border-red-400">
        <CardHeader className="bg-red-50 dark:bg-red-950/30">
          <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" /> Regra de pagamento (IMPORTANTE)
          </CardTitle>
          <CardDescription className="text-red-700/80 dark:text-red-300/80">
            Sem pagamento confirmado, o palpite não vale para premiação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm pt-4">
          <div className="flex gap-3 items-start">
            <Clock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Pague até 10 minutos antes do início do jogo</p>
              <p className="text-muted-foreground text-xs">
                O pagamento deve ser efetuado e o comprovante enviado <strong>até 10 minutos antes do apito inicial</strong> da partida.
                Pagamentos registrados depois desse prazo <strong>não contam</strong> para aquela rodada.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <Wallet className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Como pagar — passo a passo</p>
              <ol className="text-muted-foreground text-xs list-decimal list-inside space-y-1 mt-1">
                <li>Vá na aba <strong>Pagar</strong> e copie a chave PIX.</li>
                <li>Faça o PIX no valor da modalidade escolhida (R$ 50 ou R$ 2 por palpite).</li>
                <li>Clique em <strong>"1. Registrar pagamento"</strong> informando valor e observação.</li>
                <li>Clique em <strong>"2. Enviar comprovante"</strong> para abrir o WhatsApp e anexar o print.</li>
                <li>Aguarde o administrador confirmar — o status muda para <Badge className="bg-emerald-600 text-[10px]">Confirmado</Badge>.</li>
              </ol>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <MessageCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Comprovante obrigatório via WhatsApp</p>
              <p className="text-muted-foreground text-xs">
                Sem o envio do comprovante o pagamento fica pendente. Pagamentos pendentes <strong>não habilitam</strong> palpites para premiação.
              </p>
            </div>
          </div>
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-3 text-xs text-amber-900 dark:text-amber-200">
            ⚠️ <strong>Não há reembolso</strong> após confirmação do pagamento. Confira o valor e a modalidade antes de enviar o PIX.
          </div>
        </CardContent>
      </Card>

      {/* Regras dos palpites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Regras dos palpites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="prazo">
              <AccordionTrigger>Até quando posso palpitar?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Os palpites podem ser feitos ou alterados até <strong>10 minutos antes</strong> do apito inicial da partida. A partir desse momento o palpite é travado e não pode mais ser modificado.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="alterar">
              <AccordionTrigger>Posso alterar ou excluir meus palpites?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Sim. Até <strong>10 minutos antes</strong> do início, você pode editar ou excluir qualquer palpite na aba <strong>Minhas</strong> ou diretamente em <strong>Bolão</strong> / <strong>Individual</strong>.
                Depois desse prazo, o palpite fica congelado.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="prorrogacao">
              <AccordionTrigger>Prorrogação e pênaltis contam?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <strong>Não.</strong> O placar considerado é sempre o do <strong>tempo regulamentar (90 minutos + acréscimos)</strong>. Gols na prorrogação e disputas de pênaltis
                não alteram a pontuação do bolão, exceto na aba <strong>Mata-mata</strong>, onde vale o time classificado.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cancelado">
              <AccordionTrigger>E se um jogo for cancelado ou adiado?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Jogo adiado: o palpite continua valendo para a nova data. Jogo cancelado pela FIFA: os palpites individuais daquele jogo são reembolsados em forma de crédito para a próxima rodada.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="quantos">
              <AccordionTrigger>Quantos palpites posso fazer por jogo?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                No <strong>bolão de pontos</strong>: 1 palpite por jogo. No <strong>palpite individual</strong> (somente jogos destaque): quantos você quiser — cada um custa R$ 2 ou R$ 5 e concorre separadamente.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="desempate">
              <AccordionTrigger>Como funciona o desempate no ranking?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Se houver empate na pontuação final: (1) mais placares exatos, (2) mais acertos de vencedor, (3) prêmio dividido entre os empatados.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Como funciona a plataforma */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-600" /> Como funciona a plataforma
          </CardTitle>
          <CardDescription>Um guia rápido de cada aba</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { icon: <Target className="h-4 w-4" />, name: "Bolão", desc: "Faça 1 palpite por jogo. Pontuação acumulada vale para o ranking geral (R$ 50)." },
            { icon: <Coins className="h-4 w-4" />, name: "Individual", desc: "Só jogos marcados como destaque. Faça quantos palpites quiser (R$ 2 ou R$ 5 cada). Premiação sempre dividida em caso de mais de um ganhador." },
            { icon: <CheckCircle2 className="h-4 w-4" />, name: "Minhas", desc: "Veja, edite ou exclua todos os seus palpites em um só lugar (enquanto o jogo não começou)." },
            { icon: <Users className="h-4 w-4" />, name: "Grupos", desc: "Acompanhe a fase de grupos da Copa, classificação e jogos por grupo." },
            { icon: <Trophy className="h-4 w-4" />, name: "Mata-mata", desc: "Veja o chaveamento das oitavas em diante e palpite nos classificados." },
            { icon: <BarChart3 className="h-4 w-4" />, name: "Ranking", desc: "Ranking ao vivo de todos os participantes, atualizado a cada resultado." },
            { icon: <Wallet className="h-4 w-4" />, name: "Pagar", desc: "Faça o PIX, registre o pagamento e envie o comprovante pelo WhatsApp." },
          ].map((it) => (
            <div key={it.name} className="flex gap-3 items-start rounded-md border p-3">
              <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 grid place-items-center flex-shrink-0">
                {it.icon}
              </div>
              <div>
                <p className="font-semibold">{it.name}</p>
                <p className="text-xs text-muted-foreground">{it.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resultados e pagamento da premiação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" /> Apuração e pagamento dos prêmios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Os resultados são atualizados em <strong>tempo real</strong> assim que o jogo termina e o admin confirma o placar oficial.</p>
          <p>• O <strong>bolão de pontos</strong> é apurado ao fim da Copa: 80% para o líder do ranking (ou divididos em caso de empate).</p>
          <p>• Os prêmios do <strong>palpite individual</strong> são pagos via PIX em até <strong>48h</strong> após o término do jogo.</p>
        </CardContent>
      </Card>

      {/* Conduta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Conduta e boa fé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Use um nome real ou apelido reconhecível para que seus amigos te encontrem no ranking.</p>
          <p>• Múltiplas contas para o mesmo participante são proibidas e podem ser desclassificadas sem reembolso.</p>
          <p>• Em caso de dúvida ou divergência, a decisão final é do <strong>administrador do bolão</strong>.</p>
          <p>• Dúvidas? Fale com o admin pelo WhatsApp na aba <strong>Pagar</strong>.</p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Bom palpite e que vença o melhor! ⚽🏆
      </p>
    </div>
  );
}
