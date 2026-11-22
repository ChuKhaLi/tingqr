using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    public class PayloadTests
    {
        // vietnam-qr-pay README sample (MIT, https://github.com/xuannghia/vietnam-qr-pay)
        private const string S = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";

        private static List<TingQrWarningCode> Codes(TingQrResult<EmvPayload> r) => r.Warnings.Select(w => w.Code).ToList();

        private static TingQrException Fail(TingQrResult<EmvPayload> r)
        {
            Assert.False(r.Ok);
            return r.Error!;
        }

        [Fact]
        public void BuildAppends6304AndTheCrc()
        {
            var fields = Tlv.Parse(S).Where(f => f.Tag != "63").Cast<TlvField>();
            Assert.Equal(S, EmvPayloads.Build(fields));
        }

        [Fact]
        public void ReadsAValidPayloadWithoutWarnings()
        {
            var r = EmvPayloads.Parse(S);
            Assert.True(r.Ok);
            var p = r.Value!;
            Assert.Equal("AE9F", p.Crc);
            Assert.Equal(S, p.Raw);
            Assert.Equal(new[] { "00", "01", "38", "53", "58", "63" }, p.Fields.Select(f => f.Tag).ToArray());
            Assert.Equal("VN", EmvPayloads.GetField(p, "58")!.Value);
            Assert.Null(EmvPayloads.GetField(p, "54"));
            Assert.Empty(r.Warnings);
        }

        [Theory]
        [InlineData("\r\n", "")]
        [InlineData("", "  ")]
        [InlineData(" ", "\t")]
        public void TrimsWhitespaceAndWarns(string after, string before)
        {
            var r = EmvPayloads.Parse(before + S + after);
            Assert.True(r.Ok);
            Assert.Equal(new[] { TingQrWarningCode.TrimmedWhitespace }, Codes(r));
            Assert.Equal(S, r.Value!.Raw);
        }

        [Theory]
        [InlineData("﻿", "")]
        [InlineData("", " ")]
        [InlineData("\r\n", "﻿ ")]
        public void StripsBomAndNoBreakSpacesAndWarns(string after, string before)
        {
            var r = EmvPayloads.Parse(before + S + after);
            Assert.True(r.Ok);
            Assert.Equal(new[] { TingQrWarningCode.TrimmedWhitespace }, Codes(r));
            Assert.Equal(S, r.Value!.Raw);
        }

        [Fact]
        public void AcceptsLowercaseCrcAndWarns()
        {
            var r = EmvPayloads.Parse(S.Substring(0, S.Length - 4) + "ae9f");
            Assert.True(r.Ok);
            Assert.Equal(new[] { TingQrWarningCode.LowercaseCrc }, Codes(r));
            Assert.Equal("AE9F", r.Value!.Crc);
        }

        [Fact]
        public void ReportsCrcMismatch() => Assert.Equal(TingQrErrorCode.CrcMismatch, Fail(EmvPayloads.Parse(S.Substring(0, S.Length - 1) + "0")).Code);

        [Fact]
        public void ReportsCrcMissingWithoutTag63() => Assert.Equal(TingQrErrorCode.CrcMissing, Fail(EmvPayloads.Parse(S.Substring(0, S.Length - 8))).Code);

        [Fact]
        public void ReportsCrcMissingWhenTag63IsNotLast() => Assert.Equal(TingQrErrorCode.CrcMissing, Fail(EmvPayloads.Parse(S + "0002AB")).Code);

        [Fact]
        public void WrapsTlvErrorsIntoAResult() => Assert.Equal(TingQrErrorCode.Truncated, Fail(EmvPayloads.Parse("0002")).Code);

        [Fact]
        public void RejectsADuplicatedTopLevelTag()
        {
            var fields = Tlv.Parse(S).Where(f => f.Tag != "63").Cast<TlvField>().Concat(new[] { new TlvField("58", "TH") });
            var e = Fail(EmvPayloads.Parse(EmvPayloads.Build(fields)));
            Assert.Equal(TingQrErrorCode.DuplicateTag, e.Code);
            Assert.Equal("58", e.Tag);
        }

        [Theory]
        [InlineData("6302\U0001F600\U0001F600")]
        [InlineData("6304GGGG")]
        [InlineData("6304AE9-")]
        [InlineData("6305XAE9F")]
        [InlineData("6305AE9FX")]
        public void ReportsCrcMissingWhenTag63IsNotFourHexDigits(string tail)
            => Assert.Equal(TingQrErrorCode.CrcMissing, Fail(EmvPayloads.Parse(S.Substring(0, S.Length - 8) + tail)).Code);

        [Fact]
        public void ReportsCrcMissingWhenLastFieldIsHexButNotTag63()
            => Assert.Equal(TingQrErrorCode.CrcMissing, Fail(EmvPayloads.Parse(S + "0004ABCD")).Code);

        [Fact]
        public void ParseNullIsInvalidValue()
        {
            var r = EmvPayloads.Parse(null);
            Assert.False(r.Ok);
            Assert.Equal(TingQrErrorCode.InvalidValue, r.Error!.Code);
        }

        [Fact]
        public void ParseEmptyIsCrcMissing() => Assert.Equal(TingQrErrorCode.CrcMissing, Fail(EmvPayloads.Parse("")).Code);

        [Fact]
        public void ReadAdditionalDataKeysBySubTag()
        {
            var body = EmvPayloads.Build(new[] { new TlvField("00", "01"), new TlvField("62", "0103ABC0502XY") });
            var p = EmvPayloads.Parse(body).Value!;
            var d = Fields.ReadAdditionalData(p)!;
            Assert.Equal("ABC", d["01"]);
            Assert.Equal("XY", d["05"]);
            Assert.Null(Fields.ReadAdditionalData(EmvPayloads.Parse(S).Value!));
        }

        [Fact]
        public void ReadExtraFieldsReturnsUninterpretedTags()
        {
            var p = EmvPayloads.Parse(S).Value!;
            var extra = Fields.ReadExtraFields(p, new HashSet<string> { "00", "01", "38", "53", "58", "63" });
            Assert.Null(extra);
            extra = Fields.ReadExtraFields(p, new HashSet<string> { "00", "01", "38", "53", "63" })!;
            Assert.Equal("VN", extra["58"]);
            Assert.Single(extra);
        }

        [Fact]
        public void ReadSchemeTemplateMatchesGuidCaseInsensitively()
        {
            var p = EmvPayloads.Parse(S).Value!;
            Assert.NotNull(Fields.ReadSchemeTemplate(p, "38", "A000000727"));
            Assert.Null(Fields.ReadSchemeTemplate(p, "38", "A000000999"));
            Assert.Null(Fields.ReadSchemeTemplate(p, "26", "A000000727"));
        }

        [Fact]
        public void ReadSchemeTemplateIgnoresMalformedTemplateOfAnotherScheme()
        {
            var p = EmvPayloads.Parse(EmvPayloads.Build(new[] { new TlvField("38", "00") })).Value!;
            Assert.Null(Fields.ReadSchemeTemplate(p, "38", "A000000727"));
        }

        [Fact]
        public void ReadSchemeTemplateReportsDuplicateSubTagOnceGuidMatches()
        {
            var p = EmvPayloads.Parse(EmvPayloads.Build(new[] { new TlvField("38", "0004ABCD0102xx0102yy") })).Value!;
            var e = Assert.Throws<TingQrException>(() => Fields.ReadSchemeTemplate(p, "38", "ABCD"));
            Assert.Equal(TingQrErrorCode.DuplicateTag, e.Code);
            Assert.Equal("38.01", e.Tag);
        }
    }
}
