using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TingQR.Rendering;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>
/// WithTingQrSvg against conformance/http/svg-response.json. Every route returns a payload fixed in the test code; none
/// reads the URL or query.
/// </summary>
public class MinimalApiContractTests
{
    private static readonly string Payload = Contract.VietQr;

    /// <summary>Starts an app with the routes of <paramref name="map"/>; <paramref name="tingQr"/> null means no AddTingQr.</summary>
    internal static async Task<(WebApplication App, HttpClient Client, CapturingLoggerProvider Logs)> Serve(
        Action<WebApplication> map, Action<TingQrOptions>? tingQr = null, bool exceptionHandler = false)
    {
        var logs = new CapturingLoggerProvider();
        var app = TestApp.Build(b =>
        {
            b.Logging.AddProvider(logs);
            if (tingQr is not null)
            {
                b.Services.AddTingQr(tingQr);
            }
        });
        if (exceptionHandler)
        {
            app.UseTeapotExceptionHandler();
        }
        map(app);
        await app.StartAsync();
        return (app, app.GetTestClient(), logs);
    }

    [Fact]
    public async Task Get_returns_svg_with_contract_headers()
    {
        var (app, client, _) = await Serve(a => a.MapGet("/qr.svg", () => Payload).WithTingQrSvg());
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/qr.svg"), TingQrRender.ToSvg(Payload));
    }

    [Fact]
    public async Task Post_put_patch_return_200()
    {
        var (app, client, _) = await Serve(a =>
        {
            a.MapPost("/qr.svg", () => Payload).WithTingQrSvg();
            a.MapPut("/qr.svg", () => Payload).WithTingQrSvg();
            a.MapPatch("/qr.svg", () => Payload).WithTingQrSvg();
        });
        await using var _app = app;
        var svg = TingQrRender.ToSvg(Payload);
        await Contract.AssertSvg(await client.PostAsync("/qr.svg", null), svg);
        await Contract.AssertSvg(await client.PutAsync("/qr.svg", null), svg);
        await Contract.AssertSvg(await client.PatchAsync("/qr.svg", null), svg);
    }

    [Fact]
    public async Task Null_and_empty_return_404()
    {
        var (app, client, _) = await Serve(a =>
        {
            a.MapGet("/null.svg", () => (string?)null).WithTingQrSvg();
            a.MapGet("/empty.svg", () => "").WithTingQrSvg();
            a.MapGet("/task-null.svg", async () =>
            {
                await Task.Yield();
                return (string?)null;
            }).WithTingQrSvg();
        });
        await using var _app = app;
        foreach (var path in new[] { "/null.svg", "/empty.svg", "/task-null.svg" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(404, (int)response.StatusCode);
            Assert.NotEqual("image/svg+xml", response.Content.Headers.ContentType?.MediaType);
        }
    }

    [Fact]
    public async Task Async_handler_task_and_valuetask_work()
    {
        var (app, client, _) = await Serve(a =>
        {
            a.MapGet("/task.svg", async () =>
            {
                await Task.Yield();
                return Payload;
            }).WithTingQrSvg();
            a.MapGet("/valuetask.svg", () => new ValueTask<string?>(Payload)).WithTingQrSvg();
        });
        await using var _app = app;
        var svg = TingQrRender.ToSvg(Payload);
        await Contract.AssertSvg(await client.GetAsync("/task.svg"), svg);
        await Contract.AssertSvg(await client.GetAsync("/valuetask.svg"), svg);
    }

    [Fact]
    public async Task TingQrException_from_handler_returns_500_code_only()
    {
        // conformance/vectors/vietqr/vietqr-encode-purpose-accented.json: an accented purpose is NON_ASCII.
        var (app, client, logs) = await Serve(a => a.MapGet("/qr.svg", (TingQrService tingqr) => tingqr.PaymentQr(purpose: "Chuyển tiền")).WithTingQrSvg(),
            o =>
            {
                o.Bank = "MB";
                o.AccountNumber = TestApp.Account;
            });
        await using var _app = app;
        var response = await client.GetAsync("/qr.svg");
        await Contract.AssertError(response, "NON_ASCII");

        var errors = logs.Entries.Where(e => e.Category == "TingQR.AspNetCore.TingQrSvg").ToList();
        var entry = Assert.Single(errors);
        Assert.Equal(LogLevel.Error, entry.Level);
        var thrown = Assert.IsType<TingQrException>(entry.Exception);
        Assert.Equal("NON_ASCII: " + thrown.Message, entry.Message);
        Assert.DoesNotContain(thrown.Message, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Render_error_returns_500()
    {
        // render-svg-invalid-logo-too-big.json: its text and logo; the cleared box is too big for that small code.
        var tooBig = Contract.Vector("render", "render-svg-invalid-logo-too-big").GetProperty("input");
        var logo = tooBig.GetProperty("logo");
        var logoOptions = new LogoOptions
        {
            Href = logo.GetProperty("href").GetString()!,
            Size = logo.GetProperty("size").GetDouble(),
            Padding = logo.GetProperty("padding").GetInt32(),
        };
        var text = tooBig.GetProperty("text").GetString()!;
        var (app, client, logs) = await Serve(a =>
        {
            a.MapGet("/long.svg", () => Payload).WithTingQrSvg(new SvgOptions { MaxVersion = 1 });
            a.MapGet("/logo.svg", () => text).WithTingQrSvg(new SvgOptions { Logo = logoOptions });
        });
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/long.svg"), "INVALID_VALUE");
        await Contract.AssertError(await client.GetAsync("/logo.svg"), "INVALID_VALUE");
        Assert.Equal(2, logs.Entries.Count(e => e.Category == "TingQR.AspNetCore.TingQrSvg" && e.Level == LogLevel.Error));
    }

    [Fact]
    public async Task Other_exception_passes_to_app()
    {
        var (app, client, logs) = await Serve(a => a.MapGet("/qr.svg", string () => throw new InvalidOperationException("app bug")).WithTingQrSvg(),
            exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync("/qr.svg");
        Assert.Equal(418, (int)response.StatusCode);
        Assert.Equal("InvalidOperationException: app bug", await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
    }

    [Fact]
    public async Task TingQrException_bypasses_app_exception_handler()
    {
        var (app, client, _) = await Serve(a => a.MapGet("/qr.svg", string () => throw new TingQrException(TingQrErrorCode.CrcMismatch, "secret config")).WithTingQrSvg(),
            exceptionHandler: true);
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/qr.svg"), "CRC_MISMATCH");
    }

    [Fact]
    public async Task WithTingQrSvg_bad_option_throws_at_mapping()
    {
        await using var app = TestApp.Build(_ => { });
        var route = app.MapGet("/qr.svg", () => Payload);
        var logo = Assert.Throws<TingQrException>(() => route.WithTingQrSvg(new SvgOptions { Logo = new LogoOptions { Href = "/x.png" } }));
        Assert.Equal(TingQrErrorCode.InvalidValue, logo.Code);
        var margin = Assert.Throws<TingQrException>(() => route.WithTingQrSvg(new SvgOptions { Margin = 99 }));
        Assert.Equal(TingQrErrorCode.InvalidValue, margin.Code);
    }

    [Fact]
    public async Task Route_options_merge_over_app_wide()
    {
        var (app, client, _) = await Serve(
            a =>
            {
                a.MapGet("/route.svg", () => Payload).WithTingQrSvg(new SvgOptions { Margin = 8 });
                a.MapGet("/app.svg", () => Payload).WithTingQrSvg();
            },
            o => o.Svg = new SvgOptions { Margin = 2, Foreground = "#112233" });
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/route.svg"), TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 8, Foreground = "#112233" }));
        await Contract.AssertSvg(await client.GetAsync("/app.svg"), TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 2, Foreground = "#112233" }));
    }

    [Fact]
    public async Task Route_and_app_wide_clash_is_500_per_request()
    {
        // A route foreground alone passes the mapping check (colour only); against the app-wide grey background (contrast
        // 4.69 with black, valid at startup) it falls below 4.5.
        var (app, client, _) = await Serve(
            a => a.MapGet("/qr.svg", () => Payload).WithTingQrSvg(new SvgOptions { Foreground = "#333333" }),
            o => o.Svg = new SvgOptions { Background = "#777777" });
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/qr.svg"), "INVALID_VALUE");
    }

    [Fact]
    public async Task Cache_control_override()
    {
        var svg = TingQrRender.ToSvg(Payload);
        var (app, client, _) = await Serve(
            a =>
            {
                a.MapGet("/param.svg", () => Payload).WithTingQrSvg(cacheControl: "no-store");
                a.MapGet("/options.svg", () => Payload).WithTingQrSvg();
            },
            o => o.CacheControl = "no-cache");
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/param.svg"), svg, "no-store");
        await Contract.AssertSvg(await client.GetAsync("/options.svg"), svg, "no-cache");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Blank_cache_control_falls_back_to_default(string blank)
    {
        var (app, client, _) = await Serve(
            a => a.MapGet("/qr.svg", () => Payload).WithTingQrSvg(cacheControl: blank),
            o => o.CacheControl = blank);
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/qr.svg"), TingQrRender.ToSvg(Payload), Contract.DefaultCacheControl);
    }

    [Fact]
    public async Task Works_without_AddTingQr()
    {
        var (app, client, _) = await Serve(a => a.MapGet("/qr.svg", () => Contract.PromptPay).WithTingQrSvg());
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/qr.svg"), TingQrRender.ToSvg(Contract.PromptPay));
    }

    [Fact]
    public async Task Non_string_result_is_programming_error()
    {
        var (app, client, _) = await Serve(a => a.MapGet("/qr.svg", () => 42).WithTingQrSvg(), exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync("/qr.svg");
        Assert.Equal(418, (int)response.StatusCode);
        Assert.Equal("InvalidOperationException: A WithTingQrSvg endpoint must return a QR payload string or null; got System.Int32.",
            await response.Content.ReadAsStringAsync());
    }
}
