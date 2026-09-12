# Auditoria e correção do fluxo completo

## Objetivo
Garantir que visitantes consigam concluir a pesquisa sem erro de conexão, que cada resposta do Google Forms seja vinculada ao cadastro correto e que o painel administrativo mostre falhas reais sem expor dados.

## Diagnóstico confirmado
- O banco e a autenticação estão saudáveis, mas o envio público direto para `survey_responses` é recusado pela proteção de linhas (`42501`), apesar das permissões aparentarem corretas.
- O envio autenticado funciona; portanto, a falha que bloqueia participantes está isolada no caminho público de gravação.
- O cadastro atual gera um código válido antes do Google Forms, mas existem 6 respostas antigas sem token correspondente.
- A sincronização lê a planilha, porém códigos inválidos são apenas contados e não aparecem na área de pendências do painel.
- Duas funções temporárias de diagnóstico permanecem públicas e geram alertas de segurança.
- Um endpoint temporário pode devolver conteúdo da planilha sem confirmar que o solicitante é administrador.
- O painel consulta novos dados a cada 10 segundos, mas continua indicando atualização normal quando a consulta falha.

## Implementação

### 1. Corrigir definitivamente o envio público
- Criar uma função segura de envio no banco, disponível somente para registrar uma nova participação.
- Validar nela idade, cidade, UF, gênero, e-mail, consentimento, tamanho dos dados e formato do código.
- Registrar o código e a resposta na mesma transação, evitando gravações parciais.
- Alterar o formulário para usar essa função em vez da inserção pública direta.
- Manter repetição segura: o mesmo código não criará respostas duplicadas quando a rede oscilar.
- Retirar a permissão de inserção direta dos visitantes depois que o novo caminho estiver ativo.

### 2. Tornar a sincronização do Google Forms confiável
- Registrar na área de pendências cada linha com código ausente, inválido, desconhecido, duplicado ou já utilizado.
- Não classificar uma resposta já sincronizada como erro em sincronizações posteriores.
- Evitar sobrescrever respostas que já foram validadas.
- Retornar ao painel totais claros de novas, já sincronizadas e inválidas.
- Processar as linhas com limite seguro para evitar travamentos conforme a planilha crescer.

### 3. Corrigir painel e autenticação administrativa
- Diferenciar “sem permissão” de falha temporária de conexão no acesso administrativo.
- Exibir o horário da última atualização bem-sucedida e sinalizar quando os dados estiverem desatualizados.
- Aplicar espera progressiva nas novas tentativas quando a conexão falhar.
- Proteger a exportação CSV contra fórmulas maliciosas vindas de respostas abertas.

### 4. Remover superfícies temporárias e alertas de segurança
- Excluir as duas funções públicas de diagnóstico após a correção.
- Remover os endpoints temporários de leitura da planilha e de exposição do e-mail técnico.
- Manter somente a sincronização administrativa autenticada.
- Rodar novamente a auditoria de segurança e corrigir qualquer alerta restante relacionado a este fluxo.

### 5. Validar ponta a ponta
- Testar como visitante: consentimento, critérios, dados pessoais, criação do código e chegada ao Google Forms.
- Confirmar no banco que cadastro e token são criados juntos.
- Testar repetição do envio para garantir ausência de duplicidade.
- Testar código válido, inválido e já sincronizado na planilha.
- Confirmar que o painel mostra novos cadastros e pendências sem recarregar a página.
- Testar entrada do administrador e edição/exclusão autorizadas.
- Limpar apenas os registros de teste identificados com segurança.

## Detalhes técnicos
- A correção será feita por migration transacional, função `SECURITY DEFINER` com `search_path` fixo, privilégios mínimos e validações equivalentes às regras atuais.
- A sincronização continuará usando a conexão Google Sheets já configurada; não será necessário pedir novas credenciais.
- O Google Forms permanecerá aberto/incorporado para preenchimento real. A confirmação continuará baseada na planilha, que é a fonte verificável de que a resposta foi enviada.
