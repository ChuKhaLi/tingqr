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
        }

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

        private static readonly IReadOnlyDictionary<string, VietQrService> VietQrServices =
            new Dictionary<string, VietQrService> { ["account"] = VietQrService.Account, ["card"] = VietQrService.Card };

        private static object? VietQrInputOf(JsonNode node)
        {
            var i = JsonInput.Of(node);
            var input = new VietQrInput
            {
                BankBin = i.String("bankBin")!,
                AccountNumber = i.String("accountNumber")!,
                Service = i.Enum("service", VietQrServices) ?? VietQrService.Account,
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
