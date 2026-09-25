# Auditoria do fluxo de cadastros e respostas — 25/09/2026

## Escopo e evidências

O Git estava sem alterações locais ao iniciar. Foram lidos o relatório anterior, README, páginas, componentes, hooks, tipos, configurações, todas as migrations disponíveis e a Edge Function. Nenhum dado de produção foi lido, excluído ou alterado. Não houve deploy.

O relatório anterior tratava do cadastro e ainda listava deploy/teste ponta a ponta como próximos passos. Sua conclusão de resolução não é evidência de implantação. A explicação sobre objeto JSONB aninhado não demonstra por si um erro de parâmetros; JSONB é aceito pela RPC. A definição mais recente do cadastro é um wrapper SECURITY INVOKER que chama private.submit_survey_response_checked, SECURITY DEFINER, com validações e comparação do conteúdo em retentativas. Ela foi preservada.

## Fluxo real encontrado

- src/pages/Index.tsx: consentimento, elegibilidade, dados e geração criptográfica de UFTC-XXXXXX; chama submit_survey_response.
- private.submit_survey_response_checked: insere survey_responses. O trigger register_tracking_code_from_response registra valid_tokens dentro da mesma transação.
- src/lib/google-forms.ts: preenche o campo entry.1804684228 do Google Forms. Os demais entry IDs estão vazios. O questionário efetivo é externo; QuestionsStep não participa deste fluxo.
- GoogleFormStep: iframe/link externo. O botão de finalizar apenas muda a tela; não observa envio cross-origin e não comprova conclusão.
- sync-google-form-responses: autentica administrador, lê planilha via gateway Lovable e associa envios pelo código.
- Admin.tsx: botão de sincronização invoca a Edge Function; o intervalo de dez segundos apenas consulta o banco. Não foi encontrado cron/webhook de sincronização.
- AdminLogin/use-auth/user_roles: sessão Supabase de administrador. O código UFTC é identificador de vinculação gerado pelo cadastro, não JWT nem evidência de uma resposta; não há tela de resgate de convite independente.

Tabelas encontradas: survey_responses, valid_tokens, invalid_form_responses e user_roles; user_roles referencia auth.users. Não há tabela separada de respostas individuais do questionário: main_answers armazena o payload importado.

## Defeitos demonstráveis no código anterior

1. A Edge Function confirmava token/conclusão em uma RPC e gravava main_answers/data em uma segunda requisição. Falha na segunda deixava estado parcial.
2. Datas da planilha passavam por new Date(texto), que não interpreta dd/mm/aaaa de forma confiável. Data ausente virava horário da sincronização. Uma linha com data inválida interrompia o lote inteiro, bloqueando linhas seguintes.
3. A coluna do código era a primeira contendo termos amplos como identificação. Podia selecionar documento em vez de UFTC. A consulta também não fixava a aba da planilha.
4. Reenvios do mesmo código sobrescreviam payload anterior. Não havia identificador da evidência nem revisão de múltiplos envios.
5. O painel contava somente google_form_completed, sem comprovação do envio, exclusão de testes ou conflitos de identidade; a consulta sem paginação podia truncar a contagem.
6. Falhas de recarga e da consulta de invalid_form_responses eram ignoradas em partes do painel. O detalhe aberto mantinha o snapshot antigo.
7. Recarregar a participação descartava o código persistido na sessão, favorecendo novo cadastro.
8. A política Validated survey submissions e o GRANT INSERT reintroduzidos em migration antiga permitiam inserir diretamente valores de conclusão. O fluxo mais recente já usa uma RPC privada, portanto essa rota direta foi fechada.

Não é possível afirmar qual destes defeitos atingiu cada registro real sem ler banco, planilha e logs.

## Correções

A migration 20260925160000_verified_response_integrity.sql é aditiva, transacional e não apaga/backfilla registros. Acrescenta survey_started_at, verified_source_key, verified_at, research_classification e classification_note. A classificação inicial unreviewed é nova; nenhum marcador anterior é reescrito pela migration. Não importa automaticamente a seleção da equipe, cuja localização ainda precisa ser informada.

A nova RPC ingest_verified_form_response, exclusiva de service_role, bloqueia cadastro e token, valida evidência, confirma uso do token, grava respostas e conclusão atomicamente. Datas anteriores ao cadastro ou futuras, token indisponível/vinculado a outro cadastro, anulação explícita, payload legado diferente e múltiplos envios exigem revisão. A retentativa da mesma evidência é idempotente. As antigas RPCs baseadas apenas no código deixam de fabricar conclusões.

verified_source_key é SHA-256 do identificador da planilha, aba e payload canônico. É uma impressão da evidência, não o ID nativo de resposta Google Forms. Mudanças no conteúdo geram conflito para revisão; mudar a ordem das linhas não cria nova evidência. Um envio idêntico é tratado como retentativa; não são criadas múltiplas respostas válidas.

A Edge Function exige aba e cabeçalhos explícitos, data brasileira válida e fuso configurado, além de uma resposta obrigatória. Erros por linha não interrompem as demais. Retorna linhas/motivos de falha sem expor payload/credenciais em logs. Ocorrências de negócio são mantidas em invalid_form_responses; erros de parsing/banco aparecem no relatório da execução. O histórico pode conter ocorrências posteriormente resolvidas, por isso é rotulado como histórico.

O painel usa dados persistidos, paginação por ID, atualização do detalhe, erros visíveis e classificação manual com justificativa. Mostra cadastro/início, conclusão legada, envio verificado, teste, duplicado confirmado e revisão. Para a meta: envio verificado + classificação real + nenhum conflito de identidade entre registros elegíveis. E-mail normalizado, documento, código e evidência detectam candidatos a duplicidade; nome/cidade/idade/gênero não identificam pessoas. Candidatos não são excluídos nem fundidos. Não se presume unicidade universal quando faltam identificadores; a seleção real ainda requer revisão da equipe.

O código da participação é mantido em sessionStorage somente após cadastro confirmado, sem guardar dados pessoais ali; recarga na mesma aba retoma o formulário. Abertura registra somente início; a tela final informa que a confirmação depende da sincronização.

## Limites e operação

- Não foi validado o ambiente real, a autenticidade da planilha, o mapeamento atual do campo do Forms, a seleção manual ou a quantidade de respostas reais.
- O repositório NÃO contém o CREATE TABLE original de valid_tokens nem o corpo original de validate_and_consume_token. Isso impede afirmar que o histórico completo reconstrói produção do zero. O teste PostgreSQL usa fixture explícita dessa estrutura, baseada nos tipos gerados, e executa as migrations reais do trigger, cadastro atual e correção.
- A leitura da planilha exige que a aba seja a origem controlada das respostas do Forms. Edição manual da planilha não é prova criptográfica de envio. A classificação real nunca é inferida automaticamente do payload/token.
- A execução de sincronização continua sendo administrativa pelo botão. O polling não substitui essa execução. Automação fora do painel requer configurar uma integração autenticada no ambiente; não foi criado acesso público nem segredo de cron.
- O contador conservador pode inicialmente ser menor que o legado, até reconciliar evidências e importar/reproduzir a seleção já feita pela equipe. Isso não altera nem invalida automaticamente a seleção anterior.
- Datas aceitas nesta integração: dd/mm/aaaa hh:mm[:ss]. Configurar o fuso real da planilha; dados de outros formatos/fusos ficam para revisão, sem adivinhação.
- Planilhas muito grandes podem exceder o tempo da Edge Function; retentativa é idempotente, mas paginação/cursor de ingestão futura pode ser necessária. O painel exibe até 200 ocorrências históricas; isso é explícito e não limita a contagem dos cadastros.

## Acesso e publicação pendentes

Inicialmente o .env local continha apenas as três variáveis públicas VITE_SUPABASE_*. Durante a sessão surgiram alterações externas com API_KEY_GOOGLE_FORMS, ID_CONSOLE e CHAVE_SECRETA. Foram preservadas sem edição e sem imprimir valores. Os formatos indicam chave de API Google e client ID/secret OAuth Google; isso não é uma sessão OAuth autorizada nem credencial administrativa Supabase. Ainda faltam acesso autorizado às respostas/planilha, identificação da aba e sessão administrativa/banco/logs. O .env já era rastreado pelo Git: não incluir essa alteração externa em commit ou publicação. Não fornecer service_role em código frontend ou chat.

1. Obter a localização exata da seleção manual, quais códigos foram aprovados e evidências dos testes; conservar essa lista como fonte da revisão. Não classificar registros por parecerem artificiais ou por token auto-generated by site.
2. Executar audit/predeployment-readonly.sql em sessão autorizada. Exportar schema, funções, policies e backup das quatro tabelas, com acesso restrito; verificar restauração em staging. O SQL é somente leitura e contém identificadores pessoais nos resultados: manter no ambiente autorizado.
3. Conferir schema real de valid_tokens, constraints/FKs, permissões e histórico aplicado antes da migration; recuperar baseline ausente. Nenhuma exclusão foi planejada, portanto não há lista de registros a apagar. Qualquer futura limpeza requer lista nominal de IDs/códigos, backup e aprovação específica.
4. Aplicar a nova migration primeiro em staging. Verificar cadastro anônimo, RLS de admin/não admin, token ativo/usado e falhas/reenvios com formulários de teste isolados da pesquisa.
5. Configurar na Edge Function: GOOGLE_FORM_RESPONSES_SHEET_ID, GOOGLE_FORM_RESPONSES_TAB, GOOGLE_FORM_CODE_HEADER, GOOGLE_FORM_TIMESTAMP_HEADER, GOOGLE_FORM_REQUIRED_ANSWER_HEADER, GOOGLE_FORM_TIMEZONE_OFFSET (por exemplo -03:00 somente se for o fuso real). Manter LOVABLE_API_KEY e GOOGLE_SHEETS_API_KEY válidas. SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY pertencem ao ambiente seguro da função. Os três cabeçalhos devem apontar para colunas distintas. Usar uma pergunta efetivamente obrigatória do questionário.
6. Publicar a Edge Function imediatamente após a migration, em janela coordenada: a função antiga chama a RPC que passa a rejeitar confirmações sem evidência. Publicar o frontend depois. Regenerar tipos do schema real e conferir o diff.
7. Sincronizar e revisar as ocorrências; classificar apenas com base na seleção já confirmada. Conferir a contagem contra os envios reais e após recarregar o painel. Não aplicar UPDATE em massa para fazer os números coincidirem.

## Arquivos

- src/pages/Index.tsx; src/pages/Admin.tsx.
- src/components/survey/GoogleFormStep.tsx; SuccessStep.tsx.
- src/lib/response-audit.ts; src/integrations/supabase/types.ts.
- supabase/functions/sync-google-form-responses/index.ts; validation.ts.
- supabase/migrations/20260925160000_verified_response_integrity.sql.
- src/test/response-audit.test.ts; response-integrity.test.ts; survey-flow.test.tsx; setup.ts.
- package.json/package-lock.json: PGlite somente como dependência de desenvolvimento para testar SQL local.
- audit/predeployment-readonly.sql e este relatório.

## Verificação

Resultados finais locais:
- npm run test -- --maxWorkers=1: 4 arquivos, 24 testes aprovados (inclui 1 teste original).
- tsc --noEmit -p tsconfig.app.json e tsconfig.node.json: aprovados.
- ESLint dos arquivos alterados: aprovado.
- npm run build: aprovado (1788 módulos).
- git diff --check: aprovado.

Cobertura: cadastro anônimo real pela RPC em PostgreSQL isolado; trigger de token; retentativa; início sem conclusão; código inválido/inexistente; token inativo; confirmação com payload; reenvio idempotente; conflito de evidência; rollback após unique violation; preservação de payload/classificação; negação de conclusão/insert/UPDATE pelo cliente; contagem de testes/duplicidades/revisão; estabilidade da contagem após serialização/recarga; datas brasileiras e cabeçalhos ambíguos; componente de formulário não conclui ao abrir/clicar e mostra erro de persistência.

Não testado ponta a ponta em ambiente real: concessão de papel admin e RLS baseada em auth.uid(), gateway Google, envio real externo, permissões/configuração Deno implantadas, seleção real da equipe e contagem contra produção. Os testes não certificam Supabase/Google Forms reais nem implantação da Edge Function Deno. Não foi feito teste visual em navegador autenticado.

O lint completo encontrou quatro erros preexistentes em command.tsx, textarea.tsx, previewAuthStorage.ts e tailwind.config.ts, além de oito avisos; esses arquivos fora do escopo não foram alterados. O lint dos arquivos alterados passa. O build avisa sobre chunk maior que 500 kB e base Browserslist antiga. A instalação de dependência relatou vulnerabilidades no conjunto de dependências; não foi executado npm audit fix nem atualização geral fora do escopo.

Referência primária: a API Sheets retorna FORMATTED_VALUE por padrão; isso fundamenta o parsing explícito e a necessidade de confirmar formato/fuso: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get.
