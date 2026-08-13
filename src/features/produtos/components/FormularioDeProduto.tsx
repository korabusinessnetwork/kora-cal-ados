// Cadastro de produto: escolher o SVG-base, conferir o que a normalização mudou e
// confirmar. O botão de cadastrar só existe depois de o arquivo ter sido aceito — a
// próxima ação óbvia da tela é sempre uma só.

import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { ArquivoAnalisado } from '../hooks/uploadDeAssetBase';
import { RelatorioDeNormalizacao } from './RelatorioDeNormalizacao';
import './FormularioDeProduto.css';

interface Props {
  tenantId: string;
  analisarArquivo(arquivo: File): Promise<ArquivoAnalisado>;
  criarProduto(nome: string, analisado: ArquivoAnalisado, tenantId: string): Promise<void>;
}

export function FormularioDeProduto({ tenantId, analisarArquivo, criarProduto }: Props) {
  const [nome, setNome] = useState('');
  const [analisado, setAnalisado] = useState<ArquivoAnalisado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  // Input de arquivo é não-controlado: trocar a chave remonta o campo e limpa o nome do
  // arquivo já cadastrado. Sem isso a tela mostra um arquivo que não está mais em jogo.
  const [chaveDoArquivo, setChaveDoArquivo] = useState(0);

  const handleArquivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0];

    setErro(null);
    setSucesso(false);
    setAnalisado(null);

    if (!arquivo) return;

    setAnalisando(true);

    try {
      setAnalisado(await analisarArquivo(arquivo));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível ler o arquivo.');
    } finally {
      setAnalisando(false);
    }
  };

  const handleSubmit = async (evento: FormEvent) => {
    evento.preventDefault();

    if (!analisado || !nome.trim()) return;

    setErro(null);
    setEnviando(true);

    try {
      await criarProduto(nome.trim(), analisado, tenantId);
      setNome('');
      setAnalisado(null);
      setSucesso(true);
      setChaveDoArquivo((atual) => atual + 1);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível cadastrar o produto.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="formulario-de-produto" onSubmit={handleSubmit}>
      <h2 className="formulario-de-produto__titulo">Novo modelo</h2>

      <label className="formulario-de-produto__campo">
        <span>Nome do modelo</span>
        <input value={nome} onChange={(evento) => setNome(evento.target.value)} required />
      </label>

      <label className="formulario-de-produto__campo">
        <span>SVG-base</span>
        <input
          key={chaveDoArquivo}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleArquivo}
          required
        />
      </label>

      {analisando && (
        <p className="formulario-de-produto__estado" role="status">
          Conferindo o arquivo…
        </p>
      )}

      {erro && (
        <p className="formulario-de-produto__erro" role="alert">
          {erro}
        </p>
      )}

      {sucesso && (
        <p className="formulario-de-produto__sucesso" role="status">
          Modelo cadastrado.
        </p>
      )}

      {analisado && <RelatorioDeNormalizacao relatorio={analisado.relatorio} />}

      {analisado && (
        <button type="submit" className="formulario-de-produto__botao" disabled={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar modelo'}
        </button>
      )}
    </form>
  );
}
