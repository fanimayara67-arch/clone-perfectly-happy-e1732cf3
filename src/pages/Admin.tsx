import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,

  HelpCircle,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { GOOGLE_FORM_URL } from "@/lib/google-forms";
import { cn } from "@/lib/utils";

interface Response {
  id: string;
  full_name: string | null;
  age: number;
  email: string | null;
  phone: string | null;
  city: string;
  state: string;
  gender: string;
  tracking_code: string | null;
  google_form_completed: boolean;
  google_form_completed_at: string | null;
  token_validated?: boolean;
  token_validated_at?: string | null;
  consent_given: boolean;
  screening_answers: Record<string, unknown>;
  main_answers: Record<string, unknown>;
  created_at: string;
}

interface InvalidResponse {
  id: string;
  attempted_code: string | null;
  reason: string | null;
  form_submitted_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const IGNORED_FORM_KEYS = /^(carimbo de data\/hora|timestamp|anulado)$/i;
const CODE_FORM_KEY = /(c[oó]digo|autentica|token)/i;

const formAnswerEntries = (r: Response) =>
  Object.entries(r.main_answers || {}).filter(
    ([k, v]) =>
      !IGNORED_FORM_KEYS.test(k.trim()) &&
      !CODE_FORM_KEY.test(k) &&
      String(v ?? "").trim() !== "",
  );

const hasFormAnswers = (r: Response) => formAnswerEntries(r).length > 0;

const eligibilityEntries = (r: Response) => {
  const el = (r.screening_answers as { eligibility?: Record<string, string> })?.eligibility;
  return el ? Object.entries(el) : [];
};

const consentInfo = (r: Response) =>
  (r.screening_answers as {
    electronic_consent?: {
      participant_name?: string | null;
      identity_document?: string | null;
      consent_city?: string | null;
      consent_date?: string | null;
      accepted_tcle?: boolean;
    };
  })?.electronic_consent || null;

const displayName = (r: Response) =>
  consentInfo(r)?.participant_name ||
  (r.full_name && r.full_name !== "Não informado" ? r.full_name : null) ||
  "Participante anônimo";




const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [responses, setResponses] = useState<Response[]>([]);
  const [invalids, setInvalids] = useState<InvalidResponse[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending" | "answers">("all");
  const [selected, setSelected] = useState<Response | null>(null);
  const [showForms, setShowForms] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [invalidOpen, setInvalidOpen] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchAll = async () => {
    const [{ data, error }, { data: inv }] = await Promise.all([
      supabase.from("survey_responses").select("*").order("created_at", { ascending: false }),
      supabase
        .from("invalid_form_responses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (inv) setInvalids(inv as unknown as InvalidResponse[]);
    return { data: (data || []) as Response[], error };
  };

  const syncGoogleForms = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-google-form-responses",
        { body: {} },
      );
      if (error) throw error;
      const d = data as { processed?: number; valid?: number; invalid?: number; error?: string };
      if (d?.error) throw new Error(d.error);
      toast.success(
        `Sincronizado: ${d.valid ?? 0} válidas, ${d.invalid ?? 0} inválidas (${d.processed ?? 0} processadas)`,
      );
      const { data: fresh } = await fetchAll();
      setResponses(fresh);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro ao sincronizar: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;

    const load = async () => {
      const { data, error } = await fetchAll();
      if (error) {
        toast.error("Erro ao carregar respostas");
        console.error(error);
      } else {
        setResponses(data);
      }
      setFetching(false);
    };
    load();

    // Poll every 10s for new/updated responses (realtime disabled for security)
    const interval = setInterval(async () => {
      const { data: fresh, error } = await fetchAll();
      if (error) {
        console.error(error);
        return;
      }
      setResponses((prev) => {
        const prevIds = new Set(prev.map((r) => r.id));
        const newOnes = fresh.filter((r) => !prevIds.has(r.id));
        if (newOnes.length > 0) {
          const first = newOnes[0];
          setHighlightId(first.id);
          setTimeout(() => setHighlightId(null), 3000);
          toast.success(`Nova resposta: ${displayName(first)}`, {
            description: first.tracking_code || "sem código",
          });
        }
        // Detect completion changes
        const prevById = new Map(prev.map((r) => [r.id, r]));
        for (const r of fresh) {
          const old = prevById.get(r.id);
          if (old && !old.google_form_completed && r.google_form_completed) {
            toast.info(`${displayName(r)} concluiu o Google Forms`);
          }
        }
        return fresh;
      });
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [user, isAdmin]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return responses.filter((r) => {
      if (statusFilter === "completed" && !r.google_form_completed) return false;
      if (statusFilter === "pending" && r.google_form_completed) return false;
      if (statusFilter === "answers" && !hasFormAnswers(r)) return false;
      if (!q) return true;
      return (
        displayName(r).toLowerCase().includes(q) ||
        (r.tracking_code || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.city || "").toLowerCase().includes(q)
      );
    });
  }, [responses, search, statusFilter]);

  const stats = useMemo(() => {
    const total = responses.length;
    const completed = responses.filter((r) => r.google_form_completed).length;
    const withAnswers = responses.filter(hasFormAnswers).length;
    const pending = total - completed;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const last24h = responses.filter((r) => new Date(r.created_at).getTime() > cutoff).length;
    return { total, completed, pending, last24h, withAnswers };
  }, [responses]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;

  const copyCode = (code: string | null) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  const exportCsv = () => {
    const rows = filtered.map((r) => ({
      codigo: r.tracking_code || "",
      nome: displayName(r),
      documento: consentInfo(r)?.identity_document || "",
      idade: r.age,
      genero: r.gender,
      email: r.email || "",
      cidade: r.city,
      uf: r.state,
      criterios: eligibilityEntries(r)
        .map(([q, a]) => `${q}: ${a}`)
        .join(" | "),
      respostas_forms: formAnswerEntries(r)
        .map(([q, a]) => `${q.trim()}: ${String(a)}`)
        .join(" | "),
      token_validado: r.token_validated ? "sim" : "nao",
      google_forms_concluido: r.google_form_completed ? "sim" : "nao",
      data_cadastro: new Date(r.created_at).toLocaleString("pt-BR"),
      data_conclusao_forms: r.google_form_completed_at
        ? new Date(r.google_form_completed_at).toLocaleString("pt-BR")
        : "",
    }));

    if (rows.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h as keyof typeof row]).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `respostas-uniftc-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportado: ${rows.length} respostas`);
  };

  const openEdit = (r: Response) => {
    setEditing(r);
    setEditForm({
      full_name: r.full_name ?? "",
      age: String(r.age ?? ""),
      email: r.email ?? "",
      city: r.city ?? "",
      state: r.state ?? "",
      gender: r.gender ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const age = Number(editForm.age);
    if (!Number.isFinite(age) || age <= 0) {
      toast.error("Idade inválida");
      return;
    }
    if (!editForm.city.trim() || !editForm.state.trim() || !editForm.gender.trim()) {
      toast.error("Cidade, UF e gênero são obrigatórios");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("survey_responses")
      .update({
        full_name: editForm.full_name.trim() || null,
        age,
        email: editForm.email.trim() || null,
        city: editForm.city.trim(),
        state: editForm.state.trim(),
        gender: editForm.gender.trim(),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar: " + error.message);
      return;
    }
    toast.success("Cadastro atualizado");
    setEditing(null);
    const { data: fresh } = await fetchAll();
    if (fresh) setResponses(fresh as Response[]);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    const { error } = await supabase.from("survey_responses").delete().eq("id", deleting.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível excluir: " + error.message);
      return;
    }
    toast.success("Registro excluído");
    setDeleting(null);
    setSelected(null);
    const { data: fresh } = await fetchAll();
    if (fresh) setResponses(fresh as Response[]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu");
  };


  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft shrink-0">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                Painel Administrativo
              </p>
              <h1 className="text-sm font-bold truncate">UNIFTC · Pesquisa GLP-1</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Tempo real
            </div>
            <Button variant="default" size="sm" onClick={syncGoogleForms} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline ml-1">Validar Google Forms</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Ajuda</span>
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Concluídos"
            value={stats.completed}
            tone="success"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Pendentes"
            value={stats.pending}
            tone="warn"
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Com respostas"
            value={stats.withAnswers}
          />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Últimas 24h" value={stats.last24h} />
        </div>

        {invalids.length > 0 && (
          <button
            onClick={() => setInvalidOpen(true)}
            className="w-full text-left bg-destructive/5 border border-destructive/30 rounded-2xl p-4 flex items-center gap-3 hover:bg-destructive/10 transition-smooth"
          >
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                {invalids.length} resposta(s) do Google Forms com código inválido
              </p>
              <p className="text-xs text-muted-foreground">
                Clique para revisar os envios que não puderam ser vinculados a um participante.
              </p>
            </div>
          </button>
        )}


        {/* Filters */}
        <div className="bg-card rounded-2xl p-4 shadow-card border border-border/60 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código, email ou cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="answers">Com respostas do Forms</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportCsv} variant="outline">
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl shadow-card border border-border/60 overflow-hidden">
          {fetching ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma resposta encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border/60">
                  <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Participante</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Cidade/UF</th>
                    <th className="px-4 py-3 hidden md:table-cell">E-mail</th>
                    <th className="px-4 py-3 hidden md:table-cell">Respostas</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Data</th>
                    <th className="px-4 py-3"></th>

                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-border/40 hover:bg-secondary/30 transition-smooth",
                        highlightId === r.id && "bg-primary/10 animate-pulse"
                      )}
                    >
                      <td className="px-4 py-3">
                        {r.tracking_code ? (
                          <button
                            onClick={() => copyCode(r.tracking_code)}
                            className="font-mono text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                            title="Copiar código"
                          >
                            {r.tracking_code}
                            <Copy className="h-3 w-3 opacity-60" />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{displayName(r)}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.age} anos · {r.gender}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {r.city}/{r.state}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {r.email ? (
                          <span className="truncate max-w-[180px] block">{r.email}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">
                        {hasFormAnswers(r) ? (
                          <span className="font-semibold text-primary">
                            {formAnswerEntries(r).length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          {r.google_form_completed ? (
                            <Badge className="bg-success text-success-foreground hover:bg-success">
                              Concluído
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-orange-500/50 text-orange-600 dark:text-orange-400">
                              Pendente
                            </Badge>
                          )}
                          {r.token_validated ? (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/15 gap-1">
                              <ShieldCheck className="h-3 w-3" /> Token válido
                            </Badge>
                          ) : r.google_form_completed ? (
                            <Badge variant="outline" className="border-destructive/50 text-destructive gap-1">
                              <ShieldAlert className="h-3 w-3" /> Não validado
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasFormAnswers(r) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              onClick={() => {
                                setSelected(r);
                                setShowForms(true);
                              }}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Respostas</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelected(r);
                              setShowForms(false);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected ? displayName(selected) : "Detalhes da resposta"}
            </DialogTitle>

          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-1 p-1 rounded-xl bg-secondary/60">
                <button
                  onClick={() => setShowForms(false)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-smooth",
                    !showForms ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"
                  )}
                >
                  Cadastro
                </button>
                <button
                  onClick={() => setShowForms(true)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-smooth",
                    showForms ? "bg-card shadow-soft text-foreground" : "text-muted-foreground"
                  )}
                >
                  Google Forms
                  {hasFormAnswers(selected) && (
                    <span className="ml-1.5 text-[10px] font-bold text-primary">
                      {formAnswerEntries(selected).length}
                    </span>
                  )}
                </button>
              </div>

              {showForms ? (
                <Section title="Respostas do Google Forms">
                  {hasFormAnswers(selected) ? (
                    <div className="space-y-2.5">
                      {formAnswerEntries(selected).map(([q, a], i) => (
                        <div key={q} className="rounded-lg bg-card border border-border/60 p-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            {i + 1}. {q.trim()}
                          </p>
                          <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">
                            {String(a)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ainda não há respostas do Google Forms para este participante. Use “Validar Google
                      Forms” para sincronizar.
                    </p>
                  )}
                </Section>
              ) : (
                <>
                  <Section title="Identificação">
                    <Field label="Código" value={selected.tracking_code || "—"} mono />
                    <Field
                      label="Status do Google Forms"
                      value={
                        selected.google_form_completed
                          ? `Concluído em ${new Date(selected.google_form_completed_at!).toLocaleString("pt-BR")}`
                          : "Pendente"
                      }
                    />
                    <Field
                      label="Token"
                      value={
                        selected.token_validated
                          ? `Validado em ${new Date(selected.token_validated_at!).toLocaleString("pt-BR")}`
                          : "Não validado"
                      }
                    />
                    <Field label="Cadastrado em" value={new Date(selected.created_at).toLocaleString("pt-BR")} />
                  </Section>

                  <Section title="Dados pessoais">
                    <Field label="Idade" value={String(selected.age)} />
                    <Field label="Gênero" value={selected.gender} />
                    <Field label="E-mail" value={selected.email || "—"} />
                    <Field label="Cidade/UF" value={`${selected.city}/${selected.state}`} />
                  </Section>

                  <Section title="Termo de consentimento (TCLE)">
                    <Field
                      label="Nome informado"
                      value={consentInfo(selected)?.participant_name || "—"}
                    />
                    <Field
                      label="Documento"
                      value={consentInfo(selected)?.identity_document || "—"}
                    />
                    <Field label="Cidade" value={consentInfo(selected)?.consent_city || "—"} />
                    <Field label="Data" value={consentInfo(selected)?.consent_date || "—"} />
                    <Field
                      label="Aceite"
                      value={selected.consent_given ? "Aceitou o TCLE" : "Não aceitou"}
                    />
                  </Section>

                  <Section title="Critérios de elegibilidade">
                    {eligibilityEntries(selected).length > 0 ? (
                      <div className="space-y-2">
                        {eligibilityEntries(selected).map(([q, a]) => (
                          <div key={q} className="flex justify-between gap-3 items-start">
                            <span className="text-xs text-muted-foreground">{q}</span>
                            <span className="text-sm font-semibold shrink-0">{a}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Sem registro de critérios (cadastro anterior a esta atualização).
                      </p>
                    )}
                  </Section>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invalid form responses dialog */}
      <Dialog open={invalidOpen} onOpenChange={setInvalidOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Respostas do Forms sem participante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {invalids.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma resposta inválida.</p>
            ) : (
              invalids.map((iv) => (
                <div key={iv.id} className="rounded-xl border border-border/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-destructive">
                      {iv.attempted_code || "sem código"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(iv.form_submitted_at || iv.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{iv.reason || "Código não reconhecido"}</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-primary">Ver respostas enviadas</summary>
                    <div className="mt-2 space-y-1.5">
                      {Object.entries(iv.payload || {})
                        .filter(([, v]) => String(v ?? "").trim() !== "")
                        .map(([q, v]) => (
                          <div key={q}>
                            <p className="text-muted-foreground">{q.trim()}</p>
                            <p className="font-semibold text-foreground">{String(v)}</p>
                          </div>
                        ))}
                    </div>
                  </details>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Help dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Como cruzar com o Google Forms</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Cada participante recebe um <strong>código único</strong> (ex.: <code className="font-mono text-primary">UFTC-A3F9K2</code>) ao terminar os dados pessoais.
            </p>
            <p>
              No Google Forms, certifique-se de que existe um campo chamado <strong>"Código de identificação"</strong> onde o participante cola esse código antes de enviar.
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Abra a planilha de respostas do Google Forms.</li>
              <li>Encontre a coluna "Código de identificação".</li>
              <li>
                Cruze com a coluna <code>codigo</code> do CSV exportado deste painel — assim você liga cada resposta do Forms aos dados pessoais aqui.
              </li>
            </ol>
            <Button asChild variant="outline" className="w-full">
              <a href={GOOGLE_FORM_URL} target="_blank" rel="noreferrer">
                Abrir o Google Forms
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "success" | "warn";
}) => (
  <div className="bg-card rounded-2xl p-4 shadow-card border border-border/60">
    <div className="flex items-center gap-2 text-muted-foreground mb-1">
      <div
        className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center",
          tone === "success" && "bg-success/15 text-success",
          tone === "warn" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
          !tone && "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-bold text-foreground">{value}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {title}
    </h3>
    <div className="bg-secondary/40 rounded-lg p-3 space-y-1.5">{children}</div>
  </div>
);

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between gap-3">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className={cn("text-sm text-foreground text-right break-all", mono && "font-mono font-semibold text-primary")}>
      {value}
    </span>
  </div>
);

export default Admin;
