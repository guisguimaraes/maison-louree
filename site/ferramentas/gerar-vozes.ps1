# Gera "Sinta a fragrância deste perfume." na ElevenLabs (Carla no Rose Dorée, Fabio no Lourée Noir)
# em 3 versões de modelo, para escolher pelo ouvido a que soa mais brasileira.
# A chave é pedida na hora e não fica salva em lugar nenhum.
# Uso: dois cliques em "Gerar vozes ElevenLabs.cmd" (na pasta do projeto).

$ErrorActionPreference = 'Stop'
$destino = Join-Path $PSScriptRoot '..\public\media\elevenlabs'
New-Item -ItemType Directory -Force $destino | Out-Null

$segura = Read-Host 'Cole sua chave da ElevenLabs (API Key) e aperte Enter' -AsSecureString
$chave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))

$vozes = [ordered]@{
  'rose' = 'oJebhZNaPllxk6W0LSBA'  # Carla (feminina)
  'noir' = 'Dps47AVoFamqqkDShRDS'  # Fabio (masculino)
}

# 1 = Eleven v3 em português; 2 = Multilingual v2 bem estável; 3 = Turbo v2.5 em português, bem estável
$versoes = [ordered]@{
  '1' = @{ model_id = 'eleven_v3'; language_code = 'pt'; voice_settings = @{ stability = 0.5; similarity_boost = 0.85 } }
  '2' = @{ model_id = 'eleven_multilingual_v2'; voice_settings = @{ stability = 0.75; similarity_boost = 0.9; style = 0.1; speed = 0.92 } }
  '3' = @{ model_id = 'eleven_turbo_v2_5'; language_code = 'pt'; voice_settings = @{ stability = 0.75; similarity_boost = 0.9; style = 0.1; speed = 0.92 } }
}

foreach ($nome in $vozes.Keys) {
  foreach ($v in $versoes.Keys) {
    $corpo = @{ text = 'Sinta a fragrância deste perfume.' } + $versoes[$v]
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($corpo | ConvertTo-Json -Depth 3))
    $saida = Join-Path $destino "voz-$nome-$v.mp3"
    Write-Host "Gerando voz-$nome-$v..."
    try {
      Invoke-WebRequest -Method Post `
        -Uri "https://api.elevenlabs.io/v1/text-to-speech/$($vozes[$nome])`?output_format=mp3_44100_128" `
        -Headers @{ 'xi-api-key' = $chave; 'Accept' = 'audio/mpeg' } `
        -ContentType 'application/json; charset=utf-8' -Body $bytes -OutFile $saida
      Write-Host "  salvo em $saida"
    } catch {
      Write-Host "  não deu certo nessa versão: $($_.Exception.Message)"
    }
  }
}
$chave = $null
Write-Host ''
Write-Host 'Pronto! Ouça os arquivos na pasta que vai abrir e diga ao Claude qual número soa melhor.'
Start-Process explorer.exe $destino
