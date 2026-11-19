import { ref, onMounted, onUnmounted, watch, toValue } from 'vue'
import { normalizarSerieBancoMundial } from '../../shared/indicadores.js'
const cache = new Map()
const TTL = 60*60*1000
export function useIndicador(codigo) {
  const serie=ref([]),carregando=ref(true),erro=ref(''),aviso=ref(''),consultaEm=ref('')
  let controller=null
  let codigoAnterior
  async function carregar(forcar=false) {
    const id=toValue(codigo)
    if(controller)controller.abort()
    controller=new AbortController();const atual=controller
    const timeout = setTimeout(() => atual.abort('prazo'), 12000)
    if (codigoAnterior !== id) { serie.value = []; consultaEm.value = ''; codigoAnterior = id }
    erro.value='';aviso.value='';carregando.value=true
    if(!id) {serie.value=[];erro.value='Indicador inexistente.';carregando.value=false;clearTimeout(timeout);return}
    try {
      const chave=`rumocerto:indicador:${id}`
      let guardado=cache.get(chave)
      if(!guardado)try{guardado=JSON.parse(sessionStorage.getItem(chave)||'null')}catch{}
      if(!forcar&&guardado&&Array.isArray(guardado.serie)&&Date.now()-guardado.em<TTL){serie.value=guardado.serie;consultaEm.value=guardado.consulta;return}
      const url=new URL(`https://api.worldbank.org/v2/country/MOZ/indicator/${encodeURIComponent(id)}`)
      url.searchParams.set('format','json');url.searchParams.set('per_page','100')
      const response=await fetch(url,{signal:atual.signal,headers:{Accept:'application/json'}})
      if(!response.ok)throw new Error(`HTTP ${response.status}`)
      const dados=normalizarSerieBancoMundial(await response.json())
      if(atual.signal.aborted)return
      serie.value=dados;consultaEm.value=new Date().toISOString()
      const item={serie:dados,em:Date.now(),consulta:consultaEm.value};cache.set(chave,item)
      try{sessionStorage.setItem(chave,JSON.stringify(item))}catch{}
    } catch(e) {if(!atual.signal.aborted || atual.signal.reason === 'prazo'){
      const chave=`rumocerto:indicador:${id}`
      let anterior=cache.get(chave)
      if(!anterior)try{anterior=JSON.parse(sessionStorage.getItem(chave)||'null')}catch{}
      if(Array.isArray(anterior?.serie)&&anterior.serie.length){serie.value=anterior.serie;consultaEm.value=anterior.consulta;aviso.value='A fonte não está disponível neste momento. São apresentados os últimos valores guardados neste dispositivo.'}
      else{erro.value='Não foi possível obter os indicadores. Verifique a ligação à Internet e tente novamente.';serie.value=[]}
    }}
    finally{clearTimeout(timeout);if(controller===atual)carregando.value=false}
  }
  onMounted(()=>carregar());watch(()=>toValue(codigo),()=>carregar());onUnmounted(()=>controller?.abort())
  return {serie,carregando,erro,aviso,consultaEm,carregar}
}
