using System.Globalization;

namespace TingQR.Rendering
{
    /// <summary>Draws payment QR codes: module matrices and SVG strings.</summary>
    public static partial class TingQrRender
    {
        private static TingQrException Invalid(string message) => new TingQrException(TingQrErrorCode.InvalidValue, message);

        /// <summary>
        /// The most characters any QR code holds: 7089 digits (numeric mode, version 40, ECC L: 4 + 14 + 2363 × 10 =
        /// 23 648 bits, the 2956 data codewords of 40-L). Each UTF-16 unit of a text costs at least one of these
        /// characters: numeric and alphanumeric texts are ASCII (one unit, one character), and in byte mode each unit is
        /// at least one UTF-8 byte (a surrogate pair, two units, is four bytes) while 40-L holds 2953 bytes. So a longer
        /// text fits no version, ECC or mode: it is rejected before the encoder builds buffers as long as the text.
        /// Shorter texts go to the encoder, which decides.
        /// </summary>
        private const int MaxUnits = 7089;

        private static TingQrException TooLong(int maxVersion, Ecc ecc) =>
            // Stryker disable once String : error message
            Invalid(string.Format(CultureInfo.InvariantCulture, "Text is too long for a QR code of version ≤ {0} at ECC {1}.", maxVersion, ecc));

        private static int IntOption(int? value, string name, int min, int max, int fallback)
        {
            if (value == null) return fallback;
            if (value < min || value > max)
            {
                // Stryker disable once String : error message
                throw Invalid(string.Format(CultureInfo.InvariantCulture, "Option {0} must be an integer {1}–{2}.", name, min, max));
            }
            return value.Value;
        }

        /// <summary>A high surrogate not followed by a low one, or a low surrogate not preceded by a high one.</summary>
        private static bool HasLoneSurrogate(string text)
        {
            for (var i = 0; i < text.Length; i++)
            {
                var c = text[i];
                if (char.IsHighSurrogate(c))
                {
                    if (i + 1 == text.Length || !char.IsLowSurrogate(text[i + 1])) return true;
                    i++;
                }
                else if (char.IsLowSurrogate(c))
                {
                    return true;
                }
            }
            return false;
        }

        private static QrCode.Ecc NayukiEcc(Ecc ecc)
        {
            switch (ecc)
            {
                case Ecc.L: return QrCode.Ecc.LOW;
                case Ecc.M: return QrCode.Ecc.MEDIUM;
                case Ecc.Q: return QrCode.Ecc.QUARTILE;
                case Ecc.H: return QrCode.Ecc.HIGH;
                default:
                    // Stryker disable once String : error message
                    throw Invalid("Option ecc must be 'L', 'M', 'Q' or 'H'.");
            }
        }

        /// <summary>
        /// Encode <paramref name="text"/> (any Unicode string; non-alphanumeric text is encoded as UTF-8 bytes) into a QR
        /// module matrix, with the encoder ported from Project Nayuki. Throws <see cref="TingQrException"/>
        /// INVALID_VALUE for a null text, bad options or text that does not fit.
        /// </summary>
        /// <param name="text">The text to encode.</param>
        /// <param name="options">Encoding options; null means every default.</param>
        public static QrMatrix ToMatrix(string? text, MatrixOptions? options = null)
        {
            // Stryker disable once String : error message
            if (text == null) throw Invalid("Text must be a string.");
            // The byte mode encodes UTF-8 strictly, which throws on a lone surrogate (e.g. an emoji cut by Substring).
            if (HasLoneSurrogate(text))
            {
                // Stryker disable once String : error message
                throw Invalid("Text contains an unpaired surrogate (a character cut in half); it cannot be encoded as UTF-8.");
            }
            options ??= new MatrixOptions();
            var ecc = options.Ecc ?? Ecc.M;
            var nayukiEcc = NayukiEcc(ecc);
            var boostEcc = options.BoostEcc ?? true;
            var minVersion = IntOption(options.MinVersion, "minVersion", 1, 40, 1);
            var maxVersion = IntOption(options.MaxVersion, "maxVersion", 1, 40, 40);
            // Stryker disable once String : error message
            if (minVersion > maxVersion) throw Invalid("Option minVersion must not exceed maxVersion.");
            var mask = IntOption(options.Mask, "mask", 0, 7, -1);
            if (text.Length > MaxUnits) throw TooLong(maxVersion, ecc);

            QrCode qr;
            try
            {
                qr = QrCode.EncodeSegments(QrSegment.MakeSegments(text), nayukiEcc, minVersion, maxVersion, mask, boostEcc);
            }
            catch (RangeError)
            {
                throw TooLong(maxVersion, ecc);
            }
            var rows = new bool[qr.Size][];
            for (var y = 0; y < qr.Size; y++)
            {
                var row = new bool[qr.Size];
                for (var x = 0; x < qr.Size; x++) row[x] = qr.GetModule(x, y);
                rows[y] = row;
            }
            return new QrMatrix(qr.Version, (Ecc)qr.ErrorCorrectionLevel.Ordinal, qr.Mask, rows);
        }
    }
}
