using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace TingQR.Tests.Conformance
{
    /// <summary>
    /// Turns a C# result into the JSON shape the TypeScript implementation returns, so it can be compared with a
    /// vector's <c>expected</c> the way Jest's <c>toStrictEqual</c> does: camelCase property names, null properties
    /// omitted (TS leaves optional fields out), dictionary keys verbatim, enums as their TS string spellings.
    /// </summary>
    internal static class ResultJson
    {
        private static readonly ConcurrentDictionary<Type, IReadOnlyDictionary<long, string>> EnumNames =
            new ConcurrentDictionary<Type, IReadOnlyDictionary<long, string>>();

        private static readonly JsonSerializerOptions Options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DictionaryKeyPolicy = null,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Converters = { new WireEnumConverterFactory() },
        };

        /// <summary>
        /// Gives an enum explicit TS spellings (e.g. <c>CreditTransfer</c> → <c>credit-transfer</c>). Every value of
        /// the enum must be listed. Enums without a mapping serialize as the camelCase of their C# name
        /// (<c>Static</c> → <c>static</c>, <c>NationalId</c> → <c>nationalId</c>).
        /// </summary>
        public static void RegisterEnum<T>(IReadOnlyDictionary<T, string> names)
            where T : struct, Enum
        {
            var map = new Dictionary<long, string>();
            foreach (var value in (T[])Enum.GetValues(typeof(T)))
            {
                if (!names.TryGetValue(value, out var name))
                {
                    throw new InvalidOperationException($"{typeof(T).Name}.{value} has no JSON name.");
                }
                map[Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture)] = name;
            }
            EnumNames[typeof(T)] = map;
        }

        /// <summary>The JSON form of <paramref name="value"/> (null → JSON null).</summary>
        public static JsonNode? ToNode(object? value)
            => value == null ? null : JsonSerializer.SerializeToNode(value, value.GetType(), Options);

        /// <summary>Structural JSON equality; object key order does not matter, array order does.</summary>
        public static bool JsonEquals(JsonNode? a, JsonNode? b) => JsonNode.DeepEquals(a, b);

        /// <summary>Compact JSON text for assertion messages.</summary>
        public static string Show(JsonNode? node) => node == null ? "null" : node.ToJsonString();

        internal static string NameOf(Type enumType, object value)
        {
            var key = Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture);
            if (EnumNames.TryGetValue(enumType, out var map))
            {
                if (map.TryGetValue(key, out var name)) return name;
                throw new JsonException($"{enumType.Name} value {key} has no JSON name.");
            }
            var text = Enum.GetName(enumType, value)
                ?? throw new JsonException($"{enumType.Name} value {key} is not a declared member.");
            return char.ToLowerInvariant(text[0]) + text.Substring(1);
        }

        private sealed class WireEnumConverterFactory : JsonConverterFactory
        {
            public override bool CanConvert(Type typeToConvert) => typeToConvert.IsEnum;

            public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
                => (JsonConverter)Activator.CreateInstance(typeof(WireEnumConverter<>).MakeGenericType(typeToConvert))!;
        }

        private sealed class WireEnumConverter<T> : JsonConverter<T>
            where T : struct, Enum
        {
            public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
                => throw new NotSupportedException("ResultJson only writes.");

            public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
                => writer.WriteStringValue(NameOf(typeof(T), value));
        }
    }
}
