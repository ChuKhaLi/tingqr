using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace TingQR.Rendering
{
    public static partial class TingQrRender
    {
        /// <summary>
        /// Check SVG options without rendering, e.g. when a route is configured: the same INVALID_VALUE errors and messages
        /// as <see cref="ToSvg"/> for every option that does not depend on the text. Options that do (maxVersion too low
        /// for the text, a logo too big for a small code) are still only known when <see cref="ToSvg"/> runs.
        /// </summary>
        /// <param name="options">The options to check; null means every default (valid).</param>
        public static void CheckSvgOptions(SvgOptions? options)
        {
            options ??= new SvgOptions();
            Layout.CheckOptions(Svg.LayoutOptionsOf(options));
            Svg.SizeAttr(options.Size);
        }

        /// <summary>
        /// Render <paramref name="text"/> as a QR code SVG string, byte for byte equal to <c>toSvg</c> of
        /// <c>@tingqr/render</c> for the same input. Throws <see cref="TingQrException"/> INVALID_VALUE for a null text,
        /// bad options or text that does not fit.
        /// </summary>
        /// <param name="text">The text to encode.</param>
        /// <param name="options">Rendering options; null means every default.</param>
        public static string ToSvg(string? text, SvgOptions? options = null)
        {
            options ??= new SvgOptions();
            var margin = Layout.CheckMargin(options.Margin);
            var foreground = options.Foreground ?? "#000000";
            var background = options.Background ?? "#ffffff";
            Layout.CheckColours(foreground, background);
            var dimensions = Svg.SizeAttr(options.Size);
            var l = Layout.ComputeChecked(text, Svg.LayoutOptionsOf(options), margin, foreground, background);
            var w = Svg.Num(l.Size + 2 * margin);

            var svg = new StringBuilder();
            svg.Append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ").Append(w).Append(' ').Append(w).Append('"')
                .Append(dimensions).Append(" shape-rendering=\"crispEdges\">");
            if (background != "transparent")
            {
                svg.Append("<rect width=\"").Append(w).Append("\" height=\"").Append(w).Append("\" fill=\"")
                    .Append(Svg.EscapeAttr(background)).Append("\"/>");
            }
            svg.Append("<path fill=\"").Append(Svg.EscapeAttr(foreground)).Append("\" d=\"");
            Svg.AppendModulePath(svg, l, margin);
            svg.Append("\"/>");
            if (l.Logo == null) return svg.Append("</svg>").ToString();

            var box = l.Logo.Box;
            var c = Svg.Num(box.ClearStart + margin);
            if (l.Logo.Background != "transparent")
            {
                var clearSide = Svg.Num(box.ClearSide);
                svg.Append("<rect x=\"").Append(c).Append("\" y=\"").Append(c).Append("\" width=\"").Append(clearSide)
                    .Append("\" height=\"").Append(clearSide).Append("\" fill=\"").Append(Svg.EscapeAttr(l.Logo.Background)).Append("\"/>");
            }
            var p = Svg.Num(box.LogoStart + margin);
            var logoSide = Svg.Num(box.LogoSide);
            svg.Append("<image href=\"").Append(Svg.EscapeAttr(l.Logo.Href)).Append("\" x=\"").Append(p).Append("\" y=\"").Append(p)
                .Append("\" width=\"").Append(logoSide).Append("\" height=\"").Append(logoSide)
                .Append("\" preserveAspectRatio=\"xMidYMid meet\"/>");
            return svg.Append("</svg>").ToString();
        }
    }

    internal static class Svg
    {
        // [0-9], not \d: .NET's \d matches every Unicode digit, JavaScript's only ASCII. \z, not $: .NET's $ also
        // matches before a final newline, JavaScript's does not.
        private static readonly Regex Length = new Regex(@"^[0-9]+(\.[0-9]+)?(px|mm|cm|in|pt|%)?\z", RegexOptions.CultureInvariant);

        private static readonly Regex Number = new Regex(@"^[0-9]+(\.[0-9]+)?", RegexOptions.CultureInvariant);

        public static string Num(int value) => value.ToString(CultureInfo.InvariantCulture);

        /// <summary>The SVG options without size, as the layout options every renderer shares.</summary>
        public static LayoutOptions LayoutOptionsOf(SvgOptions options) => new LayoutOptions
        {
            Ecc = options.Ecc,
            BoostEcc = options.BoostEcc,
            MinVersion = options.MinVersion,
            MaxVersion = options.MaxVersion,
            Mask = options.Mask,
            Margin = options.Margin,
            Foreground = options.Foreground,
            Background = options.Background,
            Logo = options.Logo,
        };

        /// <summary>Escape a value for an XML attribute in double quotes.</summary>
        public static string EscapeAttr(string value) =>
            value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

        /// <summary>The width and height attributes (with a leading space), or "" without a size; INVALID_VALUE when bad.</summary>
        public static string SizeAttr(SvgSize? size)
        {
            if (size == null) return string.Empty;
            var s = size.Value;
            var ok = s.IsLength ? IsPositiveLength(s.Length) : IsFinite(s.Pixels) && s.Pixels > 0;
            if (!ok)
            {
                // Stryker disable once all : only builds the error message
                var shown = s.IsLength ? (s.Length == null ? "null" : Color.Quote(s.Length)) : (IsFinite(s.Pixels) ? JsNumber.ToString(s.Pixels) : "null");
                // Stryker disable once String : error message
                throw new TingQrException(TingQrErrorCode.InvalidValue, "Option size " + shown + " must be a positive number or a length like '40mm'.");
            }
            var v = EscapeAttr(s.ToString());
            return " width=\"" + v + "\" height=\"" + v + "\"";
        }

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);

        /// <summary>JavaScript's <c>LENGTH.test(size) &amp;&amp; parseFloat(size) &gt; 0</c>.</summary>
        private static bool IsPositiveLength(string? length)
        {
            if (length == null || !Length.IsMatch(length)) return false;
            // parseFloat reads the number before the unit. It is > 0 unless it rounds to 0: either every digit is 0, or
            // the value underflows. A value too large is Infinity in JavaScript (> 0); net481's parser fails on it instead,
            // so a failed parse of these plain digits means overflow, which is positive.
            var number = Number.Match(length).Value;
            return !double.TryParse(number, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var parsed) || parsed > 0;
        }

        /// <summary>Path data for dark modules, one segment per horizontal run, skipping the logo's cleared box.</summary>
        public static void AppendModulePath(StringBuilder d, LayoutResult l, int margin)
        {
            // Rows are indexed directly (not IsDark, which is false outside the matrix), so reading past the edge throws.
            var size = l.Size;
            for (var y = 0; y < size; y++)
            {
                var row = l.Matrix.Modules[y];
                var x = 0;
                while (x < size)
                {
                    if (!row[x] || l.Cleared(x, y))
                    {
                        x++;
                        continue;
                    }
                    var start = x;
                    while (x < size && row[x] && !l.Cleared(x, y)) x++;
                    var len = Num(x - start);
                    d.Append('M').Append(Num(start + margin)).Append(' ').Append(Num(y + margin))
                        .Append('h').Append(len).Append("v1h-").Append(len).Append('z');
                }
            }
        }
    }
}
