export function Footer() {
  return (
    <footer className="mt-8 border-t bg-card/60">
      <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground space-y-1">
        <p>
          Administrador e Desenvolvedor:{" "}
          <strong className="text-foreground">Fernando Rodrigues Ricardo</strong>
        </p>
        <p>
          Suporte / Comprovantes:{" "}
          <a
            href="https://wa.me/5569984236281"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 hover:underline"
          >
            WhatsApp (69) 98423-6281
          </a>
        </p>
        <p className="opacity-70">© {new Date().getFullYear()} Bolão Copa 2026</p>
      </div>
    </footer>
  );
}
