using System.Collections.Generic;
using System.Linq;

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
    public sealed record TlvNode(string Tag, string Value, IReadOnlyList<TlvNode>? Children = null) : TlvField(Tag, Value)
    {
        /// <summary>Value equality; <see cref="Children"/> are compared element by element, not by reference.</summary>
        public bool Equals(TlvNode? other)
        {
            if (ReferenceEquals(this, other)) return true;
            if (other is null || Tag != other.Tag || Value != other.Value) return false;
            if (Children is null || other.Children is null) return Children is null && other.Children is null;
            return Children.SequenceEqual(other.Children);
        }

        /// <inheritdoc />
        public override int GetHashCode()
        {
            var h = (Tag, Value).GetHashCode();
            if (Children != null)
            {
                foreach (var c in Children) h = (h * 31) + c.GetHashCode();
            }
            return h;
        }
    }
}
