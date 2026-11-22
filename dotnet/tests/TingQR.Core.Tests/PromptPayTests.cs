using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    // Ports of ts/packages/core/test/promptpay-{encode,decode}.spec.ts that the conformance vectors do not cover,
    // plus the .NET-only rules (null input, culture).
    public class PromptPayTests
    {
        private const string Mobile = "00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF";
        private const string Mobile30 = "00020101021229370016A000000677010111011300668122233335303764540530.005802TH6304F9BA";
        private const string DtMobile = "00020101021129370016A000000677010111011300668012345675802TH530376463046197";
        private const string PpMobile = Mobile;
        private const string PpBillRef3 = "00020101021130620016A000000677010112011301122334455660211CUSTOMER0010306INV00153037645802TH62070703SCB6304780E";
        private const string TqBank = "00020101021229370016A0000006770101110413014123456789053037645406100.005802TH6304901D";
        private const string TqOta = "00020101021229510016A00000067701011401130066812345678051012345678905303764540550.005802TH63048856";
        private const string VietQrSample = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";

        private static string F(string tag, string value) => Tlv.Field(tag, value);

        private static string Rebuild(string payload, Func<List<TlvField>, IEnumerable<TlvField>> edit)
            => EmvPayloads.Build(edit(Tlv.Parse(payload).Where(f => f.Tag != "63").Cast<TlvField>().ToList()));

        private static IEnumerable<TlvField> SetTag(List<TlvField> f, string tag, string value)
            => f.Select(x => x.Tag == tag ? new TlvField(tag, value) : x);

        private static PromptPayData Ok(string payload, ParseMode mode = ParseMode.Lenient)
        {
            var r = PromptPayQr.Decode(payload, mode);
            Assert.True(r.Ok, r.Error?.Code + " " + r.Error?.Tag);
            return r.Value!;
        }

        private static (TingQrErrorCode, string?) Err(string payload, ParseMode mode = ParseMode.Lenient)
        {
            var r = PromptPayQr.Decode(payload, mode);
            Assert.False(r.Ok);
            return (r.Error!.Code, r.Error.Tag);
        }

        private static (TingQrErrorCode, string?) EncodeErr(PromptPayTarget? target, QrAmount? amount = null)
        {
            var e = Assert.Throws<TingQrException>(() => PromptPayQr.Encode(new PromptPayInput { Target = target!, Amount = amount }));
            return (e.Code, e.Tag);
        }

        [Fact]
        public void DecodeNullIsInvalidValue()
        {
            Assert.Equal(TingQrErrorCode.InvalidValue, PromptPayQr.Decode(null).Error!.Code);
            Assert.Equal(TingQrErrorCode.InvalidValue, PromptPayQr.Decode(null, ParseMode.Strict).Error!.Code);
        }

        [Fact]
        public void EncodeNullIsInvalidValue()
        {
            var e = Assert.Throws<TingQrException>(() => PromptPayQr.Encode(null));
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        }

        [Fact]
        public void NullTargetIsInvalidValueAt29()
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29"), EncodeErr(null));

        [Fact]
        public void AmountSameUnderGermanCulture()
        {
            var original = Thread.CurrentThread.CurrentCulture;
            try
            {
                var target = new PromptPayTarget.Mobile("0812223333");
                Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
                var invariant = PromptPayQr.Encode(new PromptPayInput { Target = target, Amount = 30.5m });
                Thread.CurrentThread.CurrentCulture = new CultureInfo("de-DE");
                var german = PromptPayQr.Encode(new PromptPayInput { Target = target, Amount = 30.5m });
                Assert.Equal(invariant, german);
                Assert.Contains("540530.50", german);
                Assert.Equal("30.50", Ok(german).Amount);
            }
            finally
            {
                Thread.CurrentThread.CurrentCulture = original;
            }
        }

        [Theory]
        [InlineData("0812223333")]
        [InlineData("+66 81-222-3333")]
        [InlineData("66812223333")]
        [InlineData("0066812223333")]
        [InlineData("081-222-3333")]
        public void MobileEncodesAs0066Plus9Digits(string mobile)
            => Assert.Equal(Mobile, PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Mobile(mobile) }));

        [Theory]
        [InlineData("08122233")]
        [InlineData("081222333344")]
        [InlineData("1812223333")]
        [InlineData("6681222333")]
        [InlineData("0166812223333")]
        [InlineData("")]
        [InlineData("０８１２２２３３３３")] // full-width digits are not digits
        public void BadMobileIsRejected(string mobile)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.01"), EncodeErr(new PromptPayTarget.Mobile(mobile)));

        [Fact]
        public void NullMobileIsRejected()
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.01"), EncodeErr(new PromptPayTarget.Mobile(null!)));

        [Fact]
        public void AmountNumbersAndTextAreWritten30_00()
        {
            var target = new PromptPayTarget.Mobile("0812223333");
            foreach (QrAmount a in new QrAmount[] { 30L, 30m, 30.0m, "30", "30.00", "30.0" })
            {
                Assert.Equal(Mobile30, PromptPayQr.Encode(new PromptPayInput { Target = target, Amount = a }));
            }
        }

        [Theory]
        [InlineData("4.2", "4.20")]
        [InlineData("0.01", "0.01")]
        [InlineData("9999999999.99", "9999999999.99")]
        [InlineData("0001.5", "1.50")]
        [InlineData("0.5", "0.50")]
        [InlineData("100", "100.00")]
        [InlineData("00100.5", "100.50")]
        public void AmountsAlwaysGetTwoDecimalsAndKeepTheirDigits(string amount, string written)
        {
            var payload = PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Mobile("0812223333"), Amount = amount });
            Assert.Equal(written, Ok(payload).Amount);
        }

        [Theory]
        [InlineData("0")]
        [InlineData("0.00")]
        [InlineData("-1")]
        [InlineData("1.234")]
        [InlineData("10000000000")]
        [InlineData("abc")]
        [InlineData("1.")]
        [InlineData(".5")]
        [InlineData("1.5\n")]
        [InlineData("１")]
        [InlineData("1e3")]
        public void BadAmountTextIsRejected(string amount)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"54"),
                EncodeErr(new PromptPayTarget.Mobile("0812223333"), amount));

        [Fact]
        public void BadAmountNumbersAreRejected()
        {
            var target = new PromptPayTarget.Mobile("0812223333");
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"54"), EncodeErr(target, 0L));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"54"), EncodeErr(target, -1L));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"54"), EncodeErr(target, 1.234m));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"54"), EncodeErr(target, 10000000000L));
        }

        [Fact]
        public void EmptyOrMissingAmountMeansStatic()
        {
            var target = new PromptPayTarget.Mobile("0812223333");
            Assert.Equal(Mobile, PromptPayQr.Encode(new PromptPayInput { Target = target, Amount = "" }));
            Assert.Equal(Mobile, PromptPayQr.Encode(new PromptPayInput { Target = target, Amount = default(QrAmount) }));
            Assert.Equal(Mobile, PromptPayQr.Encode(new PromptPayInput { Target = target }));
        }

        [Fact]
        public void TingqrAndDtinthWriteTheSameFieldsInADifferentOrder()
        {
            var ours = PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Mobile("0801234567") });
            Assert.NotEqual(DtMobile, ours);
            Assert.Equal(Ok(DtMobile, ParseMode.Strict), Ok(ours, ParseMode.Strict), new DataComparer());
        }

        // Records compare dictionaries by reference; compare the readable parts instead.
        private sealed class DataComparer : IEqualityComparer<PromptPayData>
        {
            public bool Equals(PromptPayData? a, PromptPayData? b)
                => a != null && b != null && a.Kind == b.Kind && a.Initiation == b.Initiation && a.Currency == b.Currency
                   && a.Country == b.Country && a.Proxy == b.Proxy && a.Mobile == b.Mobile && a.ProxyType == b.ProxyType
                   && a.Ota == b.Ota && a.SubFields.OrderBy(x => x.Key).SequenceEqual(b.SubFields.OrderBy(x => x.Key));

            public int GetHashCode(PromptPayData obj) => 0;
        }

        [Theory]
        [InlineData("111111111111", "29.02")]
        [InlineData("11111111111111", "29.02")]
        [InlineData("1-1111-11111-11-1", "29.02")]
        [InlineData("A111111111111", "29.02")]
        [InlineData("１１１１１１１１１１１１１", "29.02")]
        public void BadNationalIdIsRejected(string id, string tag)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)tag), EncodeErr(new PromptPayTarget.NationalId(id)));

        [Theory]
        [InlineData("01234567890123")]
        [InlineData("01234567890123A")]
        [InlineData("A12345678901234")]
        public void BadEWalletIsRejected(string id)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.03"), EncodeErr(new PromptPayTarget.EWallet(id)));

        [Theory]
        [InlineData("01122334455")]
        [InlineData("01122334455667")]
        [InlineData("0112233445566A")]
        public void BadBillerIsRejected(string id)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30.01"), EncodeErr(new PromptPayTarget.Bill(id)));

        [Fact]
        public void NullIdsAreRejected()
        {
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.02"), EncodeErr(new PromptPayTarget.NationalId(null!)));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.03"), EncodeErr(new PromptPayTarget.EWallet(null!)));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30.01"), EncodeErr(new PromptPayTarget.Bill(null!)));
        }

        [Fact]
        public void BillPaymentWithReferencesAnd13Or15DigitBillers()
        {
            var payload = PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Bill("0112233445566", "CUSTOMER001", "INV001") });
            var v = Ok(payload, ParseMode.Strict);
            Assert.Equal(PromptPayKind.BillPayment, v.Kind);
            Assert.Equal("0112233445566", v.BillerId);
            Assert.Equal("CUSTOMER001", v.Reference1);
            Assert.Equal("INV001", v.Reference2);
            var fifteen = Ok(PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Bill("099999999999990") }), ParseMode.Strict);
            Assert.Equal("099999999999990", fifteen.BillerId);
            Assert.Equal("099999999999990", fifteen.SubFields["01"]);
        }

        [Fact]
        public void EmptyReferencesAreLeftOut()
            => Assert.Equal(
                PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Bill("0112233445566") }),
                PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Bill("0112233445566", "", "") }));

        [Theory]
        [InlineData("123456789012345678901", null, TingQrErrorCode.InvalidValue, "30.02")]
        [InlineData(null, "123456789012345678901", TingQrErrorCode.InvalidValue, "30.03")]
        [InlineData("CAFÉ", null, TingQrErrorCode.NonAscii, "30.02")]
        [InlineData(null, "tab\there", TingQrErrorCode.NonAscii, "30.03")]
        public void BadReferenceIsRejected(string? r1, string? r2, TingQrErrorCode code, string tag)
            => Assert.Equal((code, (string?)tag), EncodeErr(new PromptPayTarget.Bill("0112233445566", r1, r2)));

        [Fact]
        public void A20CharacterReferenceIsAccepted()
        {
            var r = Ok(PromptPayQr.Encode(new PromptPayInput { Target = new PromptPayTarget.Bill("0112233445566", "12345678901234567890") }));
            Assert.Equal("12345678901234567890", r.Reference1);
        }

        [Fact]
        public void AidConstants()
        {
            Assert.Equal("A000000677010111", PromptPayQr.Aid.CreditTransfer);
            Assert.Equal("A000000677010114", PromptPayQr.Aid.Ota);
            Assert.Equal("A000000677010112", PromptPayQr.Aid.BillPayment);
            Assert.Equal("A000000677012006", PromptPayQr.Aid.BillPaymentCrossBorder);
        }

        // ---- decode ----

        [Fact]
        public void MobileProxyIsVerbatimAndMobileIsNormalised()
        {
            var r = PromptPayQr.Decode(DtMobile, ParseMode.Strict);
            Assert.Empty(r.Warnings);
            var v = r.Value!;
            Assert.Equal(PromptPayKind.CreditTransfer, v.Kind);
            Assert.False(v.Ota);
            Assert.Equal(PromptPayProxyType.Mobile, v.ProxyType);
            Assert.Equal("0066801234567", v.Proxy);
            Assert.Equal("0801234567", v.Mobile);
            Assert.Null(v.BillerId);
            Assert.Null(v.CrossBorder);
            Assert.Equal("0801234567", Ok(PpMobile).Mobile is null ? null : "0801234567");
            Assert.Equal("0812223333", Ok(PpMobile).Mobile);
        }

        [Fact]
        public void AMobileSubTagNotIn0066Form_KeepsProxyButNoMobile()
        {
            var v = Ok(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("01", "66812223333"))), ParseMode.Strict);
            Assert.Equal(PromptPayProxyType.Mobile, v.ProxyType);
            Assert.Equal("66812223333", v.Proxy);
            Assert.Null(v.Mobile);
        }

        [Theory]
        [InlineData("10066812223333")]
        [InlineData("00668122233334")]
        [InlineData("００６６８１２２２３３３３")] // full-width digits
        [InlineData("006681222333١")] // Arabic-Indic digit
        public void NonAsciiOrWrongLengthMobileProxyIsNotNormalised(string proxy)
        {
            var v = Ok(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("01", proxy))));
            Assert.Null(v.Mobile);
        }

        [Fact]
        public void NationalIdEWalletAndBankAccountProxies()
        {
            var nid = Ok(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("02", "1111111111111"))));
            Assert.Equal(PromptPayProxyType.NationalId, nid.ProxyType);
            var ew = Ok(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("03", "012345678901234"))));
            Assert.Equal(PromptPayProxyType.EWallet, ew.ProxyType);
            var bank = Ok(TqBank);
            Assert.Equal(PromptPayProxyType.BankAccount, bank.ProxyType);
            Assert.Equal("0141234567890", bank.Proxy);
            Assert.Equal("100.00", bank.Amount);
            Assert.Equal(QrInitiation.Dynamic, bank.Initiation);
            Assert.Null(bank.Mobile);
        }

        [Fact]
        public void TheFirstOfSubTags01To04PresentIsTheProxy()
        {
            var v = Ok(Rebuild(PpMobile, f => SetTag(f, "29",
                F("00", PromptPayQr.Aid.CreditTransfer) + F("03", "012345678901234") + F("02", "1111111111111"))));
            Assert.Equal(PromptPayProxyType.NationalId, v.ProxyType);
            Assert.Equal("1111111111111", v.Proxy);
        }

        [Fact]
        public void BillPaymentKeepsTag62AndSubFields()
        {
            var v = Ok(PpBillRef3, ParseMode.Strict);
            Assert.Equal(PromptPayKind.BillPayment, v.Kind);
            Assert.False(v.CrossBorder);
            Assert.Equal(new Dictionary<string, string> { ["07"] = "SCB" }, v.AdditionalData);
            Assert.Equal(3, v.SubFields.Count);
            Assert.Null(v.Proxy);
            Assert.Null(v.Ota);
        }

        [Fact]
        public void OtaAndCrossBorder()
        {
            var ota = Ok(TqOta);
            Assert.True(ota.Ota);
            Assert.Equal("1234567890", ota.OtaCode);
            Assert.Equal("0812345678", ota.Mobile);
            var cb = Ok("00020101021230550016A0000006770120060115099400016550100021212345678901253037645406100.005802TH63049D1C");
            Assert.True(cb.CrossBorder);
            Assert.Equal("099400016550100", cb.BillerId);
        }

        [Fact]
        public void OptionalTagsAndExtraFields()
        {
            var p = Rebuild(PpMobile, f => f.Concat(new[]
            {
                new TlvField("52", "5814"), new TlvField("59", "SHOP"), new TlvField("60", "BANGKOK"), new TlvField("81", "0048"),
            }));
            var v = Ok(p, ParseMode.Strict);
            Assert.Equal("5814", v.MerchantCategoryCode);
            Assert.Equal("SHOP", v.MerchantName);
            Assert.Equal("BANGKOK", v.MerchantCity);
            Assert.Equal(new Dictionary<string, string> { ["81"] = "0048" }, v.ExtraFields);
        }

        [Fact]
        public void AidIsComparedCaseInsensitively()
            => Assert.Equal(PromptPayProxyType.Mobile,
                Ok(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer.ToLowerInvariant()) + F("01", "0066812223333")))).ProxyType);

        [Fact]
        public void WithBoth29And30Tag29WinsAnd30IsAnExtraField()
        {
            var t30 = F("00", PromptPayQr.Aid.BillPayment) + F("01", "0112233445566");
            var v = Ok(Rebuild(PpMobile, f => f.Concat(new[] { new TlvField("30", t30) })), ParseMode.Strict);
            Assert.Equal(PromptPayKind.CreditTransfer, v.Kind);
            Assert.Equal(new Dictionary<string, string> { ["30"] = t30 }, v.ExtraFields);
        }

        [Fact]
        public void WrongAidOrOtherSchemeIsUnsupportedScheme()
        {
            var u = (TingQrErrorCode.UnsupportedScheme, (string?)"29");
            Assert.Equal(u, Err(Rebuild(PpBillRef3, f => SetTag(f, "30", F("00", PromptPayQr.Aid.CreditTransfer) + F("01", "0112233445566")))));
            Assert.Equal(u, Err(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.BillPayment) + F("01", "1")))));
            Assert.Equal(u, Err(VietQrSample));
            Assert.Equal(u, Err(VietQrSample, ParseMode.Strict));
        }

        [Fact]
        public void Tag29WithoutProxyIsUnknownLenientAndMissingTagStrict()
        {
            var p = Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("05", "X1")));
            var r = PromptPayQr.Decode(p);
            Assert.True(r.Ok);
            Assert.Equal(PromptPayProxyType.Unknown, r.Value!.ProxyType);
            Assert.Equal("", r.Value.Proxy);
            Assert.Equal("X1", r.Value.OtaCode);
            Assert.Equal(new Dictionary<string, string> { ["05"] = "X1" }, r.Value.SubFields);
            var w = Assert.Single(r.Warnings);
            Assert.Equal((TingQrWarningCode.MissingOptionalTag, "29"), (w.Code, w.Tag));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"29.01"), Err(p, ParseMode.Strict));
        }

        [Theory]
        [InlineData(ParseMode.Strict)]
        [InlineData(ParseMode.Lenient)]
        public void Tag30Without3001IsMissingTag(ParseMode mode)
            => Assert.Equal((TingQrErrorCode.MissingTag, (string?)"30.01"),
                Err(Rebuild(PpBillRef3, f => SetTag(f, "30", F("00", PromptPayQr.Aid.BillPayment) + F("02", "R1"))), mode));

        [Fact]
        public void DuplicateSubTagIsDuplicateTag()
            => Assert.Equal((TingQrErrorCode.DuplicateTag, (string?)"29.01"),
                Err(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("01", "0066812223333") + F("01", "0066812223333")))));

        [Theory]
        [InlineData("53", "764")]
        [InlineData("58", "TH")]
        public void Missing53Or58(string tag, string fallback)
        {
            var p = Rebuild(PpMobile, f => f.Where(x => x.Tag != tag));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)tag), Err(p, ParseMode.Strict));
            var r = PromptPayQr.Decode(p);
            Assert.True(r.Ok);
            Assert.Equal(fallback, tag == "53" ? r.Value!.Currency : r.Value!.Country);
            var w = Assert.Single(r.Warnings);
            Assert.Equal((TingQrWarningCode.MissingOptionalTag, tag), (w.Code, w.Tag));
            Assert.Contains(fallback, w.Message);
        }

        [Fact]
        public void Tags00And01AreChecked()
        {
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"00"), Err(Rebuild(PpMobile, f => SetTag(f, "00", "02"))));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"01"), Err(Rebuild(PpMobile, f => SetTag(f, "01", "13"))));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"00"), Err(Rebuild(PpMobile, f => f.Where(x => x.Tag != "00"))));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"01"), Err(Rebuild(PpMobile, f => f.Where(x => x.Tag != "01"))));
        }

        [Fact]
        public void CrcErrorsPassThroughAndDefaultModeIsLenient()
        {
            Assert.Equal((TingQrErrorCode.CrcMismatch, (string?)"63"), Err(DtMobile.Substring(0, DtMobile.Length - 1) + "0"));
            Assert.True(PromptPayQr.Decode(Rebuild(PpMobile, f => f.Where(x => x.Tag != "58"))).Ok);
        }

        [Fact]
        public void MalformedTag62IsTruncated()
            => Assert.Equal((TingQrErrorCode.Truncated, (string?)null),
                Err(Rebuild(PpMobile, f => f.Concat(new[] { new TlvField("62", "07") }))));

        [Fact]
        public void BillPaymentWithoutReferencesHasNone()
        {
            var v = Ok(Rebuild(PpBillRef3, f => SetTag(f, "30", F("00", PromptPayQr.Aid.BillPayment) + F("01", "0112233445566"))), ParseMode.Strict);
            Assert.Null(v.Reference1);
            Assert.Null(v.Reference2);
        }

        [Fact]
        public void NationalIdLooking0066IsNotAMobile()
        {
            var v = Ok(Rebuild(PpMobile, f => SetTag(f, "29", F("00", PromptPayQr.Aid.CreditTransfer) + F("02", "0066812223333"))));
            Assert.Equal(PromptPayProxyType.NationalId, v.ProxyType);
            Assert.Null(v.Mobile);
        }
    }
}
