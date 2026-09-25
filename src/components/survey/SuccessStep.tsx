import { CheckCircle2 } from "lucide-react";

interface SuccessStepProps {
  onRestart: () => void;
}

export const SuccessStep = (_props: SuccessStepProps) => {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-hero rounded-3xl p-7 text-primary-foreground text-center shadow-elevated">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-4 backdrop-blur-sm">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="text-2xl font-bold">Obrigado pela participação!</h1>
        <p className="text-sm mt-3">A confirmação do envio depende da sincronização com o Google Forms. Este aviso não confirma a conclusão. Se ainda não enviou, volte ao formulário para finalizar.</p>
      </div>
    </div>
  );
};
