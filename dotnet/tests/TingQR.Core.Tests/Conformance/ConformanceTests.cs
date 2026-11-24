using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using Xunit;

namespace TingQR.Tests.Conformance
{
    /// <summary>
    /// One test per vector in conformance/vectors/ whose scheme is registered (matrix vectors, scheme "render",
    /// belong to the renderer). Rules: <see cref="VectorRunner"/>. To support a scheme, register it in the static
    /// constructor below with an input converter built on <see cref="JsonInput"/>.
    /// </summary>
    public class ConformanceTests
    {
        static ConformanceTests()
        {
            VectorRunner.Register("vietqr", VietQrInputOf, (payload, mode) => VietQr.Decode(payload, mode));
            ResultJson.RegisterEnum(new Dictionary<PromptPayKind, string>
            {
                [PromptPayKind.CreditTransfer] = "credit-transfer",
                [PromptPayKind.BillPayment] = "bill-payment",
            });
            VectorRunner.Register("promptpay", PromptPayInputOf, (payload, mode) => PromptPayQr.Decode(payload, mode));
            VectorRunner.Register("vnpay", null, (payload, mode) => VnpayQr.Decode(payload, mode));
            VectorRunner.Register("khqr", KhqrInputOf, (payload, mode) => Khqr.Decode(payload, mode));
            ResultJson.RegisterEnum(new Dictionary<QrScheme, string>
            {
                [QrScheme.VietQr] = "vietqr",
                [QrScheme.Vnpay] = "vnpay",
                [QrScheme.PromptPay] = "promptpay",
                [QrScheme.Khqr] = "khqr",
            });
            // Like the TS runner, compare only scheme and alsoMatches (the data is covered by the scheme vectors).
            VectorRunner.Register("detect", null, (payload, _) =>
            {
                var r = TingQrDetector.Detect(payload);
                return r.Ok
                    ? TingQrResult<DetectSummary>.Success(new DetectSummary(r.Value!.Scheme, r.Value.AlsoMatches), r.Warnings)
                    : TingQrResult<DetectSummary>.Failure(r.Error!);
            });
            // Not QR schemes: `link` vectors build a link from input (encode-invalid ones expect BankApps.Link to
            // throw); `lookup` vectors: Banks.Find(query) → its bin or null, BankApps.ForBank(bin) → app ids in order.
            VectorRunner.Register("bank-app-link", BankAppLinkOf, null);
            VectorRunner.Register("bank-lookup", node =>
            {
                var i = JsonInput.Of(node);
                var query = i.String("query") ?? throw new InputConversionException("input.query is missing.");
                i.Done();
                return Banks.Find(query)?.Bin;
            }, null);
            VectorRunner.Register("bank-apps-for-bank", node =>
            {
                var i = JsonInput.Of(node);
                var bin = i.String("bin") ?? throw new InputConversionException("input.bin is missing.");
                i.Done();
                return BankApps.ForBank(bin).Select(a => a.Id).ToList();
            }, null);
        }

        private static readonly IReadOnlyDictionary<string, AppPlatform> AppPlatforms =
            new Dictionary<string, AppPlatform> { ["android"] = AppPlatform.Android, ["ios"] = AppPlatform.Ios };

        private static object? BankAppLinkOf(JsonNode node)
        {
            var i = JsonInput.Of(node);
            var appId = i.String("appId") ?? throw new InputConversionException("input.appId is missing.");
            var platform = i.Enum("platform", AppPlatforms) ?? throw new InputConversionException("input.platform is missing.");
            var fallbackUrl = i.String("fallbackUrl");
            i.Done();
            return BankApps.Link(appId, platform, fallbackUrl);
        }

        private sealed record DetectSummary(QrScheme Scheme, IReadOnlyList<QrScheme> AlsoMatches);

        private static readonly IReadOnlyDictionary<string, KhqrAccountType> KhqrAccountTypes =
            new Dictionary<string, KhqrAccountType> { ["individual"] = KhqrAccountType.Individual, ["merchant"] = KhqrAccountType.Merchant };

        private static object? KhqrInputOf(JsonNode node)
        {
            var i = JsonInput.Of(node);
            var alt = i.Object("alternateLanguage");
            KhqrAlternateLanguage? language = null;
            if (alt != null)
            {
                language = new KhqrAlternateLanguage(alt.String("language")!, alt.String("merchantName")!, alt.String("merchantCity"));
                alt.Done();
            }
            var input = new KhqrInput
            {
                AccountType = i.Enum("accountType", KhqrAccountTypes) ?? throw new InputConversionException("input.accountType is missing."),
                BakongAccountId = i.String("bakongAccountId")!,
                AccountInformation = i.String("accountInformation"),
                MerchantId = i.String("merchantId"),
                AcquiringBank = i.String("acquiringBank"),
                MerchantName = i.String("merchantName")!,
                MerchantCity = i.String("merchantCity"),
                MerchantCategoryCode = i.String("merchantCategoryCode"),
                Currency = i.String("currency")!,
                Amount = i.Amount("amount"),
                BillNumber = i.String("billNumber"),
                MobileNumber = i.String("mobileNumber"),
                StoreLabel = i.String("storeLabel"),
                TerminalLabel = i.String("terminalLabel"),
                Purpose = i.String("purpose"),
                AlternateLanguage = language,
                CreatedAt = i.Long("createdAt") ?? throw new InputConversionException("input.createdAt is missing."),
                ExpiresAt = i.Long("expiresAt"),
            };
            i.Done();
            return Khqr.Encode(input);
        }

        [Fact]
        public void KhqrHasAll21Vectors()
        {
            Assert.Equal(21, Vectors().Count(row => VectorRunner.Vectors[(string)row[0]]["scheme"]!.GetValue<string>() == "khqr"));
        }

        private static readonly IReadOnlyDictionary<string, VietQrServiceCode> VietQrServices =
            new Dictionary<string, VietQrServiceCode> { ["account"] = VietQrServiceCode.Account, ["card"] = VietQrServiceCode.Card };

        private static object? VietQrInputOf(JsonNode node)
        {
            var i = JsonInput.Of(node);
            var input = new VietQrInput
            {
                BankBin = i.String("bankBin")!,
                AccountNumber = i.String("accountNumber")!,
                Service = i.Enum("service", VietQrServices) ?? VietQrServiceCode.Account,
                Amount = i.Amount("amount"),
                Purpose = i.String("purpose"),
            };
            i.Done();
            return VietQr.Encode(input);
        }

        private static readonly string[] PromptPayTargetKeys = { "mobile", "nationalId", "eWallet", "billerId" };

        private static object? PromptPayInputOf(JsonNode node)
        {
            var i = JsonInput.Of(node);
            var t = i.Object("target") ?? throw new InputConversionException("input.target is missing.");
            var keys = PromptPayTargetKeys.Where(t.Has).ToList();
            if (keys.Count != 1)
            {
                throw new InputConversionException("input.target must have exactly one of " + string.Join(", ", PromptPayTargetKeys) + ".");
            }
            PromptPayTarget target;
            switch (keys[0])
            {
                case "mobile": target = new PromptPayTarget.Mobile(t.String("mobile")!); break;
                case "nationalId": target = new PromptPayTarget.NationalId(t.String("nationalId")!); break;
                case "eWallet": target = new PromptPayTarget.EWallet(t.String("eWallet")!); break;
                default: target = new PromptPayTarget.Bill(t.String("billerId")!, t.String("reference1"), t.String("reference2")); break;
            }
            t.Done();
            var input = new PromptPayInput { Target = target, Amount = i.Amount("amount") };
            i.Done();
            return PromptPayQr.Encode(input);
        }

        public static IEnumerable<object[]> Vectors()
            => VectorRunner.Vectors.Values
                .Where(v => (string)v["scheme"]! != "render" && VectorRunner.IsRegistered((string)v["scheme"]!))
                .Select(v => new object[] { (string)v["id"]! });

        [Theory]
        [MemberData(nameof(Vectors))]
        public void Vector(string id) => VectorRunner.Run(id);

        [Fact]
        public void EveryVectorFileIsLoadedOnceAndNamedAfterItsId()
        {
            var files = Directory.GetFiles(VectorRunner.VectorsDir, "*.json", SearchOption.AllDirectories);
            Assert.Equal(files.Length, VectorRunner.Vectors.Count);
            foreach (var f in files)
            {
                Assert.True(VectorRunner.Vectors.ContainsKey(Path.GetFileNameWithoutExtension(f)), f);
            }
        }

        [Fact]
        public void EveryVectorOfARegisteredSchemeRuns()
        {
            var ran = new HashSet<string>(Vectors().Select(row => (string)row[0]));
            foreach (var scheme in VectorRunner.RegisteredSchemes)
            {
                var ofScheme = VectorRunner.Vectors.Values.Where(v => (string)v["scheme"]! == scheme).ToList();
                Assert.NotEmpty(ofScheme);
                Assert.All(ofScheme, v => Assert.Contains((string)v["id"]!, ran));
            }
        }

        /// <summary>Vectors of a scheme nobody registered would not run at all; render belongs to the renderer (Plan 8b).</summary>
        [Fact]
        public void EveryVectorSchemeHasARunner()
        {
            var missing = VectorRunner.Vectors.Values
                .Select(v => (string)v["scheme"]!)
                .Where(s => s != "render" && !VectorRunner.IsRegistered(s))
                .Distinct()
                .OrderBy(s => s, StringComparer.Ordinal)
                .ToList();
            Assert.True(missing.Count == 0, "schemes without a runner: " + string.Join(", ", missing));
        }

        [Fact]
        public void BankVectorCounts()
        {
            int Count(string scheme) => Vectors().Count(row => VectorRunner.Vectors[(string)row[0]]["scheme"]!.GetValue<string>() == scheme);
            Assert.Equal(12, Count("bank-lookup"));
            Assert.Equal(3, Count("bank-apps-for-bank"));
            Assert.Equal(24, Count("bank-app-link"));
        }

        [Fact]
        public void VietQrHasAll29Vectors()
        {
            Assert.Equal(29, Vectors().Count(row => VectorRunner.Vectors[(string)row[0]]["scheme"]!.GetValue<string>() == "vietqr"));
        }

        [Fact]
        public void PromptPayHasAll32Vectors()
        {
            Assert.Equal(32, Vectors().Count(row => VectorRunner.Vectors[(string)row[0]]["scheme"]!.GetValue<string>() == "promptpay"));
        }

        [Fact]
        public void EveryTypeCheckIdIsAVector()
        {
            Assert.All(TypeCheckVectors.Ids, id => Assert.True(VectorRunner.Vectors.ContainsKey(id), id));
        }
    }
}
