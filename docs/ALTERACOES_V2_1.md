# Actualização v2.1 — RumoCerto MZ (12/11/2026)

- Mantém o frontend Vue, os logótipos e as variáveis privadas existentes.
- Corrige entrega gratuita de PDF através de ligação em vez de anexo.
- Mantém identificadores e templates da conta EmailJS já criada pelo Grupo 8.
- Valida o URL público e não aceita HTTP inseguro em produção.
- Altera o agendamento para `*/2 * * * *`, respeitando as 1.000 listagens KV diárias no nível Free.
- Inclui tarefas concretas de Vue.js como fallback gratuito e testes adicionais de Gemini.
- Corrige mensagens da interface sobre envio e horário estimado.

**O que falta comprovar:** entrega do e-mail ao destinatário e acesso ao PDF num endereço público, execução real do cron em produção, qualidade de respostas Gemini na conta do grupo, compilação completa com npm no Mac.

**Segurança:** a chave privada da conta EmailJS foi mostrada numa captura anterior. Regenera-a antes do deploy e substitui-a em `.dev.vars` e nos secrets remotos. A chave Gemini nunca deve ser colocada no Vue.
