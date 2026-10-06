# Referências aprovadas

Lista viva: cada nova referência entra aqui com o que vale copiar dela.

> **Decisão de 2026-10-05:** o mergulho na água (itens 0 e 2) foi **descartado**. A cena principal agora é: dois frascos sobre seda escura → centro → borrifo → entram nas caixas → compra (ver `SKILL.md`). Das referências abaixo, continuam valendo o **produto como fio condutor** (Hungry Tiger), as **etiquetas laterais com ✕** (CropTab), a **tipografia com itálico** e o **microtexto mono**.

## Fundo aprovado
- **Seda/cetim** da foto de Susan Wilkinson no Unsplash (licença livre, ID `HxPjBhPIib0`), recortada na horizontal, escurecida e esquentada para champanhe escuro. Arquivo: `assets/bg/seda-escura.jpg`.

## 1. "Websites in 2026" (gravação 2026-10-05 22:10)
Coletânea de sites imersivos:
- **Igloo Inc**: objeto 3D central (iglu) em cenário de neve, microtexto mono nos cantos (`// Copyright © 2026`, `Scroll down to discover`, `Sound: on`). **Copiar:** objeto herói no centro, microtexto técnico, botão de som.
- **Site com narrativa (muralha de pedra)**: texto curto em serifa no centro, conduzindo uma história conforme o scroll. **Copiar:** contar a história do perfume em frases curtas.
- **Relay (verde neon)**: fundo escuro com feixe de luz forte e título com parte em itálico ("The handoffs run *themselves.*"). **Copiar:** contraste de luz no escuro, título com itálico.
- **Coco 3D**: um único objeto girando sobre fundo claro, logo pequeno, botão `MENU` e barra de progresso com contador (`005`). **Copiar:** minimalismo extremo, contador de progresso.

## 2. Skincare peônia (gravação 2026-10-05 22:16): referência principal do scroll
- Pote de creme centralizado. Com o scroll, a **tampa abre e sai flutuando**, o pote inclina e mostra a textura do creme, e uma **peônia floresce em volta**, envolvendo o produto.
- Depois vira uma grade "Four pieces, *one peony.*" com 4 produtos isolados.
- No fim, "Peony, *at first bloom.*": o pote aninhado dentro da flor aberta.
- Fundo claro rosado, títulos em serifa com itálico, botões pílula pequenos. Funciona igual no celular.
- **Copiar:** o produto se transformando com o scroll em sequência contínua (no nosso caso, o frasco mergulhando na água), a grade de produtos limpa e os títulos curtos com itálico.

## 0. "Meet CropTab" (gravação 2026-10-05 22:38, 1º site do vídeo): A referência do mergulho ⭐⭐
É **exatamente** o efeito que queremos para o frasco.
- **Fundo de cor lisa e chapada** (verde-limão) ocupando a tela toda. A água é transparente sobre essa cor, então o vídeo foi renderizado **com o mesmo fundo do site**, sem emenda nenhuma.
- **A linha da água atravessa a tela inteira** na horizontal. Primeiro o produto bate na superfície (respingo, bolha de ar em volta), depois afunda em câmera lenta.
- **A câmera acompanha o produto descendo:** a superfície sobe e sai pelo topo da tela, ficando um rastro de bolhas. O produto gira devagar enquanto afunda.
- **Textos laterais tipo "ficha técnica"**, sincronizados com a profundidade: marcador `✕` pequeno + linha fina horizontal + título curto ("Just drop it", "0 run-off", "Reinventing delivery", "Zero emissions") + parágrafo em caixa alta minúsculo. Alternam entre esquerda e direita.
- Título "Meet CropTab™" pequeno no canto superior esquerdo, logo centralizado no topo e menu discreto.
- **Copiar:** tudo. Fundo chapado da cor da marca, linha d'água de ponta a ponta, câmera descendo com o frasco e os textos laterais com `✕` e linha fina.

Outros sites do mesmo vídeo (secundários):
- **Aether:** objeto no centro com anéis de luz azul, "infinite scroll". Bom para efeito de luz.
- **Nfinitepapers:** partículas formando objetos, 3D usado só como fundo ("o simples bem feito").
- **Alche:** tipografia gigante com distorção. Não é o nosso estilo.

## 3. Hungry Tiger (eathungrytiger.com): referência principal de estrutura + scroll ⭐
É o modelo mais próximo do que queremos.
- **Como o produto se mexe:** 342 frames (WebP 1300×1350, produto isolado em fundo preto) tocados num `<canvas>` e controlados pelo scroll. O pote **viaja pela página inteira**: começa de pé, gira, vira de cabeça para baixo, a tampa sai e o molho escorre. O produto é o fio condutor de todas as seções, não fica preso numa só.
- **Tipografia gigante:** título enorme em caixa alta ("BOLD FLAVOR") atravessando a tela, com o produto **na frente** do texto. Subtítulo menor logo abaixo e uma linha pontilhada separando.
- **Texto revelado palavra por palavra:** frases começam com opacidade 0.2 e cada palavra acende conforme o scroll (SplitType + scrub).
- **Seções-capítulo:** "what makes it roar" (ingredientes com ícones), "what's inside", "tradition & creation" (3 pilares numerados com numerais em devanágari, ou seja, um detalhe cultural), "why the jar matters".
- Fundo com textura e ilustrações de ingredientes em tom sobre tom.
- Stack: Webflow + GSAP/ScrollTrigger + Lenis + SplitType.
- **Copiar:** o frasco atravessando a página inteira e se transformando, título gigante atrás do produto, revelação palavra por palavra, capítulos sobre as notas e o frasco ("por que o frasco importa"), numerais com toque cultural (romanos ou franceses, combinando com a marca).

## 4. Site Maison Lourée anterior (artifact): referência só de conteúdo
- Estrutura boa: hero "A arte de ser lembrado", história desde 1924 em Grasse, coleção Pour Homme / Pour Femme com pirâmide olfativa, ritual de entrega em 3 passos (numerais romanos), checkout com Pix/cartão/boleto.
- **Problema:** é frio e estático, só preto, dourado e texto, sem nenhum momento de impacto.
- **Copiar:** o conteúdo e a estrutura. **Não copiar:** a falta de movimento e de produto em destaque.

<!-- Próximas referências entram abaixo -->
