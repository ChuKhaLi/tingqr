using System;
using System.Collections.Generic;
using Xunit;

namespace TingQR.Rendering.Tests
{
    public class LayoutTests
    {
        private const string Text = "TINGQR LAYOUT TEST";
        private const string Href = "data:image/png;base64,AAAA";

        // 61 bytes of byte-mode text: version 7 at ECC H.
        private const string LogoText = "tingqr logo test: the quick brown fox jumps over the lazy dog";

        private static string Message(Action action, TingQrErrorCode code = TingQrErrorCode.InvalidValue)
        {
            var e = Assert.Throws<TingQrException>(action);
            Assert.Equal(code, e.Code);
            return e.Message;
        }

        private static void AssertSameModules(QrMatrix expected, QrMatrix actual)
        {
            Assert.Equal(expected.Size, actual.Size);
            for (var y = 0; y < expected.Size; y++)
            {
                for (var x = 0; x < expected.Size; x++) Assert.Equal(expected.IsDark(x, y), actual.IsDark(x, y));
            }
        }

        [Fact]
        public void Defaults()
        {
            var l = Layout.Compute(Text);
            Assert.Equal(4, l.Margin);
            Assert.Equal("#000000", l.Foreground);
            Assert.Equal("#ffffff", l.Background);
            Assert.Null(l.Logo);
            AssertSameModules(TingQrRender.ToMatrix(Text), l.Matrix);
            Assert.Equal(TingQrRender.ToMatrix(Text).Size, l.Size);
            Assert.False(l.Cleared(l.Size / 2, l.Size / 2));
        }

        [Fact]
        public void MatrixOptionsAndColoursArePassedThrough()
        {
            var l = Layout.Compute(Text, new LayoutOptions { Ecc = Ecc.Q, MinVersion = 6, Margin = 2, Foreground = "#123", Background = "transparent" });
            AssertSameModules(TingQrRender.ToMatrix(Text, new MatrixOptions { Ecc = Ecc.Q, MinVersion = 6 }), l.Matrix);
            Assert.Equal(2, l.Margin);
            Assert.Equal("#123", l.Foreground);
            Assert.Equal("transparent", l.Background);
        }

        [Fact]
        public void ALogoForcesEccHAndClearsExactlyTheLogoBox()
        {
            var l = Layout.Compute(Text, new LayoutOptions { MinVersion = 5, Logo = new LogoOptions { Href = Href } });
            AssertSameModules(TingQrRender.ToMatrix(Text, new MatrixOptions { Ecc = Ecc.H, MinVersion = 5 }), l.Matrix);
            Assert.Equal(Ecc.H, l.Matrix.Ecc);
            var box = Logo.Box(l.Size, 0.2, 1);
            Assert.Equal(new LogoLayout(Href, "#ffffff", box), l.Logo);
            for (var y = 0; y < l.Size; y++)
            {
                for (var x = 0; x < l.Size; x++)
                {
                    var inside = x >= box.ClearStart && x < box.ClearStart + box.ClearSide && y >= box.ClearStart && y < box.ClearStart + box.ClearSide;
                    Assert.Equal(inside, l.Cleared(x, y));
                }
            }
        }

        [Fact]
        public void ExplicitEccHIsAccepted()
        {
            var l = Layout.Compute(Text, new LayoutOptions { Ecc = Ecc.H, MinVersion = 5, Logo = new LogoOptions { Href = Href } });
            Assert.Equal(Ecc.H, l.Matrix.Ecc);
        }

        [Fact]
        public void TheLogoBackgroundDefaultsToTheQrBackgroundAndCanBeItsOwn()
        {
            Assert.Equal("#eee", Layout.Compute(Text, new LayoutOptions { MinVersion = 5, Background = "#eee", Logo = new LogoOptions { Href = Href } }).Logo!.Background);
            Assert.Equal("transparent", Layout.Compute(Text, new LayoutOptions { MinVersion = 5, Logo = new LogoOptions { Href = Href, Background = "transparent" } }).Logo!.Background);
        }

        [Fact]
        public void MarginBounds()
        {
            Layout.Compute(Text, new LayoutOptions { Margin = 0 });
            Layout.Compute(Text, new LayoutOptions { Margin = 16 });
            Assert.Equal("Option margin must be an integer 0–16.", Message(() => Layout.Compute(Text, new LayoutOptions { Margin = 17 })));
            Message(() => Layout.Compute(Text, new LayoutOptions { Margin = -1 }));
        }

        [Fact]
        public void ColourMessages()
        {
            Assert.Equal(
                "Foreground #ffffff must be darker than background #ffffff with contrast ≥ 4.5:1; light or inverted QR codes fail in many banking apps.",
                Message(() => Layout.Compute(Text, new LayoutOptions { Foreground = "#ffffff" })));
            Assert.Equal("Colour \"red\" must be #rgb or #rrggbb.", Message(() => Layout.Compute(Text, new LayoutOptions { Foreground = "red" })));
        }

        [Fact]
        public void TransparentBackgroundSkipsTheContrastCheck()
        {
            Layout.Compute(Text, new LayoutOptions { Foreground = "#ffffff", Background = "transparent" });
            Message(() => Layout.Compute(Text, new LayoutOptions { Foreground = "red", Background = "transparent" }));
        }

        [Fact]
        public void ForegroundMustBeDarkerEvenWithEnoughContrast()
        {
            Message(() => Layout.Compute(Text, new LayoutOptions { Foreground = "#ffffff", Background = "#000000" }));
        }

        public static IEnumerable<object?[]> Bad()
        {
            yield return new object?[] { "margin 17", new LayoutOptions { Margin = 17 }, Text };
            yield return new object?[] { "light foreground", new LayoutOptions { Foreground = "#ffffff" }, Text };
            yield return new object?[] { "named colour", new LayoutOptions { Foreground = "red" }, Text };
            yield return new object?[] { "mask 9", new LayoutOptions { Mask = 9 }, Text };
            yield return new object?[] { "logo href javascript:", new LayoutOptions { Logo = new LogoOptions { Href = "javascript:x" } }, Text };
            yield return new object?[] { "logo size 0.3", new LayoutOptions { Logo = new LogoOptions { Href = Href, Size = 0.3 } }, Text };
            yield return new object?[] { "logo size 0", new LayoutOptions { Logo = new LogoOptions { Href = Href, Size = 0 } }, Text };
            yield return new object?[] { "logo size negative", new LayoutOptions { Logo = new LogoOptions { Href = Href, Size = -0.1 } }, Text };
            yield return new object?[] { "logo size NaN", new LayoutOptions { Logo = new LogoOptions { Href = Href, Size = double.NaN } }, Text };
            yield return new object?[] { "logo padding 9", new LayoutOptions { Logo = new LogoOptions { Href = Href, Padding = 9 } }, Text };
            yield return new object?[] { "logo padding -1", new LayoutOptions { Logo = new LogoOptions { Href = Href, Padding = -1 } }, Text };
            yield return new object?[] { "logo background red", new LayoutOptions { Logo = new LogoOptions { Href = Href, Background = "red" } }, Text };
            yield return new object?[] { "logo with ecc M", new LayoutOptions { Ecc = Ecc.M, Logo = new LogoOptions { Href = Href } }, Text };
            yield return new object?[] { "logo with ecc L", new LayoutOptions { Ecc = Ecc.L, Logo = new LogoOptions { Href = Href } }, Text };
            yield return new object?[] { "logo on version 1", new LayoutOptions { Logo = new LogoOptions { Href = Href } }, "a" };
            yield return new object?[] { "logo options before encoding", new LayoutOptions { Logo = new LogoOptions { Href = "javascript:x" } }, new string('a', 5000) };
            yield return new object?[] { "text too long", new LayoutOptions(), new string('a', 5000) };
        }

        [Theory]
        [MemberData(nameof(Bad))]
        public void BadOptionsAreInvalidValue(string name, object options, string text)
        {
            Assert.NotNull(name);
            Message(() => Layout.Compute(text, (LayoutOptions)options));
        }

        [Fact]
        public void LogoOptionsAreCheckedBeforeTheTextIsEncoded()
        {
            var big = new string('a', 5000);
            Assert.Contains("href", Message(() => Layout.Compute(big, new LayoutOptions { Logo = new LogoOptions { Href = "javascript:x" } })));
            Assert.Contains("size must be", Message(() => Layout.Compute(big, new LayoutOptions { Logo = new LogoOptions { Href = Href, Size = 0.3 } })));
            Assert.Contains("padding must be", Message(() => Layout.Compute(big, new LayoutOptions { Logo = new LogoOptions { Href = Href, Padding = 9 } })));
            Assert.Contains("#rgb", Message(() => Layout.Compute(big, new LayoutOptions { Logo = new LogoOptions { Href = Href, Background = "red" } })));
        }

        [Fact]
        public void LogoEccMessage()
        {
            Assert.Equal(
                "A logo needs ECC H; got ecc 'M'. Leave ecc unset or pass 'H'.",
                Message(() => Layout.Compute(Text, new LayoutOptions { Ecc = Ecc.M, Logo = new LogoOptions { Href = Href } })));
        }

        [Fact]
        public void LogoSizeAndPaddingBoundsOnALargeCode()
        {
            Assert.Contains("size must be", Message(() => Layout.Compute(LogoText, new LayoutOptions { MinVersion = 40, Logo = new LogoOptions { Href = Href, Size = 0.26, Padding = 0 } })));
            Assert.Contains("padding must be", Message(() => Layout.Compute(LogoText, new LayoutOptions { MinVersion = 40, Logo = new LogoOptions { Href = Href, Size = 0.05, Padding = 5 } })));
            Assert.NotNull(Layout.Compute(LogoText, new LayoutOptions { MinVersion = 40, Logo = new LogoOptions { Href = Href, Size = 0.05, Padding = 4 } }).Logo);
            Assert.NotNull(Layout.Compute(LogoText, new LayoutOptions { MinVersion = 10, Logo = new LogoOptions { Href = Href, Size = 0.25, Padding = 0 } }).Logo);
        }

        [Fact]
        public void CheckOptionsRunsTheTextIndependentChecks()
        {
            Layout.CheckOptions(new LayoutOptions());
            Message(() => Layout.CheckOptions(new LayoutOptions { Margin = 17 }));
            Message(() => Layout.CheckOptions(new LayoutOptions { Foreground = "#fff" }));
            Message(() => Layout.CheckOptions(new LayoutOptions { Mask = 9 }));
            Message(() => Layout.CheckOptions(new LayoutOptions { MinVersion = 5, MaxVersion = 4 }));
            Message(() => Layout.CheckOptions(new LayoutOptions { Ecc = Ecc.M, Logo = new LogoOptions { Href = Href } }));
            Layout.CheckOptions(new LayoutOptions { Logo = new LogoOptions { Href = Href } });
        }
    }
}
