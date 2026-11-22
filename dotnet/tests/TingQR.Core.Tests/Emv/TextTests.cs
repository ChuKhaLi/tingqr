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
    }
}
