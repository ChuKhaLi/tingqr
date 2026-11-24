using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TingQR.Rendering;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>
/// A Cache-Control value with a control character (CR, LF, tab…) or a non-ASCII character is refused by Kestrel when the
/// header is written, i.e. on every request. A value set in configuration stops the app at startup instead; a value given
/// per request (TingQrHttpResults.Svg) gives the contract's 500.
/// </summary>
public class CacheControlTests
{
    private static readonly string Payload = Contract.VietQr;

    private const string Rule = " must contain only printable ASCII characters (no CR, LF or other control characters).";

    public static TheoryData<string> Bad => new()
    {
        "no-store\r\nX-Injected: 1",
        "no-store\n",
        "no-store\r",
        "no-store\t",
        "no-store\0",
        "\u001fno-store",
        "no-store\u007f",
        "privé",
    };

    /// <summary>Every printable ASCII character, space (0x20) to tilde (0x7E): accepted as is.</summary>
    private static readonly string AllPrintable = new(Enumerable.Range(0x20, 0x7F - 0x20).Select(c => (char)c).ToArray());

    [Theory]
    [MemberData(nameof(Bad))]
    public async Task AddTingQr_stops_startup(string value)
    {
        var e = await TestApp.StartupError(o => o.CacheControl = value);
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("AddTingQr: CacheControl" + Rule, e.Message);
    }

    [Fact]
    public async Task AddTingQr_from_configuration_stops_startup()
    {
        await using var app = TestApp.Build(b =>
        {
            b.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["TingQr:CacheControl"] = "no-store\nX: 1" });
            b.Services.AddTingQr(b.Configuration.GetSection("TingQr"));
        });
        var e = await Assert.ThrowsAsync<TingQrException>(() => app.StartAsync());
        Assert.Equal("AddTingQr: CacheControl" + Rule, e.Message);
    }

    [Fact]
    public async Task Printable_ascii_is_accepted_everywhere()
    {
        var (app, client, _) = await MinimalApiContractTests.Serve(
            a =>
            {
                a.MapGet("/route.svg", () => Payload).WithTingQrSvg(cacheControl: AllPrintable + "r");
                a.MapGet("/app.svg", () => Payload).WithTingQrSvg();
                a.MapGet("/result.svg", () => TingQrHttpResults.Svg(Payload, cacheControl: AllPrintable + "h"));
            },
            o => o.CacheControl = AllPrintable);
        await using var _app = app;
        var svg = TingQrRender.ToSvg(Payload);
        await Contract.AssertSvg(await client.GetAsync("/route.svg"), svg, AllPrintable + "r");
        await Contract.AssertSvg(await client.GetAsync("/app.svg"), svg, AllPrintable);
        await Contract.AssertSvg(await client.GetAsync("/result.svg"), svg, AllPrintable + "h");
    }

    [Theory]
    [MemberData(nameof(Bad))]
    public async Task WithTingQrSvg_throws_at_mapping(string value)
    {
        await using var app = TestApp.Build(_ => { });
        var route = app.MapGet("/qr.svg", () => Payload);
        var e = Assert.Throws<TingQrException>(() => route.WithTingQrSvg(cacheControl: value));
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("WithTingQrSvg: cacheControl" + Rule, e.Message);
    }

    [Theory]
    [MemberData(nameof(Bad))]
    public async Task TingQrHttpResults_gives_500_and_logs(string value)
    {
        var (app, client, logs) = await MinimalApiContractTests.Serve(a => a.MapGet("/qr.svg", () => TingQrHttpResults.Svg(Payload, cacheControl: value)));
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/qr.svg"), "INVALID_VALUE");
        var entry = Assert.Single(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Equal("INVALID_VALUE: Cache-Control" + Rule, entry.Message);
    }

    [Fact]
    public async Task Attribute_on_action_stops_startup_without_AddTingQr()
    {
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcBadCacheActionController) });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("[TingQrSvg] on MvcBadCacheActionController.Qr: CacheControl" + Rule, e.Message);
    }

    [Fact]
    public async Task Attribute_on_controller_stops_startup_with_AddTingQr()
    {
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcBadCacheControllerController) }, _ => { });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("[TingQrSvg] on MvcBadCacheControllerController: CacheControl" + Rule, e.Message);
    }

    [Fact]
    public async Task Global_attribute_stops_startup_with_AddTingQr()
    {
        // A global filter is not an MVC convention: the startup scan of AddTingQr finds it.
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcBadCacheGlobalController) }, _ => { },
            o => o.Filters.Add(new TingQrSvgAttribute { CacheControl = "no-store\n" }));
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("[TingQrSvg] on MvcBadCacheGlobalController.Qr: CacheControl" + Rule, e.Message);
    }

    [Fact]
    public async Task Global_attribute_without_AddTingQr_gives_500()
    {
        // No AddTingQr, so no startup scan: the per-request check still answers with the contract's 500.
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcBadCacheGlobalController) },
            mvc: o => o.Filters.Add(new TingQrSvgAttribute { CacheControl = "no-store\n" }));
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/bad-cache-global/qr.svg"), "INVALID_VALUE");
    }
}

[Route("bad-cache-action")]
public class MvcBadCacheActionController : ControllerBase
{
    [HttpGet("qr.svg"), TingQrSvg(CacheControl = "no-store\r\nX-Injected: 1")]
    public string Qr() => Contract.VietQr;
}

[Route("bad-cache-controller"), TingQrSvg(CacheControl = "no-store\n")]
public class MvcBadCacheControllerController : ControllerBase
{
    [HttpGet("qr.svg"), TingQrSvg]
    public string Qr() => Contract.VietQr;
}

[Route("bad-cache-global")]
public class MvcBadCacheGlobalController : ControllerBase
{
    [HttpGet("qr.svg")]
    public string Qr() => Contract.VietQr;
}
