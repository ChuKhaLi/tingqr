using System;
using System.Collections.Generic;
using System.Linq;

namespace TingQR.Emv
{
    /// <summary>Helpers shared by scheme readers.</summary>
    internal static class Fields
    {
        /// <summary>Every sub-tag of tag 62, keyed by sub-tag; null when tag 62 is absent. Rejects duplicates.</summary>
        public static IReadOnlyDictionary<string, string>? ReadAdditionalData(EmvPayload p)
        {
            var value = p.GetField("62")?.Value;
            if (value == null) return null;
            return ReadOnly.Dictionary(Tlv.ParseTemplate(value, "62").ToDictionary(n => n.Tag, n => n.Value));
        }

        /// <summary>Top-level tags not in <paramref name="interpreted"/>, verbatim; null when there are none.</summary>
        public static IReadOnlyDictionary<string, string>? ReadExtraFields(EmvPayload p, ISet<string> interpreted)
        {
            var extra = p.Fields.Where(f => !interpreted.Contains(f.Tag)).ToList();
            return extra.Count > 0 ? ReadOnly.Dictionary(extra.ToDictionary(f => f.Tag, f => f.Value)) : null;
        }

        /// <summary>
        /// The sub-fields of a scheme's merchant-account template, or null when the tag is absent, is not clean TLV,
        /// or its sub-tag 00 is not <paramref name="guid"/> (case-insensitive). Duplicate sub-tags are reported
        /// (DUPLICATE_TAG) only once the GUID matches.
        /// </summary>
        public static IReadOnlyList<TlvNode>? ReadSchemeTemplate(EmvPayload p, string tag, string guid)
        {
            var value = p.GetField(tag)?.Value;
            if (value == null) return null;
            IReadOnlyList<TlvNode> nodes;
            try
            {
                nodes = Tlv.Parse(value);
            }
            catch (TingQrException)
            {
                return null;
            }
            var g = nodes.FirstOrDefault(n => n.Tag == "00")?.Value;
            if (g == null || !string.Equals(g.ToUpperInvariant(), guid, StringComparison.Ordinal)) return null;
            Tlv.AssertUniqueTags(nodes.Cast<TlvField>(), tag);
            return nodes;
        }
    }
}
