using System;
using Xunit;

namespace TingQR.Rendering.Tests
{
    public class ColorTests
    {
        private static int[] Parse(string hex)
        {
            var c = Color.ParseHex(hex);
            return new[] { c.R, c.G, c.B };
        }

        [Fact]
        public void ParsesShortAndLongForms()
        {
            Assert.Equal(new[] { 255, 255, 255 }, Parse("#fff"));
            Assert.Equal(new[] { 26, 43, 60 }, Parse("#1A2b3C"));
            Assert.Equal(new[] { 0, 0, 0 }, Parse("#000"));
        }

        // color.ts accepts the 3-digit form and doubles each digit; case does not matter.
        [Theory]
        [InlineData("#FFF")]
        [InlineData("#fff")]
        [InlineData("#ffffff")]
        [InlineData("#FfFfFf")]
        public void HexCaseAndShortForm(string hex)
        {
            Assert.Equal(new[] { 255, 255, 255 }, Parse(hex));
        }

        [Fact]
        public void ShortFormDoublesEachDigit()
        {
            Assert.Equal(new[] { 0x11, 0x22, 0x33 }, Parse("#123"));
            Assert.Equal(Parse("#aabbcc"), Parse("#ABC"));
        }

        [Theory]
        [InlineData("fff")]
        [InlineData("#ffff")]
        [InlineData("red")]
        [InlineData("#ggg")]
        [InlineData("#fff\" onload=\"x")]
        [InlineData("")]
        [InlineData("#12345")]
        [InlineData("#1234567")]
        [InlineData("x#fff")]
        [InlineData("#fff\n")]
        [InlineData(null)]
        public void RejectsBadColours(string? value)
        {
            var e = Assert.Throws<TingQrException>(() => Color.ParseHex(value));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        }

        [Fact]
        public void MessageQuotesTheValueLikeJson()
        {
            var e = Assert.Throws<TingQrException>(() => Color.ParseHex("a\"b\\c\n\u0001"));
            Assert.Equal("Colour \"a\\\"b\\\\c\\n\\u0001\" must be #rgb or #rrggbb.", e.Message);
            Assert.Equal("Colour \"red\" must be #rgb or #rrggbb.", Assert.Throws<TingQrException>(() => Color.ParseHex("red")).Message);
        }

        [Fact]
        public void QuoteEscapesLikeJsonStringify()
        {
            Assert.Equal("\"\\b\\f\\r\\t\"", Color.Quote("\b\f\r\t"));
            Assert.Equal("\"\\ud800\"", Color.Quote("\ud800"));
            Assert.Equal("\"\\udc00\"", Color.Quote("\udc00"));
            Assert.Equal("\"\ud83d\ude00é\"", Color.Quote("\ud83d\ude00é"));
        }

        // node: toSvg('A', { foreground: ' ' }) throws 'Colour " " must be #rgb or #rrggbb.' (U+0020 is not escaped;
        // only characters below it are).
        [Fact]
        public void QuoteLeavesSpaceAsIs()
        {
            Assert.Equal("\" \"", Color.Quote(" "));
            Assert.Equal("\"\\u001f \"", Color.Quote("\u001f "));
        }

        private static readonly Rgb Black = new Rgb(0, 0, 0);
        private static readonly Rgb White = new Rgb(255, 255, 255);

        [Fact]
        public void WcagContrastRatio()
        {
            Assert.Equal(21, Color.ContrastRatio(Black, White), 5);
            Assert.Equal(21, Color.ContrastRatio(White, Black), 5);
            Assert.Equal(1, Color.ContrastRatio(White, White));
            Assert.True(Color.ContrastRatio(new Rgb(0x77, 0x77, 0x77), White) < 4.5);
            Assert.True(Color.ContrastRatio(new Rgb(0x76, 0x76, 0x76), White) >= 4.5);
        }

        // Real TS values, from this script (node 22; contrastRatio is not exported by dist, so the formula of color.ts is
        // repeated, and toSvg of the built dist confirms the verdict):
        //   node /tmp/c.mjs  (imports file:///.../ts/packages/render/dist/index.js)
        //   76 4.542224959605253 accepted      (toSvg('A', { foreground: '#767676' }))
        //   77 4.478089453577214 rejected      (toSvg('A', { foreground: '#777777' }))
        //   20.381370411830552 21 0.0015176349177441874   (#050505 on white, #000 on white, luminance of #050505)
        [Fact]
        public void ContrastAtThreshold()
        {
            var above = Color.ContrastRatio(new Rgb(0x76, 0x76, 0x76), White);
            var below = Color.ContrastRatio(new Rgb(0x77, 0x77, 0x77), White);
            Assert.Equal(4.542224959605253, above, 12);
            Assert.Equal(4.478089453577214, below, 12);
            Layout.CheckColours("#767676", "#ffffff");
            var e = Assert.Throws<TingQrException>(() => Layout.CheckColours("#777777", "#ffffff"));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        }

        [Fact]
        public void DarkChannelsUseTheLinearSegment()
        {
            // #050505: channel 5/255 is below 0.03928, so it is divided by 12.92 (luminance ≈ 0.00152).
            Assert.Equal(0.0015176349177441874, Color.Luminance(new Rgb(5, 5, 5)), 12);
            Assert.Equal(20.381370411830552, Color.ContrastRatio(new Rgb(5, 5, 5), White), 9);
        }

        // Channel 10 is the last on the linear segment (10/255 ≈ 0.0392 ≤ 0.03928). node, color.ts's formula:
        //   s=10/255: s/12.92 = 0.003035269835488375, ((s+0.055)/1.055)**2.4 = 0.0030345186784249568
        //   luminance of #0a0a0a = 0.003035269835488375
        [Fact]
        public void ChannelTenIsTheLastOnTheLinearSegment()
        {
            Assert.Equal(0.003035269835488375, Color.Luminance(new Rgb(10, 10, 10)), 15);
            Assert.NotEqual(0.0030345186784249568, Color.Luminance(new Rgb(10, 10, 10)), 15);
        }
    }
}
