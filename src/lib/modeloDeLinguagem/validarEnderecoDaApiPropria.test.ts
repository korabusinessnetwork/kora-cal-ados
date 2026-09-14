import { describe, expect, it } from 'vitest';

import { validarEnderecoDaApiPropria } from './validarEnderecoDaApiPropria';

const aceito = (texto: unknown) => validarEnderecoDaApiPropria(texto);
const recusado = (texto: unknown) => {
  const resultado = validarEnderecoDaApiPropria(texto);
  return resultado.valido ? null : resultado.motivo;
};

describe('validarEnderecoDaApiPropria, o que passa', () => {
  it('aceita https com nome público e normaliza a barra do fim e a caixa do nome', () => {
    expect(aceito('https://API.Exemplo.com/v1/')).toEqual({ valido: true, endereco: 'https://api.exemplo.com/v1' });
    expect(aceito('  https://api.exemplo.com  ')).toEqual({ valido: true, endereco: 'https://api.exemplo.com' });
    expect(aceito('https://api.exemplo.com:443/v1')).toEqual({ valido: true, endereco: 'https://api.exemplo.com/v1' });
  });
});

describe('validarEnderecoDaApiPropria, o que é recusado e por quê', () => {
  it('vazio, não texto e texto que não é URL', () => {
    expect(recusado('')).toMatch(/Informe o endereço/);
    expect(recusado(undefined)).toMatch(/Informe o endereço/);
    expect(recusado('api.exemplo.com')).toMatch(/não é uma URL válida/);
  });

  it('http e outros protocolos, porque a chave vai junto', () => {
    expect(recusado('http://api.exemplo.com/v1')).toMatch(/https/);
    expect(recusado('file:///etc/passwd')).toMatch(/https/);
    expect(recusado('ftp://api.exemplo.com')).toMatch(/https/);
  });

  it('usuário e senha no endereço', () => {
    expect(recusado('https://eu:segredo@api.exemplo.com/v1')).toMatch(/usuário e a senha/);
  });

  it('IP literal, nas grafias que o URL normaliza para IP', () => {
    for (const endereco of [
      'https://127.0.0.1/v1',
      'https://169.254.169.254/latest',
      'https://10.0.0.5',
      'https://0x7f.1/',
      'https://2130706433/',
      'https://[::1]/',
      'https://[fd00::1]/v1',
    ]) {
      expect(recusado(endereco), endereco).toMatch(/número de IP/);
    }
  });

  it('localhost, nome sem ponto e sufixo de rede interna', () => {
    expect(recusado('https://localhost/v1')).toMatch(/servidor público/);
    expect(recusado('https://servidor/v1')).toMatch(/servidor público/);
    expect(recusado('https://api.localhost')).toMatch(/servidor público/);
    expect(recusado('https://ollama.local/v1')).toMatch(/servidor público/);
    expect(recusado('https://metadata.google.internal/')).toMatch(/servidor público/);
  });

  it('porta que não é a do https', () => {
    expect(recusado('https://api.exemplo.com:8443/v1')).toMatch(/porta/);
  });

  it('query string e fragmento, que o servidor não repassaria', () => {
    expect(recusado('https://api.exemplo.com/v1?chave=1')).toMatch(/"\?"/);
    expect(recusado('https://api.exemplo.com/v1#x')).toMatch(/"\?"/);
  });

  it('o endereço já com /chat/completions, que o servidor acrescenta', () => {
    expect(recusado('https://api.exemplo.com/v1/chat/completions')).toMatch(/endereço base/);
  });

  it('endereço enorme', () => {
    expect(recusado(`https://api.exemplo.com/${'a'.repeat(300)}`)).toMatch(/300 caracteres/);
  });
});
