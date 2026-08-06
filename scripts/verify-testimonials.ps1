# Verify every published testimonial against the person's real words.
#
# WHY THIS EXISTS
# Testimonials kept getting quietly shortened, and worse, separated fragments got
# welded into sentences the person never said, with no ellipsis marking the cut.
#
# Why it survived every review: the master file stores condensed variants inline,
# in the same blockquote format as the real thing (a "TRUSTED BY" shortlist, an
# "email-friendly excerpt", a "cleaned version live on book.html"). A condensed
# variant is therefore indistinguishable from an original, and nothing ever
# validated a variant against the original it came from. So checking a published
# quote "against the master" would pass a spliced quote, because the master
# contained the spliced version too.
#
# Real example this catches, inside the master itself:
#   Lara Kinslow quoted as "My life now has never ever been so clear, and free.
#   My emotions no longer rule my life."
# Those two sentences sit 30 words apart in her actual DM.
#
# HOW IT WORKS
#   1. Parse the master into per-person quote blocks (### Name - ...).
#      A person may legitimately have several distinct originals (a DM, a call,
#      a course review), so every block is kept.
#   2. On the website, a paragraph counts as a testimonial only if one of those
#      people is named next to it. That is what separates a client quote from
#      Star's own first-person page copy, which otherwise looks identical.
#   3. The quote must be a contiguous run of ONE of that person's blocks.
#      Ellipses are allowed: split on them, every remaining run must be contiguous.
#
# A properly marked excerpt passes. A silent trim or a splice fails.
#
# USAGE
#   powershell -File scripts/verify-testimonials.ps1
#   powershell -File scripts/verify-testimonials.ps1 -CheckMaster
#   exit 0 = clean, 1 = something is not verbatim
param(
  [string]$Master = "C:\Users\starj\Documents\Star_Content_Strategy\Testimonials\TESTIMONIALS_MASTER.md",
  [string]$Repo   = (Split-Path -Parent $PSScriptRoot),
  [switch]$CheckMaster,
  [int]$MinLength = 55
)

$SQ = "[$([char]0x2018)$([char]0x2019)]"       # curly single quotes
$DQ = "[$([char]0x201C)$([char]0x201D)]"       # curly double quotes
$DASH = "[$([char]0x2013)$([char]0x2014)]"     # en / em dash
$ELL  = "(?:\.\.\.|&hellip;|$([char]0x2026))"

function Norm([string]$s) {
  $s = $s -replace '<[^>]+>', ' '
  $s = $s -replace '&middot;',' ' -replace '&amp;','and' -replace '&nbsp;',' '
  $s = $s -replace '&#x[0-9A-Fa-f]+;',' ' -replace '&#\d+;',' ' -replace '&[a-zA-Z]+;',' '
  $s = $s -replace $SQ, "'" -replace $DQ, '"' -replace $DASH, '-'
  return ($s.ToLower() -replace '[^a-z0-9]+', ' ').Trim()
}

if (-not (Test-Path $Master)) { Write-Output "MASTER NOT FOUND: $Master"; exit 2 }
$masterRaw = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($Master))

# ---- parse the master into per-person quote blocks -------------------------
$byPerson = @{}
foreach ($sec in [regex]::Split($masterRaw, '(?m)^###\s+')) {
  if (-not $sec.Trim()) { continue }
  $firstLine = ($sec -split "`n")[0]
  $name = ($firstLine -split "\s+(?:-|$([char]0x2013)|$([char]0x2014)|$([char]0x00B7))\s+")[0]
  $name = ($name -replace '[*_`]', '') -replace '[^\p{L}\p{N}\.\x27 ]', ''
  $name = ($name -replace '\s+', ' ').Trim()
  if ($name.Length -lt 3 -or $name.Length -gt 45) { continue }
  $key = Norm $name
  if (-not $key -or $key -eq 'video only 1 on 1') { continue }
  if (-not $byPerson.ContainsKey($key)) { $byPerson[$key] = @() }
  # A markdown blockquote that spans several lines is ONE quote. Keep each line
  # as a block AND the whole consecutive run joined, otherwise a multi-line post
  # published as one paragraph can never match and the checker cries wolf.
  $run = @()
  foreach ($line in ($sec -split "`n")) {
    if ($line -match '^>\s?(.*)$') {
      $piece = $Matches[1].Trim()
      if ($piece) { $run += $piece }
    } else {
      if ($run.Count -gt 0) {
        if ($run.Count -gt 1) { $j = Norm ($run -join ' '); if ($j.Length -ge 30) { $byPerson[$key] += $j } }
        foreach ($r in $run) { $n = Norm $r; if ($n.Length -ge 30) { $byPerson[$key] += $n } }
        $run = @()
      }
    }
  }
  if ($run.Count -gt 0) {
    if ($run.Count -gt 1) { $j = Norm ($run -join ' '); if ($j.Length -ge 30) { $byPerson[$key] += $j } }
    foreach ($r in $run) { $n = Norm $r; if ($n.Length -ge 30) { $byPerson[$key] += $n } }
  }
}
$people = @($byPerson.Keys | Where-Object { $byPerson[$_].Count -gt 0 })

function Segments([string]$raw) {
  return @([regex]::Split($raw, $ELL) | ForEach-Object { Norm $_ } | Where-Object { $_.Length -ge 20 })
}
function ContiguousIn([string[]]$segs, [string[]]$candidateBlocks) {
  foreach ($b in $candidateBlocks) {
    $all = $true
    foreach ($s in $segs) { if (-not $b.Contains($s)) { $all = $false; break } }
    if ($all) { return $true }
  }
  return $false
}

$bad = 0; $ok = 0; $ignored = 0
$failures = @()

# ---- audit the master's own condensed variants -----------------------------
if ($CheckMaster) {
  "=== AUDIT: does the master splice its own quotes? ==="
  "(a short block whose words all come from a longer block of the same person,"
  " but not contiguously, means fragments were welded into one sentence)"
  ""
  $found = @()
  foreach ($k in ($people | Sort-Object)) {
    $bs = @($byPerson[$k] | Sort-Object -Unique)
    if ($bs.Count -lt 2) { continue }
    foreach ($short in $bs) {
      foreach ($long in $bs) {
        if ($long.Length -le $short.Length -or $long.Contains($short)) { continue }
        $w = @($short -split ' ' | Where-Object { $_.Length -gt 3 })
        if ($w.Count -lt 5) { continue }
        $hit = 0; foreach ($x in $w) { if ($long.Contains(" $x ")) { $hit++ } }
        if ((100 * $hit / $w.Count) -ge 90) {
          $found += ("{0,-20} {1}" -f $k, $short.Substring(0, [Math]::Min(86, $short.Length)))
          break
        }
      }
    }
  }
  if ($found.Count) {
    $found | Select-Object -Unique | ForEach-Object { "  SPLICED  $_" }
    ""
    "  ^ inside the source of truth, so anything copied from these looks correct"
    "    on review. Fix these first or the same wording keeps spreading."
    $bad += ($found | Select-Object -Unique).Count
  } else { "  clean" }
  ""
}

# ---- check the website -----------------------------------------------------
"=== WEBSITE: published quotes vs the person's real words ==="
Get-ChildItem $Repo -Filter "*.html" -File | ForEach-Object {
  $file = $_.Name
  $html = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($_.FullName))

  $cands = @()
  foreach ($m in [regex]::Matches($html, '(?s)<p[^>]*>(.*?)</p>')) { $cands += $m }
  foreach ($m in [regex]::Matches($html, '(?s)<blockquote[^>]*>(.*?)</blockquote>')) { $cands += $m }

  foreach ($m in $cands) {
    $raw = $m.Groups[1].Value

    # A named person nearby is not enough: Star's own page copy often sits right
    # above a client's card ("Private coaching is the most direct way to do this
    # work..." above Karina's quote). A published testimonial also carries a
    # structural signal that it is a quote: quote marks, italics, or a
    # quote/testimonial class. Require both.
    $looksQuoted = ($raw -match "^\s*(?:&ldquo;|`"|$DQ)") -or
                   ($m.Value -match 'font-style\s*:\s*italic') -or
                   ($m.Value -match 'class="[^"]*(?:testimonial|quote)')
    if (-not $looksQuoted) { $ignored++; continue }

    # attribution inside the same element? keep only what is between quote marks
    $qm = [regex]::Matches($raw, "(?:&ldquo;|&rdquo;|`"|$DQ)")
    if ($qm.Count -ge 2) {
      $a = $qm[0].Index + $qm[0].Length
      $b = $qm[$qm.Count - 1].Index
      if ($b -gt $a) { $raw = $raw.Substring($a, $b - $a) }
    }

    $segs = Segments $raw
    if (-not $segs -or ($segs -join '').Length -lt $MinLength) { continue }

    # Who is this attributed to? Look at the element itself and the markup just
    # after it. No named person from the master means it is not a testimonial.
    $tailStart = $m.Index + $m.Length
    $tail = $html.Substring($tailStart, [Math]::Min(480, $html.Length - $tailStart))
    $scope = Norm ($m.Value + ' ' + $tail)
    $who = @()
    foreach ($p in $people) { if ($scope.Contains(" $p ")) { $who += $p } }
    if ($who.Count -eq 0) { $ignored++; continue }

    $candidateBlocks = @()
    foreach ($p in $who) { $candidateBlocks += $byPerson[$p] }

    if (ContiguousIn $segs $candidateBlocks) { $ok++; continue }

    $bad++
    $snip = (($raw -replace '<[^>]+>','') -replace '\s+',' ').Trim()
    $failures += ("{0,-24} [{1}]  {2}" -f $file, ($who -join '/'), $snip.Substring(0, [Math]::Min(76, $snip.Length)))
  }
}

if ($failures.Count) { $failures | ForEach-Object { "  NOT VERBATIM  $_" } } else { "  clean" }
""
"verbatim: $ok    not verbatim: $bad    not a testimonial: $ignored    people in master: $($people.Count)"
if ($bad -gt 0) {
  ""
  "FAIL. A quote above is not a contiguous run of that person's real words."
  "Restore the missing words, or mark each cut with an ellipsis so every"
  "remaining run stays intact. Never join separated fragments into one sentence."
  exit 1
}
"PASS. Every published testimonial is a contiguous run of the person's real words."
exit 0
