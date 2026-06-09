// Helpers para integração com WhatsApp (wa.me).

/** Remove tudo que não é dígito e garante prefixo 55 (Brasil). */
export function toWaDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  // Se vier sem código do país, prefixa 55. Se já começar com 55, mantém.
  if (!digits.startsWith("55")) digits = "55" + digits;
  return digits;
}

/** Valida se o número tem o formato esperado (55 + DDD + 8/9 dígitos). */
export function isValidBrPhone(raw: string | null | undefined): boolean {
  const d = toWaDigits(raw);
  // 55 + 2 (DDD) + 8 ou 9 dígitos = 12 ou 13
  return d.length === 12 || d.length === 13;
}

/** Gera link wa.me com mensagem opcional. */
export function buildWaLink(phone: string, message?: string): string {
  const digits = toWaDigits(phone);
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Mensagem padrão de boas-vindas com regras resumidas do bolão. */
export function defaultWelcomeMessage(name?: string): string {
  const saudacao = name ? `Olá, ${name.split(" ")[0]}! 👋` : "Olá! 👋";
  return [
    `${saudacao}`,
    "",
    "Seja muito bem-vindo(a) ao *Bolão Copa 2026* 🏆⚽",
    "",
    "📌 *Como funciona:*",
    "• Bolão de Pontos (inscrição única R$ 50,00) — palpite em TODOS os jogos da Copa.",
    "• Palpite Individual (R$ 2,00 por jogo) — opcional, para incrementar a diversão.",
    "",
    "🎯 *Pontuação do bolão:*",
    "• 20 pts — placar exato",
    "• 15 pts — vencedor + 1 placar certo",
    "• 10 pts — só o vencedor",
    "• 5 pts — só um dos placares",
    "",
    "💰 *Premiação:*",
    "• Líder do ranking ao fim da Copa leva *80% do bolo + R$ 100 de bônus do administrador*.",
    "• Nos individuais: placar exato leva 80% do jogo; só vencedor divide 60%.",
    "",
    "📱 *Funcionalidades:*",
    "• Ranking atualizado em tempo real",
    "• Acompanhamento de jogos e resultados ao vivo",
    "• Grupos, mata-mata e histórico dos seus palpites",
    "",
    "Qualquer dúvida é só chamar por aqui. Bora pra cima! 🇧🇷🏆",
  ].join("\n");
}
