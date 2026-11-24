using System;

namespace TingQR
{
    /// <summary>Extension methods that map codes to the names used in <c>conformance/errors.json</c>.</summary>
    public static class TingQrCodeExtensions
    {
        /// <summary>Wire name of an error code, e.g. <c>CRC_MISSING</c>.</summary>
        public static string ToWireName(this TingQrErrorCode c)
        {
            switch (c)
            {
                case TingQrErrorCode.CrcMissing: return "CRC_MISSING";
                case TingQrErrorCode.CrcMismatch: return "CRC_MISMATCH";
                case TingQrErrorCode.BadTag: return "BAD_TAG";
                case TingQrErrorCode.BadLength: return "BAD_LENGTH";
                case TingQrErrorCode.Truncated: return "TRUNCATED";
                case TingQrErrorCode.FieldTooLong: return "FIELD_TOO_LONG";
                case TingQrErrorCode.NonAscii: return "NON_ASCII";
                case TingQrErrorCode.DuplicateTag: return "DUPLICATE_TAG";
                case TingQrErrorCode.MissingTag: return "MISSING_TAG";
                case TingQrErrorCode.InvalidValue: return "INVALID_VALUE";
                case TingQrErrorCode.UnsupportedScheme: return "UNSUPPORTED_SCHEME";
                case TingQrErrorCode.UnknownScheme: return "UNKNOWN_SCHEME";
                case TingQrErrorCode.LogoLoadFailed: return "LOGO_LOAD_FAILED";
                case TingQrErrorCode.CanvasTainted: return "CANVAS_TAINTED";
                case TingQrErrorCode.NoCanvas: return "NO_CANVAS";
                default: throw new ArgumentOutOfRangeException(nameof(c));
            }
        }

        /// <summary>Wire name of a warning code, e.g. <c>LOWERCASE_CRC</c>.</summary>
        public static string ToWireName(this TingQrWarningCode c)
        {
            switch (c)
            {
                case TingQrWarningCode.TrimmedWhitespace: return "TRIMMED_WHITESPACE";
                case TingQrWarningCode.MissingOptionalTag: return "MISSING_OPTIONAL_TAG";
                case TingQrWarningCode.LowercaseCrc: return "LOWERCASE_CRC";
                default: throw new ArgumentOutOfRangeException(nameof(c));
            }
        }
    }
}
