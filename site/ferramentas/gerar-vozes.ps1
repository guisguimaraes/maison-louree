# Gera as vozes "Sinta a fragrância." na ElevenLabs (Carla no Rose Dorée, Fabio no Lourée Noir).
# A chave é pedida na hora e não fica salva em lugar nenhum.
# Uso (na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File .\site\ferramentas\gerar-vozes.ps1

$ErrorActionPreference = 'Stop'
$destino = Join-Path $PSScriptRoot '..\public\media\elevenlabs'
New-Item -ItemType Directory -Force $destino | Out-Null

$segura = Read-Host 'Cole sua chave da ElevenLabs (API Key) e aperte Enter' -AsSecureString
$chave = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura))

$vozes = [ordered]@{
  'voz-rose' = 'oJebhZNaPllxk6W0LSBA'  # Carla (feminina)
  'voz-noir' = 'Dps47AVoFamqqkDShRDS'  # Fabio (masculino)
}

$corpo = @{
  text           = 'Sinta a fragrância.'
  model_id       = 'eleven_multilingual_v2'
  voice_settings = @{ stability = 0.5; similarity_boost = 0.8; style = 0.25; speed = 0.9 }
} | ConvertTo-Json -Depth 3
$bytes = [System.Text.Encoding]::UTF8.GetBytes($corpo)

foreach ($nome in $vozes.Keys) {
  $id = $vozes[$nome]
  $saida = Join-Path $destino "$nome.mp3"
  Write-Host "Gerando $nome..."
  Invoke-WebRequest -Method Post `
    -Uri "https://api.elevenlabs.io/v1/text-to-speech/$id`?output_format=mp3_44100_128" `
    -Headers @{ 'xi-api-key' = $chave; 'Accept' = 'audio/mpeg' } `
    -ContentType 'application/json; charset=utf-8' -Body $bytes -OutFile $saida
  Write-Host "  salvo em $saida"
}
$chave = $null
Write-Host ''
Write-Host 'Pronto! Pode avisar o Claude que as vozes foram geradas.'
