using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using TingQR.Emv;
using Xunit;
using Xunit.Sdk;

namespace TingQR.Tests.Conformance
{
    /// <summary>
    /// Runs conformance/vectors/ exactly like ts/packages/core/test/conformance.spec.ts. Schemes register here
    /// (see <see cref="ConformanceTests"/>); vectors of unregistered schemes are not run.
    /// </summary>
    internal static class VectorRunner
    {
        private sealed class Runner
        {
            public Runner(Func<JsonNode, object?>? encode, Func<string, ParseMode, object>? decode, Func<object, JsonNode, object?>? expiry = null)
            {
                Encode = encode;
                Decode = decode;
                Expiry = expiry;
            }

            public Func<JsonNode, object?>? Encode { get; }

            public Func<string, ParseMode, object>? Decode { get; }

            public Func<object, JsonNode, object?>? Expiry { get; }
        }

        private static readonly Dictionary<string, Runner> Schemes = new Dictionary<string, Runner>(StringComparer.Ordinal);

        private static readonly Lazy<IReadOnlyDictionary<string, JsonObject>> AllVectors =
            new Lazy<IReadOnlyDictionary<string, JsonObject>>(Load);

        /// <summary>
        /// Registers a scheme. <paramref name="encode"/> takes the vector's raw <c>input</c>, converts it with
        /// <see cref="JsonInput"/> (throwing <see cref="InputConversionException"/> when it cannot) and returns the
        /// function's result. <paramref name="decode"/> returns a <c>TingQrResult&lt;T&gt;</c> for any T.
        /// Encode-only schemes (link, lookup) pass a null decode.
        /// </summary>
        public static void Register(string scheme, Func<JsonNode, object?>? encode, Func<string, ParseMode, object>? decode)
        {
            if (Schemes.ContainsKey(scheme)) throw new InvalidOperationException($"Scheme {scheme} registered twice.");
            Schemes[scheme] = new Runner(encode, decode);
        }

        /// <summary>
        /// Registers a scheme of <c>expiry</c> vectors: <paramref name="decode"/> reads the payload (lenient), then
        /// <paramref name="expiry"/> gets the decoded value and the vector's raw <c>input</c>.
        /// </summary>
        public static void RegisterExpiry(string scheme, Func<string, ParseMode, object> decode, Func<object, JsonNode, object?> expiry)
        {
            if (Schemes.ContainsKey(scheme)) throw new InvalidOperationException($"Scheme {scheme} registered twice.");
            Schemes[scheme] = new Runner(null, decode, expiry);
        }

        public static bool IsRegistered(string scheme) => Schemes.ContainsKey(scheme);

        public static IEnumerable<string> RegisteredSchemes => Schemes.Keys;

        /// <summary>Every vector file under conformance/vectors/, keyed by id (matrix vectors included).</summary>
        public static IReadOnlyDictionary<string, JsonObject> Vectors => AllVectors.Value;

        public static string VectorsDir => Path.Combine(ConformanceRoot.Path, "vectors");

        private static IReadOnlyDictionary<string, JsonObject> Load()
        {
            var result = new SortedDictionary<string, JsonObject>(StringComparer.Ordinal);
            foreach (var file in Directory.GetFiles(VectorsDir, "*.json", SearchOption.AllDirectories))
            {
                var v = (JsonObject)JsonNode.Parse(File.ReadAllText(file))!;
                var id = (string)v["id"]!;
                if (result.ContainsKey(id)) throw new InvalidOperationException($"Duplicate vector id {id}.");
                result[id] = v;
            }
            return result;
        }

        private sealed class Outcome
        {
            public bool Ok;
            public object? Value;
            public IReadOnlyList<TingQrWarning> Warnings = Array.Empty<TingQrWarning>();
            public TingQrException? Error;
        }

        private static Outcome ToOutcome(object result)
        {
            var t = result.GetType();
            if (!t.IsGenericType || t.GetGenericTypeDefinition() != typeof(TingQrResult<>))
            {
                throw new InvalidOperationException($"decode must return TingQrResult<T>, got {t.Name}.");
            }
            return new Outcome
            {
                Ok = (bool)t.GetProperty("Ok")!.GetValue(result)!,
                Value = t.GetProperty("Value")!.GetValue(result),
                Warnings = (IReadOnlyList<TingQrWarning>)t.GetProperty("Warnings")!.GetValue(result)!,
                Error = (TingQrException?)t.GetProperty("Error")!.GetValue(result),
            };
        }

        private static string? Str(JsonObject v, string key) => v[key] is JsonNode n ? (string)n! : null;

        private static IReadOnlyList<string>? Strings(JsonObject v, string key)
            => v[key] is JsonArray a ? a.Select(n => (string)n!).ToList() : null;

        private static void Check(bool condition, string id, string what)
        {
            if (!condition) throw new XunitException($"{id}: {what}");
        }

        private static Outcome Decode(Runner r, JsonObject v, ParseMode mode)
        {
            Check(r.Decode != null, Str(v, "id")!, "scheme has no decoder");
            return ToOutcome(r.Decode!(Str(v, "payload")!, mode));
        }

        /// <summary>The vector's warningTags (JSON null kept as null); none when the vector has no warnings.</summary>
        private static IReadOnlyList<string?> WarningTags(JsonObject v)
            => v["warningTags"] is JsonArray a ? a.Select(n => n == null ? null : (string)n!).ToList() : new List<string?>();

        private static void ExpectValue(JsonObject v, Outcome o, string mode, IReadOnlyList<string> warnings)
        {
            var id = Str(v, "id")!;
            Check(o.Ok, id, $"{mode}: expected success, got {(o.Error == null ? "?" : o.Error.Code.ToWireName() + " " + o.Error.Tag + ": " + o.Error.Message)}");
            var actual = ResultJson.ToNode(o.Value);
            Check(ResultJson.JsonEquals(actual, v["expected"]), id,
                $"{mode}: value\n  expected {ResultJson.Show(v["expected"])}\n  actual   {ResultJson.Show(actual)}");
            var codes = o.Warnings.Select(w => w.Code.ToWireName()).ToList();
            Check(codes.SequenceEqual(warnings), id,
                $"{mode}: warnings [{string.Join(",", codes)}], expected [{string.Join(",", warnings)}]");
            var tags = o.Warnings.Select(w => w.Tag).ToList();
            var expectedTags = WarningTags(v);
            Check(tags.SequenceEqual(expectedTags, StringComparer.Ordinal), id,
                $"{mode}: warning tags [{string.Join(",", tags.Select(x => x ?? "null"))}], expected [{string.Join(",", expectedTags.Select(x => x ?? "null"))}]");
        }

        /// <summary>Error code plus, when the vector pins an errorTag, the tag, as in errorOf() of the TS runner.</summary>
        private static void ExpectError(JsonObject v, Outcome o, string mode)
        {
            var id = Str(v, "id")!;
            var error = Str(v, "error");
            var errorTag = Str(v, "errorTag");
            var actualCode = o.Ok ? null : o.Error!.Code.ToWireName();
            Check(actualCode == error, id, $"{mode}: error {actualCode ?? "(none)"}, expected {error}");
            if (errorTag != null) Check(o.Error!.Tag == errorTag, id, $"{mode}: error tag {o.Error.Tag ?? "(none)"}, expected {errorTag}");
            if (v["errorFields"] is JsonNode errorFields)
            {
                var fields = ResultJson.ToNode(o.Error?.Fields);
                Check(ResultJson.JsonEquals(fields, errorFields), id,
                    $"{mode}: error fields {ResultJson.Show(fields)}, expected {ResultJson.Show(errorFields)}");
            }
        }

        /// <summary>
        /// Calls the scheme's encode with the vector's input. For a type-check vector, asserts that conversion
        /// failed and returns false (nothing else to check). Otherwise a conversion failure fails the test.
        /// </summary>
        private static bool TryEncode(Runner r, JsonObject v, out object? result, out TingQrException? thrown)
        {
            var id = Str(v, "id")!;
            Check(r.Encode != null, id, "scheme has no encoder");
            var typeCheck = TypeCheckVectors.Ids.Contains(id);
            result = null;
            thrown = null;
            try
            {
                result = r.Encode!(v["input"]!);
            }
            catch (InputConversionException e)
            {
                Check(typeCheck, id, "input does not convert to the C# input type, and the vector is not in TypeCheckVectors: " + e.Message);
                return false;
            }
            catch (TingQrException e)
            {
                thrown = e;
            }
            Check(!typeCheck, id, "type-check vector: input converted to the C# input type, but it must not");
            return true;
        }

        // UTF-16 code units outside printable ASCII as \uXXXX, so a failing message shows lone surrogates and marks.
        private static string Escape(string? s)
            => s == null ? "null" : string.Concat(s.Select(c => c >= ' ' && c <= '~' ? c.ToString() : "\\u" + ((int)c).ToString("x4", System.Globalization.CultureInfo.InvariantCulture)));

        /// <summary>Runs every check of the vector's kind; throws on the first mismatch.</summary>
        public static void Run(string id)
        {
            var v = Vectors[id];
            var scheme = Str(v, "scheme")!;
            if (!Schemes.TryGetValue(scheme, out var r)) throw new XunitException($"{id}: no runner for scheme {scheme}");
            var kind = Str(v, "kind");
            var noWarnings = Array.Empty<string>();
            switch (kind)
            {
                case "valid":
                    ExpectValue(v, Decode(r, v, ParseMode.Strict), "strict", Strings(v, "warnings") ?? noWarnings);
                    ExpectValue(v, Decode(r, v, ParseMode.Lenient), "lenient", Strings(v, "warnings") ?? noWarnings);
                    if (v["input"] != null && !(v["roundTrip"] is JsonNode rt && rt.GetValue<bool>() == false))
                    {
                        if (TryEncode(r, v, out var payload, out var thrown))
                        {
                            Check(thrown == null, id, $"encode threw {(thrown == null ? "" : thrown.Code.ToWireName() + ": " + thrown.Message)}");
                            Check(payload is string s && s == Str(v, "payload"), id,
                                $"encode gave\n  {payload}\n  expected\n  {Str(v, "payload")}");
                        }
                    }
                    break;
                case "invalid":
                    ExpectError(v, Decode(r, v, ParseMode.Strict), "strict");
                    ExpectError(v, Decode(r, v, ParseMode.Lenient), "lenient");
                    break;
                case "lenient":
                    ExpectError(v, Decode(r, v, ParseMode.Strict), "strict");
                    ExpectValue(v, Decode(r, v, ParseMode.Lenient), "lenient",
                        Strings(v, "warnings") ?? throw new XunitException($"{id}: lenient vector without warnings"));
                    break;
                case "encode-invalid":
                    if (TryEncode(r, v, out _, out var error))
                    {
                        Check(error != null, id, $"encode did not throw TingQrException; expected {Str(v, "error")}");
                        Check(error!.Code.ToWireName() == Str(v, "error"), id, $"encode threw {error.Code.ToWireName()}, expected {Str(v, "error")}");
                        var tag = Str(v, "errorTag");
                        if (tag != null) Check(error.Tag == tag, id, $"encode error tag {error.Tag ?? "(none)"}, expected {tag}");
                    }
                    break;
                case "link":
                    if (TryEncode(r, v, out var link, out var linkError))
                    {
                        Check(linkError == null, id, $"link threw {(linkError == null ? "" : linkError.Code.ToWireName())}");
                        Check(link is string l && l == Str((JsonObject)v["expected"]!, "link"), id, $"link {link}, expected {v["expected"]!["link"]}");
                    }
                    break;
                case "expiry":
                    {
                        Check(r.Expiry != null, id, "scheme has no expiry check");
                        var decoded = Decode(r, v, ParseMode.Lenient);
                        Check(decoded.Ok, id, $"decode failed: {decoded.Error?.Code.ToWireName()}");
                        var expired = ResultJson.ToNode(r.Expiry!(decoded.Value!, v["input"]!));
                        var expectedExpired = v["expected"]!["result"];
                        Check(ResultJson.JsonEquals(expired, expectedExpired), id, $"expiry {ResultJson.Show(expired)}, expected {ResultJson.Show(expectedExpired)}");
                    }
                    break;
                case "text":
                    if (TryEncode(r, v, out var text, out var textError))
                    {
                        Check(textError == null, id, $"text threw {(textError == null ? "" : textError.Code.ToWireName())}");
                        var expectedText = JsonInput.Of(v["expected"]).String("result");
                        Check(text is string s && string.Equals(s, expectedText, StringComparison.Ordinal), id,
                            $"text {Escape(text as string)}, expected {Escape(expectedText)}");
                    }
                    break;
                case "lookup":
                    if (TryEncode(r, v, out var found, out var lookupError))
                    {
                        Check(lookupError == null, id, $"lookup threw {(lookupError == null ? "" : lookupError.Code.ToWireName())}");
                        var expected = v["expected"]!["result"];
                        var actual = ResultJson.ToNode(found);
                        Check(ResultJson.JsonEquals(actual, expected), id, $"lookup {ResultJson.Show(actual)}, expected {ResultJson.Show(expected)}");
                    }
                    break;
                default:
                    throw new XunitException($"{id}: unknown kind {kind}");
            }
        }
    }
}
