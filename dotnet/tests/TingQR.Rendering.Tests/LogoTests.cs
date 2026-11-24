using System;
using Xunit;

namespace TingQR.Rendering.Tests
{
    public class LogoTests
    {
        private static TingQrException Fails(Action action)
        {
            var e = Assert.Throws<TingQrException>(action);
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            return e;
        }

        [Fact]
        public void Version5Box()
        {
            Assert.Equal(new LogoBox(14, 9, 13, 11), Logo.Box(37, 0.2, 1));
        }

        [Fact]
        public void Version3Box()
        {
            Assert.Equal(new LogoBox(11, 7, 10, 9), Logo.Box(29, 0.2, 1));
        }

        [Fact]
        public void LogoSideHasTheParityOfTheMatrix()
        {
            foreach (var size in new[] { 21, 25, 29, 57 })
            {
                foreach (var s in new[] { 0.05, 0.1, 0.17, 0.25 })
                {
                    Assert.Equal(size % 2, Logo.Box(size, s, 0).LogoSide % 2);
                }
            }
        }

        [Fact]
        public void Constants()
        {
            Assert.Equal(0.1, Logo.MaxClearedShare);
            Assert.Equal(9, Logo.MinClearStart);
        }

        [Fact]
        public void NinePointSixPercentAndClearStart10IsAccepted()
        {
            Logo.CheckBox(29, Logo.Box(29, 0.2, 1));
        }

        [Fact]
        public void AboveTenPercentIsRejected()
        {
            Fails(() => Logo.CheckBox(33, Logo.Box(33, 0.2, 2)));
        }

        [Fact]
        public void Version1WithDefaultsIsRejected()
        {
            Fails(() => Logo.CheckBox(21, Logo.Box(21, 0.2, 1)));
        }

        [Fact]
        public void BoxReachingRow8IsRejectedAndRow9Accepted()
        {
            Fails(() => Logo.CheckBox(21, Logo.Box(21, 0.2, 0))); // 5x5 at 8
            Logo.CheckBox(21, Logo.Box(21, 0.1, 0)); // 3x3 at 9, 2% of the area
        }

        [Fact]
        public void MessagesGiveTheNumbersAndAWayOut()
        {
            Assert.Equal(
                "Logo area is 11.1% of the code (max 10%); use a smaller logo size or padding, or a larger minVersion.",
                Fails(() => Logo.CheckBox(33, Logo.Box(33, 0.2, 2))).Message);
            Assert.Equal(
                "Logo area reaches the finder, format or timing modules of this 21×21 code; use a smaller logo size or padding, or a larger minVersion.",
                Fails(() => Logo.CheckBox(21, Logo.Box(21, 0.2, 0))).Message);
        }

        [Theory]
        [InlineData("data:image/png;base64,AAAA")]
        [InlineData("data:image/svg+xml,<svg/>")]
        [InlineData("data:image/jpeg;base64,x")]
        [InlineData("data:image/webp;base64,x")]
        [InlineData("https://x.vn/a.png")]
        [InlineData("http://x.vn/a.png")]
        [InlineData("logo.svg")]
        [InlineData("img/logo.png")]
        [InlineData("./a.png")]
        [InlineData("../a.png?v=1#x")]
        public void AcceptsSafeHrefs(string href)
        {
            Assert.Equal(href, Logo.CheckHref(href));
        }

        [Theory]
        [InlineData("javascript:alert(1)")]
        [InlineData("JAVASCRIPT:x")]
        [InlineData("data:text/html,x")]
        [InlineData("data:image/gif;base64,x")]
        [InlineData("//evil.com/a.png")]
        [InlineData("vbscript:x")]
        [InlineData(" javascript:x")]
        [InlineData("")]
        [InlineData("a:b/c")]
        [InlineData("file:///etc/passwd")]
        [InlineData("javascript:alert(1)//https://x.vn/a.png")]
        [InlineData("javascript:x//data:image/png;base64,AAAA")]
        [InlineData("x data:image/png,AA")]
        [InlineData("/\\evil.example/x.png")]
        [InlineData("\\\\evil.example/x.png")]
        [InlineData("img\\logo.png")]
        [InlineData("https:\\\\evil.example/x.png")]
        [InlineData(" logo.png")]
        [InlineData(null)]
        public void RejectsUnsafeHrefs(string? href)
        {
            Fails(() => Logo.CheckHref(href));
        }

        // Ends of the ranges in JavaScript's /\s/, checked against the built dist (node 22):
        // toSvg('https://x.vn', { minVersion: 10, logo: { href } }) rejects \t, \r, U+2000 and U+200A before 'logo.png'
        // and accepts U+0008, U+000E, U+1FFF and U+200B.
        [Theory]
        [InlineData("\tlogo.png")]
        [InlineData("\rlogo.png")]
        [InlineData("\u2000logo.png")]
        [InlineData("\u200Alogo.png")]
        public void RejectsLeadingWhitespaceAtTheEndsOfJsRanges(string href)
        {
            Fails(() => Logo.CheckHref(href));
        }

        [Theory]
        [InlineData("\u0008logo.png")]
        [InlineData("\u000Elogo.png")]
        [InlineData("\u1FFFlogo.png")]
        [InlineData("\u200Blogo.png")]
        public void AcceptsCharactersJustOutsideJsWhitespace(string href)
        {
            Assert.Equal(href, Logo.CheckHref(href));
        }

        [Fact]
        public void RelativePathMustNotEndInANewlineTrick()
        {
            // JavaScript's $ matches only at the very end; the port uses \z, so a trailing newline changes nothing.
            Assert.Equal("logo.png\n", Logo.CheckHref("logo.png\n"));
            Assert.Equal("data:image/png,A", Logo.CheckHref("data:image/png,A"));
        }

        [Fact]
        public void LeadingJsWhitespaceIsRejectedButNel()
        {
            // JavaScript's \s includes U+FEFF and U+00A0 and excludes U+0085.
            Fails(() => Logo.CheckHref((char)0xFEFF + "logo.png"));
            Fails(() => Logo.CheckHref((char)0xA0 + "logo.png"));
            Fails(() => Logo.CheckHref((char)0x2003 + "logo.png"));
            var nel = (char)0x85 + "logo.png";
            Assert.Equal(nel, Logo.CheckHref(nel));
        }

        [Fact]
        public void HrefMessage()
        {
            Assert.Equal(
                "Logo href must be a data:image/(png|jpeg|webp|svg+xml) URI, an http(s) URL or a relative path.",
                Fails(() => Logo.CheckHref("javascript:x")).Message);
        }

        [Fact]
        public void LogoOptionsDefaultsAreNull()
        {
            var o = new LogoOptions { Href = "a.png" };
            Assert.Null(o.Size);
            Assert.Null(o.Padding);
            Assert.Null(o.Background);
        }
    }
}
