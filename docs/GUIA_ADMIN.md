# Guia da administração

## Criar o primeiro operador

Crie ou convide uma conta de teste em Supabase Auth e confirme o e-mail. Use o UUID atribuído pelo Auth para criar o registo de papel no SQL Editor do ambiente autorizado. O identificador auditável é `admin`. O login usa o e-mail e a palavra-passe da conta de Auth.

```sql
insert into public.administradores (utilizador, identificador)
select id, 'admin'
from auth.users
where id = '<UUID_DA_CONTA_CONFIRMADA>'::uuid
  and email_confirmed_at is not null;
```

O resultado esperado é uma linha inserida. O papel só pode ser atribuído pelo operador privilegiado do Supabase. A aplicação consulta o servidor antes de abrir `/#/admin`, e as políticas SQL voltam a verificar o papel ao ler ou modificar dados administrativos.

## Publicar e moderar anúncios

1. Em **Fontes**, registe o nome e uma URL HTTPS oficial. Consulte a página e confirme a entidade responsável. Assinale a verificação apenas depois de a concluir.
2. Em **Oportunidades**, crie um rascunho com título, entidade, descrição, fonte, tipo e URLs original e de candidatura. Indique local, requisitos, competências, datas e hora em Maputo quando conhecidos. Pode usar as fontes já consultadas na [matriz de serviços](VERIFICACAO_SERVICOS.md) para uma nova revisão.
3. Abra as duas ligações e confronte os campos com o anúncio. Confirme se o período de candidaturas está aberto. Seleccione **Activa**, assinale a confirmação de verificação e guarde.
4. Use **Arquivar** para ocultar um anúncio cancelado ou moderado. **Arquivar expiradas** processa anúncios cujo prazo conhecido terminou. Um anúncio fora do prazo ou com revisão caducada deixa de aparecer publicamente mesmo antes de ser arquivado. Uma fonte desactivada também retira os seus anúncios do catálogo.
5. Confira em **Auditoria** o operador, o objecto e a data. O painel só permite arquivamento para preservar rastreabilidade e ligações históricas.

## Operação e privacidade

**Serviços e relatórios** apresenta o estado da saúde do Worker, a última execução de alertas, totais, resultados de envio e falhas recentes. Compare a saúde com o protocolo 3.5 e consulte o painel Cloudflare para logs de infra-estrutura quando autorizado.

A definição de resumos do painel controla a fila em conjunto com as variáveis do Worker. Confira o limite diário, as quotas do provedor e o consentimento real. Uma tentativa incerta requer verificação no fornecedor antes de tomar qualquer acção.

O painel mostra totais de pedidos de eliminação. O operador autorizado do Supabase trata estes pedidos pelo UUID, confirma a identidade da conta e segue a retenção aprovada. A eliminação da conta no Supabase remove os dados dependentes por chaves estrangeiras. Os dados temporários de pedidos de plano no Worker expiram separadamente. A revisão de oportunidades e relatórios não confere acesso ao CV, às notas de candidatura ou a credenciais.
