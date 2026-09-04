import { useState } from "react";
import { Copy, ExternalLink, Loader2, KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonalData } from "@/components/survey/PersonalDataStep";
import { createGoogleFormUrl } from "@/lib/google-forms";
import { toast } from "sonner";

interface GoogleFormStepProps {
  personal?: Partial<PersonalData>;
  trackingCode?: string;
  onDone: () => void;
}

export const GoogleFormStep = ({ personal, trackingCode, onDone }: GoogleFormStepProps) => {
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const embedUrl = createGoogleFormUrl(personal, true);
  const openUrl = createGoogleFormUrl(personal, false);

  const copyCode = async () => {
    if (!trackingCode) return;
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Anote o código manualmente.");
    }
  };

  // A conclusão não é marcada aqui: mark_google_form_completed é revogada para anon
  // (migration 20260429211029) e toda chamada voltava 42501. Quem marca de verdade
  // é confirm_response_with_token, chamada pela edge function sync-google-form-responses
  // com service_role quando a resposta aparece na planilha — e essa fonte é confiável,
  // pois depende do envio real do formulário, não do clique neste botão.
  const handleDone = () => {
    setFinishing(true);
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-hero rounded-2xl p-5 text-primary-foreground shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90 mb-2">
          Formulário Google
        </p>
        <h2 className="text-lg font-bold">Triagem e pesquisa</h2>
        <p className="text-sm opacity-90 mt-1 leading-snug">
          Responda a pesquisa abaixo. Se o Google não carregar no seu navegador, use o botão para abrir a pesquisa.
        </p>
      </div>

      {trackingCode && (
        <div className="bg-card rounded-2xl p-5 border-2 border-primary/30 shadow-card">
          <div className="flex items-start gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground leading-snug">
                Seu código de identificação
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Cole este código no campo <strong>"Código de identificação"</strong> dentro do Google Forms antes de enviar suas respostas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-xl p-3">
            <code className="flex-1 text-base font-mono font-bold text-foreground tracking-wider text-center">
              {trackingCode}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyCode}
              className="h-9 rounded-lg shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1.5 text-xs font-semibold">
                {copied ? "Copiado" : "Copiar"}
              </span>
            </Button>
          </div>
        </div>
      )}

      <Button asChild size="lg" className="h-12 w-full rounded-xl bg-gradient-primary font-semibold">
        <a href={openUrl} target="_blank" rel="noreferrer">
          Abrir pesquisa agora
          <ExternalLink className="h-4 w-4 ml-2" />
        </a>
      </Button>

      <div className="relative bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 z-10 flex min-h-[420px] items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Carregando Google Forms…</p>
              <p className="max-w-sm text-xs text-muted-foreground leading-relaxed">
                Caso demore ou fique em branco, toque em "Abrir pesquisa agora".
              </p>
            </div>
          </div>
        )}
        <iframe
          title="Google Forms — Triagem e Pesquisa"
          src={embedUrl}
          onLoad={() => setLoaded(true)}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-[calc(100vh-260px)] min-h-[760px] w-full border-0 bg-background"
        >
          Carregando formulário…
        </iframe>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" size="lg" className="h-12 rounded-xl">
          <a href={openUrl} target="_blank" rel="noreferrer">
            Abrir no Google Forms
            <ExternalLink className="h-4 w-4 ml-2" />
          </a>
        </Button>
        <Button
          size="lg"
          onClick={handleDone}
          disabled={finishing}
          className="h-12 rounded-xl bg-gradient-primary font-semibold"
        >
          {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizei o Google Forms"}
        </Button>
      </div>
    </div>
  );
};
