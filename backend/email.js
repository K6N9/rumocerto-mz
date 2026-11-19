export class FalhaEmail extends Error {
  constructor(mensagem, incerta = true, status = 0) { super(mensagem); this.incerta = incerta; this.status = status }
}
export async function emailJS(env, template, parametros) {
  if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY || !template) throw new FalhaEmail('E-mail indisponível', false)
  const corpo = { service_id: env.EMAILJS_SERVICE_ID, template_id: template,
    user_id: env.EMAILJS_PUBLIC_KEY, template_params: parametros }
  if (env.EMAILJS_PRIVATE_KEY) corpo.accessToken = env.EMAILJS_PRIVATE_KEY
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const resposta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
    })
    if (!resposta.ok) throw new FalhaEmail(`Envio recusado (${resposta.status})`,
      resposta.status >= 500 || resposta.status === 429 || resposta.status === 408, resposta.status)
  } catch (e) {
    if (e instanceof FalhaEmail) throw e
    throw new FalhaEmail('Não foi possível confirmar o resultado do serviço de e-mail.', true)
  } finally { clearTimeout(timeout) }
}
