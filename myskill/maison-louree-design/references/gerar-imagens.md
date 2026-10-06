# Como gerar as imagens do produto (sem cara de IA)

Frasco, caixa e borrifo **não** são feitos em código (ver `SKILL.md`, seção 6). Eles vêm de foto de estúdio ou de geração com IA a partir das fotos reais (`assets/fotos/`).

Ferramentas: **Gemini** (modelo Nano Banana, gratuito no app), **ChatGPT** (gera PNG com fundo transparente) ou **Morphix** (precisa de créditos). Sempre **anexe a foto real** como referência, para a IA copiar o formato do frasco e o rótulo exatos.

Depois de gerar, confira com lupa: o texto do rótulo/caixa está **exatamente** igual ao real? Letras tortas ou inventadas = gerar de novo.

## 1. Frascos (um de cada vez)

Anexe a foto em que o frasco aparece de frente (`assets/fotos/2.png` para o Rose Dorée, `assets/fotos/5.png` para o Lourée Noir).

> Use the attached photo as the exact reference for the perfume bottle: same bottle shape, same gold cap, same label design and the exact label text ("MAISON LOURÉE · PARFUMS · L'art de se souvenir · **Rose Dorée** · EAU DE PARFUM · 50 ml"). Create a high-end studio product photograph of ONLY this bottle, straight front view, centered, on a transparent background (or pure white seamless if transparency is not possible). Soft diffused studio lighting, crisp realistic glass reflections and refraction, pale golden perfume liquid visible through the glass, polished gold cap with soft highlights, subtle contact shadow. No props, no table, no box, no text outside the label. Ultra sharp, luxury fragrance advertising style, 4K.

Para o masculino, troque **Rose Dorée** por **Lourée Noir**.

Gere também uma versão **levemente girada (3/4)** de cada frasco: dá mais vida ao movimento.

## 2. Caixas (cada uma, três peças)

Anexe a foto da caixa de frente (`assets/fotos/2.png`).

> Using the attached photo as exact reference for the packaging design (color, gold foil frame, laurel "L" monogram, typography and the exact text), create a photorealistic studio product shot of this perfume box, straight front view, closed, on a transparent background. Glossy [burgundy / black] cardboard with real gold hot-foil stamping that catches the light, crisp edges, slight 3D depth showing a thin side. No bottle, no props. Luxury packaging photography, 4K.

Variações para a animação de "entrar na caixa":
- **Caixa aberta, sem tampa, vista de frente levemente de cima** (aparece a borda interna).
- **Só a tampa**, flutuando, vista de frente.

## 3. Borrifo (névoa de perfume)

Gere em **fundo preto puro**, para recortar a névoa pela luminosidade:

> Photorealistic fine perfume mist bursting from a spray atomizer nozzle, isolated on pure black background, backlit with warm golden light, millions of micro droplets forming a soft cone-shaped cloud that dissipates, slow motion high-speed photography, no bottle visible, 4K.

Ideal: **vídeo** de 3 a 5 s dessa névoa (Veo, Kling, Runway). Vira uma sequência de frames tocada pelo scroll, presa ao bico do frasco.

## 4. Onde salvar

- `assets/produto/rose-doree-frente.png`, `rose-doree-3-4.png`
- `assets/produto/louree-noir-frente.png`, `louree-noir-3-4.png`
- `assets/produto/caixa-rose-fechada.png`, `caixa-rose-aberta.png`, `caixa-rose-tampa.png` (e o mesmo para `caixa-noir-*`)
- `assets/produto/borrifo.mp4` (ou `borrifo.png`)
