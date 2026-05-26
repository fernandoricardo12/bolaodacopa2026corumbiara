// FIFA code → ISO 3166-1 alpha-2 (or gb-eng/gb-sct) for flagcdn.com
const MAP: Record<string, string> = {
  ALG: "dz", ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BIH: "ba", BOL: "bo",
  BRA: "br", CAN: "ca", CIV: "ci", COD: "cd", COL: "co", CPV: "cv", CRO: "hr",
  CUW: "cw", CZE: "cz", ECU: "ec", EGY: "eg", ENG: "gb-eng", ESP: "es", FRA: "fr",
  GER: "de", GHA: "gh", HAI: "ht", IRN: "ir", JOR: "jo", JPN: "jp", KOR: "kr",
  KSA: "sa", MAR: "ma", MEX: "mx", NED: "nl", NOR: "no", NZL: "nz", PAN: "pa",
  PAR: "py", POR: "pt", QAT: "qa", RSA: "za", SCO: "gb-sct", SEN: "sn", SUI: "ch",
  SWE: "se", TUN: "tn", TUR: "tr", URU: "uy", USA: "us", UZB: "uz",
};

export function flagUrl(code: string, size: 40 | 80 | 160 = 80) {
  const iso = MAP[code?.toUpperCase()] ?? "un";
  return `https://flagcdn.com/w${size}/${iso}.png`;
}

export function FlagImg({ code, name, size = 40, className = "" }: { code: string; name?: string; size?: 24 | 32 | 40 | 56; className?: string }) {
  const w = size <= 32 ? 40 : size <= 40 ? 80 : 160;
  return (
    <img
      src={flagUrl(code, w)}
      alt={name ?? code}
      loading="lazy"
      width={size}
      height={Math.round(size * 0.66)}
      className={`inline-block rounded-sm shadow-sm object-cover ${className}`}
      style={{ width: size, height: Math.round(size * 0.66) }}
    />
  );
}
