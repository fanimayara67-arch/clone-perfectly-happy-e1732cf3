import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

export const personalDataSchema = z.object({
  age: z
    .number({ invalid_type_error: "Informe sua idade" })
    .int()
    .min(18, "Idade mínima: 18 anos")
    .max(110, "Idade inválida"),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().trim().length(2, "UF deve conter 2 letras"),
  gender: z.string().min(1, "Selecione o gênero"),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    // 254 e o teto do chk_email_len no banco; 255 passava aqui e estourava no INSERT.
    .max(254, "E-mail muito longo"),
});

export type PersonalData = z.infer<typeof personalDataSchema>;

interface PersonalDataStepProps {
  data: Partial<PersonalData>;
  onChange: (data: Partial<PersonalData>) => void;
  onValidityChange: (valid: boolean) => void;
}

const GENDERS = [
  "Feminino",
  "Masculino",
  "Não-binário",
  "Transgênero",
  "Prefiro não informar",
  "Outro",
];

export const PersonalDataStep = ({
  data,
  onChange,
  onValidityChange,
}: PersonalDataStepProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dataRef = useRef<Partial<PersonalData>>(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const update = (patch: Partial<PersonalData>) => {
    const next = { ...dataRef.current, ...patch };
    dataRef.current = next;
    onChange(next);
    const result = personalDataSchema.safeParse(next);
    if (result.success) {
      setErrors({});
      onValidityChange(true);
    } else {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        if (i.path[0]) errs[String(i.path[0])] = i.message;
      });
      setErrors(errs);
      onValidityChange(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Dados Pessoais"
        subtitle="Preencha seus dados antes de iniciar as perguntas."
      />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Idade" error={errors.age}>
            <Input
              type="number"
              inputMode="numeric"
              value={data.age ?? ""}
              onChange={(e) =>
                update({ age: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Ex.: 28"
              min={18}
              max={110}
              className="h-12"
            />
          </Field>
          <Field label="Gênero" error={errors.gender}>
            <Select
              value={data.gender || ""}
              onValueChange={(v) => update({ gender: v })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
          Localização
        </p>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Cidade" error={errors.city}>
            <Input
              value={data.city || ""}
              onChange={(e) => update({ city: e.target.value })}
              placeholder="Ex.: Salvador"
              className="h-12"
            />
          </Field>
          <Field label="UF" error={errors.state}>
            <Input
              value={data.state || ""}
              onChange={(e) =>
                update({ state: e.target.value.toUpperCase().slice(0, 2) })
              }
              maxLength={2}
              placeholder="BA"
              className="h-12 uppercase"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <Field label="E-mail para receber informações e resultados" error={errors.email}>
          <Input
            type="email"
            value={data.email || ""}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="seu@email.com"
            inputMode="email"
            maxLength={255}
            className="h-12"
          />
        </Field>
      </Card>
    </div>
  );
};

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="bg-gradient-hero rounded-2xl p-5 text-primary-foreground shadow-soft">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="text-sm opacity-90 mt-0.5 leading-snug">{subtitle}</p>
  </div>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card rounded-2xl p-5 shadow-card border border-border/60 space-y-4">
    {children}
  </div>
);

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-semibold text-foreground">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive font-medium">{error}</p>}
  </div>
);
