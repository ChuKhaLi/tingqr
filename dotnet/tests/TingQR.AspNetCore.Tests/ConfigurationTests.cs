using Xunit;
using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TingQR.Rendering;

namespace TingQR.AspNetCore.Tests;

public class ConfigurationTests
{
    /// <summary>Any data:image/ URI passes the served-logo rule; the image bytes are never decoded.</summary>
    private const string DataLogo = "data:image/png;base64,iVBORw0KGgo=";

    [Fact]
    public async Task Unknown_bank_stops_startup()
    {
        var e = await TestApp.StartupError(o =>
        {
            o.Bank = "NOPE";
            o.AccountNumber = TestApp.Account;
        });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("\"NOPE\"", e.Message, StringComparison.Ordinal);
        Assert.Contains("'MB', 'VCB', '970422'", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Account_without_bank_stops_startup()
    {
        var e = await TestApp.StartupError(o => o.AccountNumber = TestApp.Account);
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("Bank", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Bank_without_account_stops_startup()
    {
        var e = await TestApp.StartupError(o => o.Bank = "MB");
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("AccountNumber", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Invalid_account_stops_startup()
    {
        // conformance/vectors/vietqr/vietqr-encode-account-too-short.json: INVALID_VALUE, tag 38.
        var expected = Assert.Throws<TingQrException>(() => VietQr.Encode(new VietQrInput { BankBin = "970422", AccountNumber = "12" }));
        var e = await TestApp.StartupError(o =>
        {
            o.Bank = "MB";
            o.AccountNumber = "12";
        });
        Assert.Equal(expected.Code, e.Code);
        Assert.Equal(expected.Tag, e.Tag);
        Assert.Equal(expected.Message, e.Message);
    }

    [Fact]
    public async Task Logo_not_data_uri_stops_startup_for_svg()
    {
        var e = await TestApp.StartupError(o =>
        {
            o.Bank = "MB";
            o.AccountNumber = TestApp.Account;
            o.Svg = new SvgOptions { Logo = new LogoOptions { Href = "/logo.png" } };
        });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("data:image/", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Logo_not_data_uri_stops_startup_for_profile()
    {
        var e = await TestApp.StartupError(o => o.Profiles["logo"] = new SvgOptions { Logo = new LogoOptions { Href = "/logo.png" } });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("data:image/", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Svg_that_cannot_render_static_code_stops_startup()
    {
        var svg = new SvgOptions { MaxVersion = 1, Logo = new LogoOptions { Href = DataLogo, Size = 0.25 } };
        // Without an account only the payload-independent options are checked, and these are fine.
        TingQrRender.CheckSvgOptions(svg);
        var e = await TestApp.StartupError(o =>
        {
            o.Bank = "MB";
            o.AccountNumber = TestApp.Account;
            o.Svg = svg;
        });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
    }

    [Fact]
    public async Task Svg_with_bad_option_stops_startup_without_account()
    {
        var e = await TestApp.StartupError(o => o.Svg = new SvgOptions { Margin = 99 });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
    }

    [Fact]
    public async Task No_account_is_allowed()
    {
        await using var app = await TestApp.StartAsync(o => o.Svg = new SvgOptions { Foreground = "#123456", Logo = new LogoOptions { Href = DataLogo } });
        var service = app.Services.GetRequiredService<TingQrService>();
        Assert.Null(service.Bin);
        Assert.Null(service.Bank);
    }

    [Fact]
    public async Task Nothing_configured_is_allowed()
    {
        await using var app = await TestApp.StartAsync(_ => { });
        Assert.Null(app.Services.GetRequiredService<TingQrService>().Bin);
    }

    [Fact]
    public async Task Binds_from_configuration()
    {
        // conformance/vectors/vietqr/vietqr-card.json: card 9704220123456789 at 970422.
        await using var app = TestApp.Build(b =>
        {
            b.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["TingQr:Bank"] = "MB",
                ["TingQr:AccountNumber"] = "9704220123456789",
                ["TingQr:Service"] = "card",
                ["TingQr:CacheControl"] = "no-store",
            });
            b.Services.AddTingQr(b.Configuration.GetSection("TingQr"));
        });
        await app.StartAsync();
        var service = app.Services.GetRequiredService<TingQrService>();
        Assert.Equal("970422", service.Bin);
        Assert.Equal("MB", service.Bank!.Code);
        var vector = System.Text.Json.JsonDocument.Parse(File.ReadAllText(Path.Combine(ConformanceRoot.Path, "vectors", "vietqr", "vietqr-card.json")));
        Assert.Equal(vector.RootElement.GetProperty("payload").GetString(), service.PaymentQr(20000));
        Assert.Equal("no-store", app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<TingQrOptions>>().Value.CacheControl);
    }

    [Theory]
    [InlineData("Card", VietQrServiceCode.Card)]
    [InlineData("ACCOUNT", VietQrServiceCode.Account)]
    public async Task Binds_service_ignoring_case(string text, VietQrServiceCode expected)
    {
        await using var app = TestApp.Build(b =>
        {
            b.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TingQr:Service"] = text });
            b.Services.AddTingQr(b.Configuration.GetSection("TingQr"));
        });
        await app.StartAsync();
        Assert.Equal(expected, app.Services.GetRequiredService<Microsoft.Extensions.Options.IOptions<TingQrOptions>>().Value.Service);
    }

    [Fact]
    public async Task Unknown_service_in_configuration_stops_startup()
    {
        await using var app = TestApp.Build(b =>
        {
            b.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TingQr:Service"] = "wallet" });
            b.Services.AddTingQr(b.Configuration.GetSection("TingQr"));
        });
        var e = await Assert.ThrowsAsync<TingQrException>(() => app.StartAsync());
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("wallet", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Code_configure_runs_after_section()
    {
        await using var app = TestApp.Build(b =>
        {
            b.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TingQr:Bank"] = "NOPE", ["TingQr:AccountNumber"] = TestApp.Account });
            b.Services.AddTingQr(b.Configuration.GetSection("TingQr"), o => o.Bank = "970422");
        });
        await app.StartAsync();
        Assert.Equal("970422", app.Services.GetRequiredService<TingQrService>().Bin);
    }

    [Fact]
    public async Task Profile_foreground_alone_is_checked_as_colour_only()
    {
        // White on the default white background would fail the contrast check; as a route option its background is the
        // app-wide one, known only per request.
        Assert.Throws<TingQrException>(() => TingQrRender.CheckSvgOptions(new SvgOptions { Foreground = "#ffffff" }));
        await using var app = await TestApp.StartAsync(o => o.Profiles["light"] = new SvgOptions { Foreground = "#ffffff" });
        Assert.NotNull(app);
    }

    [Fact]
    public async Task Profile_bad_colour_stops_startup()
    {
        var e = await TestApp.StartupError(o => o.Profiles["bad"] = new SvgOptions { Foreground = "red" });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
    }

    [Fact]
    public async Task Profile_with_both_colours_is_checked_for_contrast()
    {
        var e = await TestApp.StartupError(o => o.Profiles["low"] = new SvgOptions { Foreground = "#ffffff", Background = "#ffffff" });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
    }

    [Fact]
    public async Task Empty_profile_name_stops_startup()
    {
        var e = await TestApp.StartupError(o => o.Profiles[""] = new SvgOptions());
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
    }

    [Fact]
    public void CheckRouteOptions_accepts_null() => TingQrConfiguration.CheckRouteOptions(null);

    [Fact]
    public void Merge_route_wins_key_by_key()
    {
        var appLogo = new LogoOptions { Href = DataLogo, Size = 0.2, Padding = 2, Background = "#eeeeee" };
        var routeLogo = new LogoOptions { Href = "data:image/svg+xml;base64,PHN2Zy8+" };
        var appWide = new SvgOptions { Foreground = "#123456", Margin = 2, Logo = appLogo };
        var route = new SvgOptions { Margin = 1, Ecc = Ecc.H, Logo = routeLogo };

        var merged = TingQrConfiguration.Merge(appWide, route)!;

        Assert.Equal(1, merged.Margin);
        Assert.Equal("#123456", merged.Foreground);
        Assert.Equal(Ecc.H, merged.Ecc);
        // The logo is replaced as a whole: no size, padding or background from the app-wide logo.
        Assert.Equal(routeLogo, merged.Logo);
        Assert.Null(merged.Background);
    }

    [Fact]
    public void Merge_with_a_null_side_returns_the_other()
    {
        var o = new SvgOptions { Margin = 1 };
        Assert.Same(o, TingQrConfiguration.Merge(o, null));
        Assert.Same(o, TingQrConfiguration.Merge(null, o));
        Assert.Null(TingQrConfiguration.Merge(null, null));
    }

    private static SvgOptions AllSet(int seed) => new SvgOptions
    {
        Ecc = seed == 0 ? Ecc.L : Ecc.H,
        BoostEcc = seed == 0,
        MinVersion = 1 + seed,
        MaxVersion = 30 + seed,
        Mask = seed,
        Margin = 2 + seed,
        Foreground = seed == 0 ? "#000000" : "#111111",
        Background = seed == 0 ? "#ffffff" : "#eeeeee",
        Size = seed == 0 ? new SvgSize(100) : new SvgSize("40mm"),
        Logo = new LogoOptions { Href = DataLogo + seed },
    };

    [Fact]
    public void Merge_covers_every_property()
    {
        // If SvgOptions or MatrixOptions gains a property, Merge must handle it and AllSet must set it.
        var names = typeof(SvgOptions).GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal);
        Assert.Equal(
            new[] { "Background", "BoostEcc", "Ecc", "Foreground", "Logo", "Margin", "Mask", "MaxVersion", "MinVersion", "Size" },
            names);
        foreach (var p in typeof(SvgOptions).GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            Assert.NotNull(p.GetValue(AllSet(0)));
            Assert.NotNull(p.GetValue(AllSet(1)));
            Assert.NotEqual(p.GetValue(AllSet(0)), p.GetValue(AllSet(1)));
        }
        Assert.Equal(AllSet(0), TingQrConfiguration.Merge(AllSet(0), new SvgOptions()));
        Assert.Equal(AllSet(1), TingQrConfiguration.Merge(AllSet(0), AllSet(1)));
        Assert.Equal(AllSet(1), TingQrConfiguration.Merge(new SvgOptions(), AllSet(1)));
    }
}
