using System.Text.RegularExpressions;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    public class CrcTests
    {
        // vietnam-qr-pay README sample (MIT, https://github.com/xuannghia/vietnam-qr-pay)
        private const string SampleBody = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304";

        [Fact]
        public void MatchesTheCheckValue() => Assert.Equal("29B1", Crc16.Compute("123456789"));

        [Fact]
        public void MatchesPublishedVietQrSample() => Assert.Equal("AE9F", Crc16.Compute(SampleBody));

        [Fact]
        public void EmptyInputIsTheInitialValue() => Assert.Equal("FFFF", Crc16.Compute(""));

        [Fact]
        public void ALoneSurrogateCountsAsReplacementCharacter() => Assert.Equal(Crc16.Compute("a�b"), Crc16.Compute("a\uD800b"));

        [Fact]
        public void AlwaysFourUppercaseHexDigitsZeroPadded()
        {
            var n = 1;
            while (!Crc16.Compute(new string('A', n)).StartsWith("0", System.StringComparison.Ordinal) && n < 100000) n++;
            Assert.Matches(new Regex("^0[0-9A-F]{3}$"), Crc16.Compute(new string('A', n)));
        }

        [Fact]
        public void RunsOverUtf8BytesNotUtf16Units()
        {
            Assert.Equal("4426", Crc16.Compute("Đ"));
            Assert.NotEqual("F3C1", Crc16.Compute("Đ"));
        }

        [Fact]
        public void EncodesThreeAndFourByteCharacters()
        {
            Assert.Equal("F1F1", Crc16.Compute("ក"));
            Assert.Equal("4F4F", Crc16.Compute("\U0001F600"));
        }

        [Fact]
        public void EncodesLoneSurrogateAsReplacementCharacter()
        {
            Assert.Equal("38D9", Crc16.Compute("\uD800"));
            Assert.Equal("38D9", Crc16.Compute("\uDC00"));
        }

        [Theory]
        [InlineData(0x7F, "6E88")]
        [InlineData(0x80, "FCB1")]
        [InlineData(0x7FF, "4E22")]
        [InlineData(0x800, "E05B")]
        [InlineData(0xD7FF, "701D")]
        [InlineData(0xE000, "FDBC")]
        [InlineData(0xFFFF, "189B")]
        [InlineData(0x10000, "E9A4")]
        public void CorrectAtUtf8EncodingBoundaries(int codePoint, string expected)
            => Assert.Equal(expected, Crc16.Compute(char.ConvertFromUtf32(codePoint)));

        [Fact]
        public void LoneLowSurrogateAtTheTopOfTheRange() => Assert.Equal("38D9", Crc16.Compute("\uDFFF"));
    }
}
