using System;

namespace TingQR.Rendering
{
    /// <summary>
    /// Options for <see cref="TingQrRender.ToSvg"/>. A null property means the default. Inherits the encoding options of
    /// <see cref="MatrixOptions"/> (like the TypeScript <c>SvgOptions extends LayoutOptions extends MatrixOptions</c>), so
    /// the same object can also be passed to <see cref="TingQrRender.ToMatrix"/>.
    /// </summary>
    public sealed record SvgOptions : MatrixOptions
    {
        /// <summary>Quiet zone in modules, 0–16; default 4 (the QR standard).</summary>
        public int? Margin { get; init; }

        /// <summary>Dark module colour, '#rgb' or '#rrggbb'; default '#000000'.</summary>
        public string? Foreground { get; init; }

        /// <summary>
        /// Background colour, '#rgb', '#rrggbb' or 'transparent'; default '#ffffff'. With 'transparent' no contrast is
        /// checked: you are responsible for printing the code on a background light enough for the foreground.
        /// </summary>
        public string? Background { get; init; }

        /// <summary>
        /// Width and height of the &lt;svg&gt;: a positive number (px) or a length like "40mm", "2in", "100%". Null: no
        /// width/height attributes, the SVG scales to its box.
        /// </summary>
        public SvgSize? Size { get; init; }

        /// <summary>
        /// Centre logo (provisional, see <see cref="LogoOptions"/>). Forces ECC H (an explicit ecc other than H is rejected)
        /// and clears the modules under it.
        /// </summary>
        public LogoOptions? Logo { get; init; }
    }

    /// <summary>
    /// The size of an SVG: a number of pixels or a CSS length string, like TypeScript's <c>size?: number | string</c>.
    /// Converts implicitly from <see cref="double"/> (and so from <see cref="int"/>) and from <see cref="string"/>; it is
    /// checked only when the SVG is rendered or the options are checked.
    /// </summary>
    public readonly struct SvgSize : IEquatable<SvgSize>
    {
        private readonly double _pixels;
        private readonly string? _length;

        /// <summary>A size in pixels; must be finite and positive.</summary>
        /// <param name="pixels">The width and height in px.</param>
        public SvgSize(double pixels)
        {
            _pixels = pixels;
            _length = null;
            IsLength = false;
        }

        /// <summary>A length: digits, optional decimals, optional unit px, mm, cm, in, pt or %; must be positive.</summary>
        /// <param name="length">The width and height, e.g. "40mm".</param>
        public SvgSize(string? length)
        {
            _pixels = 0;
            _length = length;
            IsLength = true;
        }

        /// <summary>True when created from a string.</summary>
        public bool IsLength { get; }

        /// <summary>The number of pixels (0 when <see cref="IsLength"/>).</summary>
        public double Pixels => _pixels;

        /// <summary>The length string (null when not <see cref="IsLength"/>).</summary>
        public string? Length => _length;

        /// <summary>A size in pixels.</summary>
        /// <param name="pixels">The width and height in px.</param>
        public static implicit operator SvgSize(double pixels) => new SvgSize(pixels);

        /// <summary>A length such as "40mm".</summary>
        /// <param name="length">The width and height.</param>
        public static implicit operator SvgSize(string? length) => new SvgSize(length);

        /// <summary>The value as written in the width/height attributes (JavaScript's <c>String(size)</c>).</summary>
        public override string ToString() => IsLength ? _length ?? string.Empty : JsNumber.ToString(_pixels);

        /// <summary>
        /// Same form and same value: pixels compare with <c>==</c> of <see cref="double"/> (so 0 equals -0 and NaN equals
        /// nothing), lengths compare ordinally.
        /// </summary>
        /// <remarks>
        /// A NaN pixel size is not equal to itself: <c>Equals</c> and <c>==</c> return false for two NaN sizes, even a size
        /// compared with itself. The compiler-generated equality of <see cref="SvgOptions"/> uses this method, so two
        /// <see cref="SvgOptions"/> with <c>Size = double.NaN</c> are not equal either (before value equality, NaN sizes
        /// were equal). NaN is rejected when rendering, so this only affects hash sets and dictionaries.
        /// </remarks>
        public bool Equals(SvgSize other)
            => IsLength == other.IsLength && _pixels == other._pixels && string.Equals(_length, other._length, StringComparison.Ordinal);

        /// <inheritdoc />
        public override bool Equals(object? obj) => obj is SvgSize other && Equals(other);

        /// <inheritdoc />
        public override int GetHashCode()
            => IsLength ? (_length == null ? 1 : StringComparer.Ordinal.GetHashCode(_length)) : _pixels.GetHashCode();

        /// <summary>Equality.</summary>
        public static bool operator ==(SvgSize left, SvgSize right) => left.Equals(right);

        /// <summary>Inequality.</summary>
        public static bool operator !=(SvgSize left, SvgSize right) => !left.Equals(right);
    }
}
