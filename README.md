# Maison Lourée

Site da Maison Lourée, marca de perfumes (Rose Dorée e Lourée Noir).

## Estrutura

- `myskill/maison-louree-design/`: skill do Claude Code com a direção de design do site (marca, cores, tipografia, referências e a avaliação "nunca com cara de IA").
- `assets/fotos/`: fotos reais dos frascos e das caixas.
- `assets/bg/`: fundos de seda (foto de Susan Wilkinson no Unsplash, licença Unsplash).
- `.agents/skills/`: skills instaladas (find-skills, grill-me, hyperframes-cli, frontend-design).
- `video/`: projeto Remotion para vídeos.

## Ativar a skill no Claude Code

No Windows (PowerShell, na raiz do projeto):

```powershell
New-Item -ItemType Junction -Path ".claude\skills\maison-louree-design" -Target "$PWD\myskill\maison-louree-design"
```

## Instalar dependências

```bash
npm install
cd video && npm install
```
