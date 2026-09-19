$html = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity\scratch\trending\index.html' -Encoding UTF8

$panes = @(
    @{ id="feeds"; file="feeds.js" },
    @{ id="explore"; file="explore.js" },
    @{ id="reels"; file="reels.js" },
    @{ id="fitness"; file="fitness.js" },
    @{ id="learn"; file="learn.js" },
    @{ id="creator"; file="creator.js" },
    @{ id="messages"; file="messages.js" },
    @{ id="community"; file="community.js" },
    @{ id="profile"; file="profile.js" },
    @{ id="category"; file="category.js" },
    @{ id="designstudio"; file="designstudio.js" }
)

foreach ($pane in $panes) {
    # Regex to capture the entire section, using singleline modifier (?s) so . matches newlines
    $regex = "(?s)<section id=`"pane-$($pane.id)`".*?</section>"
    $match = [regex]::Match($html, $regex)
    
    if ($match.Success) {
        $paneHtml = $match.Value
        
        # Escape backticks and ${} to safely insert into JS template literal
        $escapedHtml = $paneHtml -replace '`', '\`' -replace '\$\{', '\$\{'
        
        $jsFunc = "`n`nfunction get$([char]::ToUpper($pane.id[0]) + $pane.id.Substring(1))Template() {`n  return ``$escapedHtml``;`n}`n"
        
        # Append to the respective JS file
        $jsPath = "C:\Users\ASUS\.gemini\antigravity\scratch\trending\js\pages\$($pane.file)"
        if (Test-Path $jsPath) {
            Add-Content -Path $jsPath -Value $jsFunc -Encoding UTF8
        }
        
        # Remove from index.html
        $html = $html -replace [regex]::Escape($paneHtml), ""
    }
}

# The new index.html should have a single mount point instead of all the stripped panes
$html = $html -replace '<main class="pane-container">', '<main class="pane-container" id="main-content">'

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity\scratch\trending\index.html' -Value $html -Encoding UTF8
Write-Output "Successfully migrated pane HTML to JS templates and stripped index.html!"
