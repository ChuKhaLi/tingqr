using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace TingQR.Emv
{
    /// <summary>EMV TLV encoding and parsing. Lengths count code points.</summary>
    public static class Tlv
    {
        /// <summary>One TLV field: tag + two-digit length + value. Throws FIELD_TOO_LONG above 99 code points.</summary>
        public static string Field(string tag, string value)
        {
            var length = CodePoints.Count(value);
            if (length > 99)
            {
                throw new TingQrException(TingQrErrorCode.FieldTooLong,
                    $"Tag {tag} is {length} characters long; the maximum is 99.", tag);
            }
            return tag + length.ToString("D2", CultureInfo.InvariantCulture) + value;
        }

        /// <summary>Concatenates <see cref="Field"/> for each field.</summary>
        public static string EncodeFields(IEnumerable<TlvField> fields)
        {
            var sb = new StringBuilder();
            foreach (var f in fields) sb.Append(Field(f.Tag, f.Value));
            return sb.ToString();
        }

        private static bool IsAsciiDigit(string cp) => cp.Length == 1 && cp[0] >= '0' && cp[0] <= '9';

        private static bool TwoDigits(IReadOnlyList<string> cps, int at) => IsAsciiDigit(cps[at]) && IsAsciiDigit(cps[at + 1]);

        private static string Join(List<string> cps, int start, int count)
        {
            var sb = new StringBuilder();
            for (var i = start; i < start + count; i++) sb.Append(cps[i]);
            return sb.ToString();
        }

        /// <summary>Splits a TLV string into top-level fields. Does not descend into templates.</summary>
        public static IReadOnlyList<TlvNode> Parse(string input)
        {
            var chars = CodePoints.Split(input);
            var result = new List<TlvNode>();
            var i = 0;
            while (i < chars.Count)
            {
                if (i + 4 > chars.Count)
                {
                    throw new TingQrException(TingQrErrorCode.Truncated, $"Field header at position {i} is cut off.");
                }
                var tag = Join(chars, i, 2);
                if (!TwoDigits(chars, i))
                {
                    throw new TingQrException(TingQrErrorCode.BadTag, $"Tag \"{tag}\" at position {i} is not two digits.");
                }
                var lengthText = Join(chars, i + 2, 2);
                if (!TwoDigits(chars, i + 2))
                {
                    throw new TingQrException(TingQrErrorCode.BadLength,
                        $"Tag {tag} has length \"{lengthText}\", expected two digits.", tag);
                }
                var length = int.Parse(lengthText, NumberStyles.None, CultureInfo.InvariantCulture);
                var start = i + 4;
                if (start + length > chars.Count)
                {
                    throw new TingQrException(TingQrErrorCode.Truncated,
                        $"Tag {tag} declares {length} characters but the payload ends first.", tag);
                }
                result.Add(new TlvNode(tag, Join(chars, start, length)));
                i = start + length;
            }
            return result;
        }

        /// <summary>Throws DUPLICATE_TAG if a tag appears twice at this level; <paramref name="path"/> prefixes the tag.</summary>
        internal static void AssertUniqueTags(IEnumerable<TlvField> nodes, string? path = null)
        {
            var seen = new HashSet<string>();
            foreach (var n in nodes)
            {
                var where = string.IsNullOrEmpty(path) ? n.Tag : path + "." + n.Tag;
                if (!seen.Add(n.Tag))
                {
                    throw new TingQrException(TingQrErrorCode.DuplicateTag, $"Tag {where} appears more than once.", where);
                }
            }
        }

        /// <summary>Parses the value of a template tag (e.g. 38, 62) into sub-fields. Rejects duplicate sub-tags.</summary>
        public static IReadOnlyList<TlvNode> ParseTemplate(string value, string? path = null)
        {
            var nodes = Parse(value);
            AssertUniqueTags(nodes.Cast<TlvField>(), path);
            return nodes;
        }
    }
}
