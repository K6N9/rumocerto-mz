export function papelJwt(valor) {
  const partes = valor.split('.')
  if (partes.length !== 3 || !partes.every(parte => /^[A-Za-z0-9_-]+$/.test(parte))) return null
  try {
    const [cabecalho, corpo] = partes.slice(0, 2).map(parte => {
      const base64 = parte.replace(/-/g, '+').replace(/_/g, '/')
      return JSON.parse(atob(base64))
    })
    return typeof cabecalho?.alg === 'string' && typeof corpo?.role === 'string' ? corpo.role : null
  } catch { return null }
}

export function chavePublicaSupabase(valor) {
  return /^sb_publishable_[A-Za-z0-9_-]+$/.test(valor) || papelJwt(valor) === 'anon'
}
