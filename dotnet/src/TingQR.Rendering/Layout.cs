using System.Globalization;

namespace TingQR.Rendering
{
    /// <summary>The options of <see cref="SvgOptions"/> except Size: what every renderer shares.</summary>
    internal sealed record LayoutOptions : MatrixOptions
    {
        /// <summary>Quiet zone in modules, 0–16; default 4.</summary>
        public int? Margin { get; init; }

        /// <summary>Dark module colour, '#rgb' or '#rrggbb'; default '#000000'.</summary>
        public string? Foreground { get; init; }

        /// <summary>Background colour, '#rgb', '#rrggbb' or 'transparent'; default '#ffffff'. 'transparent' skips the contrast check.</summary>
        public string? Background { get; init; }

        /// <summary>Centre logo; forces ECC H and clears the modules under it.</summary>
        public LogoOptions? Logo { get; init; }
    }

    /// <summary>The logo part of a <see cref="LayoutResult"/>.</summary>
    internal sealed record LogoLayout(string Href, string Background, LogoBox Box);

    /// <summary>A validated, encoded code ready to draw: module grid, colours and the logo box (module coordinates).</summary>
    internal sealed class LayoutResult
    {
        public LayoutResult(QrMatrix matrix, int margin, string foreground, string background, LogoLayout? logo)
        {
            Matrix = matrix;
            Margin = margin;
            Foreground = foreground;
            Background = background;
            Logo = logo;
        }

        public QrMatrix Matrix { get; }

        public int Size => Matrix.Size;

        public int Margin { get; }

        public string Foreground { get; }

        /// <summary>A hex colour or 'transparent'.</summary>
        public string Background { get; }

        public LogoLayout? Logo { get; }

        /// <summary>True for a module inside the logo's cleared box (always false without a logo).</summary>
        public bool Cleared(int x, int y)
        {
            if (Logo == null) return false;
            var box = Logo.Box;
            var end = box.ClearStart + box.ClearSide;
            return x >= box.ClearStart && x < end && y >= box.ClearStart && y < end;
        }
    }

    internal static class Layout
    {
        /// <summary>
        /// Minimum contrast between foreground and background. A heuristic: 4.5:1 is the WCAG text threshold, used here as
        /// a conservative bar for phone cameras; not a measured property of banking apps.
        /// </summary>
        public const double MinContrast = 4.5;

        private static TingQrException Invalid(string message) => new TingQrException(TingQrErrorCode.InvalidValue, message);

        public static int CheckMargin(int? margin)
        {
            var value = margin ?? 4;
            if (value < 0 || value > 16)
            {
                // Stryker disable once String : error message
                throw Invalid("Option margin must be an integer 0–16.");
            }
            return value;
        }

        public static void CheckColours(string foreground, string background)
        {
            var fg = Color.ParseHex(foreground);
            if (background == "transparent") return;
            var bg = Color.ParseHex(background);
            if (Color.Luminance(fg) >= Color.Luminance(bg) || Color.ContrastRatio(fg, bg) < MinContrast)
            {
                // Stryker disable once all : only builds the error message
                var message = string.Format(
                    CultureInfo.InvariantCulture,
                    "Foreground {0} must be darker than background {1} with contrast ≥ {2}:1; light or inverted QR codes fail in many banking apps.",
                    foreground,
                    background,
                    MinContrast);
                throw Invalid(message);
            }
        }

        private sealed class LogoParts
        {
            public LogoParts(string href, double size, int padding, string background)
            {
                Href = href;
                Size = size;
                Padding = padding;
                Background = background;
            }

            public string Href { get; }

            public double Size { get; }

            public int Padding { get; }

            public string Background { get; }
        }

        /// <summary>Validate the logo options (no matrix needed) and fill in their defaults.</summary>
        private static LogoParts CheckLogoOptions(LogoOptions logo, string background)
        {
            var href = Logo.CheckHref(logo.Href);
            var size = logo.Size ?? 0.2;
            if (!(size > 0 && size <= 0.25))
            {
                // Stryker disable once String : error message
                throw Invalid("Logo size must be a number in (0, 0.25].");
            }
            var padding = logo.Padding ?? 1;
            if (padding < 0 || padding > 4)
            {
                // Stryker disable once String : error message
                throw Invalid("Logo padding must be an integer 0–4.");
            }
            var logoBackground = logo.Background ?? background;
            if (logoBackground != "transparent") Color.ParseHex(logoBackground);
            return new LogoParts(href, size, padding, logoBackground);
        }

        /// <summary>Check the logo options and the logo/ECC rule; return the logo parts and the options for ToMatrix.</summary>
        private static LogoParts? CheckedParts(LayoutOptions options, string background, out MatrixOptions matrixOptions)
        {
            matrixOptions = new MatrixOptions
            {
                Ecc = options.Ecc,
                BoostEcc = options.BoostEcc,
                MinVersion = options.MinVersion,
                MaxVersion = options.MaxVersion,
                Mask = options.Mask,
            };
            // Every logo option is checked before encoding, so a bad option is reported even when the text is also too long.
            if (options.Logo == null) return null;
            var parts = CheckLogoOptions(options.Logo, background);
            if (options.Ecc != null && options.Ecc != Ecc.H)
            {
                // Stryker disable once all : only builds the error message
                var message = string.Format(CultureInfo.InvariantCulture, "A logo needs ECC H; got ecc '{0}'. Leave ecc unset or pass 'H'.", options.Ecc);
                throw Invalid(message);
            }
            matrixOptions = matrixOptions with { Ecc = Ecc.H };
            return parts;
        }

        /// <summary>
        /// Check every option that does not depend on the text, without rendering: the same errors as <see cref="Compute"/>
        /// would throw for them. What depends on the text (too long for maxVersion, a logo too big) is only known when drawing.
        /// </summary>
        public static void CheckOptions(LayoutOptions options)
        {
            CheckMargin(options.Margin);
            var background = options.Background ?? "#ffffff";
            CheckColours(options.Foreground ?? "#000000", background);
            CheckedParts(options, background, out var matrixOptions);
            TingQrRender.ToMatrix(string.Empty, matrixOptions); // checks ecc, versions, mask… on an empty text
        }

        /// <summary>
        /// Validate everything, encode <paramref name="text"/> and place the logo. Margin and colours are checked by the
        /// caller first (the SVG renderer checks its size in between); this repeats nothing and is the one place logo and
        /// ECC rules live.
        /// </summary>
        public static LayoutResult ComputeChecked(string? text, LayoutOptions options, int margin, string foreground, string background)
        {
            var parts = CheckedParts(options, background, out var matrixOptions);
            var matrix = TingQrRender.ToMatrix(text, matrixOptions);
            if (parts == null) return new LayoutResult(matrix, margin, foreground, background, null);

            var box = Logo.Box(matrix.Size, parts.Size, parts.Padding);
            Logo.CheckBox(matrix.Size, box);
            return new LayoutResult(matrix, margin, foreground, background, new LogoLayout(parts.Href, parts.Background, box));
        }

        /// <summary>Validate the options, encode <paramref name="text"/> and place the logo. Throws INVALID_VALUE with the same messages as the TypeScript toSvg.</summary>
        public static LayoutResult Compute(string? text, LayoutOptions? options = null)
        {
            options ??= new LayoutOptions();
            var margin = CheckMargin(options.Margin);
            var foreground = options.Foreground ?? "#000000";
            var background = options.Background ?? "#ffffff";
            CheckColours(foreground, background);
            return ComputeChecked(text, options, margin, foreground, background);
        }
    }
}
