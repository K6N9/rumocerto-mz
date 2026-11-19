# Arquitectura do RumoCerto MZ 4.0

O GitHub Pages serve a SPA Vue. O Vue Router usa URLs com hash, incluindo nas rotas com parâmetros e nos acessos directos. Os recursos públicos e o planeador local estão disponíveis sem sessão. As vistas são carregadas por rota e o SDK do Supabase só é inicializado se receber configuração pública válida.

| Camada | Responsabilidade |
| --- | --- |
| `src/views`, `src/components`, `src/router` | Áreas pública, pessoal e administrativa. Formulários, estados de rede, validação de interface e navegação. |
| `src/composables`, `src/services` | Indicadores, estado de plano, sessão, operações PostgreSQL, exportações e integração com o catálogo. |
| `shared` | Regras de planeamento e de correspondência, filtros, validação do currículo e geração PDF. |
| `supabase` | Conta por e-mail, PostgreSQL, migrations, permissões, integridade, auditoria, notificações e fila de resumos. |
| `backend` | Cloudflare Worker. Mantém o protocolo 3.5 do envio de planos. Um cron opcional integra Supabase, RumoMatch e EmailJS. |
| `public`, `src/assets/dados` | Marca e cópia local datada de anúncios com fontes verificadas. |

## Dados e autorização

Auth associa a conta ao UUID de `auth.users`. RLS limita cada titular ao seu perfil, preferências, planos, tarefas, favoritos, CV, candidaturas, histórico, notificações, tentativas de envio e pedido de eliminação. O papel administrativo é consultado em `administradores` pelo servidor. A conta do navegador recebe apenas a chave pública. O Worker usa a chave de serviço no ambiente privado quando o cron é activado.

O catálogo só expõe versões activas com anúncio verificado nos últimos 30 dias, fonte activa verificada nos últimos 90 dias, data de publicação decorrida e prazo vigente em Maputo. A revisão é humana. O PostgreSQL revalida as condições e gera auditoria das alterações. A cópia estática segue o prazo e a antiguidade da revisão. Quando o Supabase está configurado, a cópia pode ser aberta separadamente a partir de uma pesquisa pública sem resultados ou de uma ligação antiga. Nesse modo, o detalhe mostra a fonte e as acções de conta ficam reservadas aos anúncios do catálogo remoto com UUID.

`guardar_perfil` grava dados profissionais e preferências na mesma transacção. `guardar_plano` cria o plano e as suas tarefas numa transacção e prevê repetição segura do mesmo identificador. O contrato do plano é verificado na SPA, no Worker e por um trigger no PostgreSQL. Testes de paridade comparam o espelho SQL ao contrato em JavaScript. As alterações posteriores de progresso actualizam a tarefa individual com a identidade do titular. O plano público usa a chave de armazenamento da v3.6. A conversão opcional preserva a versão original e transfere conclusões apenas para as actividades copiadas. A conta pode importar o plano público por acção explícita e escolher quais os planos a guardar. O rascunho privado e o progresso por sincronizar ficam na sessão do separador. Os planos guardados no servidor podem ser abertos noutro dispositivo.

As ligações dos templates Auth transportam o token de uso único no fragmento. A SPA retira os parâmetros do URL antes de iniciar o SDK e verifica o token na API Auth. As ligações de templates antigos com parâmetros na query continuam a ser aceites durante a transição. O alojamento recebe a query dessas ligações antigas antes de a SPA poder limpá-la.

O CV é guardado em JSON validado e exportado no dispositivo. Cada mudança de estado ou data de candidatura grava uma entrada de histórico. O painel do grupo usa consultas agregadas para monitorizar utilização, envios e pedidos de eliminação.

## RumoMatch e alertas

O algoritmo compara área (25), escolaridade (12), competências (15), experiência (12), província (8), modalidade (8), tipo (8) e competências obrigatórias (12). Campos ausentes ficam por confirmar e não acrescentam pontos. O alerta exige pelo menos 60 pontos e confirmação dos requisitos obrigatórios calculáveis. Os requisitos que só constam do texto do anúncio são apresentados para revisão pelo jovem. O cálculo usa apenas atributos profissionais necessários.

A materialização insere uma chave única por oportunidade, prazo ou tarefa e respeita as preferências internas individuais. Prazos são sinalizados até três dias antes. Os lembretes referem-se ao plano guardado actualizado mais recentemente e às tarefas recentes ainda pendentes. A consulta manual compara até 100 anúncios recentes. O cron processa lotes rotativos de oito contas e até 50 anúncios por invocação, para limitar os pedidos do plano gratuito.

Os resumos têm uma fila de uma linha por conta e semana, verificação de e-mail confirmado e consentimento. A reserva é transaccional, limita as tentativas diárias e protege contra reenvios repetidos. Uma tentativa de resultado ambíguo fica marcada como incerta. Um pedido de eliminação cancela o consentimento e deixa de ser elegível para novos alertas. Os dados disponíveis ao operador do painel são totais e códigos de falha.

## Versionamento

A aplicação é 4.0.0. `/api/saude` mantém `ok`, `versao: "3.5"` e `envioDisponivel`. A migration SQLite `v3_3_sqlite` e os bindings `PLANOS` e `LIMITES` mantêm a identidade existente do Worker. As migrations PostgreSQL da v4 são independentes das do Worker.
