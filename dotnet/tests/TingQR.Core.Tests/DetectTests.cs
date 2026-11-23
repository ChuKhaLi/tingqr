using System;
using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;
using TingQR.Tests.Conformance;
using Xunit;

namespace TingQR.Tests
{
    public class DetectTests
    {
        // promptparse@1.7.1 (MIT): PromptPay mobile.
        private const string PromptPay = "00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF";
        // vietnam-qr-pay README (MIT) VietQR and VNPAY samples.
        private const string VietQrSample = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";
        private const string VnpaySample =
            "00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685";

        private const string KhqrTag30 = "0009khqr@devb0106123456" + "0208Dev Bank";

        private static string Rebuild(string payload, Func<List<TlvField>, IEnumerable<TlvField>> edit)
        {
            var fields = EmvPayloads.Parse(payload).Value!.Fields
                .Where(f => f.Tag != "63").Select(f => new TlvField(f.Tag, f.Value)).ToList();
            return EmvPayloads.Build(edit(fields));
        }

        private static TlvField Tag26OfVnpay() =>
            EmvPayloads.Parse(VnpaySample).Value!.Fields.Where(f => f.Tag == "26").Select(f => new TlvField(f.Tag, f.Value)).Single();

        [Fact]
        public void DetectNullIsInvalidValue()
        {
            var r = TingQrDetector.Detect(null);
            Assert.False(r.Ok);
            Assert.Equal(TingQrErrorCode.InvalidValue, r.Error!.Code);
            Assert.Null(r.Error!.Tag);
        }

        [Fact]
        public void UnknownSchemeCarriesFields()
        {
            var payload = EmvPayloads.Build(new[]
            {
                new TlvField("00", "01"), new TlvField("01", "11"),
                new TlvField("29", Tlv.Field("00", "A000000999")), new TlvField("58", "TH"),
            });
            var r = TingQrDetector.Detect(payload);
            Assert.False(r.Ok);
            Assert.Equal(TingQrErrorCode.UnknownScheme, r.Error!.Code);
            Assert.NotEmpty(r.Error.Fields!);
            Assert.Equal(EmvPayloads.Parse(payload).Value!.Fields, r.Error.Fields);
        }

        [Fact]
        public void ResultCarriesSchemeDataReadLeniently()
        {
            var r = TingQrDetector.Detect(VnpaySample);
            Assert.True(r.Ok);
            Assert.Equal(QrScheme.Vnpay, r.Value!.Scheme);
            Assert.Empty(r.Value.AlsoMatches);
            Assert.Equal("0105313144", ((VnpayQrData)r.Value.Data).MerchantId);
            Assert.Equal(new[] { "52", "60" }, r.Warnings.Select(w => w.Tag).ToArray());
            var p = TingQrDetector.Detect(PromptPay);
            Assert.Equal(QrScheme.PromptPay, p.Value!.Scheme);
            Assert.IsType<PromptPayData>(p.Value.Data);
        }

        [Fact]
        public void VietQrAndVnpayTemplatesGiveVietQrAlsoMatchingVnpay()
        {
            var t26 = Tag26OfVnpay();
            var r = TingQrDetector.Detect(Rebuild(VietQrSample, f => f.Append(t26)));
            Assert.True(r.Ok);
            Assert.Equal(QrScheme.VietQr, r.Value!.Scheme);
            Assert.IsType<VietQrData>(r.Value.Data);
            Assert.Equal(new[] { QrScheme.Vnpay }, r.Value.AlsoMatches.ToArray());
        }

        [Fact]
        public void LaterSchemeThatRecognisesButRejectsStillCountsInAlsoMatches()
        {
            var r = TingQrDetector.Detect(Rebuild(VietQrSample, f => f.Append(new TlvField("26", Tlv.Field("00", "A000000775")))));
            Assert.True(r.Ok);
            Assert.Equal(QrScheme.VietQr, r.Value!.Scheme);
            Assert.Equal(new[] { QrScheme.Vnpay }, r.Value.AlsoMatches.ToArray());
        }

        [Fact]
        public void ErrorFromFirstRecognisingSchemeIsReturnedWithoutTryingOthers()
        {
            var t26 = Tag26OfVnpay();
            var broken = Rebuild(VietQrSample, f => f.Select(x => x.Tag == "38" ? new TlvField("38", Tlv.Field("00", "A000000727")) : x).Append(t26));
            var r = TingQrDetector.Detect(broken);
            Assert.False(r.Ok);
            Assert.Equal(TingQrErrorCode.MissingTag, r.Error!.Code);
            Assert.Equal("38.01", r.Error.Tag);
        }

        [Fact]
        public void CrcAndTlvErrorsPassThrough()
        {
            var crc = TingQrDetector.Detect(PromptPay.Substring(0, PromptPay.Length - 1) + "0");
            Assert.False(crc.Ok);
            Assert.Equal(TingQrErrorCode.CrcMismatch, crc.Error!.Code);
            Assert.Equal("63", crc.Error.Tag);
            var t = TingQrDetector.Detect("0002");
            Assert.False(t.Ok);
            Assert.Equal(TingQrErrorCode.Truncated, t.Error!.Code);
        }

        [Fact]
        public void WhitespaceWarningIsKeptOnce()
        {
            var r = TingQrDetector.Detect("  " + PromptPay + "\n");
            Assert.True(r.Ok);
            Assert.Equal(new[] { TingQrWarningCode.TrimmedWhitespace }, r.Warnings.Select(w => w.Code).ToArray());
        }

        [Fact]
        public void KhqrTag30InsideThaiCodeIsNotKhqr()
        {
            var r = TingQrDetector.Detect(Rebuild(PromptPay, f => f.Append(new TlvField("30", KhqrTag30))));
            Assert.True(r.Ok);
            Assert.Equal(QrScheme.PromptPay, r.Value!.Scheme);
            Assert.Empty(r.Value.AlsoMatches);
        }

        [Fact]
        public void WithoutTag58PromptPayComesFirstAndKhqrAlsoMatches()
        {
            var r = TingQrDetector.Detect(Rebuild(PromptPay, f => f.Where(x => x.Tag != "58").Append(new TlvField("30", KhqrTag30))));
            Assert.True(r.Ok);
            Assert.Equal(QrScheme.PromptPay, r.Value!.Scheme);
            Assert.Equal(new[] { QrScheme.Khqr }, r.Value.AlsoMatches.ToArray());
        }

        [Fact]
        public void AtAccountInNonCambodianCodeIsUnknownScheme()
        {
            var payload = EmvPayloads.Build(new[]
            {
                new TlvField("00", "01"), new TlvField("01", "11"),
                new TlvField("30", Tlv.Field("00", "user@example") + Tlv.Field("01", "M1") + Tlv.Field("02", "Bank")),
                new TlvField("53", "978"), new TlvField("58", "DE"),
            });
            var r = TingQrDetector.Detect(payload);
            Assert.False(r.Ok);
            Assert.Equal(TingQrErrorCode.UnknownScheme, r.Error!.Code);
        }

        [Fact]
        public void DetectHasAll7Vectors()
        {
            Assert.Equal(7, ConformanceTests.Vectors().Count(row => VectorRunner.Vectors[(string)row[0]]["scheme"]!.GetValue<string>() == "detect"));
        }
    }
}
