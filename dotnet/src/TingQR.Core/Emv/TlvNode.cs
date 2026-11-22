using System.Collections.Generic;

namespace TingQR.Emv
{
    /// <summary>A tag/value pair of an EMV TLV payload.</summary>
    /// <param name="Tag">Two-digit tag.</param>
    /// <param name="Value">Field value.</param>
    public record TlvField(string Tag, string Value);

    /// <summary>A TLV field with optional parsed sub-fields.</summary>
    /// <param name="Tag">Two-digit tag.</param>
    /// <param name="Value">Field value.</param>
    /// <param name="Children">Parsed sub-fields, when the field is a template.</param>
    public sealed record TlvNode(string Tag, string Value, IReadOnlyList<TlvNode>? Children = null) : TlvField(Tag, Value);
}
