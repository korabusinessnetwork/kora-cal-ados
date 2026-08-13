// Roda antes de cada arquivo de teste. O ambiente de teste é Node puro (sem DOMParser
// nativo), então o motor de render precisa do analisador de jsdom registrado — é o mesmo
// registro que a função serverless vai fazer na rodada 3.

import { registrarAnalisadorDeNode } from './src/lib/render/analisadorDeNode';

registrarAnalisadorDeNode();
