# Scam Guard - asset generator (icons, promo banner, screenshots)
# Run: powershell -ExecutionPolicy Bypass -File tools/generate-assets.ps1
# (Run from the project root folder)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root 'assets\icons'
$storeDir = Join-Path $root 'assets\store'

foreach ($d in @($iconDir, $storeDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

function New-Canvas([int]$w, [int]$h, [string]$bg = '') {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    if ($bg -ne '') {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($bg))
        $g.Clear($brush.Color)
        $brush.Dispose()
    }
    return @{ Bitmap = $bmp; G = $g }
}

function Save-Canvas($canvas, [string]$path) {
    $canvas.G.Dispose()
    $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Bitmap.Dispose()
}

function Draw-Shield([System.Drawing.Graphics]$g, [int]$cx, [int]$cy, [int]$size, [string]$fill, [string]$outline, [int]$outlineW, [string]$check) {
    $s = $size / 100.0
    $pts = @(
        (New-Object System.Drawing.PointF(($cx - 0 * $s + $size * 0.50), ($cy + 4 * $s))),
        (New-Object System.Drawing.PointF(($cx - 0 * $s + $size * 0.90), ($cy + 16 * $s))),
        (New-Object System.Drawing.PointF(($cx - 0 * $s + $size * 0.90), ($cy + 54 * $s))),
        (New-Object System.Drawing.PointF(($cx - 0 * $s + $size * 0.50), ($cy + 96 * $s))),
        (New-Object System.Drawing.PointF(($cx - 0 * $s + $size * 0.10), ($cy + 54 * $s))),
        (New-Object System.Drawing.PointF(($cx - 0 * $s + $size * 0.10), ($cy + 16 * $s)))
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddPolygon($pts)

    $fillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#" + $fill.TrimStart('#')))
    $g.FillPath($fillBrush, $path)
    $fillBrush.Dispose()

    if ($outline -ne '') {
        $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#" + $outline.TrimStart('#')), $outlineW)
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawPath($pen, $path)
        $pen.Dispose()
    }

    if ($check -ne '') {
        $p = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#" + $check.TrimStart('#')), [Math]::Max(3, $size * 0.09))
        $p.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $p.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawLines($p, @(
            (New-Object System.Drawing.PointF(($cx + $size * 0.30), ($cy + $size * 0.50))),
            (New-Object System.Drawing.PointF(($cx + $size * 0.46), ($cy + $size * 0.64))),
            (New-Object System.Drawing.PointF(($cx + $size * 0.72), ($cy + $size * 0.34)))
        ))
        $p.Dispose()
    }

    $path.Dispose()
}

# ---------- Icons ----------
foreach ($size in @(16, 32, 48, 128)) {
    $c = New-Canvas $size $size '000000'
    # transparent clear
    $c.G.Clear([System.Drawing.Color]::Transparent)
    # green rounded-square background
    $r = $size * 0.10
    $rect = New-Object System.Drawing.RectangleF($r, $r, ($size - 2 * $r), ($size - 2 * $r))
    $rr = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $size * 0.25
    $rr.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $rr.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $rr.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $rr.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $rr.CloseFigure()
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.ColorTranslator]::FromHtml('#1f9d57'), [System.Drawing.ColorTranslator]::FromHtml('#12713e'), 45)
    $c.G.FillPath($bgBrush, $rr)
    $bgBrush.Dispose()

    # white shield + green check
    Draw-Shield $c.G 0 0 $size '#ffffff' '#0c5a30' 1 '12713e'
    Save-Canvas $c (Join-Path $iconDir "icon$size.png")
    $rr.Dispose()
}

# ---------- Promo banner 440x280 ----------
$pw = 440; $ph = 280
$c = New-Canvas $pw $ph '#0f1424'
$g = $c.G

# subtle gradient background
$bgRect = New-Object System.Drawing.RectangleF(0, 0, $pw, $ph)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, [System.Drawing.ColorTranslator]::FromHtml('#0f1424'), [System.Drawing.ColorTranslator]::FromHtml('#1a2747'), 90)
$g.FillRectangle($grad, $bgRect)
$grad.Dispose()

# decorative circles
$deco = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 62, 128, 255))
$g.FillEllipse($deco, 330, -40, 180, 180)
$deco2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 80, 200, 140))
$g.FillEllipse($deco2, -40, 190, 160, 160)
$deco.Dispose(); $deco2.Dispose()

Draw-Shield $g 70 70 110 '#22a05a' '#0c5a30' 2 '#ffffff'

$f1 = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Bold)
$f2 = New-Object System.Drawing.Font('Segoe UI', 13)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gray = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#9db2d8'))

$g.DrawString('Scam Guard', $f1, $white, 150, 92)
$g.DrawString('Phishing & Fake Website Detector', $f2, $gray, 150, 136)

$f1.Dispose(); $f2.Dispose(); $white.Dispose(); $gray.Dispose()
Save-Canvas $c (Join-Path $storeDir 'promo-440x280.png')

# ---------- Screenshot 1: safe site (1280x800) ----------
$sw = 1280; $sh = 800
$c = New-Canvas $sw $sh '#e8ecf4'
$g = $c.G

# browser window
$win = New-Object System.Drawing.RectangleF(120, 60, 1040, 640)
$winBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($winBrush, $win)
$winBrush.Dispose()
$winPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c3c9d6'), 2)
$g.DrawRectangle($winPen, [int]$win.X, [int]$win.Y, [int]$win.Width, [int]$win.Height)
$winPen.Dispose()

# toolbar
$tbBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f2f4f8'))
$g.FillRectangle($tbBrush, $win.X, $win.Y, $win.Width, 70)
$tbBrush.Dispose()

# dots
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 95, 99, 132))
foreach ($dx in @(($win.X + 24), ($win.X + 44), ($win.X + 64))) {
    $g.FillEllipse($dotBrush, $dx, $win.Y + 30, 10, 10)
}
$dotBrush.Dispose()

# address bar
$addrRect = New-Object System.Drawing.RectangleF(($win.X + 90), ($win.Y + 24), 700, 26)
$addrBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#e2e6ee'))
$g.FillRectangle($addrBrush, $addrRect)
$addrBrush.Dispose()
$fAddr = New-Object System.Drawing.Font('Segoe UI', 12)
$addrColor = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#333a47'))
$g.DrawString('  https://yourbank.com', $fAddr, $addrColor, $addrRect.X, $addrRect.Y + 3)
$addrColor.Dispose()

# green shield card in page
$card = New-Object System.Drawing.RectangleF(($win.X + 180), ($win.Y + 180), 680, 360)
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ffffff'))
$g.FillRectangle($cardBrush, $card)
$cardBrush.Dispose()
$cardPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#2e7d46'), 3)
$g.DrawRectangle($cardPen, [int]$card.X, [int]$card.Y, [int]$card.Width, [int]$card.Height)
$cardPen.Dispose()

Draw-Shield $g 520 250 120 '#2e7d46' '#1c5a30' 2 '#ffffff'

$fBig = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Bold)
$fMed = New-Object System.Drawing.Font('Segoe UI', 15)
$green = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#2e7d46'))
$dark = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#444b58'))

$g.DrawString('Site Safe', $fBig, $green, ($card.X + 280), ($card.Y + 30))
$g.DrawString('This website looks safe. Scam Guard found no fake patterns.', $fMed, $dark, ($card.X + 60), ($card.Y + 200))
$g.DrawString('Your passwords and data are protected.', $fMed, $dark, ($card.X + 60), ($card.Y + 240))

$fBig.Dispose(); $fMed.Dispose(); $green.Dispose(); $dark.Dispose(); $fAddr.Dispose()
Save-Canvas $c (Join-Path $storeDir 'screenshot-1-safe.png')

# ---------- Screenshot 2: danger warning (1280x800) ----------
$c = New-Canvas $sw $sh '#e8ecf4'
$g = $c.G

$win = New-Object System.Drawing.RectangleF(120, 60, 1040, 640)
$winBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($winBrush, $win)
$winBrush.Dispose()
$winPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c3c9d6'), 2)
$g.DrawRectangle($winPen, [int]$win.X, [int]$win.Y, [int]$win.Width, [int]$win.Height)
$winPen.Dispose()

$tbBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f2f4f8'))
$g.FillRectangle($tbBrush, $win.X, $win.Y, $win.Width, 70)
$tbBrush.Dispose()

$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 95, 99, 132))
foreach ($dx in @(($win.X + 24), ($win.X + 44), ($win.X + 64))) {
    $g.FillEllipse($dotBrush, $dx, $win.Y + 30, 10, 10)
}
$dotBrush.Dispose()

$addrRect = New-Object System.Drawing.RectangleF(($win.X + 90), ($win.Y + 24), 700, 26)
$addrBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f3d9d5'))
$g.FillRectangle($addrBrush, $addrRect)
$addrBrush.Dispose()
$fAddr = New-Object System.Drawing.Font('Segoe UI', 12)
$addrColor = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#a04034'))
$g.DrawString('  https://paypal-secure-login.xyz', $fAddr, $addrColor, $addrRect.X, $addrRect.Y + 3)
$addrColor.Dispose()

# red warning card
$card = New-Object System.Drawing.RectangleF(($win.X + 180), ($win.Y + 180), 680, 360)
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ffffff'))
$g.FillRectangle($cardBrush, $card)
$cardBrush.Dispose()
$cardPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c0392b'), 3)
$g.DrawRectangle($cardPen, [int]$card.X, [int]$card.Y, [int]$card.Width, [int]$card.Height)
$cardPen.Dispose()

Draw-Shield $g 520 250 120 '#c0392b' '#8e2a20' 2 '#ffffff'

$fBig = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Bold)
$fMed = New-Object System.Drawing.Font('Segoe UI', 15)
$red = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c0392b'))
$dark = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#444b58'))

$g.DrawString('Warning: Fake Website!', $fBig, $red, ($card.X + 140), ($card.Y + 30))
$g.DrawString('This site looks like PayPal but is a scam - do not enter your password.', $fMed, $dark, ($card.X + 60), ($card.Y + 200))
$g.DrawString('Scam Guard blocked the page to protect you.', $fMed, $dark, ($card.X + 60), ($card.Y + 240))

$fBig.Dispose(); $fMed.Dispose(); $red.Dispose(); $dark.Dispose(); $fAddr.Dispose()
Save-Canvas $c (Join-Path $storeDir 'screenshot-2-warning.png')

# ---------- Screenshot 3: popup showing the verdict (1280x800) ----------
$c = New-Canvas $sw $sh '#e8ecf4'
$g = $c.G

# browser window with a real-looking login page behind the popup
$win = New-Object System.Drawing.RectangleF(120, 60, 1040, 640)
$winBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($winBrush, $win)
$winBrush.Dispose()
$winPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c3c9d6'), 2)
$g.DrawRectangle($winPen, [int]$win.X, [int]$win.Y, [int]$win.Width, [int]$win.Height)
$winPen.Dispose()

$tbBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f2f4f8'))
$g.FillRectangle($tbBrush, $win.X, $win.Y, $win.Width, 70)
$tbBrush.Dispose()

$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 95, 99, 132))
foreach ($dx in @(($win.X + 24), ($win.X + 44), ($win.X + 64))) {
    $g.FillEllipse($dotBrush, $dx, $win.Y + 30, 10, 10)
}
$dotBrush.Dispose()

$addrRect = New-Object System.Drawing.RectangleF(($win.X + 90), ($win.Y + 24), 700, 26)
$addrBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f3d9d5'))
$g.FillRectangle($addrBrush, $addrRect)
$addrBrush.Dispose()
$fAddr = New-Object System.Drawing.Font('Segoe UI', 12)
$addrColor = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#a04034'))
$g.DrawString('  https://paypal-secure-login.xyz', $fAddr, $addrColor, $addrRect.X, $addrRect.Y + 3)
$addrColor.Dispose()

# grey login form (behind the popup)
$form = New-Object System.Drawing.RectangleF(($win.X + 340), ($win.Y + 140), 360, 420)
$formBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 246, 249))
$g.FillRectangle($formBrush, $form)
$formBrush.Dispose()
$fFake = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$fakeCol = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#5a6270'))
$g.DrawString('PayPal Login', $fFake, $fakeCol, ($form.X + 30), ($form.Y + 40))
$inputBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#ffffff'))
$inPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c3c9d6'), 1)
foreach ($iy in @(($form.Y + 120), ($form.Y + 200))) {
    $inRect = New-Object System.Drawing.RectangleF(($form.X + 30), $iy, 300, 46)
    $g.FillRectangle($inputBrush, $inRect)
    $g.DrawRectangle($inPen, [int]$inRect.X, [int]$inRect.Y, [int]$inRect.Width, [int]$inRect.Height)
}
$inPen.Dispose()
$btnRect = New-Object System.Drawing.RectangleF(($form.X + 30), ($form.Y + 300), 300, 50)
$btnBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#0070ba'))
$g.FillRectangle($btnBrush, $btnRect)
$btnBrush.Dispose()
$fBtn = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$whiteCol = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString('Log In', $fBtn, $whiteCol, ($form.X + 135), ($form.Y + 314))
$fFake.Dispose(); $fakeCol.Dispose(); $inputBrush.Dispose()
$fBtn.Dispose(); $whiteCol.Dispose(); $fAddr.Dispose()

# popup panel (top-right, like the real toolbar popup)
$pop = New-Object System.Drawing.RectangleF(($win.X + 640), ($win.Y + 90), 340, 500)
$popBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#16161f'))
$g.FillRectangle($popBrush, $pop)
$popBrush.Dispose()
$popPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#2c2c40'), 1)
$g.DrawRectangle($popPen, [int]$pop.X, [int]$pop.Y, [int]$pop.Width, [int]$pop.Height)
$popPen.Dispose()

Draw-Shield $g ($pop.X + 34) ($pop.Y + 30) 26 '#22a05a' '#0c5a30' 1 '#ffffff'

$fTit = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$g.DrawString('Scam Guard', $fTit, [System.Drawing.Brushes]::White, ($pop.X + 60), ($pop.Y + 20))
$fSub = New-Object System.Drawing.Font('Segoe UI', 10)
$subCol = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#9a9aa8'))
$g.DrawString('Phishing & Fake Website Detector', $fSub, $subCol, ($pop.X + 60), ($pop.Y + 42))

# status card (danger)
$status = New-Object System.Drawing.RectangleF(($pop.X + 20), ($pop.Y + 86), 300, 70)
$statusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1e1e2e'))
$g.FillRectangle($statusBrush, $status)
$statusBrush.Dispose()
$statusPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c0392b'), 2)
$g.DrawRectangle($statusPen, [int]$status.X, [int]$status.Y, [int]$status.Width, [int]$status.Height)
$statusPen.Dispose()
$warnCol = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c0392b'))
$fWarn = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Bold)
$g.DrawString('!', $fWarn, $warnCol, ($status.X + 28), ($status.Y + 10))
$fDanger = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$g.DrawString('Danger - Fake Website!', $fDanger, [System.Drawing.Brushes]::White, ($status.X + 70), ($status.Y + 12))
$fSafeTxt = New-Object System.Drawing.Font('Segoe UI', 10)
$g.DrawString('Do not enter any password here.', $fSafeTxt, $subCol, ($status.X + 70), ($status.Y + 38))

# host + reasons
$fHost = New-Object System.Drawing.Font('Segoe UI', 11)
$hostCol = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#9a9aa8'))
$g.DrawString('paypal-secure-login.xyz', $fHost, $hostCol, ($pop.X + 22), ($pop.Y + 174))
$reasonCol = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d8d8e0'))
$fReason = New-Object System.Drawing.Font('Segoe UI', 11)
$g.DrawString('  Lookalike of PayPal domain', $fReason, $reasonCol, ($pop.X + 22), ($pop.Y + 204))
$g.DrawString('  Suspicious new top-level domain (.xyz)', $fReason, $reasonCol, ($pop.X + 22), ($pop.Y + 228))
$g.DrawString('  Login page imitating a real brand', $fReason, $reasonCol, ($pop.X + 22), ($pop.Y + 252))

# buttons
$btnBlock = New-Object System.Drawing.RectangleF(($pop.X + 20), ($pop.Y + 300), 145, 44)
$btnBlockBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c0392b'))
$g.FillRectangle($btnBlockBrush, $btnBlock)
$btnBlockBrush.Dispose()
$g.DrawString('Block this site', $fReason, [System.Drawing.Brushes]::White, ($btnBlock.X + 20), ($btnBlock.Y + 13))
$btnTrust = New-Object System.Drawing.RectangleF(($pop.X + 175), ($pop.Y + 300), 145, 44)
$btnTrustBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#1e6b3a'))
$g.FillRectangle($btnTrustBrush, $btnTrust)
$btnTrustBrush.Dispose()
$g.DrawString('Trust this site', $fReason, [System.Drawing.Brushes]::White, ($btnTrust.X + 22), ($btnTrust.Y + 13))

# footer
$g.DrawString('3 sites checked today', $fSub, $subCol, ($pop.X + 22), ($pop.Y + 370))
$g.DrawString('Settings >', $fSub, $subCol, ($pop.X + 240), ($pop.Y + 370))

$fTit.Dispose(); $fSub.Dispose(); $subCol.Dispose(); $warnCol.Dispose()
$fWarn.Dispose(); $fDanger.Dispose(); $fSafeTxt.Dispose(); $fHost.Dispose()
$hostCol.Dispose(); $reasonCol.Dispose(); $fReason.Dispose()
Save-Canvas $c (Join-Path $storeDir 'screenshot-3-popup.png')

Write-Output 'Assets generated successfully.'
