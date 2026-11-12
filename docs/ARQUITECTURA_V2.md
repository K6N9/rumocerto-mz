# Arquitectura v2 — justificação académica

O projecto mantém o frontend independente (Vue 3, Composition API, Vue Router e Vite) para cumprir o enunciado do ISUTC, e acrescenta um backend gratuito separado para segredos e tarefas agendadas.

**Presentation:** `src/views/PlanoView.vue`, componentes e estilos; utiliza `fetch` para comunicar com Worker e Banco Mundial.

**Application/Domain:** `backend/src/planner.js` valida e cria planos educativos, com fallback gratuito de regras e integração opcional Gemini. A versão sem IA não faz afirmações de ter recorrido a IA.

**Infrastructure:** `backend/src/worker.js` integra EmailJS, Google Gemini e KV; `scheduled()` executa de dois em dois minutos. `backend/src/pdf.js` gera PDF com cores e imagem incorporada sem dependência paga. O frontend gera uma cópia local para consulta.

**Dados e privacidade:** o e-mail e o pedido são armazenados temporariamente no KV até 7 dias; o navegador guarda apenas os campos do formulário. Tokens aleatórios protegem o PDF; o nome pode ser omitido.

**Limitações de produção:** KV não fornece transacções ACID nem lock para envio exactamente uma vez. Em casos raros de crash e reexecução o e-mail pode duplicar; para uma plataforma comercial seria necessário Queue/D1 com idempotência, CAPTCHA, autorização mais forte, análise de conformidade e observabilidade. As quotas dos planos gratuitos limitam o número de envios.
