// `zone_key` é a chave PÚBLICA da API: o cliente manda `{"sola": "#C0392B"}`.
// Por isso ela é slug estável, acento e espaço viram problema de encoding em URL, JSON
// de cliente e log, e "Cadarço" nunca deve virar duas chaves diferentes por causa disso.

import { ErroDeVariante } from './erros';

const ZONE_KEY = /^[a-z][a-z0-9-]*$/;
const LIMITE = 40;

/** Aceita a chave ou explica o que corrigir, nunca conserta calado. */
export function validarZoneKey(valor: unknown): string {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErroDeVariante('ZONE_KEY_INVALIDA', 'A zona precisa de uma chave (zone_key).');
  }

  const chave = valor.trim();

  if (chave.length > LIMITE) {
    throw new ErroDeVariante(
      'ZONE_KEY_INVALIDA',
      `A chave "${chave}" passa de ${LIMITE} caracteres.`,
    );
  }

  if (!ZONE_KEY.test(chave)) {
    throw new ErroDeVariante(
      'ZONE_KEY_INVALIDA',
      `A chave "${chave}" precisa ser minúscula, sem acento e sem espaço (ex: "cadarco-lateral").`,
    );
  }

  return chave;
}

/**
 * Converte o rótulo digitado pelo time numa chave válida, para o editor SUGERIR.
 * Sugestão, não conserto automático: quem confirma a chave é o time, porque ela vira
 * contrato com o cliente da API no minuto seguinte.
 */
export function sugerirZoneKey(rotulo: string): string {
  return rotulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITE)
    .replace(/^[^a-z]*/, '');
}
