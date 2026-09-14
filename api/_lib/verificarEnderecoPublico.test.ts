import { describe, expect, it } from 'vitest';

import { FalhaDaApi } from './tiposDaApi';
import { ehPublico, verificarEnderecoPublico } from './verificarEnderecoPublico';

const resolvendoPara = (...enderecos: string[]) =>
  async () => enderecos.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));

async function motivoAoVerificar(endereco: string, resolver: Parameters<typeof verificarEnderecoPublico>[1]) {
  try {
    await verificarEnderecoPublico(endereco, resolver);
    return null;
  } catch (erro) {
    if (erro instanceof FalhaDaApi) return `${erro.codigo}: ${erro.message}`;
    throw erro;
  }
}

describe('verificarEnderecoPublico', () => {
  it('deixa passar o nome que resolve para endereço público', async () => {
    expect(await motivoAoVerificar('https://api.exemplo.com/v1', resolvendoPara('93.184.216.34'))).toBeNull();
    expect(await motivoAoVerificar('https://api.exemplo.com/v1', resolvendoPara('2606:2800:220:1::1'))).toBeNull();
  });

  it('recusa o nome que resolve para rede privada, loopback ou metadados da nuvem', async () => {
    for (const endereco of ['10.0.0.5', '127.0.0.1', '169.254.169.254', '192.168.1.1', '172.20.0.1', '::1', 'fd00::1']) {
      const motivo = await motivoAoVerificar('https://interno.exemplo.com', resolvendoPara(endereco));
      expect(motivo, endereco).toMatch(/^ENDERECO_NAO_PERMITIDO: /);
      expect(motivo, endereco).toMatch(/rede privada/);
    }
  });

  it('recusa quando UM dos endereços do nome é privado, e não só quando todos são', async () => {
    // O contorno óbvio: um nome com dois registros, um público e um interno.
    expect(await motivoAoVerificar('https://api.exemplo.com', resolvendoPara('93.184.216.34', '10.0.0.5'))).toMatch(
      /rede privada/,
    );
  });

  it('recusa o nome que não resolve, dizendo o nome', async () => {
    const motivo = await motivoAoVerificar('https://naoexiste.exemplo.com', async () => {
      throw new Error('ENOTFOUND');
    });

    expect(motivo).toMatch(/não foi encontrado no DNS/);
    expect(motivo).toMatch(/naoexiste.exemplo.com/);
  });

  it('recusa nome sem endereço nenhum', async () => {
    expect(await motivoAoVerificar('https://api.exemplo.com', resolvendoPara())).toMatch(/rede privada/);
  });
});

describe('ehPublico', () => {
  it('reprova as faixas reservadas do IPv4', () => {
    for (const endereco of [
      '0.0.0.0',
      '10.255.255.255',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '100.64.0.1',
      '192.0.0.1',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(ehPublico(endereco), endereco).toBe(false);
    }
  });

  it('aprova endereço público de verdade, inclusive vizinho de faixa reservada', () => {
    for (const endereco of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '172.15.0.1', '169.253.0.1', '100.63.255.255']) {
      expect(ehPublico(endereco), endereco).toBe(true);
    }
  });

  it('reprova IPv4 privado escondido em IPv6 mapeado', () => {
    expect(ehPublico('::ffff:10.0.0.1')).toBe(false);
    expect(ehPublico('::ffff:169.254.169.254')).toBe(false);
    expect(ehPublico('::FFFF:93.184.216.34')).toBe(true);
  });

  it('reprova loopback, único local, link-local e multicast do IPv6', () => {
    for (const endereco of ['::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      expect(ehPublico(endereco), endereco).toBe(false);
    }
    expect(ehPublico('2606:2800:220:1::1')).toBe(true);
  });

  it('texto que não é endereço nenhum não passa por público', () => {
    expect(ehPublico('nao-e-endereco')).toBe(false);
    expect(ehPublico('999.1.1.1')).toBe(false);
  });
});
