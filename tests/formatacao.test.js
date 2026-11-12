import test from 'node:test'
import assert from 'node:assert/strict'
import { formatarPercentagem, validarEmail, validarPlano, normalizarSerieBancoMundial, criarCsvSerie } from '../src/utils/formatacao.js'

test('normaliza uma série do Banco Mundial e descarta valores nulos', () => {
  const serie = normalizarSerieBancoMundial([{}, [
    { date: '2025', value: 11.6 }, { date: '2023', value: null }, { date: '2024', value: 11.1 }, { date: '2022', value: 'sem número' }
  ]])
  assert.deepEqual(serie, [{ ano: 2024, valor: 11.1 }, { ano: 2025, valor: 11.6 }])
})
test('rejeita formatos inválidos da API', () => {
  assert.throws(() => normalizarSerieBancoMundial({ data: [] }), /formato/)
})
test('não inventa uma percentagem para valores ausentes', () => {
  assert.equal(formatarPercentagem(null), 'Sem dados')
})
test('valida e-mails básicos', () => {
  assert.equal(validarEmail('teste@exemplo.co.mz'), true)
  assert.equal(validarEmail('teste@@exemplo'), false)
})
test('exige os campos essenciais do plano', () => {
  assert.ok(validarPlano({}).area)
  assert.ok(validarPlano({ area:'Tecnologia', situacao:'Estudante', objetivo:'Preparar um currículo completo' }).objetivo === undefined)
})

test('exporta CSV com anos e valores portugueses', () => {
  const csv = criarCsvSerie([{ ano: 2025, valor: 11.6 }]);
  assert.ok(csv.includes('Ano;Percentagem'));
  assert.ok(csv.includes('2025;11,6'));
});
test('CSV ignora observações sem ano e valor válido', () => {
  const csv = criarCsvSerie([{ ano: 2025, valor: NaN }, { ano: 2024, valor: 8 }]);
  assert.ok(!csv.includes('2025;'));
  assert.ok(csv.includes('2024;8'));
});
test('validação rejeita objetivo demasiado curto', () => {
  assert.ok(validarPlano({ area: 'Tecnologia', situacao: 'Estudante', objetivo: 'curto' }).objetivo);
});
test('normalização conserva zeros e rejeita valores de texto', () => {
  assert.deepEqual(normalizarSerieBancoMundial([{}, [
    { date: '2022', value: 0 }, { date: '2023', value: '10' }
  ]]), [{ ano: 2022, valor: 0 }]);
});
test('email não pode conter espaços ou não ter domínio', () => {
  assert.equal(validarEmail('a b@example.org'), false);
  assert.equal(validarEmail('aluno@'), false);
});
