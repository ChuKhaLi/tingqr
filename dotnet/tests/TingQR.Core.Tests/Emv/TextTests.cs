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
