using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using TingQR.Tests.Conformance;
using Xunit;

namespace TingQR.Rendering.Tests
{
    /// <summary>
    /// Runner for conformance/vectors/render/ (conformance/README.md "Mẫu ma trận"), mirroring
    /// ts/packages/render/test/matrix-conformance.spec.ts: every matrix must equal what the original Nayuki encoder
    /// produced. Runs kind "matrix", and kind "encode-invalid" without a top-level <c>"render": "svg"</c> (those are
    /// ToSvg's). Other vectors in the folder belong to other runners.
    /// </summary>
    public class MatrixConformanceTests
    {
        private static readonly string Dir = Path.Combine(ConformanceRoot.Path, "vectors", "render");

        /// <summary>Type-check vectors (conformance/README.md): their input must FAIL to convert to <see cref="MatrixOptions"/>.</summary>
        private static readonly HashSet<string> TypeCheckIds = new HashSet<string>(StringComparer.Ordinal)
        {
            "render-invalid-mask-fraction",
        };

        private static readonly Dictionary<string, Ecc> EccByName = new Dictionary<string, Ecc>(StringComparer.Ordinal)
        {
            ["L"] = Ecc.L,
            ["M"] = Ecc.M,
            ["Q"] = Ecc.Q,
            ["H"] = Ecc.H,
        };

        private static readonly Dictionary<string, JsonObject> All = Directory.GetFiles(Dir, "*.json")
            .Select(f => (JsonObject)JsonNode.Parse(File.ReadAllText(f))!)
            .ToDictionary(v => (string)v["id"]!, StringComparer.Ordinal);

        private static bool IsMatrixRunners(JsonObject v)
        {
            var kind = (string)v["kind"]!;
            return kind == "matrix" || (kind == "encode-invalid" && !v.ContainsKey("render"));
        }

        public static IEnumerable<object[]> Vectors()
            => All.Values.Where(IsMatrixRunners).Select(v => new object[] { (string)v["id"]! });

        [Fact]
        public void RunnerSeesEveryMatrixVector()
        {
            var files = Directory.GetFiles(Dir, "*.json").Select(Path.GetFileName).ToList();
            var expected = files.Count(n => n!.StartsWith("render-invalid-", StringComparison.Ordinal))
                + All.Values.Count(v => (string)v["kind"]! == "matrix");
            var ran = Vectors().Count();
            Assert.Equal(expected, ran);
            Assert.True(ran >= 27, "ran " + ran);
        }

        [Theory]
        [MemberData(nameof(Vectors))]
        public void Vector(string id)
        {
            var v = All[id];
            Assert.Equal("render", (string)v["scheme"]!);
            string? text;
            MatrixOptions options;
            try
            {
                (text, options) = InputOf(v["input"]);
            }
            catch (InputConversionException) when (TypeCheckIds.Contains(id))
            {
                return;
            }
            Assert.False(TypeCheckIds.Contains(id), id + " is a type-check vector, but its input converted.");

            if ((string)v["kind"]! == "matrix")
            {
                var m = TingQrRender.ToMatrix(text, options);
                var e = v["expected"]!.AsObject();
                Assert.Equal(
                    new object[] { (int)e["size"]!, (int)e["version"]!, (string)e["ecc"]!, (int)e["mask"]! },
                    new object[] { m.Size, m.Version, m.Ecc.ToString(), m.Mask });
                var rows = e["rows"]!.AsArray().Select(r => (string)r!).ToList();
                var actual = m.Modules.Select(row => string.Concat(row.Select(d => d ? '1' : '0'))).ToList();
                Assert.Equal(rows, actual);
            }
            else
            {
                var thrown = Assert.Throws<TingQrException>(() => TingQrRender.ToMatrix(text, options));
                Assert.Equal((string)v["error"]!, WireNames.Of(thrown.Code));
            }
        }

        private static (string? Text, MatrixOptions Options) InputOf(JsonNode? node)
        {
            var i = JsonInput.Of(node);
            var text = i.String("text");
            var options = new MatrixOptions
            {
                Ecc = i.Enum("ecc", EccByName),
                BoostEcc = i.Bool("boostEcc"),
                MinVersion = ToInt(i.Long("minVersion")),
                MaxVersion = ToInt(i.Long("maxVersion")),
                Mask = ToInt(i.Long("mask")),
            };
            i.Done();
            return (text, options);
        }

        private static int? ToInt(long? value)
        {
            if (value == null) return null;
            if (value < int.MinValue || value > int.MaxValue) throw new InputConversionException(value + " does not fit an int.");
            return (int)value;
        }
    }
}
