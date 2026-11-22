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
            public Runner(Func<JsonNode, object?>? encode, Func<string, ParseMode, object>? decode)
            {
                Encode = encode;
                Decode = decode;
            }

            public Func<JsonNode, object?>? Encode { get; }

            public Func<string, ParseMode, object>? Decode { get; }
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

        private static void ExpectValue(JsonObject v, Outcome o, string mode, IReadOnlyList<string> warnings)
        {
            var id = Str(v, "id")!;
            Check(o.Ok, id, $"{mode}: expected success, got {(o.Error == null ? "?" : WireNames.Of(o.Error.Code) + " " + o.Error.Tag + ": " + o.Error.Message)}");
            var actual = ResultJson.ToNode(o.Value);
            Check(ResultJson.JsonEquals(actual, v["expected"]), id,
                $"{mode}: value\n  expected {ResultJson.Show(v["expected"])}\n  actual   {ResultJson.Show(actual)}");
            var codes = o.Warnings.Select(w => WireNames.Of(w.Code)).ToList();
            Check(codes.SequenceEqual(warnings), id,
                $"{mode}: warnings [{string.Join(",", codes)}], expected [{string.Join(",", warnings)}]");
        }

        /// <summary>Error code plus, when the vector pins an errorTag, the tag, as in errorOf() of the TS runner.</summary>
        private static void ExpectError(JsonObject v, Outcome o, string mode)
        {
            var id = Str(v, "id")!;
            var error = Str(v, "error");
            var errorTag = Str(v, "errorTag");
            var actualCode = o.Ok ? null : WireNames.Of(o.Error!.Code);
            Check(actualCode == error, id, $"{mode}: error {actualCode ?? "(none)"}, expected {error}");
            if (errorTag != null) Check(o.Error!.Tag == errorTag, id, $"{mode}: error tag {o.Error.Tag ?? "(none)"}, expected {errorTag}");
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
                            Check(thrown == null, id, $"encode threw {(thrown == null ? "" : WireNames.Of(thrown.Code) + ": " + thrown.Message)}");
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
                        Check(WireNames.Of(error!.Code) == Str(v, "error"), id, $"encode threw {WireNames.Of(error.Code)}, expected {Str(v, "error")}");
                        var tag = Str(v, "errorTag");
                        if (tag != null) Check(error.Tag == tag, id, $"encode error tag {error.Tag ?? "(none)"}, expected {tag}");
                    }
                    break;
                case "link":
                    if (TryEncode(r, v, out var link, out var linkError))
                    {
                        Check(linkError == null, id, $"link threw {(linkError == null ? "" : WireNames.Of(linkError.Code))}");
                        Check(link is string l && l == Str((JsonObject)v["expected"]!, "link"), id, $"link {link}, expected {v["expected"]!["link"]}");
                    }
                    break;
                case "lookup":
                    if (TryEncode(r, v, out var found, out var lookupError))
                    {
                        Check(lookupError == null, id, $"lookup threw {(lookupError == null ? "" : WireNames.Of(lookupError.Code))}");
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
