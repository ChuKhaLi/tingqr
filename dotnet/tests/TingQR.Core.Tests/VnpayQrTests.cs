using System;
using System.Collections.Generic;
using System.Linq;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    // Ports of ts/packages/core/test/vnpay-decode.spec.ts that the conformance vectors do not cover,
    // plus the .NET-only rule (null input).
    public class VnpayQrTests
    {
        // vietnam-qr-pay README (MIT): a public shop QR (CellphoneS) shown in that README.
        private const string V = "00020101021126280010A0000007750110010531314453037045408210900005802VN5910CELLPHONES62600312CPSHN ONLINE0517021908061613127850705ONLHN0810CellphoneS63047685";

        // vietnam-qr-pay README (MIT) VietQR sample.
        private const string SVietQr = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";

        private static string F(string tag, string value) => Tlv.Field(tag, value);

        private static string Rebuild(Func<List<TlvField>, IEnumerable<TlvField>> edit)
            => EmvPayload.Build(edit(Tlv.Parse(V).Where(f => f.Tag != "63").Cast<TlvField>().ToList()));

        private static string Replace(string tag, string value)
            => Rebuild(f => f.Select(x => x.Tag == tag ? new TlvField(tag, value) : x));

        private static TingQrException Fail(TingQrResult<VnpayQrData> r)
        {
            Assert.False(r.Ok);
            return r.Error!;
        }

        private static TingQrErrorCode VietQrCode(TingQrResult<VietQrData> r)
        {
            Assert.False(r.Ok);
            return r.Error!.Code;
        }

        private static VnpayQrData Ok(TingQrResult<VnpayQrData> r)
        {
            Assert.True(r.Ok, r.Error?.Message);
            return r.Value!;
        }

        private static void AssertFails(TingQrResult<VnpayQrData> r, TingQrErrorCode code, string tag)
        {
            var e = Fail(r);
            Assert.Equal(code, e.Code);
            Assert.Equal(tag, e.Tag);
        }

        [Fact]
        public void DecodeNullIsInvalidValue()
        {
            Assert.Equal(TingQrErrorCode.InvalidValue, Fail(VnpayQr.Decode(null)).Code);
            Assert.Equal(TingQrErrorCode.InvalidValue, Fail(VnpayQr.Decode(null, ParseMode.Strict)).Code);
            Assert.Null(Fail(VnpayQr.Decode(null)).Tag);
            Assert.Null(Fail(VnpayQr.Decode(null, ParseMode.Strict)).Tag);
        }

        [Fact]
        public void ReadmeQrFailsStrictOnMissingTag52()
            => AssertFails(VnpayQr.Decode(V, ParseMode.Strict), TingQrErrorCode.MissingTag, "52");

        [Fact]
        public void ReadmeQrReadsLeniently()
        {
            var r = VnpayQr.Decode(V, ParseMode.Lenient);
            var v = Ok(r);
            Assert.Equal("0105313144", v.MerchantId);
            Assert.Equal(QrInitiation.Static, v.Initiation);
            Assert.Equal("21090000", v.Amount);
            Assert.Equal("CELLPHONES", v.MerchantName);
            Assert.Null(v.MerchantCity);
            Assert.Equal("CPSHN ONLINE", v.Store);
            Assert.Equal("02190806161312785", v.Reference);
            Assert.Equal("ONLHN", v.Terminal);
            Assert.Equal("CellphoneS", v.Purpose);
            Assert.Equal(new[] { "52", "60" }, r.Warnings.Select(w => w.Tag).ToArray());
            Assert.All(r.Warnings, w => Assert.Equal(TingQrWarningCode.MissingOptionalTag, w.Code));
        }

        [Fact]
        public void With52And60StrictReadsWithoutWarnings()
        {
            var r = VnpayQr.Decode(Rebuild(f => f.Concat(new[] { new TlvField("52", "5732"), new TlvField("60", "HA NOI") })), ParseMode.Strict);
            Assert.Empty(r.Warnings);
            Assert.Equal("5732", Ok(r).MerchantCategoryCode);
            Assert.Equal("HA NOI", r.Value!.MerchantCity);
        }

        [Fact]
        public void EachSubTagMapsToItsNamedField()
        {
            var sub = string.Concat(new[] { "01", "02", "03", "04", "05", "06", "07", "08" }.Select(t => F(t, "V" + t)));
            var v = Ok(VnpayQr.Decode(Replace("62", sub)));
            Assert.Equal(
                new[] { "V01", "V02", "V03", "V04", "V05", "V06", "V07", "V08" },
                new[] { v.BillNumber, v.MobileNumber, v.Store, v.LoyaltyNumber, v.Reference, v.CustomerLabel, v.Terminal, v.Purpose });
        }

        [Fact]
        public void Missing53And58DefaultInTagOrderWithWarnings()
        {
            var r = VnpayQr.Decode(Rebuild(f => f.Where(x => x.Tag != "53" && x.Tag != "58")));
            Assert.Equal("704", Ok(r).Currency);
            Assert.Equal("VN", r.Value!.Country);
            Assert.Equal(new[] { "52", "53", "58", "60" }, r.Warnings.Select(w => w.Tag).ToArray());
        }

        [Fact]
        public void Missing59IsMissingTagStrictAndWarningLenient()
        {
            var p = Rebuild(f => f.Where(x => x.Tag != "59").Concat(new[] { new TlvField("52", "5732"), new TlvField("60", "HA NOI") }));
            AssertFails(VnpayQr.Decode(p, ParseMode.Strict), TingQrErrorCode.MissingTag, "59");
            var lenient = VnpayQr.Decode(p, ParseMode.Lenient);
            Assert.Null(Ok(lenient).MerchantName);
            Assert.Equal(new[] { "59" }, lenient.Warnings.Select(w => w.Tag).ToArray());
        }

        [Fact]
        public void WrongSchemeFunctionIsUnsupportedSchemeBothWays()
        {
            Assert.Equal(TingQrErrorCode.UnsupportedScheme, Fail(VnpayQr.Decode(SVietQr)).Code);
            Assert.Equal(TingQrErrorCode.UnsupportedScheme, VietQrCode(VietQr.Decode(V)));
        }

        [Theory]
        [InlineData(ParseMode.Strict)]
        [InlineData(ParseMode.Lenient)]
        public void Missing2601IsMissingTag(ParseMode mode)
            => AssertFails(VnpayQr.Decode(Replace("26", F("00", "A000000775")), mode), TingQrErrorCode.MissingTag, "26.01");

        [Fact]
        public void OtherSubTagsOf26GoToProviderDataAndGuidIsCaseInsensitive()
        {
            var v = Ok(VnpayQr.Decode(Replace("26", F("00", "a000000775") + F("01", "0105313144") + F("02", "XYZ"))));
            Assert.Equal(new Dictionary<string, string> { ["02"] = "XYZ" }, v.ProviderData);
        }

        [Fact]
        public void NoOtherSubTagsMeansNoProviderData() => Assert.Null(Ok(VnpayQr.Decode(V)).ProviderData);

        [Fact]
        public void Duplicated6207IsDuplicateTag()
            => AssertFails(VnpayQr.Decode(Replace("62", F("07", "A") + F("07", "B"))), TingQrErrorCode.DuplicateTag, "62.07");

        [Fact]
        public void BadTag00Or01IsInvalidValueAndPoi12IsDynamic()
        {
            AssertFails(VnpayQr.Decode(Replace("00", "02")), TingQrErrorCode.InvalidValue, "00");
            AssertFails(VnpayQr.Decode(Replace("01", "13")), TingQrErrorCode.InvalidValue, "01");
            Assert.Equal(QrInitiation.Dynamic, Ok(VnpayQr.Decode(Replace("01", "12"))).Initiation);
        }

        [Fact]
        public void MerchantCategoryAndCityAreInterpretedNotExtra()
        {
            var v = Ok(VnpayQr.Decode(Rebuild(f => f.Concat(new[] { new TlvField("52", "5411"), new TlvField("60", "HANOI") }))));
            Assert.Null(v.ExtraFields);
            Assert.Equal("5411", v.MerchantCategoryCode);
        }

        [Fact]
        public void UnknownTopLevelTagsGoToExtraFields()
        {
            var v = Ok(VnpayQr.Decode(Rebuild(f => f.Concat(new[] { new TlvField("80", "X") }))));
            Assert.Equal(new Dictionary<string, string> { ["80"] = "X" }, v.ExtraFields);
        }

        [Fact]
        public void ParseWarningsComeFirst()
        {
            var r = VnpayQr.Decode(V + "\r\n");
            Assert.True(r.Ok);
            Assert.Equal(
                new[] { TingQrWarningCode.TrimmedWhitespace, TingQrWarningCode.MissingOptionalTag, TingQrWarningCode.MissingOptionalTag },
                r.Warnings.Select(w => w.Code).ToArray());
        }

        [Theory]
        [InlineData("A000000727")]
        [InlineData("")]
        public void Tag26WithOtherGuidOrWithoutSubTag00IsUnsupportedScheme(string guid)
        {
            var value = (guid.Length > 0 ? F("00", guid) : "") + F("01", "0105313144");
            AssertFails(VnpayQr.Decode(Replace("26", value)), TingQrErrorCode.UnsupportedScheme, "26");
        }

        [Fact]
        public void MissingTag00IsInvalidValueAndMissingTag01IsMissingTag()
        {
            AssertFails(VnpayQr.Decode(Rebuild(f => f.Where(x => x.Tag != "00"))), TingQrErrorCode.InvalidValue, "00");
            AssertFails(VnpayQr.Decode(Rebuild(f => f.Where(x => x.Tag != "01"))), TingQrErrorCode.MissingTag, "01");
        }

        [Fact]
        public void WithoutTag62NoAdditionalDataAndNoNamedFields()
        {
            var v = Ok(VnpayQr.Decode(Rebuild(f => f.Where(x => x.Tag != "62"))));
            Assert.Null(v.AdditionalData);
            Assert.Null(v.Store);
            Assert.Equal("0105313144", v.MerchantId);
        }

        [Theory]
        [InlineData("ABCD")]
        [InlineData("0001X0001Y")]
        [InlineData("0010A000000727")]
        public void VietQrWhoseTag26IsNotCleanTlvIsUnsupportedScheme(string value)
        {
            var fields = Tlv.Parse(SVietQr).Where(f => f.Tag != "63").Cast<TlvField>().ToList();
            var p = EmvPayload.Build(fields.Take(2).Concat(new[] { new TlvField("26", value) }).Concat(fields.Skip(2)));
            Assert.Equal(TingQrErrorCode.UnsupportedScheme, Fail(VnpayQr.Decode(p)).Code);
        }

        [Fact]
        public void DuplicatedSubTagsIn26AreDuplicateTag()
            => AssertFails(VnpayQr.Decode(Replace("26", F("00", "A000000775") + F("01", "1") + F("01", "2"))),
                TingQrErrorCode.DuplicateTag, "26.01");

        [Theory]
        [InlineData("ABCD")]
        [InlineData("0001X0001Y")]
        public void VnpayWhoseTag38IsNotCleanTlvIsUnsupportedSchemeForVietQr(string value)
        {
            var p = Rebuild(f => f.Concat(new[] { new TlvField("38", value) }));
            Assert.Equal(TingQrErrorCode.UnsupportedScheme, VietQrCode(VietQr.Decode(p)));
        }
    }
}
