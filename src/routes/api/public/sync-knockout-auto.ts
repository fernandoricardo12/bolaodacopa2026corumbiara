import { createFileRoute } from "@tanstack/react-router";

// Preenche automaticamente os times dos jogos de mata-mata (R32) com base
// nos standings da Copa do Mundo via ESPN (sem chave). Os triggers do banco
// cuidam de propagar para a tabela `matches` e avançar nas fases seguintes.

const STANDINGS_URL =
  "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";

export const Route = createFileRoute("/api/public/sync-knockout-auto")({
  server: {
    handlers: {
      GET: async () => handle(),
      POST: async () => handle(),
    },
  },
});

type StandingEntry = {
  code: string;
  rank: number;
  points: number;
  gd: number;
  gf: number;
  group: string; // "A".."L"
};

async function handle() {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1) Buscar standings da ESPN
    const res = await fetch(STANDINGS_URL, {
      headers: { "user-agent": "Mozilla/5.0 BolaoCopa2026" },
    });
    if (!res.ok) {
      return Response.json(
        { error: "espn_standings_failed", status: res.status },
        { status: 502 },
      );
    }
    const json: any = await res.json();
    const children: any[] = Array.isArray(json?.children) ? json.children : [];
    if (children.length === 0) {
      return Response.json(
        { error: "no_standings_yet", note: "ESPN ainda não publicou os grupos" },
        { status: 200 },
      );
    }

    // 2) Indexar por grupo + posição
    const byGroup = new Map<string, StandingEntry[]>();
    for (const group of children) {
      const name: string = group?.name ?? group?.abbreviation ?? "";
      const letter = (name.match(/Group\s+([A-L])/i)?.[1] ?? "").toUpperCase();
      if (!letter) continue;
      const entries = group?.standings?.entries ?? [];
      const list: StandingEntry[] = entries
        .map((e: any) => {
          const stats: any[] = e?.stats ?? [];
          const stat = (n: string) =>
            Number(stats.find((s) => s?.name === n)?.value ?? 0);
          return {
            code: String(e?.team?.abbreviation ?? "").toUpperCase(),
            rank: Number(e?.note?.rank ?? 0),
            points: stat("points"),
            gd: stat("pointDifferential"),
            gf: stat("pointsFor"),
            group: letter,
          };
        })
        .filter((x: StandingEntry) => x.code && x.rank > 0)
        .sort((a: StandingEntry, b: StandingEntry) => a.rank - b.rank);
      byGroup.set(letter, list);
    }

    // 3) Mapear código FIFA → team_id (a coluna teams.code usa códigos PT-BR
    //    como BRA, ALG; mapeamos ESPN→nosso onde diverge)
    const espnToOurs: Record<string, string> = {
      RSA: "RSA", ALG: "ALG", DZA: "ALG",
      KSA: "KSA", SAU: "KSA",
      NED: "NED", HOL: "NED",
      GER: "GER",
      POR: "POR",
      KOR: "KOR",
      SUI: "SUI", SWI: "SUI",
      URU: "URU",
      CRO: "CRO",
      ENG: "ENG",
      JPN: "JPN", HAI: "HAI", BRA: "BRA",
      // restantes: mesma sigla
    };
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id, code");
    const codeToId = new Map<string, string>();
    for (const t of teams ?? []) {
      codeToId.set(String((t as any).code).toUpperCase(), (t as any).id);
    }
    const resolveTeamId = (espnCode: string): string | null => {
      const c = espnCode.toUpperCase();
      const mapped = espnToOurs[c] ?? c;
      return codeToId.get(mapped) ?? codeToId.get(c) ?? null;
    };

    // 4) Buscar R32 atuais
    const { data: r32, error } = await supabaseAdmin
      .from("knockout_matches")
      .select("id, position, home_source, away_source, home_team_id, away_team_id")
      .eq("round", "R32");
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Helpers para resolver as fontes textuais ("1º Grupo A", "2º Grupo B",
    // "3º A/B/C/D/F", etc.)
    const resolveSource = (src: string | null): string | null => {
      if (!src) return null;
      const txt = src.trim();
      // "1º Grupo X" / "2º Grupo X"
      const m1 = txt.match(/^([12])[ºo]\s*Grupo\s+([A-L])$/i);
      if (m1) {
        const pos = Number(m1[1]);
        const g = m1[2].toUpperCase();
        const list = byGroup.get(g) ?? [];
        return list.find((e) => e.rank === pos)?.code ?? null;
      }
      // "3º A/B/C/D/F" — pega o melhor 3º colocado entre os grupos listados
      const m3 = txt.match(/^3[ºo]\s*([A-L/]+)$/i);
      if (m3) {
        const groups = m3[1]
          .toUpperCase()
          .split("/")
          .map((g) => g.trim())
          .filter(Boolean);
        const thirds: StandingEntry[] = [];
        for (const g of groups) {
          const t = (byGroup.get(g) ?? []).find((e) => e.rank === 3);
          if (t) thirds.push(t);
        }
        // só decide se TODOS os grupos listados já tiverem 3º definido
        if (thirds.length < groups.length) return null;
        thirds.sort(
          (a, b) =>
            b.points - a.points || b.gd - a.gd || b.gf - a.gf ||
            a.code.localeCompare(b.code),
        );
        return thirds[0]?.code ?? null;
      }
      return null;
    };

    let updated = 0;
    const results: any[] = [];

    for (const row of r32 ?? []) {
      const patch: Record<string, string> = {};

      if (!row.home_team_id) {
        const code = resolveSource(row.home_source);
        const id = code ? resolveTeamId(code) : null;
        if (id) patch.home_team_id = id;
      }
      if (!row.away_team_id) {
        const code = resolveSource(row.away_source);
        const id = code ? resolveTeamId(code) : null;
        if (id) patch.away_team_id = id;
      }

      if (Object.keys(patch).length === 0) continue;

      const { error: uerr } = await supabaseAdmin
        .from("knockout_matches")
        .update(patch)
        .eq("id", (row as any).id);
      if (uerr) {
        results.push({ position: row.position, error: uerr.message });
      } else {
        updated++;
        results.push({ position: row.position, patched: patch });
      }
    }

    return Response.json({
      updated,
      groups: byGroup.size,
      r32: r32?.length ?? 0,
      results,
    });
  } catch (e: any) {
    return Response.json(
      { error: "exception", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
