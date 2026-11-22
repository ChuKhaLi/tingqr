using System;
using System.Globalization;

namespace TingQR
{
    /// <summary>
    /// An amount as the caller gave it: a <see cref="long"/>, a <see cref="decimal"/> or a <see cref="string"/>.
    /// The form is kept so each scheme applies the same rejection rules as the TypeScript implementation, which takes
    /// <c>number | string</c>. A null or empty string, and <c>default(QrAmount)</c>, mean "no amount".
    /// </summary>
    public readonly struct QrAmount : IEquatable<QrAmount>
    {
        private enum Form : byte
        {
            None,
            Number,
            Text,
        }

        private readonly Form _form;
        private readonly string? _text;

        private QrAmount(Form form, string? text)
        {
            _form = form;
            _text = text;
        }

        /// <summary>A whole-number amount.</summary>
        public QrAmount(long value) : this(Form.Number, value.ToString(CultureInfo.InvariantCulture))
        {
        }

        /// <summary>A decimal amount; trailing zeros after the point do not count (<c>1.50m</c> is <c>1.5</c>).</summary>
        public QrAmount(decimal value) : this(Form.Number, NumberText(value))
        {
        }

        /// <summary>An amount written as text, used verbatim; null or empty means no amount.</summary>
        public QrAmount(string? value) : this(string.IsNullOrEmpty(value) ? Form.None : Form.Text, string.IsNullOrEmpty(value) ? null : value)
        {
        }

        /// <summary>Converts a whole number.</summary>
        public static implicit operator QrAmount(long value) => new QrAmount(value);

        /// <summary>Converts a decimal.</summary>
        public static implicit operator QrAmount(decimal value) => new QrAmount(value);

        /// <summary>Converts text; null or empty means no amount.</summary>
        public static implicit operator QrAmount(string? value) => new QrAmount(value);

        /// <summary>False for <c>default</c>, a null string or an empty string.</summary>
        public bool HasValue => _form != Form.None;

        /// <summary>True when created from a number rather than text.</summary>
        public bool IsNumber => _form == Form.Number;

        /// <summary>
        /// What JavaScript's <c>String(amount)</c> gives for the equivalent TS input (plain digits, <c>.</c> as the
        /// decimal point, no trailing zeros for numbers); null when there is no amount. Culture-independent.
        /// </summary>
        internal string? Text => _text;

        // String(n) of a JS number for the values a decimal can hold, without exponent notation (JS uses it only
        // below 1e-6 or from 1e21, which every scheme rejects anyway).
        private static string NumberText(decimal value)
            => value.ToString("0.############################", CultureInfo.InvariantCulture);

        /// <summary>The amount text (see <see cref="QrAmount(decimal)"/>), or an empty string when there is none.</summary>
        public override string ToString() => _text ?? string.Empty;

        /// <summary>Same form and same text.</summary>
        public bool Equals(QrAmount other) => _form == other._form && string.Equals(_text, other._text, StringComparison.Ordinal);

        /// <inheritdoc />
        public override bool Equals(object? obj) => obj is QrAmount other && Equals(other);

        /// <inheritdoc />
        // Stryker disable once Bitwise : any hash combining is valid; only equal values must hash equal (tested)
        public override int GetHashCode() => ((int)_form * 397) ^ (_text == null ? 0 : StringComparer.Ordinal.GetHashCode(_text));

        /// <summary>Equality.</summary>
        public static bool operator ==(QrAmount left, QrAmount right) => left.Equals(right);

        /// <summary>Inequality.</summary>
        public static bool operator !=(QrAmount left, QrAmount right) => !left.Equals(right);
    }
}
