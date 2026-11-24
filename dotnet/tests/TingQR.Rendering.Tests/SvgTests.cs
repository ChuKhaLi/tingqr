using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace TingQR.Rendering.Tests
{
    /// <summary>Port of ts/packages/render/test/svg.spec.ts (cases the vectors do not cover) plus .NET-only cases.</summary>
    public class SvgTests
    {
        private const string Text = "TINGQR SVG TEST";
        private const string Href = "data:image/png;base64,AAAA";

        private static readonly Regex PathData = new Regex("<path[^>]* d=\"([^\"]*)\"", RegexOptions.CultureInvariant);

        private static readonly Regex Segment = new Regex("M([0-9]+) ([0-9]+)h([0-9]+)v1h-([0-9]+)z", RegexOptions.CultureInvariant);

        private static int Int(string s) => int.Parse(s, CultureInfo.InvariantCulture);

        /// <summary>Dark cells drawn by the path, as "x,y" in module coordinates (margin removed).</summary>
        private static HashSet<string> CellsOf(string svg, int margin)
        {
            var d = PathData.Match(svg).Groups[1].Value;
            var cells = new HashSet<string>(StringComparer.Ordinal);
            var covered = 0;
            foreach (Match m in Segment.Matches(d))
            {
                covered += m.Length;
                int x = Int(m.Groups[1].Value), y = Int(m.Groups[2].Value), len = Int(m.Groups[3].Value);
                Assert.Equal(len, Int(m.Groups[4].Value));
                for (var i = 0; i < len; i++) cells.Add((x - margin + i).ToString(CultureInfo.InvariantCulture) + "," + (y - margin).ToString(CultureInfo.InvariantCulture));
            }
            Assert.Equal(d.Length, covered);
            return cells;
        }

        private static HashSet<string> DarkCells(QrMatrix m)
        {
            var cells = new HashSet<string>(StringComparer.Ordinal);
            for (var y = 0; y < m.Size; y++)
            {
                for (var x = 0; x < m.Size; x++)
                {
                    if (m.IsDark(x, y)) cells.Add(x.ToString(CultureInfo.InvariantCulture) + "," + y.ToString(CultureInfo.InvariantCulture));
                }
            }
            return cells;
        }

        private static string Message(Action action)
        {
            var e = Assert.Throws<TingQrException>(action);
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            return e.Message;
        }

        [Theory]
        [InlineData(0)]
        [InlineData(4)]
        public void PathDrawsExactlyTheDarkModules(int margin)
        {
            var svg = TingQrRender.ToSvg(Text, new SvgOptions { Margin = margin });
            Assert.Equal(DarkCells(TingQrRender.ToMatrix(Text)), CellsOf(svg, margin));
        }

        [Fact]
        public void RunsOnOneRowAreMergedIntoOneSegment()
        {
            var d = PathData.Match(TingQrRender.ToSvg(Text)).Groups[1].Value;
            var segments = Segment.Matches(d).Cast<Match>()
                .Select(m => (X: Int(m.Groups[1].Value), Y: Int(m.Groups[2].Value), Len: Int(m.Groups[3].Value)))
                .ToList();
            Assert.NotEmpty(segments);
            var starts = new HashSet<(int, int)>(segments.Select(s => (s.X, s.Y)));
            foreach (var s in segments) Assert.DoesNotContain((s.X + s.Len, s.Y), starts);
        }

        [Fact]
        public void ShapeViewBoxIncludesTheMarginBackgroundRectOnePathCrispEdges()
        {
            var w = TingQrRender.ToMatrix(Text).Size + 8;
            var ws = w.ToString(CultureInfo.InvariantCulture);
            var svg = TingQrRender.ToSvg(Text);
            Assert.StartsWith("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + ws + " " + ws + "\" shape-rendering=\"crispEdges\">", svg, StringComparison.Ordinal);
            Assert.Contains("<rect width=\"" + ws + "\" height=\"" + ws + "\" fill=\"#ffffff\"/>", svg, StringComparison.Ordinal);
            Assert.Contains("<path fill=\"#000000\" d=\"M", svg, StringComparison.Ordinal);
            Assert.EndsWith("</svg>", svg, StringComparison.Ordinal);
            Assert.Single(Regex.Matches(svg, "<path").Cast<Match>());
        }

        [Fact]
        public void NullOptionsIsDefault()
        {
            Assert.Equal(TingQrRender.ToSvg(Text, new SvgOptions()), TingQrRender.ToSvg(Text, null));
            Assert.Equal(TingQrRender.ToSvg(Text, new SvgOptions()), TingQrRender.ToSvg(Text));
            TingQrRender.CheckSvgOptions(null);
            TingQrRender.CheckSvgOptions(new SvgOptions());
        }

        [Fact]
        public void NullTextIsInvalidValue()
        {
            Message(() => TingQrRender.ToSvg(null));
            Message(() => TingQrRender.ToSvg(null, new SvgOptions { Logo = new LogoOptions { Href = Href } }));
        }

        [Fact]
        public void MatrixOptionsArePassedThrough()
        {
            var svg = TingQrRender.ToSvg(Text, new SvgOptions { Ecc = Ecc.H, MinVersion = 5, Margin = 0 });
            Assert.Equal(DarkCells(TingQrRender.ToMatrix(Text, new MatrixOptions { Ecc = Ecc.H, MinVersion = 5 })), CellsOf(svg, 0));
        }

        public static IEnumerable<object[]> AcceptedSizes() => new[]
        {
            new object[] { (SvgSize)300, "width=\"300\" height=\"300\"" },
            new object[] { (SvgSize)"40mm", "width=\"40mm\" height=\"40mm\"" },
            new object[] { (SvgSize)"2.5in", "width=\"2.5in\" height=\"2.5in\"" },
            new object[] { (SvgSize)"100%", "width=\"100%\" height=\"100%\"" },
            new object[] { (SvgSize)"40", "width=\"40\" height=\"40\"" },
            new object[] { (SvgSize)"2.55in", "width=\"2.55in\" height=\"2.55in\"" },
            new object[] { (SvgSize)1e21, "width=\"1e+21\" height=\"1e+21\"" },
            new object[] { (SvgSize)"0.5pt", "width=\"0.5pt\" height=\"0.5pt\"" },
        };

        [Theory]
        [MemberData(nameof(AcceptedSizes))]
        public void SizeIsWrittenOnTheSvg(SvgSize size, string attrs)
        {
            var svg = TingQrRender.ToSvg(Text, new SvgOptions { Size = size });
            Assert.Contains(attrs + " shape-rendering", svg, StringComparison.Ordinal);
            TingQrRender.CheckSvgOptions(new SvgOptions { Size = size });
        }

        public static IEnumerable<object[]> RejectedSizes() => new[]
        {
            new object[] { (SvgSize)(-1) },
            new object[] { (SvgSize)0 },
            new object[] { (SvgSize)double.NaN },
            new object[] { (SvgSize)double.PositiveInfinity },
            new object[] { (SvgSize)"40 mm" },
            new object[] { (SvgSize)"40mm\"" },
            new object[] { (SvgSize)"1e3" },
            new object[] { (SvgSize)"mm" },
            new object[] { (SvgSize)"-5px" },
            new object[] { (SvgSize)"0" },
            new object[] { (SvgSize)"0mm" },
            new object[] { (SvgSize)"0.0px" },
            new object[] { (SvgSize)"40mm\n" },
            new object[] { (SvgSize)"٤٠mm" }, // Arabic-Indic digits: JavaScript's \d is ASCII only
            new object[] { (SvgSize)"40.mm" },
            new object[] { (SvgSize)"40MM" },
            new object[] { new SvgSize((string?)null) },
            new object[] { default(SvgSize) },
        };

        [Theory]
        [MemberData(nameof(RejectedSizes))]
        public void SizeIsRejected(SvgSize size)
        {
            var message = Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Size = size }));
            Assert.Contains("must be a positive number or a length like '40mm'", message, StringComparison.Ordinal);
            Assert.Equal(message, Message(() => TingQrRender.CheckSvgOptions(new SvgOptions { Size = size })));
        }

        [Fact]
        public void SizeMessageShowsTheValueLikeJsonStringify()
        {
            Assert.Equal("Option size -1 must be a positive number or a length like '40mm'.", Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Size = -1 })));
            Assert.Equal("Option size null must be a positive number or a length like '40mm'.", Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Size = double.NaN })));
            Assert.Equal("Option size \"40mm\\\"\" must be a positive number or a length like '40mm'.", Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Size = "40mm\"" })));
        }

        [Fact]
        public void HugeLengthIsPositive()
        {
            // parseFloat gives Infinity for 400 nines, which JavaScript accepts as > 0; net481's parser overflows instead.
            var nines = new string('9', 400);
            Assert.Contains("width=\"" + nines + "\"", TingQrRender.ToSvg(Text, new SvgOptions { Size = nines }), StringComparison.Ordinal);
        }

        [Fact]
        public void LengthThatUnderflowsToZeroIsRejected()
        {
            // parseFloat('0.' + '0'.repeat(400) + '1') is 0 in JavaScript, so toSvg rejects it.
            Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Size = "0." + new string('0', 400) + "1mm" }));
        }

        [Theory]
        [InlineData(17)]
        [InlineData(-1)]
        public void MarginIsRejected(int margin)
        {
            Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Margin = margin }));
        }

        [Fact]
        public void Margin16IsAccepted()
        {
            var w = (TingQrRender.ToMatrix(Text).Size + 32).ToString(CultureInfo.InvariantCulture);
            Assert.Contains("viewBox=\"0 0 " + w + " " + w + "\"", TingQrRender.ToSvg(Text, new SvgOptions { Margin = 16 }), StringComparison.Ordinal);
        }

        [Fact]
        public void TransparentBackgroundNoRectAnyHexForeground()
        {
            var svg = TingQrRender.ToSvg(Text, new SvgOptions { Background = "transparent", Foreground = "#ffffff" });
            Assert.DoesNotContain("<rect", svg, StringComparison.Ordinal);
            Assert.Contains("fill=\"#ffffff\"", svg, StringComparison.Ordinal);
        }

        [Theory]
        [InlineData("#ffffff", "#ffffff")]
        [InlineData("#777777", "#ffffff")]
        [InlineData("#ffffff", "#000000")]
        [InlineData("#000", "transparentish")]
        [InlineData("red", "#fff")]
        public void ColoursAreRejected(string foreground, string background)
        {
            Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Foreground = foreground, Background = background }));
        }

        [Fact]
        public void DarkOnLightColoursAreAcceptedAsGivenEitherCase()
        {
            var svg = TingQrRender.ToSvg(Text, new SvgOptions { Foreground = "#1A2B3C", Background = "#fff" });
            Assert.Contains("fill=\"#1A2B3C\"", svg, StringComparison.Ordinal);
            Assert.Contains("fill=\"#fff\"", svg, StringComparison.Ordinal);
            Assert.Contains("fill=\"#1a2b3c\"", TingQrRender.ToSvg(Text, new SvgOptions { Foreground = "#1a2b3c" }), StringComparison.Ordinal);
        }

        [Fact]
        public void EscapeAttrEscapesTheFiveXmlSpecialCharacters()
        {
            Assert.Equal("&lt;a &quot;b&quot; &amp; &#39;c&#39;&gt;", Svg.EscapeAttr("<a \"b\" & 'c'>"));
            Assert.Equal("&amp;amp;", Svg.EscapeAttr("&amp;"));
        }

        [Fact]
        public void BadMatrixOptionsSurfaceAsInvalidValue()
        {
            Message(() => TingQrRender.ToSvg(Text, new SvgOptions { Mask = 9 }));
        }

        [Fact]
        public void LogoIsDrawnOverTheClearedBox()
        {
            var options = new SvgOptions { MinVersion = 5, Margin = 2, Logo = new LogoOptions { Href = Href, Background = "#abc" } };
            var svg = TingQrRender.ToSvg(Text, options);
            var m = TingQrRender.ToMatrix(Text, new MatrixOptions { Ecc = Ecc.H, MinVersion = 5 });
            var box = Logo.Box(m.Size, 0.2, 1);
            string S(int n) => n.ToString(CultureInfo.InvariantCulture);
            var c = S(box.ClearStart + 2);
            var p = S(box.LogoStart + 2);
            Assert.Contains("<rect x=\"" + c + "\" y=\"" + c + "\" width=\"" + S(box.ClearSide) + "\" height=\"" + S(box.ClearSide) + "\" fill=\"#abc\"/>", svg, StringComparison.Ordinal);
            Assert.EndsWith("<image href=\"" + Href + "\" x=\"" + p + "\" y=\"" + p + "\" width=\"" + S(box.LogoSide) + "\" height=\"" + S(box.LogoSide) + "\" preserveAspectRatio=\"xMidYMid meet\"/></svg>", svg, StringComparison.Ordinal);
            var expected = DarkCells(m);
            expected.RemoveWhere(cell =>
            {
                var xy = cell.Split(',');
                int x = Int(xy[0]), y = Int(xy[1]);
                var end = box.ClearStart + box.ClearSide;
                return x >= box.ClearStart && x < end && y >= box.ClearStart && y < end;
            });
            Assert.Equal(expected, CellsOf(svg, 2));
        }

        public static IEnumerable<object[]> CheckCases() => new[]
        {
            new object[] { "margin", new SvgOptions { Margin = -1 } },
            new object[] { "colours", new SvgOptions { Foreground = "#ffffff" } },
            new object[] { "size", new SvgOptions { Size = "10furlongs" } },
            new object[] { "logo size", new SvgOptions { Logo = new LogoOptions { Href = Href, Size = 0.5 } } },
            new object[] { "logo padding", new SvgOptions { Logo = new LogoOptions { Href = Href, Padding = 9 } } },
            new object[] { "logo href", new SvgOptions { Logo = new LogoOptions { Href = "javascript:alert(1)" } } },
            new object[] { "logo with ecc L", new SvgOptions { Logo = new LogoOptions { Href = Href }, Ecc = Ecc.L } },
            new object[] { "ecc", new SvgOptions { Ecc = (Ecc)99 } },
            new object[] { "minVersion above maxVersion", new SvgOptions { MinVersion = 10, MaxVersion = 5 } },
        };

        [Theory]
        [MemberData(nameof(CheckCases))]
        public void CheckSvgOptionsGivesTheSameErrorAndMessageAsToSvg(string name, SvgOptions options)
        {
            Assert.NotNull(name);
            Assert.Equal(Message(() => TingQrRender.ToSvg("TINGQR", options)), Message(() => TingQrRender.CheckSvgOptions(options)));
        }

        [Fact]
        public void CheckSvgOptionsAcceptsValidOptions()
        {
            TingQrRender.CheckSvgOptions(new SvgOptions { Margin = 2, Size = 240, Foreground = "#112233", Logo = new LogoOptions { Href = Href, Size = 0.2 }, MinVersion = 5 });
        }

        [Fact]
        public void SvgSizeConvertsFromNumbersAndStrings()
        {
            SvgSize n = 100.5;
            SvgSize s = "40mm";
            Assert.False(n.IsLength);
            Assert.Equal(100.5, n.Pixels);
            Assert.Null(n.Length);
            Assert.Equal("100.5", n.ToString());
            Assert.True(s.IsLength);
            Assert.Equal("40mm", s.Length);
            Assert.Equal(0, s.Pixels);
            Assert.Equal("40mm", s.ToString());
            Assert.Equal(string.Empty, new SvgSize((string?)null).ToString());
        }

        private static string Sample() => TingQrRender.ToSvg("tingqr culture", new SvgOptions
        {
            Size = 100.5,
            Foreground = "#0A2540",
            Background = "#F6F9FC",
            Margin = 3,
            MinVersion = 5,
            Logo = new LogoOptions { Href = "LOGO-i.png", Background = "#FFF8E1" },
        });

        [Fact]
        public void SameUnderGermanAndTurkishCulture()
        {
            var invariant = WithCulture(CultureInfo.InvariantCulture, Sample);
            Assert.Contains("width=\"100.5\"", invariant, StringComparison.Ordinal);
            Assert.Equal(invariant, WithCulture(new CultureInfo("de-DE"), Sample));
            Assert.Equal(invariant, WithCulture(new CultureInfo("tr-TR"), Sample));
        }

        private static string WithCulture(CultureInfo culture, Func<string> run)
        {
            var (culture0, ui0) = (CultureInfo.CurrentCulture, CultureInfo.CurrentUICulture);
            try
            {
                CultureInfo.CurrentCulture = culture;
                CultureInfo.CurrentUICulture = culture;
                return run();
            }
            finally
            {
                CultureInfo.CurrentCulture = culture0;
                CultureInfo.CurrentUICulture = ui0;
            }
        }

        [Fact]
        public async Task ParallelCallsAgree()
        {
            var expected = Sample();
            // LongRunning gives each task its own thread; an exception in any task surfaces from WhenAll and fails the test.
            var tasks = Enumerable.Range(0, 8).Select(_ => Task.Factory.StartNew(() =>
            {
                var mine = new string[50];
                for (var i = 0; i < 50; i++) mine[i] = Sample();
                return mine;
            }, CancellationToken.None, TaskCreationOptions.LongRunning, TaskScheduler.Default)).ToArray();
            var results = await Task.WhenAll(tasks);
            Assert.All(results.SelectMany(r => r), r => Assert.Equal(expected, r));
            Assert.Equal(400, results.Sum(r => r.Length));
        }
    }
}
