using Xunit;

namespace TingQR.Tests
{
    public class TextTests
    {
        [Fact]
        public void StripsToneAndVowelMarks()
            => Assert.Equal("Chuyen tien Da Nang", VietnameseText.RemoveAccents("Chuyển tiền Đà Nẵng"));

        [Fact]
        public void MapsDStroke() => Assert.Equal("dD", VietnameseText.RemoveAccents("đĐ"));

        [Fact]
        public void LeavesAsciiUnchanged() => Assert.Equal("TINGQR TEST 123 -_.", VietnameseText.RemoveAccents("TINGQR TEST 123 -_."));

        [Fact]
        public void LeavesNonLatinScriptsIntact()
        {
            Assert.Equal("ที่", VietnameseText.RemoveAccents("ที่"));
            var korean = VietnameseText.RemoveAccents("한국");
            Assert.Equal("한국", korean);
            Assert.Equal(2, korean.Length);
        }

        [Fact]
        public void HandlesHornLettersAndReturnsNfc()
        {
            Assert.Equal("Thuong Tet oi", VietnameseText.RemoveAccents("Thưởng Tết ơi"));
            Assert.Equal("Cafe", VietnameseText.RemoveAccents("Café"));
        }

        // xUnit's theory serialisation turns a lone surrogate into U+FFFD, so the data is written escaped.
        private static string Unescape(string escaped) => System.Text.RegularExpressions.Regex.Unescape(escaped);

        // Expected values: removeVietnameseAccents of @tingqr/core on Node 22.23.3 (2026-11-25), whose
        // String.prototype.normalize keeps a lone surrogate as it is and normalises the text around it.
        [Theory]
        [InlineData(@"\uD800", @"\uD800")]
        [InlineData(@"\uDC00", @"\uDC00")]
        [InlineData(@"Ti\u1EC1n\uD800 \u0111i\u1EC7n", @"Tien\uD800 dien")]
        [InlineData(@"\u0110\u1EA1i\uDC00h\u1ECDc", @"Dai\uDC00hoc")]
        [InlineData(@"a\uD800\u0301b", @"a\uD800\u0301b")]
        [InlineData(@"\uDC00\u0301", @"\uDC00\u0301")]
        [InlineData(@"Vi\u1EC7t\uD83D", @"Viet\uD83D")]
        [InlineData(@"\uDE00\uD83D", @"\uDE00\uD83D")]
        [InlineData(@"e\uD800\u0301", @"e\uD800\u0301")]
        [InlineData(@"c\u00E0 ph\u00EA \uD83D\uDE00", @"ca phe \uD83D\uDE00")]
        public void KeepsLoneSurrogatesLikeJavaScript(string input, string expected)
            => Assert.Equal(Unescape(expected), VietnameseText.RemoveAccents(Unescape(input)));

        // A combining mark outside the BMP (U+1D167, a surrogate pair) after a Latin letter: JS's /\p{M}/u matches
        // it, so it goes; after a lone surrogate it stays. Same Node run as above.
        [Theory]
        [InlineData(@"a\uD834\uDD67b", @"ab")]
        [InlineData(@"\uD800\uD834\uDD67", @"\uD800\uD834\uDD67")]
        [InlineData(@"A\u0301\uD834\uDD67\u0300", @"A")]
        // Not Latin, so the marks stay: the pair (ccc 1) is reordered before U+0301 (ccc 230), which then composes
        // with alpha. A valid pair must not split the text into separately normalised runs.
        [InlineData(@"\u03B1\uD834\uDD67\u0301", @"\u03AC\uD834\uDD67")]
        [InlineData(@"\u03B1\u0301\uD834\uDD67", @"\u03AC\uD834\uDD67")]
        public void RemovesSupplementaryMarksLikeJavaScript(string input, string expected)
            => Assert.Equal(Unescape(expected), VietnameseText.RemoveAccents(Unescape(input)));

        // Edges of [A-Za-z], the three mark categories (Mn, Me U+20DD, Mc U+0903), đ followed by a mark (not stripped,
        // as in JS where đ→d happens after the marks go) and NFC recomposition on another script. Expected values:
        // removeVietnameseAccents of @tingqr/core on Node 22.23.3 (2026-11-25).
        [Theory]
        [InlineData(@"Ẑẑ", @"Zz")]
        [InlineData(@"Áá", @"Aa")]
        [InlineData(@"@́[́`́{́", @"@́[́`́{́")]
        [InlineData(@"a⃝", @"a")]
        [InlineData(@"aः", @"a")]
        [InlineData(@"đ́", @"d́")]
        [InlineData(@"ά", @"ά")]
        public void MatchesJavaScriptAtTheEdges(string input, string expected)
            => Assert.Equal(Unescape(expected), VietnameseText.RemoveAccents(Unescape(input)));

        // TS throws TypeError for a non-string; both are programming errors (conformance/README.md).
        [Fact]
        public void NullThrowsArgumentNullException()
            => Assert.Equal("s", Assert.Throws<System.ArgumentNullException>(() => VietnameseText.RemoveAccents(null!)).ParamName);

        [Fact]
        public void CodePointsCountsSurrogatePairAsOne()
        {
            Assert.Equal(2, CodePoints.Count("a\U0001F600"));
            Assert.Equal(8, CodePoints.Count("ចន ស្មីន"));
        }

        [Fact]
        public void LoneSurrogatesCountOneEachAndStaySeparateInSplit()
        {
            Assert.Equal(2, CodePoints.Count("a\uD83D"));
            Assert.Equal(2, CodePoints.Count("\uD83D\uD83D"));
            Assert.Equal(2, CodePoints.Count("\uDE00\uD83D"));
            Assert.Equal(new[] { "a", "\uD83D" }, CodePoints.Split("a\uD83D"));
            Assert.Equal(new[] { "\uD83D", "\uD83D" }, CodePoints.Split("\uD83D\uD83D"));
            Assert.Equal(new[] { "\uDE00", "\uD83D" }, CodePoints.Split("\uDE00\uD83D"));
            Assert.Equal(new[] { "a", "\U0001F600", "b" }, CodePoints.Split("a\U0001F600b"));
        }

        [Fact]
        public void AmountHashFollowsEquality()
        {
            Assert.Equal(new QrAmount("20000").GetHashCode(), new QrAmount("20000").GetHashCode());
            Assert.NotEqual(new QrAmount("20000").GetHashCode(), new QrAmount("20001").GetHashCode());
            Assert.NotEqual(new QrAmount(20000L).GetHashCode(), new QrAmount("20000").GetHashCode());
            Assert.NotEqual(default(QrAmount).GetHashCode(), new QrAmount("20000").GetHashCode());
            Assert.Equal(default(QrAmount).GetHashCode(), default(QrAmount).GetHashCode());
            Assert.True(new QrAmount(5L).IsNumber);
            Assert.False(new QrAmount("5").IsNumber);
        }

        [Fact]
        public void NodeHashFollowsChildren()
        {
            var a = new Emv.TlvNode("26", "x", new[] { new Emv.TlvNode("00", "a"), new Emv.TlvNode("01", "b") });
            var same = new Emv.TlvNode("26", "x", new[] { new Emv.TlvNode("00", "a"), new Emv.TlvNode("01", "b") });
            var swapped = new Emv.TlvNode("26", "x", new[] { new Emv.TlvNode("01", "b"), new Emv.TlvNode("00", "a") });
            var none = new Emv.TlvNode("26", "x");
            Assert.True(a.Equals((object)a));
            Assert.Equal(a.GetHashCode(), same.GetHashCode());
            Assert.NotEqual(a.GetHashCode(), swapped.GetHashCode());
            Assert.NotEqual(a.GetHashCode(), none.GetHashCode());
            Assert.Equal((a.Tag, a.Value).GetHashCode(), none.GetHashCode());
        }
    }
}
