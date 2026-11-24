using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using TingQR.Tests.Conformance;
using Xunit;

namespace TingQR.Rendering.Tests
{
    /// <summary>
    /// Runner for the SVG vectors of conformance/vectors/render/ (conformance/README.md "Mẫu SVG"), mirroring
    /// ts/packages/render/test/svg-conformance.spec.ts. The vectors are golden output of the TypeScript toSvg: passing
    /// proves the two implementations agree byte for byte, not that the SVG is right.
    /// </summary>
    public class SvgConformanceTests
    {
        private static readonly string Dir = Path.Combine(ConformanceRoot.Path, "vectors", "render");

        /// <summary>Type-check vectors (conformance/README.md): their input must FAIL to convert to <see cref="SvgOptions"/>.</summary>
        private static readonly HashSet<string> TypeCheckIds = new HashSet<string>(StringComparer.Ordinal)
        {
            "render-svg-invalid-margin-fraction",
            "render-svg-invalid-logo-padding-fraction",
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

        private static bool IsSvgRunners(JsonObject v)
            => (string)v["kind"]! == "svg" || (v.TryGetPropertyValue("render", out var r) && (string)r! == "svg");

        public static IEnumerable<object[]> Vectors()
            => All.Values.Where(IsSvgRunners).Select(v => new object[] { (string)v["id"]! });

        [Fact]
        public void RunnerSeesEverySvgVector()
        {
            var files = Directory.GetFiles(Dir, "render-svg-*.json");
            var ran = Vectors().Count();
            Assert.Equal(files.Length, ran);
            Assert.True(All.Values.Where(IsSvgRunners).Count(v => (string)v["kind"]! == "svg") >= 25);
            Assert.True(All.Values.Where(IsSvgRunners).Count(v => (string)v["kind"]! == "encode-invalid") >= 20);
        }

        [Theory]
        [MemberData(nameof(Vectors))]
        public void Vector(string id)
        {
            var v = All[id];
            Assert.Equal("render", (string)v["scheme"]!);
            string? text;
            SvgOptions options;
            try
            {
                (text, options) = InputOf(v["input"]);
            }
            catch (InputConversionException) when (TypeCheckIds.Contains(id))
            {
                return;
            }
            Assert.False(TypeCheckIds.Contains(id), id + " is a type-check vector, but its input converted.");

            if ((string)v["kind"]! == "svg")
            {
                Assert.Equal((string)v["expected"]!["svg"]!, TingQrRender.ToSvg(text, options));
                TingQrRender.CheckSvgOptions(options);
                return;
            }

            Assert.Equal("encode-invalid", (string)v["kind"]!);
            var error = (string)v["error"]!;
            var thrown = Assert.Throws<TingQrException>(() => TingQrRender.ToSvg(text, options));
            Assert.Equal(error, thrown.Code.ToWireName());
            // textDependent: the error needs the text (too long, logo too big), so CheckSvgOptions cannot know it.
            var textDependent = v.TryGetPropertyValue("textDependent", out var t) && (bool)t!;
            if (textDependent)
            {
                TingQrRender.CheckSvgOptions(options);
            }
            else
            {
                var checkThrown = Assert.Throws<TingQrException>(() => TingQrRender.CheckSvgOptions(options));
                Assert.Equal(error, checkThrown.Code.ToWireName());
            }
        }

        private static (string? Text, SvgOptions Options) InputOf(JsonNode? node)
        {
            var i = JsonInput.Of(node);
            var text = i.String("text");
            var options = new SvgOptions
            {
                Ecc = i.Enum("ecc", EccByName),
                BoostEcc = i.Bool("boostEcc"),
                MinVersion = ToInt(i.Long("minVersion")),
                MaxVersion = ToInt(i.Long("maxVersion")),
                Mask = ToInt(i.Long("mask")),
                Margin = ToInt(i.Long("margin")),
                Foreground = i.String("foreground"),
                Background = i.String("background"),
                Size = SizeOf(i),
                Logo = LogoOf(i.Object("logo")),
            };
            i.Done();
            return (text, options);
        }

        /// <summary><c>size</c>: a JSON number as a double, anything else read as a length string (TS <c>number | string</c>).</summary>
        private static SvgSize? SizeOf(JsonInput i)
        {
            if (i.KindOf("size") == JsonValueKind.Number) return i.Double("size");
            var length = i.String("size");
            return length == null ? (SvgSize?)null : length;
        }

        private static LogoOptions? LogoOf(JsonInput? l)
        {
            if (l == null) return null;
            var href = l.String("href");
            var logo = new LogoOptions
            {
                Href = href ?? throw new InputConversionException("input.logo.href is missing."),
                Size = l.Double("size"),
                Padding = ToInt(l.Long("padding")),
                Background = l.String("background"),
            };
            l.Done();
            return logo;
        }

        private static int? ToInt(long? value)
        {
            if (value == null) return null;
            if (value < int.MinValue || value > int.MaxValue) throw new InputConversionException(value + " does not fit an int.");
            return (int)value;
        }
    }
}
