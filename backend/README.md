# Backend gratuito — RumoCerto MZ

Cloudflare Workers Free + Workers KV Free + Cron de 2 minutos. **Não necessita de servidor sempre ligado no Mac.** O frontend continua no GitHub Pages.

- `POST /api/planos` valida, tenta gerar plano com Gemini **apenas se houver chave de camada gratuita**; caso contrário usa um motor educativo local de regras, claramente identificado.
- Envia imediatamente e-mail de confirmação via EmailJS; regista o pedido em KV com prazo de 5 minutos.
- Cron consulta pendências a cada minuto e envia o segundo e-mail após o prazo, com PDF em Base64 `{{pdf_anexo}}` e link protegido `{{link_pdf}}`.
- `GET /api/planos/:id?token=...` devolve estado; `GET /api/planos/:id/pdf?token=...` descarrega PDF.
- Acesso por token aleatório, TTL de 7 dias, limites simples por IP, consentimento e CORS. Para utilização em escala real, acrescentar CAPTCHA, D1 com transacções, telemetria e política de retenção.

## Limitações reais

A modalidade gratuita tem quotas. O agendamento via cron é **aproximado** (em geral 5–7 minutos, podendo atrasar). O processamento não garante exactamente uma execução em falhas extremas de rede/KV. O EmailJS Free não disponibiliza anexos; o e-mail contém um **link privado para descarregar o PDF**, desde que `PUBLIC_WORKER_URL` seja público.

O modo gratuito da Gemini pode depender do país/conta e estar sujeito a limites e tratamento de dados de acordo com o fornecedor. Não introduzir dados íntimos, clínicos ou financeiros no formulário. Não activar facturação paga.

## Setup

Ver [`../docs/INSTALAR_V2_FREE.md`](../docs/INSTALAR_V2_FREE.md).
