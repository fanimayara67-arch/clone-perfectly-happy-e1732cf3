import type { PersonalData } from "@/components/survey/PersonalDataStep";

export type AnswerMap = Record<string, string | string[]>;

type GoogleFormPayload = {
  personal: PersonalData;
  screening: AnswerMap;
  main: AnswerMap;
};

type EntryMap = Record<string, string>;

export const GOOGLE_FORM_ID = "1FAIpQLSfkK5RUJIZ6a95AGx7zHDJAKWo9a1_SSEVO9umV8l5idc5VHw";
export const GOOGLE_FORM_URL = `https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/viewform`;
export const GOOGLE_FORM_EMBED_URL = `${GOOGLE_FORM_URL}?embedded=true`;
// Campo de identificação do formulário externo: preenchido pelo site, sem digitação.
const TRACKING_ENTRY_ID = "1804684228";

const GOOGLE_FORM_ENTRIES: EntryMap = {
  age: "",
  city: "",
  state: "",
  gender: "",
  email: "",

  // Triagem: preencha com os entry IDs do Google Forms quando criar as perguntas.
  s_1: "",
  s_2: "",
  s_3: "",
  s_4: "",
  s_5: "",
  s_6: "",
  s_7: "",
  s_8: "",
  s_9: "",
  s_10: "",
  s_11: "",
  s_12: "",
  s_13: "",
  s_14: "",
  s_15: "",
  s_16: "",
  s_17: "",
  s_18: "",
  s_19: "",
  s_20: "",

  // Pesquisa principal.
  knowledge_heard: "",
  knowledge_source: "",
  knowledge_purpose: "",
  use_personal: "",
  use_known_person: "",
  facial_term_known: "",
  facial_perception: "",
  facial_observed: "",
  body_perception: "",
  body_observed: "",
  safety_opinion: "",
  would_recommend: "",
  complementary_treatment: "",
  dentist_role: "",
  comments: "",
};

const appendValue = (body: URLSearchParams, entryId: string, value?: string | number | string[] | null) => {
  if (!entryId || value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item) body.append(`entry.${entryId}`, item);
    });
    return;
  }

  body.append(`entry.${entryId}`, String(value));
};

const appendAnswerMap = (body: URLSearchParams, answers: AnswerMap) => {
  Object.entries(answers).forEach(([questionId, value]) => {
    appendValue(body, GOOGLE_FORM_ENTRIES[questionId], value);
  });
};

export const isGoogleFormsConfigured = () =>
  Boolean(GOOGLE_FORM_ID) &&
  Object.values(GOOGLE_FORM_ENTRIES).some((entryId) => Boolean(entryId));

export const createGoogleFormUrl = (personal?: Partial<PersonalData>, embedded = true, trackingCode?: string) => {
  const params = new URLSearchParams();
  if (embedded) params.set("embedded", "true");
  if (trackingCode) {
    params.set("usp", "pp_url");
    appendValue(params, TRACKING_ENTRY_ID, trackingCode);
  }

  if (personal) {
    appendValue(params, GOOGLE_FORM_ENTRIES.age, personal.age);
    appendValue(params, GOOGLE_FORM_ENTRIES.city, personal.city);
    appendValue(params, GOOGLE_FORM_ENTRIES.state, personal.state);
    appendValue(params, GOOGLE_FORM_ENTRIES.gender, personal.gender);
    appendValue(params, GOOGLE_FORM_ENTRIES.email, personal.email);
  }

  const query = params.toString();
  return query ? `${GOOGLE_FORM_URL}?${query}` : GOOGLE_FORM_URL;
};

export const submitToGoogleForms = async ({ personal, screening, main }: GoogleFormPayload) => {
  if (!isGoogleFormsConfigured()) return { skipped: true };

  const body = new URLSearchParams();

  appendValue(body, GOOGLE_FORM_ENTRIES.age, personal.age);
  appendValue(body, GOOGLE_FORM_ENTRIES.city, personal.city);
  appendValue(body, GOOGLE_FORM_ENTRIES.state, personal.state);
  appendValue(body, GOOGLE_FORM_ENTRIES.gender, personal.gender);
  appendValue(body, GOOGLE_FORM_ENTRIES.email, personal.email);

  appendAnswerMap(body, screening);
  appendAnswerMap(body, main);

  await fetch(`https://docs.google.com/forms/d/e/${GOOGLE_FORM_ID}/formResponse`, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return { skipped: false };
};
