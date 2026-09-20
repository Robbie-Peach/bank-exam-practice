$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$base='https://robbie-peach.github.io/bank-exam-practice/'
$proxy=git config --get https.proxy
$files=@('index.html','app.js','core.js','styles.css','data.js','sw.js','manifest.webmanifest','icon.svg','ATTRIBUTION.html')
$results=@()
foreach ($file in $files) {
  $r=Invoke-WebRequest -Uri ($base+$file) -Proxy $proxy
  $local=(Get-Content -LiteralPath (Join-Path $root ('docs/'+$file)) -Raw).Replace("`r`n","`n")
  $decoded=if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
  if($r.StatusCode -ne 200 -or $local -cne $decoded.Replace("`r`n","`n")) { throw "Remote content mismatch: $file status=$($r.StatusCode)" }
  $results += "$file HTTP=$($r.StatusCode) CONTENT_MATCH=YES"
}
$results | Set-Content -LiteralPath (Join-Path $root 'artifacts/remote-assets.txt') -Encoding utf8
$results
'DEPLOYMENT=PASS; REMOTE_ASSETS=9; HTTPS=YES'
