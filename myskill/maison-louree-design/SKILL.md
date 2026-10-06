---
name: maison-louree-design
description: Direção de design e frontend do site da Maison Lourée (marca de perfumes Rose Dorée e Lourée Noir). Use SEMPRE que for criar, editar ou revisar qualquer página, seção, componente, animação ou efeito de scroll do site da Maison Lourée, especialmente a cena principal dos dois frascos sobre seda champanhe, com borrifo e entrada nas caixas. Inclui a avaliação obrigatória "nunca com cara de IA" antes de toda entrega.
---

# Maison Lourée — Design & Frontend

A Maison Lourée é uma marca de perfumes. O site não é uma loja comum: é uma **experiência cinematográfica**, no nível de sites premiados (Awwwards / "Websites in 2026"). Perfume não se cheira pela tela, então o site vende **sensação**: luz, textura, brilho dourado, silêncio, movimento lento.

Antes de começar qualquer tela, leia também:
- [references/marca.md](references/marca.md): quem é a marca, os dois perfumes, as caixas, o tom de voz e as regras de conteúdo (**leia primeiro**).
- [references/referencias.md](references/referencias.md): referências visuais aprovadas e o que copiar de cada uma.
- [references/mergulho-scroll.md](references/mergulho-scroll.md): técnica de **sequência de frames controlada pelo scroll**. O mergulho na água foi descartado, mas a técnica vale se um dia houver vídeo real do produto.

Implementação de referência aprovada: `preview/index.html` na raiz do projeto.

---

## 1. A cena principal: dois frascos, borrifo e caixas

A home gira em torno de **uma cena presa na tela** (seção alta, ~800vh, com bloco `sticky`) controlada pelo scroll. Os **dois perfumes são os protagonistas** e o fundo é uma **foto real de seda champanhe luminosa**.

| Progresso | Cena | Texto |
|---|---|---|
| 0–14% | **Rose Dorée à esquerda, Lourée Noir à direita**, grandes, levemente inclinados | "A arte de *se lembrar.*" no centro, entre os frascos |
| 14–32% | Os dois **deslizam para o centro**, menores. As **caixas entram pelas laterais** (bordô à esquerda, preta à direita) | "Dois perfumes. *Uma assinatura.*" |
| 32–55% | Os frascos **descem borrifando**: névoa de perfume saindo do spray | Etiquetas laterais com ✕ + linha fina: nome e linha (Feminino / Masculino) |
| 55–80% | Cada frasco **sobe, vai até a sua caixa e desce para dentro dela** | "Guardado para *ser lembrado.*" |
| 78–87% | A **tampa desce** e fecha cada caixa | |
| 86–100% | As caixas fechadas vão para o centro e, **embaixo de cada uma, aparece a compra**: linha, nome, preço, botões **Comprar** e **Detalhes** | |

Regras:
- Tudo é **controlado pelo scroll** e reversível (rolar para cima desfaz), menos a névoa, que é efêmera.
- Movimento **lento e elegante**, com easing `inOutCubic` entre pontos-chave. Nunca rápido nem com quique.
- **Fio condutor:** os frascos nunca somem sem motivo. Eles saem de cena **entrando na caixa**.
- **Celular:** frascos lado a lado e menores, caixas entram **por baixo** em vez das laterais.

### Como montar (técnica)
- **Frascos:** recortes PNG com fundo transparente das fotos reais (`assets/recortes/`), posicionados com `transform` (translate/rotate) a cada frame.
- **Roteiro por pontos-chave:** cada propriedade (x, y, altura, rotação) é uma lista `[progresso, valor]` interpolada (função `kf`). Para ajustar a coreografia, mexa só nesses números.
- **"Entrar na caixa":** a caixa é feita de **3 camadas irmãs** no mesmo contexto de empilhamento: fundo da caixa (z 1) → frasco (z 2–3) → frente da caixa (z 4) → tampa (z 5). O frasco desce entre o fundo e a frente, então some "dentro". **Não aplique transform no contêiner da caixa**, porque isso cria outro contexto de empilhamento e quebra o efeito. Aplique em cada camada.
- **Caixas:** imagem **real ou render fotorrealista** da caixa (frente fechada, frente aberta e tampa como peças separadas com fundo transparente). A versão em CSS foi reprovada. As camadas (fundo/frente/tampa) continuam valendo, mas cada camada é uma imagem.
- **Borrifo:** **névoa real**, com vídeo de spray de perfume em fundo preto (usar `mix-blend-mode: screen` sobre claro não funciona, então use vídeo com canal alfa WebM/sequência PNG) ou sequência de frames gerada, presa ao bico do frasco e tocada conforme o scroll. As partículas em canvas foram reprovadas.
- **Fundo:** foto de seda **champanhe luminosa** com leve zoom e parallax pelo scroll, com um brilho claro no centro e uma vinheta quente e leve nas bordas.

### Recorte dos frascos
O removedor de fundo automático (`hyperframes remove-background`) usa um modelo de **pessoas** e **não funciona** em frascos. Como os frascos têm formas geométricas, o recorte é feito com **máscara desenhada à mão** (elipse + retângulos para o Rose Dorée, polígono para o Lourée Noir) aplicada pixel a pixel com suavização. Com fotos de estúdio (fundo liso), o ideal é refazer os recortes.

## 2. Direção visual

- **Produto é o herói.** Os frascos grandes, com espaço em volta. Poucos elementos por tela.
- **Cinematográfico e luminoso:** seda champanhe, luz quente, dourado. Cada momento parece um frame de filme.
- **Luxo silencioso:** nada grita. Sem cores saturadas além das cores das caixas.

### Tipografia
- **Títulos:** Cormorant Garamond, peso 300. *Itálico* dourado em parte da frase: "A arte de *se lembrar.*"
- **Texto corrido:** Inter 300, 15–17px, entrelinha 1.6.
- **Microtexto técnico:** JetBrains Mono, 10–11px, maiúsculas, espaçamento largo, nos cantos: `// MAISON LOURÉE © 2026`, `01 / 05`, `ROLE PARA DESCOBRIR ↓`.
- **Revelação palavra por palavra** no manifesto: palavras começam com `opacity: .14` e acendem com o scroll.

### Cores
Site **claro e luminoso sobre seda champanhe**, com texto marrom quase preto e dourado escuro. Rodapé escuro para fechar. Sempre use as variáveis.

```css
:root {
  --ml-bg: #f1e6d4;                        /* champanhe claro: base das seções */
  --ml-ink: #231b12;                       /* texto principal */
  --ml-ink-muted: rgba(35, 27, 18, .66);   /* texto secundário */
  --ml-line: rgba(35, 27, 18, .18);        /* linhas finas */
  --ml-gold: #9a7438;                      /* dourado escuro: logo, numerais, filetes */
  --ml-gold-deep: #7d5a24;                 /* itálicos dos títulos */
  --ml-foil: #d9b874;                      /* dourado claro: sobre bordô/preto */
  --ml-femme: #6a1d35;                     /* bordô da caixa Rose Dorée */
  --ml-homme: #1d2428;                     /* preto azul-esverdeado da caixa Lourée Noir */
}
```

- **Botão: moldura dourada.** Retangular, filete `--ml-gold` de 1px + contorno externo fino afastado 3px (como a moldura das caixas), texto em Cormorant maiúsculo bem espaçado. No hover, enche de dourado de baixo para cima e o texto fica claro. O secundário é só texto com uma linha dourada que cresce.
- Dourado só em detalhes finos (itálico, filete, numeral, logo, botão). Nunca como fundo de bloco.

### Componentes
- **Botões:** moldura dourada (ver Cores). Nunca pílula.
- **Linhas finas** (1px, `--ml-line`) para separar áreas, em vez de cards com sombra.
- **Etiquetas laterais:** `✕` + linha de 1px que se desenha + título em serifa + texto mono minúsculo.
- **Filete dourado** (moldura de 1px) como nas caixas reais: é o detalhe gráfico assinatura da marca.

## 3. Detalhes que fazem o site parecer premiado

- **Tela de carregamento** com o L de louros e contador `000 → 100`.
- **Contador de capítulos** (`01 / 05`) e barra de progresso fina no canto.
- **Scroll suave** com [Lenis](https://github.com/darkroomengineering/lenis).
- **Revelação de texto** com anime.js (`translateY` + `opacity`, 700–1000ms, `outQuart` / `outExpo`).
- **Sacola** no topo que reage ao adicionar (pulso no número).

## 4. Animação

- **anime.js** (instalado no projeto) para entradas, textos e microinterações; a cena do scroll é calculada à mão a cada frame.
- Durações: 600–1200ms. Easing: `outQuart`, `outExpo`, `inOutSine`, `inOutCubic`. **Nunca** `elastic`/`bounce`.
- Anime só `transform` e `opacity`.
- Tudo que depende de scroll usa o progresso **suavizado** (lerp ~0.1).
- Modo de teste: `#p=0.4` no fim da URL congela a cena naquele ponto do scroll.

## 5. Performance e celular (obrigatório)

- Recortes em PNG/WebP com tamanho certo (não maiores que ~2× o tamanho exibido).
- `devicePixelRatio` do canvas limitado a **2**; limite de partículas (~900).
- `prefers-reduced-motion`: sem névoa e sem suavização.
- Testar sempre em 390px de largura. Nada de rolagem horizontal.

## 6. Avaliação obrigatória: nunca com cara de IA

**Regra do dono da marca:** o site **nunca** pode parecer feito por IA. Toda entrega passa por esta avaliação **antes** de ser mostrada. Se falhar em qualquer item, corrija e avalie de novo. Não entregue "quase bom".

### Como avaliar
1. Tire capturas reais (desktop 1440px e celular 390px) dos momentos-chave do scroll. Use `#p=0.4` para congelar a cena.
2. Olhe cada captura **como um cliente de perfume de luxo** e como um jurado do Awwwards. Pergunte: *"isso parece uma grife de verdade ou um template gerado?"*
3. Compare lado a lado com as referências aprovadas (`references/referencias.md`). Se a referência parece mais cara, ainda não está pronto.
4. Passe pelo checklist abaixo e diga ao dono, com honestidade, o que ainda está fraco.

### Sinais de "cara de IA" (proibidos)
- **Elementos de produto feitos em código:** frasco desenhado em SVG/CSS, caixa montada em CSS, borrifo de partículas genéricas. *Produto, embalagem e efeitos físicos (névoa, líquido, tecido) precisam ser imagem/vídeo real ou render fotorrealista.* Código serve para movimento, layout e tipografia, não para fingir objetos.
- Recorte de foto amadora (fundo de mesa aparecendo pelo vidro, borda serrilhada, luz de escritório).
- Fundo apagado, lamacento ou escuro demais. O fundo tem que ter **luz e brilho**.
- Gradiente roxo/azul, glassmorphism, brilho neon genérico.
- Botão pílula branco ou preto padrão, cantos arredondados em tudo, sombras grandes e borradas.
- Layout "hero centralizado + 3 cards + CTA" de template.
- Emojis, ícones genéricos de biblioteca enfeitando seções.
- Texto genérico de marketing ("Eleve sua experiência", "Descubra o extraordinário", "Desbloqueie").
- Tudo perfeitamente simétrico e igual, sem nenhum detalhe artesanal da marca (filete dourado, louros, numerais, microtexto).
- Animações que existem só por existir, rápidas ou com quique.

### O que o dono já reprovou (não repetir)
| Reprovado | Por quê | Fazer no lugar |
|---|---|---|
| Frasco desenhado em código | "Horroroso", falso | Imagem real ou gerada fotorrealista do frasco, fundo transparente |
| Recorte das fotos da mesa | Amador | Foto de estúdio ou render com IA a partir da foto |
| Seda escura escurecida | "Muito apagado" | Seda **champanhe luminosa** (`assets/bg/seda-champanhe.jpg`) |
| Botão pílula branco | Genérico | **Moldura dourada** (filete + contorno externo, enche de dourado no hover) |
| Borrifo de partículas em canvas | Não parece perfume de verdade | Vídeo/sequência de frames de névoa real, ou render |
| Caixa montada em CSS | Não parece a caixa real | Foto/render da caixa real (fechada e aberta) |
| Mergulho na água | Mudança de direção | Cena dos dois frascos + caixas |

## 7. Nunca fazer

- Frasco **desenhado** em vez de foto real (fica fraco e falso).
- Fundo genérico gerado. Use **foto real** de textura de luxo (seda, cetim) de banco gratuito (Unsplash com licença livre, **não** Unsplash+).
- Gradiente roxo/azul genérico de "site de IA".
- Cards com sombra grande e cantos muito arredondados.
- Emojis na interface.
- Fontes padrão (Arial, Roboto, system-ui) em títulos.
- Muito texto na mesma tela.
- Animação rápida, com quique ou que toca sozinha sem a pessoa rolar.
- Carrossel automático.
