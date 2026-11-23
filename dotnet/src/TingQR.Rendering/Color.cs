using System;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace TingQR.Rendering
{
    /// <summary>An sRGB colour, channels 0–255.</summary>
    internal readonly struct Rgb
    {
        public Rgb(int r, int g, int b)
        {
            R = r;
            G = g;
            B = b;
        }

        public int R { get; }

        public int G { get; }

        public int B { get; }
    }

    internal static class Color
    {
        // \z, not $: .NET's $ also matches before a final newline, JavaScript's does not.
        private static readonly Regex Hex = new Regex(@"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\z", RegexOptions.CultureInvariant);

        /// <summary>'#rgb' or '#rrggbb' (either case) as 0–255 channels. Anything else is INVALID_VALUE.</summary>
        public static Rgb ParseHex(string? value)
        {
            var m = value == null ? null : Hex.Match(value);
            if (m == null || !m.Success)
            {
                // Stryker disable once all : only builds the error message
                var shown = value == null ? "null" : Quote(value);
                // Stryker disable once String : error message
                throw new TingQrException(TingQrErrorCode.InvalidValue, "Colour " + shown + " must be #rgb or #rrggbb.");
            }
            var digits = m.Groups[1].Value;
            if (digits.Length == 3)
            {
                digits = new string(new[] { digits[0], digits[0], digits[1], digits[1], digits[2], digits[2] });
            }
            return new Rgb(Channel(digits, 0), Channel(digits, 2), Channel(digits, 4));
        }

        private static int Channel(string hex, int start) =>
            int.Parse(hex.Substring(start, 2), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);

        /// <summary>WCAG 2.x relative luminance.</summary>
        public static double Luminance(Rgb c) => 0.2126 * Lin(c.R) + 0.7152 * Lin(c.G) + 0.0722 * Lin(c.B);

        private static double Lin(int channel)
        {
            double s = channel / 255.0;
            return s <= 0.03928 ? s / 12.92 : Math.Pow((s + 0.055) / 1.055, 2.4);
        }

        /// <summary>WCAG 2.x contrast ratio, 1–21, independent of argument order.</summary>
        public static double ContrastRatio(Rgb a, Rgb b)
        {
            var la = Luminance(a);
            var lb = Luminance(b);
            return (Math.Max(la, lb) + 0.05) / (Math.Min(la, lb) + 0.05);
        }

        /// <summary>The text as a JSON string literal, like JavaScript's JSON.stringify (used in error messages).</summary>
        internal static string Quote(string text)
        {
            var sb = new StringBuilder("\"");
            for (var i = 0; i < text.Length; i++)
            {
                var c = text[i];
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        var lone = char.IsHighSurrogate(c)
                            ? !(i + 1 < text.Length && char.IsLowSurrogate(text[i + 1]))
                            : char.IsLowSurrogate(c) && !(i > 0 && char.IsHighSurrogate(text[i - 1]));
                        if (c < 0x20 || lone)
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            return sb.Append('"').ToString();
        }
    }
}
