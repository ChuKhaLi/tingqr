using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using TingQR.Emv;
using Xunit;

namespace TingQR.Tests
{
    // Ports of ts/packages/core/test/khqr-{encode,decode}.spec.ts that the conformance vectors do not cover,
    // plus the .NET-only rules (null input, code point lengths, culture).
    public class KhqrTests
    {
        private const long Now = 1731000000000;

        // bakong-khqr@1.0.20 test (ISC): individual, USD, Khmer tag 64, tag 99 after 64.
        private const string Individual =
            "00020101021229460015john_smith@devb0111855122334550208Dev Bank52045999530384054031005802KH5910John Smith6010PHNOM PENH62670106#123450211855122334550311Coffee Shop0709Cashier_10810Buy coffee64280002km0108ចន ស្មីន0206ភ្នំពញ993400131726821915797011317268220357976304B73E";
        private const string Merchant =
            "00020101021130470009khqr@aclb0111855124649170215ACLEDA Bank Plc5204599953038405802KH5907BUN MAO6010Phnom Penh6102126213020901050033164310002KM0107BUN MAO0210Phnom Penh6304E313";
        private const string PromptPay = "00020101021129370016A0000006770101110113006681222333353037645802TH63041DCF";
        private const string VietQrSample = "00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F";

        private static KhqrInput Base => new KhqrInput
        {
            AccountType = KhqrAccountType.Individual,
            BakongAccountId = "jonhsmith@nbcq",
            MerchantName = "Jonh Smith",
            Currency = "KHR",
            CreatedAt = Now,
        };

        private static KhqrInput MerchantBase => new KhqrInput
        {
            AccountType = KhqrAccountType.Merchant,
            BakongAccountId = "khqr@devb",
            MerchantId = "123456",
            AcquiringBank = "Dev Bank",
            MerchantName = "TINGQR SHOP",
            Currency = "KHR",
            CreatedAt = Now,
        };

        private static (TingQrErrorCode, string?) EncodeErr(KhqrInput input)
        {
            var e = Assert.Throws<TingQrException>(() => Khqr.Encode(input));
            return (e.Code, e.Tag);
        }

        private static KhqrData Ok(string payload, ParseMode mode = ParseMode.Lenient)
        {
            var r = Khqr.Decode(payload, mode);
            Assert.True(r.Ok, r.Error?.Code + " " + r.Error?.Tag);
            return r.Value!;
        }

        private static (TingQrErrorCode, string?) Err(string payload, ParseMode mode = ParseMode.Lenient)
        {
            var r = Khqr.Decode(payload, mode);
            Assert.False(r.Ok);
            return (r.Error!.Code, r.Error.Tag);
        }

        private static string Rebuild(string payload, Func<TlvField[], TlvField[]> edit)
            => EmvPayloads.Build(edit(Tlv.Parse(payload).Where(f => f.Tag != "63").Cast<TlvField>().ToArray()));

        private static TlvField[] Set(TlvField[] f, string tag, string value) => f.Select(x => x.Tag == tag ? new TlvField(tag, value) : x).ToArray();

        private static TlvField[] Drop(TlvField[] f, string tag) => f.Where(x => x.Tag != tag).ToArray();

        private static string? Tag(string payload, string tag) => Tlv.Parse(payload).FirstOrDefault(f => f.Tag == tag)?.Value;

        private static string Emoji(int n) => string.Concat(Enumerable.Repeat("\U0001F600", n));

        [Fact]
        public void DecodeNullIsInvalidValue()
        {
            Assert.Equal(TingQrErrorCode.InvalidValue, Khqr.Decode(null).Error!.Code);
            Assert.Equal(TingQrErrorCode.InvalidValue, Khqr.Decode(null, ParseMode.Strict).Error!.Code);
            Assert.Null(Khqr.Decode(null).Error!.Tag);
            Assert.Null(Khqr.Decode(null, ParseMode.Strict).Error!.Tag);
        }

        [Fact]
        public void EncodeNullIsInvalidValue()
            => Assert.Equal(TingQrErrorCode.InvalidValue, Assert.Throws<TingQrException>(() => Khqr.Encode(null)).Code);

        [Fact]
        public void MerchantNameEmojiIsNonAscii()
        {
            // Tag 59 is ASCII only, so 25 emoji are rejected for their script; the length rule is shown on tag 64.
            Assert.Equal((TingQrErrorCode.NonAscii, (string?)"59"), EncodeErr(Base with { MerchantName = Emoji(25) }));
        }

        [Fact]
        public void AlternateNameKhmer25Ok26Rejected()
        {
            var ok = Khqr.Encode(Base with { AlternateLanguage = new KhqrAlternateLanguage("km", Emoji(25)) });
            Assert.Equal(Emoji(25), Khqr.Decode(ok).Value!.AlternateLanguage!.MerchantName);
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"64.01"),
                EncodeErr(Base with { AlternateLanguage = new KhqrAlternateLanguage("km", Emoji(26)) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"64.02"),
                EncodeErr(Base with { AlternateLanguage = new KhqrAlternateLanguage("km", "X", Emoji(16)) }));
        }

        [Fact]
        public void IsExpiredLikeTypeScript()
        {
            var data = Ok(Individual);
            Assert.False(Khqr.IsExpired(data, 0));
            Assert.True(Khqr.IsExpired(data, new DateTimeOffset(2030, 1, 1, 0, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds()));
            Assert.False(Khqr.IsExpired(data, 1726822035797));
            Assert.True(Khqr.IsExpired(data, 1726822035798));
            Assert.Null(Khqr.IsExpired(Ok(Merchant), 1893456000000));
        }

        [Fact]
        public void DecodeNeverReadsTheClock()
        {
            // Every dynamic sample expired in 2024; decoding still succeeds in strict mode.
            Assert.Empty(Khqr.Decode(Individual, ParseMode.Strict).Warnings);
        }

        [Fact]
        public void SameInputSamePayload()
        {
            var input = Base with { Amount = 1000, ExpiresAt = Now + 60000 };
            Assert.Equal(Khqr.Encode(input), Khqr.Encode(input));
        }

        [Fact]
        public void EncodedPayloadDecodesBackInStrictMode()
        {
            var alt = new KhqrAlternateLanguage("km", "ចន ស្មីន", "ភ្នំពញ");
            var input = MerchantBase with
            {
                MerchantCity = "Siem Reap", MerchantCategoryCode = "5814", Amount = 1000, BillNumber = "INV-0001",
                MobileNumber = "85512345678", StoreLabel = "Store 1", TerminalLabel = "T1", Purpose = "Coffee",
                AlternateLanguage = alt, ExpiresAt = Now + 120000,
            };
            var r = Khqr.Decode(Khqr.Encode(input), ParseMode.Strict);
            Assert.True(r.Ok);
            Assert.Empty(r.Warnings);
            var v = r.Value!;
            Assert.Equal(KhqrAccountType.Merchant, v.AccountType);
            Assert.Equal("123456", v.MerchantId);
            Assert.Equal("116", v.Currency);
            Assert.Equal("KHR", v.CurrencyAlpha);
            Assert.Equal("1000", v.Amount);
            Assert.Equal("INV-0001", v.BillNumber);
            Assert.Equal("ភ្នំពញ", v.AlternateLanguage!.MerchantCity);
            Assert.Equal(Now, v.CreatedAt);
            Assert.Equal(Now + 120000, v.ExpiresAt);
            Assert.Equal(QrInitiation.Dynamic, v.Initiation);
        }

        [Fact]
        public void DefaultsAndStaticHasNoTag99()
        {
            var payload = Khqr.Encode(Base);
            Assert.Equal("Phnom Penh", Tag(payload, "60"));
            Assert.Equal("5999", Tag(payload, "52"));
            Assert.Equal("11", Tag(payload, "01"));
            Assert.Null(Tag(payload, "99"));
        }

        [Fact]
        public void StaticWithExpiresAtCarriesBothTimestamps()
        {
            var v = Ok(Khqr.Encode(Base with { ExpiresAt = Now + 1 }), ParseMode.Strict);
            Assert.Equal(QrInitiation.Static, v.Initiation);
            Assert.Equal(Now, v.CreatedAt);
            Assert.Equal(Now + 1, v.ExpiresAt);
        }

        [Fact]
        public void TagsAreInSdkOrder()
        {
            var payload = Khqr.Encode(Base with
            {
                Amount = 1, ExpiresAt = Now + 1, BillNumber = "B", AlternateLanguage = new KhqrAlternateLanguage("km", "X"),
            });
            Assert.Equal(new[] { "00", "01", "29", "52", "53", "54", "58", "59", "60", "62", "64", "99", "63" }, Tlv.Parse(payload).Select(f => f.Tag));
        }

        [Fact]
        public void UsdAmounts()
        {
            string Usd(QrAmount a) => Tag(Khqr.Encode(Base with { Currency = "USD", Amount = a, ExpiresAt = Now + 1 }), "54")!;
            Assert.Equal("1", Usd(1L));
            Assert.Equal("1.50", Usd(1.5m));
            Assert.Equal("1.50", Usd("1.5"));
            Assert.Equal("1.00", Usd("1.0"));
            Assert.Equal("0.01", Usd("0.01"));
            Assert.Equal("7", Usd("007"));
            Assert.Equal("10.50", Usd("0010.5"));
        }

        [Fact]
        public void KhrAmounts()
        {
            string Khr(QrAmount a) => Tag(Khqr.Encode(Base with { Amount = a, ExpiresAt = Now + 1 }), "54")!;
            Assert.Equal("1000", Khr(1000L));
            Assert.Equal("1000", Khr("01000"));
            Assert.Equal("1234567890123", Khr("1234567890123"));
        }

        [Theory]
        [InlineData("KHR", "1.5")]
        [InlineData("KHR", "1000.0")]
        [InlineData("KHR", "0")]
        [InlineData("KHR", "-5")]
        [InlineData("KHR", "1e3")]
        [InlineData("KHR", "12345678901234")]
        [InlineData("USD", "1.234")]
        [InlineData("USD", "0")]
        [InlineData("USD", "0.00")]
        [InlineData("USD", "1.")]
        [InlineData("USD", "12345678901.23")]
        [InlineData("USD", "١")]
        [InlineData("116", "1.5")]
        public void BadAmountIsInvalidValueAt54(string currency, string amount)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"54"), EncodeErr(Base with { Currency = currency, Amount = amount, ExpiresAt = Now + 1 }));

        [Fact]
        public void EmptyAmountIsStatic()
            => Assert.Equal(Khqr.Encode(Base), Khqr.Encode(Base with { Amount = "" }));

        [Fact]
        public void AmountSameUnderGermanCulture()
        {
            var original = Thread.CurrentThread.CurrentCulture;
            try
            {
                var input = Base with { Currency = "USD", Amount = 1.5m, ExpiresAt = Now + 1 };
                Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;
                var invariant = Khqr.Encode(input);
                Thread.CurrentThread.CurrentCulture = new CultureInfo("de-DE");
                Assert.Equal(invariant, Khqr.Encode(input));
                Assert.Equal(Now, Khqr.Decode(invariant).Value!.CreatedAt);
            }
            finally
            {
                Thread.CurrentThread.CurrentCulture = original;
            }
        }

        [Theory]
        [InlineData(1000L, null, "99.01")]
        [InlineData(1000L, Now, "99.01")]
        [InlineData(1000L, Now - 1, "99.01")]
        [InlineData(null, 17310000000000L, "99.01")]
        public void BadExpiry(long? amount, long? expiresAt, string tag)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)tag),
                EncodeErr(Base with { Amount = amount.HasValue ? new QrAmount(amount.Value) : (QrAmount?)null, ExpiresAt = expiresAt }));

        [Theory]
        [InlineData(173100000000L)]
        [InlineData(17310000000000L)]
        [InlineData(0L)]
        [InlineData(-1731000000000L)]
        public void BadCreatedAt(long createdAt)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"99.00"), EncodeErr(Base with { CreatedAt = createdAt }));

        [Theory]
        [InlineData("jonhsmithnbcq", "29.00")]
        [InlineData("a@b@c", "29.00")]
        [InlineData("abcdefghijklmnopqrstuvwxyz@abcdef", "29.00")]
        [InlineData("a@", "29.00")]
        [InlineData("@b", "29.00")]
        [InlineData("@", "29.00")]
        public void BadAccount(string account, string tag)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)tag), EncodeErr(Base with { BakongAccountId = account }));

        [Fact]
        public void FieldLimits()
        {
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.01"), EncodeErr(Base with { AccountInformation = new string('x', 33) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29.02"), EncodeErr(Base with { AcquiringBank = new string('x', 33) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29"), EncodeErr(Base with { MerchantId = "1" }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"59"), EncodeErr(Base with { MerchantName = "" }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"59"), EncodeErr(Base with { MerchantName = new string('x', 26) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"60"), EncodeErr(Base with { MerchantCity = new string('x', 16) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"62.01"), EncodeErr(Base with { BillNumber = new string('x', 26) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"62.02"), EncodeErr(Base with { MobileNumber = new string('x', 26) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"62.03"), EncodeErr(Base with { StoreLabel = new string('x', 26) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"62.07"), EncodeErr(Base with { TerminalLabel = new string('x', 26) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"62.08"), EncodeErr(Base with { Purpose = new string('x', 26) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"29"), EncodeErr(Base with { AccountType = (KhqrAccountType)99 }));
            var maxed = Base with
            {
                BakongAccountId = "abcdefghijklmnopqrstuvwxyz@abcde", MerchantName = new string('x', 25),
                MerchantCity = new string('x', 15), BillNumber = new string('x', 25),
            };
            Assert.True(Khqr.Decode(Khqr.Encode(maxed), ParseMode.Strict).Ok);
        }

        [Theory]
        [InlineData("599")]
        [InlineData("abcd")]
        [InlineData("59990")]
        [InlineData("٥٩٩٩")]
        public void BadMcc(string mcc)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"52"), EncodeErr(Base with { MerchantCategoryCode = mcc }));

        [Fact]
        public void MerchantRules()
        {
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30.01"), EncodeErr(MerchantBase with { MerchantId = null }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30.01"), EncodeErr(MerchantBase with { MerchantId = new string('x', 33) }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30.02"), EncodeErr(MerchantBase with { AcquiringBank = null }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30"), EncodeErr(MerchantBase with { AccountInformation = "1" }));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"30.00"), EncodeErr(MerchantBase with { BakongAccountId = "khqrdevb" }));
        }

        [Theory]
        [InlineData("EUR")]
        [InlineData("764")]
        [InlineData("khr")]
        [InlineData(null)]
        public void BadCurrency(string? currency)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"53"), EncodeErr(Base with { Currency = currency! }));

        [Theory]
        [InlineData("116", "KHR")]
        [InlineData("840", "USD")]
        public void NumericCurrencyEncodesLikeAlpha(string numeric, string alpha)
        {
            var input = Base with { Amount = "5", ExpiresAt = Now + 1 };
            Assert.Equal(Khqr.Encode(input with { Currency = alpha }), Khqr.Encode(input with { Currency = numeric }));
        }

        [Fact]
        public void DecodedCurrencyCanBePassedBack()
        {
            var first = Khqr.Encode(Base with { Currency = "USD", Amount = 2L, ExpiresAt = Now + 1 });
            var again = Khqr.Encode(Base with { Currency = Khqr.Decode(first, ParseMode.Strict).Value!.Currency, Amount = 2L, ExpiresAt = Now + 1 });
            Assert.Equal(first, again);
        }

        [Theory]
        [InlineData("Café", "59")]
        public void NonAsciiOutsideTag64(string name, string tag)
            => Assert.Equal((TingQrErrorCode.NonAscii, (string?)tag), EncodeErr(Base with { MerchantName = name }));

        [Fact]
        public void NonAsciiOnOtherFields()
        {
            Assert.Equal((TingQrErrorCode.NonAscii, (string?)"60"), EncodeErr(Base with { MerchantCity = "Phnôm Pénh" }));
            Assert.Equal((TingQrErrorCode.NonAscii, (string?)"62.08"), EncodeErr(Base with { Purpose = "កាហ្វេ" }));
            Assert.Equal((TingQrErrorCode.NonAscii, (string?)"29.00"), EncodeErr(Base with { BakongAccountId = "jön@nbcq" }));
            Assert.Equal((TingQrErrorCode.NonAscii, (string?)"29.02"), EncodeErr(Base with { AcquiringBank = "Bank\n" }));
        }

        [Fact]
        public void KhmerCountedInCharactersNotBytes()
            => Assert.Contains("0108ចន ស្មីន", Khqr.Encode(Base with { AlternateLanguage = new KhqrAlternateLanguage("km", "ចន ស្មីន") }));

        [Theory]
        [InlineData("1!")]
        [InlineData("k1")]
        [InlineData(" k")]
        [InlineData("k-")]
        [InlineData("k")]
        [InlineData("kmr")]
        [InlineData("")]
        public void BadLanguage(string language)
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"64.00"),
                EncodeErr(Base with { AlternateLanguage = new KhqrAlternateLanguage(language, "X") }));

        [Fact]
        public void KhmerLanguageLetterIsNonAscii()
            => Assert.Equal((TingQrErrorCode.NonAscii, (string?)"64.00"),
                EncodeErr(Base with { AlternateLanguage = new KhqrAlternateLanguage("ក", "X") }));

        [Theory]
        [InlineData("km")]
        [InlineData("KM")]
        [InlineData("Km")]
        public void LanguageKeepsCase(string language)
            => Assert.Equal(language, Khqr.Decode(Khqr.Encode(Base with { AlternateLanguage = new KhqrAlternateLanguage(language, "X") })).Value!.AlternateLanguage!.Language);

        [Fact]
        public void MissingAlternateName()
            => Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"64.01"),
                EncodeErr(Base with { AlternateLanguage = new KhqrAlternateLanguage("km", "") }));

        // decode

        [Fact]
        public void MerchantWithPostalCodeAndUpperKm()
        {
            var v = Ok(Merchant, ParseMode.Strict);
            Assert.Equal(KhqrAccountType.Merchant, v.AccountType);
            Assert.Equal("85512464917", v.MerchantId);
            Assert.Equal("ACLEDA Bank Plc", v.AcquiringBank);
            Assert.Equal("12", v.PostalCode);
            Assert.Equal("KM", v.AlternateLanguage!.Language);
            Assert.Equal("Phnom Penh", v.AlternateLanguage.MerchantCity);
        }

        [Fact]
        public void OtherSchemesAreUnsupported()
        {
            Assert.Equal((TingQrErrorCode.UnsupportedScheme, (string?)"29"), Err(PromptPay));
            Assert.Equal((TingQrErrorCode.UnsupportedScheme, (string?)"29"), Err(PromptPay, ParseMode.Strict));
            Assert.Equal((TingQrErrorCode.UnsupportedScheme, (string?)"29"), Err(VietQrSample));
        }

        [Theory]
        [InlineData("john_smithdevb")]
        [InlineData("john@smith@devb")]
        public void BadAccountIsNotKhqr(string account)
            => Assert.Equal((TingQrErrorCode.UnsupportedScheme, (string?)"29"), Err(Rebuild(Individual, f => Set(f, "29", Tlv.Field("00", account)))));

        [Fact]
        public void Tag29NotTlvOrWithout00IsNotKhqr()
        {
            Assert.Equal((TingQrErrorCode.UnsupportedScheme, (string?)"29"), Err(Rebuild(Individual, f => Set(f, "29", "a@b"))));
            Assert.Equal((TingQrErrorCode.UnsupportedScheme, (string?)"29"), Err(Rebuild(Individual, f => Set(f, "29", Tlv.Field("01", "a@b")))));
        }

        [Fact]
        public void Missing53IsErrorInBothModes()
        {
            var payload = Rebuild(Individual, f => Drop(f, "53"));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"53"), Err(payload));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"53"), Err(payload, ParseMode.Strict));
        }

        [Theory]
        [InlineData("52")]
        [InlineData("59")]
        [InlineData("60")]
        public void MissingOptionalTag(string tag)
        {
            var payload = Rebuild(Individual, f => Drop(f, tag));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)tag), Err(payload, ParseMode.Strict));
            var r = Khqr.Decode(payload);
            Assert.True(r.Ok);
            var w = Assert.Single(r.Warnings);
            Assert.Equal((TingQrWarningCode.MissingOptionalTag, (string?)tag), (w.Code, w.Tag));
            var v = r.Value!;
            Assert.Null(tag == "52" ? v.MerchantCategoryCode : tag == "59" ? v.MerchantName : v.MerchantCity);
        }

        [Fact]
        public void Missing58()
        {
            var payload = Rebuild(Individual, f => Drop(f, "58"));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"58"), Err(payload, ParseMode.Strict));
            var r = Khqr.Decode(payload);
            Assert.Equal("KH", r.Value!.Country);
            var w = Assert.Single(r.Warnings);
            Assert.Equal("58", w.Tag);
            Assert.Contains("KH", w.Message);
        }

        [Fact]
        public void DynamicWithoutExpiry()
        {
            var payload = Rebuild(Individual, f => Set(f, "99", Tlv.Field("00", "1726821915797")));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"99.01"), Err(payload, ParseMode.Strict));
            var w = Assert.Single(Khqr.Decode(payload).Warnings);
            Assert.Equal((TingQrWarningCode.MissingOptionalTag, (string?)"99.01"), (w.Code, w.Tag));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"99.01"), Err(Rebuild(Individual, f => Drop(f, "99")), ParseMode.Strict));
            Assert.Empty(Khqr.Decode(Merchant, ParseMode.Strict).Warnings);
        }

        [Theory]
        [InlineData("01")]
        [InlineData("02")]
        public void MerchantWithoutSub(string sub)
        {
            var nodes = Tlv.Parse(Tlv.Parse(Merchant).First(f => f.Tag == "30").Value).Where(n => n.Tag != sub);
            var payload = Rebuild(Merchant, f => Set(f, "30", string.Concat(nodes.Select(n => Tlv.Field(n.Tag, n.Value)))));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)("30." + sub)), Err(payload));
        }

        [Fact]
        public void Tag29WinsOver30()
        {
            var t30 = Tlv.Parse(Merchant).First(f => f.Tag == "30").Value;
            var v = Ok(Rebuild(Individual, f => f.Concat(new[] { new TlvField("30", t30) }).ToArray()), ParseMode.Strict);
            Assert.Equal(KhqrAccountType.Individual, v.AccountType);
            Assert.Equal(t30, v.ExtraFields!["30"]);
        }

        [Fact]
        public void CurrencyVerbatim()
        {
            var v = Ok(Rebuild(Individual, f => Set(f, "53", "764")));
            Assert.Equal("764", v.Currency);
            Assert.Null(v.CurrencyAlpha);
            Assert.Equal("KHR", Ok(Rebuild(Individual, f => Set(f, "53", "116"))).CurrencyAlpha);
        }

        [Fact]
        public void ExtraFieldsAndUnionPay()
        {
            var v = Ok(Rebuild(Merchant, f => f.Concat(new[] { new TlvField("15", "UP1"), new TlvField("81", "X") }).ToArray()), ParseMode.Strict);
            Assert.Equal("UP1", v.UnionPay);
            Assert.Equal(new[] { "81" }, v.ExtraFields!.Keys);
            Assert.Equal("X", v.ExtraFields["81"]);
        }

        [Fact]
        public void Tag64WithOnlyLanguage()
        {
            var alt = Ok(Rebuild(Merchant, f => Set(f, "64", Tlv.Field("00", "km")))).AlternateLanguage!;
            Assert.Equal("km", alt.Language);
            Assert.Null(alt.MerchantName);
            Assert.Null(alt.MerchantCity);
        }

        [Fact]
        public void Tags00And01AreChecked()
        {
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"00"), Err(Rebuild(Individual, f => Set(f, "00", "02"))));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"01"), Err(Rebuild(Individual, f => Set(f, "01", "13"))));
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"00"), Err(Rebuild(Individual, f => Drop(f, "00"))));
            Assert.Equal((TingQrErrorCode.MissingTag, (string?)"01"), Err(Rebuild(Individual, f => Drop(f, "01"))));
        }

        [Fact]
        public void DuplicateSubTags()
        {
            Assert.Equal((TingQrErrorCode.DuplicateTag, (string?)"29.01"),
                Err(Rebuild(Individual, f => Set(f, "29", Tlv.Field("00", "a@b") + Tlv.Field("01", "x") + Tlv.Field("01", "y")))));
            Assert.Equal((TingQrErrorCode.DuplicateTag, (string?)"99.00"),
                Err(Rebuild(Individual, f => Set(f, "99", Tlv.Field("00", "1") + Tlv.Field("00", "2")))));
            Assert.Equal((TingQrErrorCode.DuplicateTag, (string?)"64.00"),
                Err(Rebuild(Individual, f => Set(f, "64", Tlv.Field("00", "km") + Tlv.Field("00", "km")))));
        }

        [Fact]
        public void CrcErrorAndDefaultIsLenient()
        {
            Assert.Equal((TingQrErrorCode.CrcMismatch, (string?)"63"), Err(Individual.Substring(0, Individual.Length - 1) + "0"));
            Assert.True(Khqr.Decode(Rebuild(Individual, f => Drop(f, "52"))).Ok);
        }

        [Fact]
        public void ParseWarningsAreKept()
            => Assert.Equal(new[] { TingQrWarningCode.TrimmedWhitespace }, Khqr.Decode(" " + Individual + " ").Warnings.Select(w => w.Code));

        [Theory]
        [InlineData("01726821915797")]
        [InlineData("17268219157970")]
        public void FourteenDigitTimestampIsNotATime(string stamp)
        {
            var v = Ok(Rebuild(Individual, f => Set(f, "99", Tlv.Field("00", stamp) + Tlv.Field("01", stamp))));
            Assert.Null(v.CreatedAt);
            Assert.Null(v.ExpiresAt);
            Assert.Equal(stamp, v.Timestamp!["00"]);
        }

        [Fact]
        public void NonAsciiDigitsAreNotATimestamp()
        {
            var arabic = "١٧٢٦٨٢١٩١٥٧٩٧";
            var payload = Rebuild(Individual, f => Set(f, "99", Tlv.Field("00", arabic) + Tlv.Field("01", arabic)));
            Assert.Null(Ok(payload).CreatedAt);
            Assert.Equal((TingQrErrorCode.InvalidValue, (string?)"99.00"), Err(payload, ParseMode.Strict));
        }

        [Fact]
        public void AnIndividualAccountWinsOverAMerchantTemplateInTheSamePayload()
        {
            foreach (var template in new[]
            {
                Tlv.Field("00", "other@bank"),
                Tlv.Field("00", "other@bank") + Tlv.Field("01", "m1") + Tlv.Field("02", "bk"),
            })
            {
                var payload = Rebuild(Individual, f => f.Concat(new[] { new TlvField("30", template) }).ToArray());
                var v = Ok(payload);
                Assert.Equal(KhqrAccountType.Individual, v.AccountType);
                Assert.Equal("john_smith@devb", v.BakongAccountId);
                Assert.Null(v.MerchantId);
            }
        }

        [Fact]
        public void ALetterInAThirteenCharacterStampIsNotATime()
        {
            var v = Ok(Rebuild(Individual, f => Set(f, "99", Tlv.Field("00", "123456789012a") + Tlv.Field("01", "123456789012a"))));
            Assert.Null(v.CreatedAt);
            Assert.Null(v.ExpiresAt);
        }

        [Fact]
        public void EncodeErrorsCarryTheTagOfTheFieldAtFault()
        {
            var long33 = new string('a', 33);
            var cases = new (KhqrInput Input, string Tag)[]
            {
                (Base with { BakongAccountId = "" }, "29.00"),
                (Base with { BakongAccountId = "nobank" }, "29.00"),
                (Base with { BakongAccountId = "@bank" }, "29.00"),
                (Base with { BakongAccountId = "name@" }, "29.00"),
                (Base with { BakongAccountId = "a@b@c" }, "29.00"),
                (Base with { Currency = "USD", Amount = "1.234", ExpiresAt = Now + 1 }, "54"),
                (Base with { Currency = "USD", Amount = "1.", ExpiresAt = Now + 1 }, "54"),
                (Base with { Currency = "USD", Amount = "1.x", ExpiresAt = Now + 1 }, "54"),
                (MerchantBase with { BakongAccountId = "" }, "30.00"),
                (MerchantBase with { BakongAccountId = "nobank" }, "30.00"),
                (Base with { AccountInformation = long33 }, "29.01"),
                (MerchantBase with { MerchantId = "" }, "30.01"),
                (MerchantBase with { MerchantId = long33 }, "30.01"),
                (Base with { AcquiringBank = long33 }, "29.02"),
                (MerchantBase with { AcquiringBank = long33 }, "30.02"),
                (MerchantBase with { AcquiringBank = "" }, "30.02"),
                (Base with { MerchantName = "" }, "59"),
                (Base with { MerchantCity = new string('a', 16) }, "60"),
                (Base with { BillNumber = new string('a', 26) }, "62.01"),
                (Base with { MobileNumber = new string('a', 26) }, "62.02"),
                (Base with { StoreLabel = new string('a', 26) }, "62.03"),
                (Base with { TerminalLabel = new string('a', 26) }, "62.07"),
                (Base with { Purpose = new string('a', 26) }, "62.08"),
                (Base with { AlternateLanguage = new KhqrAlternateLanguage("", "x") }, "64.00"),
                (Base with { AlternateLanguage = new KhqrAlternateLanguage("k1", "x") }, "64.00"),
                (Base with { AlternateLanguage = new KhqrAlternateLanguage("km", "") }, "64.01"),
                (Base with { AlternateLanguage = new KhqrAlternateLanguage("km", "x", new string('a', 16)) }, "64.02"),
                (Base with { CreatedAt = 0 }, "99.00"),
                (Base with { CreatedAt = 999999999999L }, "99.00"),
                (Base with { CreatedAt = 10000000000000L }, "99.00"),
                (Base with { ExpiresAt = 999999999999L }, "99.01"),
                (Base with { ExpiresAt = 10000000000000L }, "99.01"),
                (Base with { ExpiresAt = Now }, "99.01"),
                (Base with { Currency = "EUR" }, "53"),
                (Base with { MerchantCategoryCode = "59a9" }, "52"),
                (Base with { MerchantCategoryCode = "599" }, "52"),
                (Base with { Currency = "USD", Amount = ".5", ExpiresAt = Now + 1 }, "54"),
                (Base with { Amount = 5L }, "99.01"),
            };
            foreach (var (input, tag) in cases)
            {
                var e = Assert.Throws<TingQrException>(() => Khqr.Encode(input));
                Assert.Equal(tag, e.Tag);
            }
        }

        [Fact]
        public void EncodeAcceptsTheBoundaryOfTimestampsAndLanguageLetters()
        {
            Khqr.Encode(Base with { CreatedAt = 1000000000000L });
            Khqr.Encode(Base with { CreatedAt = 9999999999998L, ExpiresAt = 9999999999999L });
            foreach (var code in new[] { "aa", "zz", "AA", "ZZ", "az", "AZ" })
            {
                Khqr.Encode(Base with { AlternateLanguage = new KhqrAlternateLanguage(code, "x") });
            }
            foreach (var code in new[] { "@a", "`a", "[a", "{a", "a@", "a`" })
            {
                var e = Assert.Throws<TingQrException>(() => Khqr.Encode(Base with { AlternateLanguage = new KhqrAlternateLanguage(code, "x") }));
                Assert.Equal("64.00", e.Tag);
            }
        }

        [Fact]
        public void KhmerMerchantDecodesWithCodePointLengths()
        {
            var v = Ok(Individual, ParseMode.Strict);
            Assert.Equal("ចន ស្មីន", v.AlternateLanguage!.MerchantName);
            Assert.Equal(1726821915797, v.CreatedAt);
            Assert.Equal(1726822035797, v.ExpiresAt);
        }
    }
}
