using System;
using System.Globalization;
using System.Text.RegularExpressions;

namespace TingQR.Rendering
{
    /// <summary>Square areas in module coordinates (quiet zone not added).</summary>
    internal sealed record LogoBox(int LogoStart, int LogoSide, int ClearStart, int ClearSide);

    internal static class Logo
    {
        /// <summary>Largest share of the code's modules that may be cleared (provisional until real-app scans, design 5.4).</summary>
        public const double MaxClearedShare = 0.1;

        /// <summary>
        /// First row/column the cleared box may start at. Rows and columns 0–8 hold the top-left finder, its separator, the
        /// format information (row/column 8) and the timing pattern (row/column 6); the box is centred, so the same bound
        /// keeps it off the other two finders. The version information (versions ≥ 7) sits in rows 0–5 beside the top-right
        /// finder and columns 0–5 beside the bottom-left one, so a box starting at row/column 9 or later never touches it.
        /// </summary>
        public const int MinClearStart = 9;

        private static TingQrException Invalid(string message) => new TingQrException(TingQrErrorCode.InvalidValue, message);

        /// <summary>Centre box for a logo of <paramref name="size"/> (fraction of the matrix) plus <paramref name="padding"/> modules each side.</summary>
        public static LogoBox Box(int matrixSize, double size, int padding)
        {
            var logoSide = (int)Math.Ceiling(size * matrixSize);
            if (logoSide % 2 != matrixSize % 2) logoSide += 1;
            var logoStart = (matrixSize - logoSide) / 2;
            return new LogoBox(logoStart, logoSide, logoStart - padding, logoSide + 2 * padding);
        }

        /// <summary>Throw INVALID_VALUE when the cleared box is too large or reaches the finder, format or timing modules.</summary>
        public static void CheckBox(int matrixSize, LogoBox box)
        {
            var share = (double)box.ClearSide * box.ClearSide / ((double)matrixSize * matrixSize);
            // Stryker disable once String : error message
            const string hint = "use a smaller logo size or padding, or a larger minVersion.";
            if (share > MaxClearedShare)
            {
                // Stryker disable once all : only builds the error message
                var message = string.Format(CultureInfo.InvariantCulture, "Logo area is {0}% of the code (max {1}%); {2}", (share * 100).ToString("F1", CultureInfo.InvariantCulture), (MaxClearedShare * 100).ToString(CultureInfo.InvariantCulture), hint);
                throw Invalid(message);
            }
            if (box.ClearStart < MinClearStart)
            {
                // Stryker disable once all : only builds the error message
                var message = string.Format(CultureInfo.InvariantCulture, "Logo area reaches the finder, format or timing modules of this {0}×{0} code; {1}", matrixSize, hint);
                throw Invalid(message);
            }
        }

        private static readonly Regex DataImage = new Regex(@"^data:image/(png|jpeg|webp|svg\+xml)(;base64)?,", RegexOptions.CultureInvariant);

        private static readonly Regex Http = new Regex(@"^https?://", RegexOptions.CultureInvariant);

        // Relative path: no scheme (no ':' before the first '/', '?' or '#') and not protocol-relative ('//host').
        // \z, not $: .NET's $ also matches before a final newline, JavaScript's does not.
        private static readonly Regex Relative = new Regex(@"^(?!//)[^:/?#]*(?:[/?#]|\z)", RegexOptions.CultureInvariant);

        /// <summary>JavaScript's /\s/ for one character (differs from .NET: includes U+FEFF, excludes U+0085).</summary>
        private static bool IsJsWhitespace(char c) =>
            c == 32 || (c >= 9 && c <= 13) || c == 0xA0 || c == 0x1680 || (c >= 0x2000 && c <= 0x200A)
            || c == 0x2028 || c == 0x2029 || c == 0x202F || c == 0x205F || c == 0x3000 || c == 0xFEFF;

        /// <summary>Return <paramref name="href"/> when it is a safe image reference, else throw INVALID_VALUE.</summary>
        public static string CheckHref(string? href)
        {
            var ok = !string.IsNullOrEmpty(href)
                && (DataImage.IsMatch(href!)
                    // Browsers read '\' as '/' in http(s) and relative URLs, so '/\host/x' would load from another host.
                    || (href!.IndexOf('\\') == -1 && (Http.IsMatch(href) || (Relative.IsMatch(href) && !IsJsWhitespace(href[0])))));
            if (!ok)
            {
                // Stryker disable once String : error message
                throw Invalid("Logo href must be a data:image/(png|jpeg|webp|svg+xml) URI, an http(s) URL or a relative path.");
            }
            return href!;
        }
    }
}
