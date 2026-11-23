using System;
using System.Linq;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    public class TlvTests
    {
        private const string Sample = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";

        private static TingQrException Thrown(Action a) => Assert.Throws<TingQrException>(a);

        private static void AssertFields(string[] expected, System.Collections.Generic.IReadOnlyList<TlvNode> actual)
            => Assert.Equal(expected, actual.Select(f => f.Tag + "=" + f.Value).ToArray());

        [Fact]
        public void FieldWritesTagLengthAndValue() => Assert.Equal("000201", Tlv.Field("00", "01"));

        [Fact]
        public void FieldAcceptsExactly99Characters() => Assert.Equal(103, Tlv.Field("62", new string('x', 99)).Length);

        [Fact]
        public void FieldRejects100CharactersOnThatTag()
        {
            var e = Thrown(() => Tlv.Field("62", new string('x', 100)));
            Assert.Equal(TingQrErrorCode.FieldTooLong, e.Code);
            Assert.Equal("62", e.Tag);
        }

        [Fact]
        public void FieldCountsCharactersNotBytes() => Assert.Equal("5902Đà", Tlv.Field("59", "Đà"));

        [Fact]
        public void FieldCountsSurrogatePairAsOne()
        {
            Assert.Equal("5999" + new string('x', 98) + "\U0001F600", Tlv.Field("59", new string('x', 98) + "\U0001F600"));
        }

        [Fact]
        public void ParseSplitsTopLevelFields() => AssertFields(new[] { "00=01", "01=11" }, Tlv.Parse("000201010211"));

        [Fact]
        public void ParseRejectsNonNumericLength() => Assert.Equal(TingQrErrorCode.BadLength, Thrown(() => Tlv.Parse("00AB01")).Code);

        [Fact]
        public void ParseRejectsLengthPastTheEnd() => Assert.Equal(TingQrErrorCode.Truncated, Thrown(() => Tlv.Parse("000501")).Code);

        [Fact]
        public void ParseCountsCharactersForNonAsciiValues()
            => AssertFields(new[] { "59=Đà", "00=AB" }, Tlv.Parse("5902Đà0002AB"));

        [Fact]
        public void EncodeFieldsOfParseRoundTripsPublishedSample()
        {
            var fields = Tlv.Parse(Sample);
            Assert.Equal(new[] { "00", "01", "38", "53", "58", "63" }, fields.Select(f => f.Tag).ToArray());
            Assert.Equal(Sample, Tlv.EncodeFields(fields));
        }

        [Fact]
        public void ParseRejectsNonDigitTagWithBadTag()
        {
            Assert.Equal(TingQrErrorCode.BadTag, Thrown(() => Tlv.Parse("AB02xx")).Code);
            Assert.Equal(TingQrErrorCode.BadTag, Thrown(() => Tlv.Parse("!!02xx")).Code);
            Assert.Equal(TingQrErrorCode.BadTag, Thrown(() => Tlv.Parse("0!02xx")).Code);
            Assert.Equal(TingQrErrorCode.BadTag, Thrown(() => Tlv.Parse("/:02xx")).Code);
            Assert.Equal(TingQrErrorCode.BadTag, Thrown(() => Tlv.Parse("\U0001F600\U0001F60002xx")).Code);
        }

        [Fact]
        public void ParseReportsTruncatedForCutOffHeader()
        {
            Assert.Equal(TingQrErrorCode.Truncated, Thrown(() => Tlv.Parse("00")).Code);
            Assert.Equal(TingQrErrorCode.Truncated, Thrown(() => Tlv.Parse("000")).Code);
            Assert.Equal(TingQrErrorCode.Truncated, Thrown(() => Tlv.Parse("0002AB01")).Code);
        }

        [Fact]
        public void ParseAcceptsEmptyFieldAtTheEnd() => AssertFields(new[] { "00=" }, Tlv.Parse("0000"));

        [Fact]
        public void ParseTemplateRejectsDuplicateSubTagWithPath()
        {
            var e = Thrown(() => Tlv.ParseTemplate("0002AB0002CD", "38"));
            Assert.Equal(TingQrErrorCode.DuplicateTag, e.Code);
            Assert.Equal("38.00", e.Tag);
        }

        [Fact]
        public void AssertUniqueTagsWithoutPathReportsBareTag()
        {
            var e = Thrown(() => Tlv.AssertUniqueTags(new[] { new TlvField("58", "VN"), new TlvField("58", "TH") }));
            Assert.Equal("58", e.Tag);
        }

        [Fact]
        public void TlvNodeEqualityComparesChildrenByValue()
        {
            var a = new TlvNode("38", "x", new[] { new TlvNode("00", "A") });
            var b = new TlvNode("38", "x", new[] { new TlvNode("00", "A") });
            var c = new TlvNode("38", "x", new[] { new TlvNode("00", "B") });
            Assert.Equal(a, b);
            Assert.Equal(a.GetHashCode(), b.GetHashCode());
            Assert.NotEqual(a, c);
            Assert.NotEqual(a, new TlvNode("38", "x"));
        }
    }
}
