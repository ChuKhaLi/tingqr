using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Xunit;

namespace TingQR.Tests
{
    // banks-lookup.spec.ts and banks-link.spec.ts, where they add to the vectors.
    public class BanksTests
    {
        private static JsonArray Json(string file, string key)
            => (JsonArray)JsonNode.Parse(File.ReadAllText(Path.Combine(ConformanceRoot.Path, "banks", file)))![key]!;

        private static TingQrException Thrown(Action f)
        {
            var e = Assert.Throws<TingQrException>(f);
            Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
            return e;
        }

        // ---- data

        [Fact]
        public void AllCarriesEveryEntryOfConformanceBanksInFileOrder()
        {
            Assert.Equal(Json("banks.json", "banks").Select(b => (string)b!["bin"]!), Banks.All.Select(b => b.Bin));
            Assert.Equal(Json("bank-apps.json", "apps").Select(a => (string)a!["id"]!), BankApps.All.Select(a => a.Id));
        }

        [Fact]
        public void GeneratedRecordsCarryTheJsonValues()
        {
            Assert.Equal(new Bank("970422", "MB", "MBBank", "Ngân hàng TMCP Quân đội", "MSCBVNVX", "https://cdn.vietqr.io/img/MB.png"), Banks.Find("970422"));
            Assert.Null(Banks.Find("168999")!.Swift);
            Assert.Equal(new BankAppAndroid("vn.com.techcombank.bb.app", "tcb", "applink"), BankApps.Find("tcb")!.Android);
            Assert.Equal(BankAppConfidence.MultiSource, BankApps.Find("tcb")!.Confidence);
            Assert.True(BankApps.Find("mb")!.VietqrAutofill);
            var momo = BankApps.Find("momo")!;
            Assert.Equal(new BankAppIos("momo"), momo.Ios);
            Assert.Null(momo.Android);
            Assert.Null(BankApps.Find("nab")!.Ios);
            // A bidi mark in the source name survives generation (sync-dotnet.mjs writes it as ‪).
            Assert.Equal("CAKE - Digital Bankin‪g", BankApps.Find("cake")!.Name);
        }

        [Fact]
        public void ListsAreReadOnly()
        {
            Assert.False(Banks.All is Bank[], "Banks.All must not be an array (a cast would make it writable)");
            Assert.False(BankApps.All is BankApp[], "BankApps.All must not be an array");
            var banks = Assert.IsAssignableFrom<IList<Bank>>(Banks.All);
            Assert.Throws<NotSupportedException>(() => banks[0] = banks[1]);
            Assert.Throws<NotSupportedException>(() => banks.Add(banks[0]));
            var apps = Assert.IsAssignableFrom<IList<BankApp>>(BankApps.All);
            Assert.Throws<NotSupportedException>(() => apps[0] = apps[1]);
            Assert.Throws<NotSupportedException>(() => apps.Clear());
            var forBank = BankApps.ForBank("970416");
            Assert.False(forBank is BankApp[]);
            if (forBank is IList<BankApp> list) Assert.Throws<NotSupportedException>(() => list.Clear());
            Assert.Equal(2, BankApps.ForBank("970416").Count);
        }

        [Fact]
        public void FindNullIsNull()
        {
            Assert.Null(Banks.Find(null));
            Assert.Null(BankApps.Find(null));
            Assert.Empty(BankApps.ForBank(null));
        }

        // ---- Banks.Find (findBank)

        [Fact]
        public void FindByCodeOrShortNameIgnoresCase()
        {
            var mb = Banks.Find("970422");
            Assert.NotNull(mb);
            Assert.Same(mb, Banks.Find("MB"));
            Assert.Same(mb, Banks.Find("mb"));
            Assert.Same(mb, Banks.Find("MBBANK"));
            Assert.Same(mb, Banks.Find("mbbank"));
        }

        [Fact]
        public void FindDoesNotTrimAndNeedsAWholeBin()
        {
            Assert.Null(Banks.Find(" MB"));
            Assert.Null(Banks.Find("MB "));
            Assert.Null(Banks.Find(""));
            Assert.Null(Banks.Find("97042"));
            Assert.Null(Banks.Find("9704220"));
            // Six digits, but not ASCII: no BIN match, and no code is spelled that way.
            Assert.Null(Banks.Find("٩٧٠٤٢٢"));
        }

        [Fact]
        public void ACodeWinsOverAnotherBankShortNameThatSpellsTheSame()
        {
            var list = new[]
            {
                new Bank("900001", "AAA", "BBB", "first", null, "https://x/a.png"),
                new Bank("900002", "BBB", "CCC", "second", null, "https://x/b.png"),
            };
            Assert.Equal("900002", Banks.FindIn(list, "bbb")?.Bin);
            Assert.Equal("900002", Banks.FindIn(list, "ccc")?.Bin);
            Assert.Equal("900001", Banks.FindIn(list, "900001")?.Bin);
            Assert.Null(Banks.FindIn(list, "zzz"));
        }

        [Theory]
        [InlineData("tr-TR")]
        [InlineData("de-DE")]
        public void FindIgnoresTheMachineCulture(string culture)
        {
            var original = CultureInfo.CurrentCulture;
            try
            {
                CultureInfo.CurrentCulture = new CultureInfo(culture);
                // Turkish lower-cases I to dotless ı; the lookup must not.
                Assert.Equal("970441", Banks.Find("vib")?.Bin);
                Assert.Equal("970441", Banks.Find("VIB")?.Bin);
                Assert.Equal("970415", Banks.Find("VIETINBANK")?.Bin);
            }
            finally
            {
                CultureInfo.CurrentCulture = original;
            }
        }

        // ---- BankApps.Find / ForBank

        [Fact]
        public void FindAppIsExact()
        {
            Assert.Equal("tcb", BankApps.Find("tcb")?.Id);
            Assert.Null(BankApps.Find("nope"));
            Assert.Null(BankApps.Find("TCB"));
        }

        [Fact]
        public void ForBankReturnsEveryAppOfABinAndEmptyForNone()
        {
            Assert.Equal(new[] { "acb", "acb-biz" }, BankApps.ForBank("970416").Select(a => a.Id));
            Assert.Equal(new[] { "mb" }, BankApps.ForBank("970422").Select(a => a.Id));
            Assert.Empty(BankApps.ForBank("999999"));
        }

        // ---- BankApps.Link (bankAppLink)

        [Fact]
        public void WithoutFallbackTheAndroidLinkHasNoBrowserFallback()
        {
            Assert.DoesNotContain("S.browser_fallback_url", BankApps.Link("tcb", AppPlatform.Android));
            Assert.Equal(BankApps.Link("tcb", AppPlatform.Android), BankApps.Link("tcb", AppPlatform.Android, null));
        }

        [Fact]
        public void ALocalHttpFallbackIsAccepted()
        {
            Assert.Equal(
                "intent://#Intent;scheme=mbbank;package=com.mbmobile;S.browser_fallback_url=http%3A%2F%2Flocalhost%3A4200%2Fx;end",
                BankApps.Link("mb", AppPlatform.Android, "http://localhost:4200/x"));
        }

        [Theory]
        [InlineData("data:text/html,x")]
        [InlineData("intent://x#Intent;end")]
        [InlineData("javascript:alert(1)")]
        [InlineData("ftp://example.com/")]
        [InlineData("/relative")]
        [InlineData("")]
        [InlineData("https://")]
        [InlineData("https://a b.vn/")]
        [InlineData("https://example.com:99999/")]
        [InlineData("https://example.com:8x/")]
        [InlineData("https://a:b:c/")]
        [InlineData("https://xn--abc.vn/")]
        [InlineData("https://\uD800.vn/")]
        public void BadFallbackThrowsInvalidValueNamingTheField(string fallbackUrl)
        {
            Assert.Contains("fallbackUrl", Thrown(() => BankApps.Link("mb", AppPlatform.Android, fallbackUrl)).Message);
            // Checked on iOS too, although iOS ignores it.
            Thrown(() => BankApps.Link("mb", AppPlatform.Ios, fallbackUrl));
        }

        // WHATWG accepts and rewrites these (Node 22: user info kept, [::1] kept, ex%41mple → example, 0x7f.1 →
        // 127.0.0.1, a/../b → b, \ → /). The .NET checker is not a full WHATWG parser and rejects them rather than risk
        // a different href (conformance/README.md: the two versions only promise to agree on the vectors).
        [Theory]
        [InlineData("https://user@example.com/")]
        [InlineData("https://[::1]/")]
        [InlineData("https://ex%41mple.com/")]
        [InlineData("https://0x7f.1/")]
        [InlineData("https://1.2.3.04/")]
        [InlineData("https://a.vn/a/../b")]
        [InlineData("https://a.vn/a/%2E/b")]
        [InlineData("https://a.vn/x\\y")]
        public void FallbackOutsideTheSupportedSubsetIsRejected(string fallbackUrl)
        {
            Thrown(() => BankApps.Link("mb", AppPlatform.Android, fallbackUrl));
        }

        [Fact]
        public void AFallbackThatIsNotAUrlSaysItMustBeAbsolute()
        {
            Assert.Contains("absolute", Thrown(() => BankApps.Link("mb", AppPlatform.Android, "not a url")).Message);
        }

        [Theory]
        // What WHATWG URL (Node 22) gives for these, checked with: node -e "console.log(new URL(process.argv[1]).href)" <url>
        [InlineData("https://example.com", "https://example.com/")]
        [InlineData("HTTP://Example.COM:80/A?B#C", "http://example.com/A?B#C")]
        [InlineData("https://example.com:443/", "https://example.com/")]
        [InlineData("https://example.com:8443", "https://example.com:8443/")]
        [InlineData("https://example.com?q", "https://example.com/?q")]
        [InlineData("https://example.com#f", "https://example.com/#f")]
        [InlineData("https://example.com/a b", "https://example.com/a%20b")]
        [InlineData("https://example.com/?a b", "https://example.com/?a%20b")]
        [InlineData("https://example.com/#a b", "https://example.com/#a%20b")]
        [InlineData("https://example.com/%7e", "https://example.com/%7e")]
        [InlineData("\thttps://example.com/\n", "https://example.com/")]
        [InlineData("https:example.com", "https://example.com/")]
        [InlineData("https://ví-dụ.vn/", "https://xn--v-d-rma6749a.vn/")]
        [InlineData("https://VÍ-DỤ.vn/", "https://xn--v-d-rma6749a.vn/")]
        [InlineData("https://xn--v-d-rma6749a.vn/", "https://xn--v-d-rma6749a.vn/")]
        [InlineData("https://1.2.3.4/", "https://1.2.3.4/")]
        [InlineData("https://a.vn:/", "https://a.vn/")]
        [InlineData("http://example.com:0080/", "http://example.com/")]
        [InlineData("https://a..vn/", "https://a..vn/")]
        [InlineData("https://a_b.vn/", "https://a_b.vn/")]
        [InlineData("https://a.vn./", "https://a.vn./")]
        [InlineData("https:///a.vn", "https://a.vn/")]
        [InlineData("https://a.vn/'<>\"`{}|^", "https://a.vn/'%3C%3E%22%60%7B%7D|^")]
        [InlineData("https://a.vn/?'<>\"`{}|^", "https://a.vn/?%27%3C%3E%22`{}|^")]
        [InlineData("https://a.vn/#'<>\"`{}|^", "https://a.vn/#'%3C%3E%22%60{}|^")]
        [InlineData("https://example.com?", "https://example.com/?")]
        [InlineData("https://example.com#", "https://example.com/#")]
        [InlineData("https://a.vn/%zz%", "https://a.vn/%zz%")]
        [InlineData("https://a.vn/\u0001\u007f", "https://a.vn/%01%7F")]
        [InlineData("https://a.vn/😀?😀#😀", "https://a.vn/%F0%9F%98%80?%F0%9F%98%80#%F0%9F%98%80")]
        [InlineData("https://a.vn/?q=\\", "https://a.vn/?q=\\")]
        public void FallbackIsNormalisedLikeWhatwgHref(string input, string href)
        {
            Assert.Equal(href, FallbackUrl.Normalize(input));
        }

        // What WHATWG URL (Node 22) gives, checked with: node -e "console.log(new URL(process.argv[1]).href)" <url>
        [Theory]
        [InlineData("https://a.vn:65535/", "https://a.vn:65535/")]
        [InlineData("https://a./", "https://a./")]
        [InlineData("https://a.vn/\u001fx", "https://a.vn/%1Fx")]
        [InlineData("https://a.vn:1/", "https://a.vn:1/")]
        [InlineData("http://a.vn:443/", "http://a.vn:443/")]
        [InlineData("https://a.vn:80/", "https://a.vn:80/")]
        [InlineData("https://a.vn:00443/", "https://a.vn/")]
        [InlineData("https://a../", "https://a../")]
        [InlineData("https://0.0.0.0/", "https://0.0.0.0/")]
        [InlineData("https://10.20.30.40/", "https://10.20.30.40/")]
        [InlineData("https://100.200.255.255/", "https://100.200.255.255/")]
        [InlineData("https://255.255.255.255/", "https://255.255.255.255/")]
        [InlineData("https://1.2.3.123/", "https://1.2.3.123/")]
        [InlineData("https://zZ.vn/", "https://zz.vn/")]
        [InlineData("https://AZaz09.vn/", "https://azaz09.vn/")]
        [InlineData("https://exa\tmple.com/", "https://example.com/")]
        [InlineData("https://exa\nmple.com/", "https://example.com/")]
        [InlineData("https://exa\rmple.com/", "https://example.com/")]
        [InlineData("https://a.vn/a.b/..c/.d", "https://a.vn/a.b/..c/.d")]
        [InlineData("https://a.vn/~", "https://a.vn/~")]
        [InlineData("https://a.vn/}", "https://a.vn/%7D")]
        [InlineData("https://a.vn/a?b#c#d", "https://a.vn/a?b#c#d")]
        [InlineData("https://a.vn/\u0080", "https://a.vn/%C2%80")]
        [InlineData("https://a.vn/߿", "https://a.vn/%DF%BF")]
        [InlineData("https://a.vn/ࠀ", "https://a.vn/%E0%A0%80")]
        [InlineData("https://a.vn/￿", "https://a.vn/%EF%BF%BF")]
        [InlineData("https://a.vn/\U00010000", "https://a.vn/%F0%90%80%80")]
        [InlineData("https://a.vn/\U0010FFFF", "https://a.vn/%F4%8F%BF%BF")]
        [InlineData("https://a.vn/?\u0080", "https://a.vn/?%C2%80")]
        [InlineData("https://a.vn/#ࠀ", "https://a.vn/#%E0%A0%80")]
        public void FallbackBoundariesMatchWhatwgHref(string input, string href)
        {
            Assert.Equal(href, FallbackUrl.Normalize(input));
        }

        // WHATWG throws for the first group; the second is accepted by WHATWG (1.2.3.4. and %2e segments are rewritten)
        // but outside the subset this checker supports, so it throws too.
        [Theory]
        [InlineData("https://a.vn:65536/")]
        [InlineData("https://1./")]
        [InlineData("https://a\u0080.vn/")]
        [InlineData("https://a b.vn/")]
        [InlineData("https://a\u001fb.vn/")]
        [InlineData("https://256.1.1.1/")]
        [InlineData("https://1.2.3.1234/")]
        [InlineData("https://1..2.3/")]
        [InlineData("https://a.1/")]
        [InlineData("https://a\u007F.vn/")]
        [InlineData("https://a<b.vn/")]
        [InlineData("https://a>b.vn/")]
        [InlineData("https://a^b.vn/")]
        [InlineData("https://a|b.vn/")]
        [InlineData("https://a]b.vn/")]
        [InlineData("https://1.2.3.4./")]
        [InlineData("https://a.vn/a/%2e/b")]
        [InlineData("https://a.vn/%2e%2e")]
        [InlineData("https://a.vn/.%2e")]
        [InlineData("https://a.vn/%2E.")]
        [InlineData("https://a.vn/%2e")]
        [InlineData("https://a.vn/..")]
        [InlineData("https://a.vn/.")]
        public void FallbackHostsPortsAndPathsOutsideTheSubsetThrow(string url)
        {
            Assert.Equal(TingQrErrorCode.InvalidValue, Assert.Throws<TingQrException>(() => FallbackUrl.Normalize(url)).Code);
        }

        [Theory]
        [InlineData("a:b")]
        [InlineData("a+b:x")]
        [InlineData("a-b:x")]
        [InlineData("a.b:x")]
        [InlineData("a1:x")]
        [InlineData("a9:x")]
        [InlineData("zaAZ:x")]
        [InlineData("Abc:x")]
        [InlineData("Z:x")]
        public void AWellFormedSchemeThatIsNotHttpSaysSo(string url)
        {
            Assert.Contains("https: or http:", Assert.Throws<TingQrException>(() => FallbackUrl.Normalize(url)).Message);
        }

        [Theory]
        [InlineData(":x")]
        [InlineData("1abc://x")]
        [InlineData("a b:x")]
        [InlineData("a!b:x")]
        [InlineData("a/b:x")]
        [InlineData("a@b:x")]
        [InlineData("a[b:x")]
        [InlineData("a`b:x")]
        [InlineData("a{b:x")]
        [InlineData("@a:x")]
        [InlineData("[a:x")]
        public void AMalformedSchemeSaysTheUrlIsNotAbsolute(string url)
        {
            var message = Assert.Throws<TingQrException>(() => FallbackUrl.Normalize(url)).Message;
            Assert.Contains("absolute", message);
        }

        [Fact]
        public void FindAndForBankAnswerForARealBinAndForNull()
        {
            Assert.Null(BankApps.Find(null));
            Assert.Empty(BankApps.ForBank(null));
            Assert.NotEmpty(BankApps.ForBank("970422"));
            Assert.All(BankApps.ForBank("970422"), a => Assert.Equal("970422", a.Bin));
        }

        [Fact]
        public void ANullFallbackIsInvalidValue()
        {
            Assert.Equal(TingQrErrorCode.InvalidValue, Assert.Throws<TingQrException>(() => FallbackUrl.Normalize(null)).Code);
        }

        [Fact]
        public void EncodeUriComponentKeepsTheUnreservedSetAndEscapesTheRest()
        {
            Assert.Equal("azAZ09-_.!~*'()", FallbackUrl.EncodeUriComponent("azAZ09-_.!~*'()"));
            Assert.Equal("%40%5B%60%7B%2F%3A%20%25", FallbackUrl.EncodeUriComponent("@[`{/: %"));
        }

        [Fact]
        public void ABinMustBeSixAsciiDigitsToBeLookedUpAsABin()
        {
            var list = new[] { new Bank("900001", "12345a", "XYZ", "odd code", null, "https://x/a.png") };
            Assert.Equal("900001", Banks.FindIn(list, "12345a")?.Bin);
        }

        [Fact]
        public void AccentedCharactersAndSpacesInFallbackAreEncodedToAscii()
        {
            var link = BankApps.Link("mb", AppPlatform.Android, "https://ví-dụ.vn/a b?c=đ");
            Assert.EndsWith(";end", link);
            Assert.DoesNotMatch(new Regex(@"[\s\u0080-￿]"), link);
            var value = Regex.Match(link, "S\\.browser_fallback_url=([^;]*);end$").Groups[1].Value;
            Assert.StartsWith("https://xn--", Uri.UnescapeDataString(value));
        }

        [Fact]
        public void AnUnknownAppABadPlatformAndAMissingPlatformNameWhatIsWrong()
        {
            Assert.Contains("nope", Thrown(() => BankApps.Link("nope", AppPlatform.Android)).Message);
            Assert.Contains("platform", Thrown(() => BankApps.Link("mb", (AppPlatform)99)).Message);
            Assert.Contains("android", Thrown(() => BankApps.Link("momo", AppPlatform.Android)).Message);
            Assert.Contains("ios", Thrown(() => BankApps.Link("nab", AppPlatform.Ios)).Message);
            Thrown(() => BankApps.Link(null!, AppPlatform.Android));
        }

        [Fact]
        public void EveryAppBuildsALinkOnEachPlatformItHas()
        {
            foreach (var app in BankApps.All)
            {
                if (app.Ios != null) Assert.Equal(app.Ios.Scheme + "://", BankApps.Link(app.Id, AppPlatform.Ios));
                if (app.Android != null) Assert.Matches("^intent://[^#]*#Intent;scheme=[^;]+;package=[^;]+;end$", BankApps.Link(app.Id, AppPlatform.Android));
            }
        }
    }
}
