import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

export function MatchFilters({
  search, onSearch, group, onGroup,
}: {
  search: string; onSearch: (v: string) => void;
  group: string; onGroup: (v: string) => void;
}) {
  return (
    <div className="sticky top-14 z-[5] -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar time ou estádio…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-8 pr-8 h-9"
        />
        {search && (
          <button
            onClick={() => onSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
        <Button
          size="sm"
          variant={group === "" ? "default" : "outline"}
          className="h-7 px-3 text-xs shrink-0"
          onClick={() => onGroup("")}
        >Todos</Button>
        {GROUPS.map((g) => (
          <Button
            key={g}
            size="sm"
            variant={group === g ? "default" : "outline"}
            className="h-7 w-9 px-0 text-xs shrink-0"
            onClick={() => onGroup(g === group ? "" : g)}
          >{g}</Button>
        ))}
      </div>
    </div>
  );
}

export function filterMatches<T extends { group_name: string | null; venue: string | null; home_team_id: string; away_team_id: string }>(
  matches: T[],
  teams: Record<string, { name: string; code: string }>,
  search: string,
  group: string,
): T[] {
  const q = search.trim().toLowerCase();
  return matches.filter((m) => {
    if (group && m.group_name !== group) return false;
    if (!q) return true;
    const h = teams[m.home_team_id];
    const a = teams[m.away_team_id];
    return (
      h?.name.toLowerCase().includes(q) ||
      a?.name.toLowerCase().includes(q) ||
      h?.code.toLowerCase().includes(q) ||
      a?.code.toLowerCase().includes(q) ||
      (m.venue ?? "").toLowerCase().includes(q) ||
      (m.group_name ?? "").toLowerCase() === q
    );
  });
}
