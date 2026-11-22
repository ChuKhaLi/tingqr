using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace TingQR.Tests.Conformance
{
    /// <summary>A vector's <c>input</c> could not be converted to the C# input type (see <see cref="TypeCheckVectors"/>).</summary>
    internal sealed class InputConversionException : Exception
    {
        public InputConversionException(string message) : base(message)
        {
        }
    }

    /// <summary>
    /// Strict reader that turns a vector's JSON <c>input</c> object into C# values. Anything the C# type cannot
    /// represent faithfully (a number where a string is declared, JSON null, an unknown key) throws
    /// <see cref="InputConversionException"/> instead of being coerced or dropped.
    /// </summary>
    internal sealed class JsonInput
    {
        private readonly JsonObject _obj;
        private readonly HashSet<string> _read = new HashSet<string>(StringComparer.Ordinal);

        private JsonInput(JsonObject obj) => _obj = obj;

        public static JsonInput Of(JsonNode? node)
            => node is JsonObject o ? new JsonInput(o) : throw new InputConversionException("input must be a JSON object.");

        private JsonNode? Take(string name, out bool present)
        {
            _read.Add(name);
            present = _obj.TryGetPropertyValue(name, out var node);
            if (present && node == null) throw new InputConversionException($"input.{name} is JSON null.");
            return node;
        }

        private static JsonValueKind Kind(JsonNode node) => node.GetValueKind();

        /// <summary>A string field, or null when absent (the C# caller then passes null, as TS would pass undefined).</summary>
        public string? String(string name)
        {
            var node = Take(name, out var present);
            if (!present) return null;
            if (Kind(node!) != JsonValueKind.String) throw new InputConversionException($"input.{name} is not a string.");
            return node!.GetValue<string>();
        }

        /// <summary>Whether the input has the key (without reading it).</summary>
        public bool Has(string name) => _obj.ContainsKey(name);

        /// <summary>An object field wrapped in its own strict reader, or null when absent.</summary>
        public JsonInput? Object(string name)
        {
            var node = Take(name, out var present);
            if (!present) return null;
            return node is JsonObject o ? new JsonInput(o) : throw new InputConversionException($"input.{name} is not an object.");
        }

        /// <summary>
        /// An enum field given as its TS string. A string that names no member maps to an undefined value of
        /// <typeparamref name="T"/> (C#'s only way to pass an invalid enum), so the function under test rejects it.
        /// </summary>
        public T? Enum<T>(string name, IReadOnlyDictionary<string, T> byWireName)
            where T : struct, System.Enum
        {
            var text = String(name);
            if (text == null) return null;
            if (byWireName.TryGetValue(text, out var value)) return value;
            return (T)(object)int.MaxValue;
        }

        /// <summary>
        /// An amount: a JSON string as <see cref="QrAmount"/> from string, an integral number from long, any other
        /// number from decimal. Booleans and other kinds do not convert.
        /// </summary>
        public QrAmount? Amount(string name)
        {
            var node = Take(name, out var present);
            if (!present) return null;
            switch (Kind(node!))
            {
                case JsonValueKind.String:
                    return node!.GetValue<string>();
                case JsonValueKind.Number:
                    var element = node!.GetValue<JsonElement>();
                    if (element.TryGetInt64(out var whole)) return whole;
                    if (element.TryGetDecimal(out var d)) return d;
                    throw new InputConversionException($"input.{name} does not fit a decimal.");
                default:
                    throw new InputConversionException($"input.{name} is neither a string nor a number.");
            }
        }

        /// <summary>Fails when the input has keys nobody read, so vectors never lose a field silently.</summary>
        public void Done()
        {
            var unread = _obj.Select(p => p.Key).Where(k => !_read.Contains(k)).ToList();
            if (unread.Count > 0) throw new InputConversionException("input has unknown keys: " + string.Join(", ", unread));
        }
    }
}
