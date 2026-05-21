# Generate Korean count voice WAV files using Windows TTS (System.Speech).
# Output: packages/electron-app/src/renderer/assets/sounds/count-{3,2,1}.wav
#
# Korean characters are written as Unicode escapes to avoid encoding issues
# when this file is read by PowerShell 5.1 (which assumes ANSI for BOM-less files).
#   sam = U+C0BC  (3, sino-Korean)
#   i   = U+C774  (2, sino-Korean)
#   il  = U+C77C  (1, sino-Korean)
#
# Notes:
# - Rate is set to -1 so the single-syllable "sam" is enunciated clearly.
# - Each utterance is wrapped with PromptBuilder + AppendBreak to add a short
#   leading/trailing silence so the very first phoneme is not cut off.

Add-Type -AssemblyName System.Speech

$assetsDir = Join-Path $PSScriptRoot '..\packages\electron-app\src\renderer\assets\sounds'
$assetsDir = [System.IO.Path]::GetFullPath($assetsDir)
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

Write-Host '--- Installed Voices ---'
$synth.GetInstalledVoices() | ForEach-Object {
    $info = $_.VoiceInfo
    Write-Host ("  {0} [{1}]" -f $info.Name, $info.Culture.Name)
}

$koVoice = $synth.GetInstalledVoices() | Where-Object {
    $_.VoiceInfo.Culture.Name -like 'ko*'
} | Select-Object -First 1

if ($koVoice) {
    $synth.SelectVoice($koVoice.VoiceInfo.Name)
    Write-Host ("Selected Korean voice: {0}" -f $koVoice.VoiceInfo.Name)
} else {
    Write-Host 'WARN: No Korean voice installed - using default voice (may sound English).'
}

$synth.Rate = -1
$synth.Volume = 100

$sam = [string][char]0xC0BC
$i   = [string][char]0xC774
$il  = [string][char]0xC77C

$pairs = [ordered]@{
    '3' = $sam
    '2' = $i
    '1' = $il
}

$culture = New-Object System.Globalization.CultureInfo 'ko-KR'

foreach ($key in $pairs.Keys) {
    $path = Join-Path $assetsDir ("count-{0}.wav" -f $key)
    $synth.SetOutputToWaveFile($path)

    $builder = New-Object System.Speech.Synthesis.PromptBuilder $culture
    $builder.AppendBreak([System.Speech.Synthesis.PromptBreak]::ExtraSmall)
    $builder.AppendText($pairs[$key])
    $builder.AppendBreak([System.Speech.Synthesis.PromptBreak]::ExtraSmall)
    $synth.Speak($builder)

    Write-Host ("Created: {0}  (text='{1}')" -f $path, $pairs[$key])
}

$synth.Dispose()
Write-Host 'Done.'
