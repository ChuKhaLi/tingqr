namespace TingQR.Rendering
{
    /// <summary>
    /// Centre logo. <b>Provisional:</b> the limits (logo size ≤ 0.25, cleared area ≤ 10%, clearing the centre alignment
    /// pattern on version 7+) are not yet verified by scans with real banking apps; see conformance/scans.md.
    /// </summary>
    public sealed record LogoOptions
    {
        /// <summary>Logo image: data:image/(png|jpeg|webp|svg+xml), http(s): URL, or a relative path.</summary>
        public required string Href { get; init; }

        /// <summary>Logo side as a fraction of the QR side (quiet zone excluded), in (0, 0.25]; default 0.2.</summary>
        public double? Size { get; init; }

        /// <summary>Blank modules around the logo, integer 0–4; default 1.</summary>
        public int? Padding { get; init; }

        /// <summary>Colour behind the logo, '#rgb', '#rrggbb' or 'transparent'; default: the QR background.</summary>
        public string? Background { get; init; }
    }
}
