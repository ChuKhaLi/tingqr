using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using TingQR.Rendering;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>TingQrHttpResults.Svg against conformance/http/svg-response.json. Payloads are fixed in the test code.</summary>
public class HttpResultsContractTests
{
    private static readonly string Payload = Contract.VietQr;

    [Fact]
    public async Task Payload_returns_svg_with_contract_headers()
    {
        var (app, client, _) = await MinimalApiContractTests.Serve(a =>
        {
            a.MapGet("/qr.svg", () => TingQrHttpResults.Svg(Payload));
            a.MapPost("/qr.svg", () => TingQrHttpResults.Svg(Payload));
            a.MapGet("/margin.svg", () => TingQrHttpResults.Svg(Payload, new SvgOptions { Margin = 8 }, "no-store"));
        });
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/qr.svg"), TingQrRender.ToSvg(Payload));
        await Contract.AssertSvg(await client.PostAsync("/qr.svg", null), TingQrRender.ToSvg(Payload));
        await Contract.AssertSvg(await client.GetAsync("/margin.svg"), TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 8 }), "no-store");
    }

    [Fact]
    public async Task App_wide_options_and_cache_control_apply()
    {
        var (app, client, _) = await MinimalApiContractTests.Serve(
            a => a.MapGet("/qr.svg", () => TingQrHttpResults.Svg(Payload, new SvgOptions { Margin = 8 })),
            o =>
            {
                o.Svg = new SvgOptions { Margin = 2, Foreground = "#112233" };
                o.CacheControl = "no-cache";
            });
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/qr.svg"), TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 8, Foreground = "#112233" }), "no-cache");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public async Task Blank_cache_control_falls_back_to_default(string blank)
    {
        var (app, client, _) = await MinimalApiContractTests.Serve(
            a => a.MapGet("/qr.svg", () => TingQrHttpResults.Svg(Payload, cacheControl: blank)),
            o => o.CacheControl = blank);
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/qr.svg"), TingQrRender.ToSvg(Payload), Contract.DefaultCacheControl);
    }

    [Fact]
    public async Task Null_and_empty_return_404()
    {
        var (app, client, _) = await MinimalApiContractTests.Serve(a =>
        {
            a.MapGet("/null.svg", () => TingQrHttpResults.Svg(null));
            a.MapGet("/empty.svg", () => TingQrHttpResults.Svg(""));
        });
        await using var _app = app;
        Assert.Equal(404, (int)(await client.GetAsync("/null.svg")).StatusCode);
        Assert.Equal(404, (int)(await client.GetAsync("/empty.svg")).StatusCode);
    }

    [Fact]
    public async Task Render_error_returns_500_and_logs()
    {
        var (app, client, logs) = await MinimalApiContractTests.Serve(a =>
            a.MapGet("/qr.svg", () => TingQrHttpResults.Svg(Payload, new SvgOptions { MaxVersion = 1 })));
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/qr.svg"), "INVALID_VALUE");
        var entry = Assert.Single(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.StartsWith("INVALID_VALUE: ", entry.Message);
        Assert.IsType<TingQrException>(entry.Exception);
    }

    [Fact]
    public async Task Bad_options_give_500_not_throw()
    {
        // Building the result never throws; the options are checked (served-logo rule included) when it runs.
        var badLogo = TingQrHttpResults.Svg(Payload, new SvgOptions { Logo = new LogoOptions { Href = "/x.png" } });
        var badMargin = TingQrHttpResults.Svg(Payload, new SvgOptions { Margin = 99 });
        Assert.NotNull(badLogo);
        Assert.NotNull(badMargin);

        var (app, client, _) = await MinimalApiContractTests.Serve(a =>
        {
            a.MapGet("/logo.svg", () => badLogo);
            a.MapGet("/margin.svg", () => badMargin);
        });
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/logo.svg"), "INVALID_VALUE");
        await Contract.AssertError(await client.GetAsync("/margin.svg"), "INVALID_VALUE");
    }
}
