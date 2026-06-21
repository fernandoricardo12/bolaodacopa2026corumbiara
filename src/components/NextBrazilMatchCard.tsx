import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, Trophy, Star } from "lucide-react";

const MATCH_DATE = new Date("2026-06-24T22:00:00Z"); // 19h Brasília = 22h UTC

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds, isPast: diff <= 0 };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-emerald-950/60 backdrop-blur border border-yellow-400/30 flex items-center justify-center shadow-lg">
          <span className="text-2xl sm:text-3xl font-black text-yellow-300 tabular-nums drop-shadow">
            {String(value).padStart(2, "0")}
          </span>
        </div>
        <div className="absolute -inset-0.5 rounded-xl bg-yellow-400/10 blur-sm -z-10" />
      </div>
      <span className="text-[10px] sm:text-xs font-bold text-yellow-100/80 mt-1.5 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export function NextBrazilMatchCard() {
  const { days, hours, minutes, seconds, isPast } = useCountdown(MATCH_DATE);

  if (isPast) return null;

  return (
    <Card className="mb-4 border-2 border-yellow-400 overflow-hidden shadow-2xl relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-blue-800 to-green-700" />
      {/* Decorative circles */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-yellow-400/15 blur-3xl animate-pulse" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-green-400/15 blur-3xl animate-pulse" />
      {/* Star pattern */}
      <div className="absolute top-3 right-3 text-yellow-400/20">
        <Star className="h-8 w-8 fill-current" />
      </div>
      <div className="absolute bottom-3 left-3 text-yellow-400/10">
        <Star className="h-6 w-6 fill-current" />
      </div>

      <CardContent className="relative p-4 sm:p-5 space-y-4 text-white">
        {/* Badge */}
        <div className="flex items-center justify-center">
          <Badge className="bg-yellow-400 text-emerald-950 hover:bg-yellow-400 font-extrabold text-xs sm:text-sm px-4 py-1 shadow-lg animate-pulse">
            <Trophy className="h-3.5 w-3.5 mr-1.5" /> PRÓXIMO JOGO DO BRASIL
          </Badge>
        </div>

        {/* Teams */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl sm:text-5xl drop-shadow-lg">🇧🇷</span>
              <span className="text-sm sm:text-base font-extrabold tracking-wide">BRASIL</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-black text-yellow-300 drop-shadow animate-pulse">VS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-4xl sm:text-5xl drop-shadow-lg">🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
              <span className="text-sm sm:text-base font-extrabold tracking-wide">ESCÓCIA</span>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <CountdownUnit value={days} label="Dias" />
          <span className="text-2xl font-black text-yellow-300 mt-[-16px]">:</span>
          <CountdownUnit value={hours} label="Horas" />
          <span className="text-2xl font-black text-yellow-300 mt-[-16px]">:</span>
          <CountdownUnit value={minutes} label="Min" />
          <span className="text-2xl font-black text-yellow-300 mt-[-16px]">:</span>
          <CountdownUnit value={seconds} label="Seg" />
        </div>

        {/* Match info */}
        <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-yellow-100">
            <Calendar className="h-3.5 w-3.5 text-yellow-300 shrink-0" />
            <span><strong>Quarta-feira, 24 de junho de 2026</strong> — 19h (Brasília)</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-yellow-100">
            <MapPin className="h-3.5 w-3.5 text-yellow-300 shrink-0" />
            <span>Hard Rock Stadium — <strong>Miami, EUA</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-yellow-100">
            <Trophy className="h-3.5 w-3.5 text-yellow-300 shrink-0" />
            <span>3ª rodada — <strong>Grupo C</strong> — Copa do Mundo 2026</span>
          </div>
        </div>

        {/* Context */}
        <div className="relative rounded-xl bg-gradient-to-r from-yellow-400/20 via-yellow-300/10 to-yellow-400/20 border border-yellow-400/30 p-3 text-center">
          <p className="text-xs sm:text-sm font-semibold text-yellow-100">
            ⭐ Brasil lidera o <strong>Grupo C</strong> com <strong>4 pontos</strong>.
            <br />
            <span className="text-yellow-200/90">Jogo decisivo para confirmar a classificação e a liderança da chave!</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
