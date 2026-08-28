import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShieldAlert, MapPin, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface EligibilityStepProps {
  onEligible: (answers: Record<string, string>) => void;
  onIneligible: (reason: "age" | "location" | "criteria") => void;
}

export const EligibilityStep = ({ onEligible, onIneligible }: EligibilityStepProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const canSubmit = CRITERIA.every((criterion) => !!answers[criterion.id]);

  const labelled = (raw: Record<string, string>) =>
    Object.fromEntries(
      CRITERIA.filter((c) => raw[c.id]).map((c) => [
        c.title,
        raw[c.id] === "yes" ? "Sim" : "Não",
      ]),
    );

  const setCriterionAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));

    const criterion = CRITERIA.find((item) => item.id === id);
    if (!criterion || value === criterion.eligibleValue) return;

    onIneligible(criterion.reason);
  };

  const handleContinue = () => {
    const failed = CRITERIA.find((criterion) => answers[criterion.id] !== criterion.eligibleValue);
    if (failed) return onIneligible(failed.reason);
    onEligible(labelled(answers));
  };


  return (
    <div className="space-y-5">
      <div className="bg-gradient-hero rounded-3xl p-6 text-primary-foreground shadow-elevated">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Critérios de Participação
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold leading-tight mb-2">
          Antes de começar
        </h1>
        <p className="text-sm opacity-95 leading-relaxed mb-2">
          Por favor, confirme todos os critérios obrigatórios para participar
          desta pesquisa.
        </p>
        <p className="text-sm opacity-95 leading-relaxed">
          GLP-1 refere-se a medicamentos usados principalmente para emagrecimento
          e controle do diabetes (como Ozempic, Wegovy e Saxenda).
        </p>
      </div>

      {CRITERIA.map((criterion) => (
        <CriterionCard
          key={criterion.id}
          icon={criterion.icon}
          title={criterion.title}
          subtitle={criterion.subtitle}
          value={answers[criterion.id] || ""}
          onChange={(value) => setCriterionAnswer(criterion.id, value)}
          name={criterion.id}
        />
      ))}

      <Button
        onClick={handleContinue}
        disabled={!canSubmit}
        size="lg"
        className="w-full h-14 text-base font-semibold rounded-xl bg-gradient-primary hover:opacity-95 shadow-soft disabled:opacity-50"
      >
        Continuar
      </Button>
    </div>
  );
};

const CRITERIA = [
  {
    id: "age-check",
    icon: <CalendarCheck className="h-4 w-4" />,
    title: "Você tem 18 anos ou mais?",
    subtitle: "Critério obrigatório para participação na pesquisa.",
    eligibleValue: "yes",
    reason: "age" as const,
  },
  {
    id: "bahia-check",
    icon: <MapPin className="h-4 w-4" />,
    title: "Você reside no estado da Bahia?",
    subtitle: "A coleta de dados está delimitada a residentes no estado da Bahia.",
    eligibleValue: "yes",
    reason: "location" as const,
  },
  {
    id: "glp1-check",
    icon: <ShieldAlert className="h-4 w-4" />,
    title: "Você utilizou agonistas de GLP-1 com objetivo de emagrecer?",
    subtitle: "Responda sim apenas se o uso foi especificamente para emagrecimento.",
    eligibleValue: "yes",
    reason: "criteria" as const,
  },
  {
    id: "glp1-duration-check",
    icon: <CalendarCheck className="h-4 w-4" />,
    title: "Você utilizou GLP-1 por pelo menos 3 meses?",
    subtitle: "Participantes com menos de 3 meses de uso não integram os critérios da pesquisa.",
    eligibleValue: "yes",
    reason: "criteria" as const,
  },
  {
    id: "schooling-check",
    icon: <CalendarCheck className="h-4 w-4" />,
    title: "Você possui ensino médio completo?",
    subtitle: "Critério necessário para garantir compreensão adequada das perguntas da pesquisa.",
    eligibleValue: "yes",
    reason: "criteria" as const,
  },
  {
    id: "procedure-check",
    icon: <ShieldAlert className="h-4 w-4" />,
    title: "Você realizou algum procedimento facial ou corporal recentemente?",
    subtitle: "Procedimentos recentes podem interferir na análise das percepções estéticas.",
    eligibleValue: "no",
    reason: "criteria" as const,
  },
  {
    id: "medicine-check",
    icon: <ShieldAlert className="h-4 w-4" />,
    title: "Você já fez uso de algum outro medicamento para perda de peso que não pertença à classe dos análogos de GLP-1 (semaglutida: Ozempic/Wegovy; liraglutida: Saxenda/Victoza; dulaglutida: Trulicity)?",
    subtitle: "Responda \"Sim\" apenas se usou outro medicamento para emagrecer que não seja um desses análogos de GLP-1 citados.",
    eligibleValue: "no",
    reason: "criteria" as const,
  },
];

interface CriterionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  name: string;
}

const CriterionCard = ({
  icon,
  title,
  subtitle,
  value,
  onChange,
  name,
}: CriterionCardProps) => (
  <div className="bg-card rounded-2xl p-5 shadow-card border border-border/60">
    <div className="flex items-start gap-3 mb-4">
      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <Label className="text-base font-semibold text-foreground leading-snug block">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {subtitle}
        </p>
      </div>
    </div>
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 gap-2.5">
      {[
        { v: "yes", label: "Sim" },
        { v: "no", label: "Não" },
      ].map((opt) => {
        const selected = value === opt.v;
        return (
          <label
            key={opt.v}
            className={cn(
              "flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 cursor-pointer transition-smooth active:scale-[0.99]",
              selected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <RadioGroupItem value={opt.v} id={`${name}-${opt.v}`} />
            <span className="text-sm font-semibold text-foreground">
              {opt.label}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  </div>
);
