using System.Collections.Generic;
using System.Linq;

namespace TingQR.Emv
{
    /// <summary>A parsed EMV merchant-presented payload with a verified CRC.</summary>
    public sealed class EmvPayload
    {
        /// <summary>Creates a payload.</summary>
        public EmvPayload(IReadOnlyList<TlvNode> fields, string crc, string raw)
        {
            Fields = fields;
            Crc = crc;
            Raw = raw;
        }

        /// <summary>Top-level fields, including tag 63.</summary>
        public IReadOnlyList<TlvNode> Fields { get; }

        /// <summary>The CRC, uppercase.</summary>
        public string Crc { get; }

        /// <summary>The payload after surrounding whitespace was removed.</summary>
        public string Raw { get; }
    }

    /// <summary>Building and parsing EMV payloads.</summary>
    public static class EmvPayloads
    {
        /// <summary>Encodes <paramref name="fields"/> (without tag 63), then appends <c>6304</c> and the CRC.</summary>
        public static string Build(IEnumerable<TlvField> fields)
        {
            var body = Tlv.EncodeFields(fields) + "6304";
            return body + Crc16.Compute(body);
        }

        /// <summary>The first top-level field with <paramref name="tag"/>, or null.</summary>
        public static TlvNode? GetField(EmvPayload p, string tag) => p.Fields.FirstOrDefault(f => f.Tag == tag);

        // ASCII whitespace plus a UTF-8 BOM and no-break space, like the TS reader.
        private static bool IsEdge(char c) => c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '﻿' || c == ' ';

        private static bool IsHex4(string v)
        {
            if (v.Length != 4) return false;
            foreach (var c in v)
            {
                if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
            }
            return true;
        }

        /// <summary>
        /// Parses an EMV merchant-presented payload and verifies its CRC. Scheme-agnostic. Never throws, including
        /// for null.
        /// </summary>
        public static TingQrResult<EmvPayload> Parse(string? input)
        {
            if (input == null)
            {
                return TingQrResult<EmvPayload>.Failure(
                    new TingQrException(TingQrErrorCode.InvalidValue,
                        // Stryker disable once String : error message, or a field name that only appears in one
                        "The payload must not be null."));
            }
            var warnings = new List<TingQrWarning>();
            var a = 0;
            var b = input.Length;
            while (a < b && IsEdge(input[a])) a++;
            while (b > a && IsEdge(input[b - 1])) b--;
            var raw = input.Substring(a, b - a);
            if (raw != input)
            {
                warnings.Add(new TingQrWarning(TingQrWarningCode.TrimmedWhitespace,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "Whitespace around the payload was removed."));
            }

            IReadOnlyList<TlvNode> fields;
            try
            {
                fields = Tlv.Parse(raw);
            }
            catch (TingQrException e)
            {
                return TingQrResult<EmvPayload>.Failure(e);
            }

            var last = fields.Count > 0 ? fields[fields.Count - 1] : null;
            if (last == null || last.Tag != "63" || !IsHex4(last.Value))
            {
                return TingQrResult<EmvPayload>.Failure(new TingQrException(TingQrErrorCode.CrcMissing,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "The payload must end with tag 63 holding a 4-digit CRC.", "63"));
            }

            var expected = Crc16.Compute(raw.Substring(0, raw.Length - 4));
            var actual = last.Value.ToUpperInvariant();
            if (actual != expected)
            {
                return TingQrResult<EmvPayload>.Failure(new TingQrException(TingQrErrorCode.CrcMismatch,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    $"CRC is {last.Value}, expected {expected}.", "63"));
            }
            try
            {
                Tlv.AssertUniqueTags(fields.Cast<TlvField>());
            }
            catch (TingQrException e)
            {
                return TingQrResult<EmvPayload>.Failure(e);
            }
            if (last.Value != actual)
            {
                warnings.Add(new TingQrWarning(TingQrWarningCode.LowercaseCrc,
                    // Stryker disable once String : error message, or a field name that only appears in one
                    "The CRC is written in lowercase hex.", "63"));
            }
            return TingQrResult<EmvPayload>.Success(new EmvPayload(fields, actual, raw), warnings);
        }
    }
}
