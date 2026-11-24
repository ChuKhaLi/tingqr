using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using TingQR.Rendering;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>
/// [TingQrSvg] against conformance/http/svg-response.json. Every action returns a payload fixed in the test code; none
/// reads the URL or query.
/// </summary>
public class MvcContractTests
{
    private static readonly string Payload = Contract.VietQr;

    private static readonly Type[] Svg = { typeof(MvcSvgController) };

    private static void Account(TingQrOptions o)
    {
        o.Bank = "MB";
        o.AccountNumber = TestApp.Account;
    }

    [Fact]
    public async Task Get_post_put_patch_return_200_with_contract_headers()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg);
        await using var _app = app;
        var svg = TingQrRender.ToSvg(Payload);
        await Contract.AssertSvg(await client.GetAsync("/mvc/qr.svg"), svg);
        await Contract.AssertSvg(await client.PostAsync("/mvc/qr.svg", null), svg);
        await Contract.AssertSvg(await client.PutAsync("/mvc/qr.svg", null), svg);
        await Contract.AssertSvg(await client.PatchAsync("/mvc/qr.svg", null), svg);
    }

    [Fact]
    public async Task Status_set_by_action_is_overridden_with_200()
    {
        // A served SVG is always 200, whatever status the action set before returning the payload.
        var (app, client, _) = await MvcTestApp.Serve(Svg);
        await using var _app = app;
        await Contract.AssertSvg(await client.PostAsync("/mvc/accepted.svg", null), TingQrRender.ToSvg(Payload));
    }

    [Fact]
    public async Task Null_and_empty_return_404()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg);
        await using var _app = app;
        foreach (var path in new[] { "/mvc/null.svg", "/mvc/empty.svg", "/mvc/task-null.svg", "/mvc/result-null.svg" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(404, (int)response.StatusCode);
            Assert.NotEqual("image/svg+xml", response.Content.Headers.ContentType?.MediaType);
        }
    }

    [Fact]
    public async Task Task_and_ActionResult_work()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg);
        await using var _app = app;
        var svg = TingQrRender.ToSvg(Payload);
        await Contract.AssertSvg(await client.GetAsync("/mvc/task.svg"), svg);
        await Contract.AssertSvg(await client.GetAsync("/mvc/result.svg"), svg);
        await Contract.AssertSvg(await client.GetAsync("/mvc/task-result.svg"), svg);
    }

    [Fact]
    public async Task TingQrException_from_action_returns_500_code_only()
    {
        // conformance/vectors/vietqr/vietqr-encode-purpose-accented.json: an accented purpose is NON_ASCII.
        var (app, client, logs) = await MvcTestApp.Serve(Svg, Account);
        await using var _app = app;
        var response = await client.GetAsync("/mvc/accented.svg");
        await Contract.AssertError(response, "NON_ASCII");

        var entry = Assert.Single(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
        Assert.Equal(LogLevel.Error, entry.Level);
        var thrown = Assert.IsType<TingQrException>(entry.Exception);
        Assert.Equal("NON_ASCII: " + thrown.Message, entry.Message);
        Assert.DoesNotContain(thrown.Message, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task TingQrException_after_await_returns_500()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg, exceptionHandler: true);
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/mvc/after-await.svg"), "CRC_MISMATCH");
    }

    [Fact]
    public async Task Render_error_returns_500()
    {
        var (app, client, logs) = await MvcTestApp.Serve(new[] { typeof(MvcTinyController) }, o => o.Profiles["tiny"] = new SvgOptions { MaxVersion = 1 });
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/mvc/tiny.svg"), "INVALID_VALUE");
        Assert.Single(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg" && e.Level == LogLevel.Error);
    }

    [Fact]
    public async Task Other_exception_passes_to_app()
    {
        var (app, client, logs) = await MvcTestApp.Serve(Svg, exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync("/mvc/crash.svg");
        Assert.Equal(418, (int)response.StatusCode);
        Assert.Equal("InvalidOperationException: app bug", await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
    }

    [Fact]
    public async Task TingQrException_wins_over_app_global_exception_filter()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg, mvc: o => o.Filters.Add(new TeapotExceptionFilter()));
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/mvc/after-await.svg"), "CRC_MISMATCH");
        // The filter is live: other exceptions reach it.
        var crash = await client.GetAsync("/mvc/crash.svg");
        Assert.Equal(418, (int)crash.StatusCode);
        Assert.Equal("filter: app bug", await crash.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Non_string_result_is_programming_error()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg, exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync("/mvc/int.svg");
        Assert.Equal(418, (int)response.StatusCode);
        Assert.StartsWith("InvalidOperationException: A [TingQrSvg] action must return a QR payload string or null",
            await response.Content.ReadAsStringAsync());
        // A void action gives MVC's EmptyResult, which is not a payload (a returned null is an ObjectResult).
        var empty = await client.GetAsync("/mvc/void.svg");
        Assert.Equal(418, (int)empty.StatusCode);
        Assert.Contains("got Microsoft.AspNetCore.Mvc.EmptyResult", await empty.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/mvc/bad-request.svg", "BadRequestObjectResult")]
    [InlineData("/mvc/not-found.svg", "NotFoundObjectResult")]
    [InlineData("/mvc/ok.svg", "OkObjectResult")]
    [InlineData("/mvc/conflict.svg", "ObjectResult")]
    [InlineData("/mvc/object-result-status.svg", "ObjectResult")]
    public async Task Action_result_with_text_is_not_a_payload(string path, string resultType)
    {
        // Only the value an action returns (MVC wraps it in a plain ObjectResult without a status) is a payload; a result
        // the action built itself, such as BadRequest("msg"), must never be drawn as a QR code.
        var (app, client, logs) = await MvcTestApp.Serve(Svg, exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync(path);
        Assert.Equal(418, (int)response.StatusCode);
        Assert.StartsWith("InvalidOperationException: A [TingQrSvg] action must return a QR payload string or null (also as Task<string> or " +
            "ActionResult<string>); got Microsoft.AspNetCore.Mvc." + resultType + " from ", await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
    }

    [Fact]
    public async Task Works_without_AddTingQr()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg);
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/mvc/promptpay.svg"), TingQrRender.ToSvg(Contract.PromptPay));
    }

    [Fact]
    public async Task Cache_control_on_attribute()
    {
        var svg = TingQrRender.ToSvg(Payload);
        var (app, client, _) = await MvcTestApp.Serve(Svg, o => o.CacheControl = "no-cache");
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/mvc/no-store.svg"), svg, "no-store");
        await Contract.AssertSvg(await client.GetAsync("/mvc/blank-cache.svg"), svg, "no-cache");
        await Contract.AssertSvg(await client.GetAsync("/mvc/qr.svg"), svg, "no-cache");
    }

    [Fact]
    public async Task Blank_cache_control_everywhere_falls_back_to_default()
    {
        var (app, client, _) = await MvcTestApp.Serve(Svg, o => o.CacheControl = " ");
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/mvc/blank-cache.svg"), TingQrRender.ToSvg(Payload), Contract.DefaultCacheControl);
    }

    [Fact]
    public async Task Profile_with_bank_logo_renders()
    {
        var bank = new SvgOptions { Logo = new LogoOptions { Href = BankLogos.Icon("mb")! } };
        var appWide = new SvgOptions { Margin = 2 };
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcBankLogoController) }, o =>
        {
            o.Svg = appWide;
            o.Profiles["bank"] = bank;
        });
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/mvc/bank.svg"), TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 2, Logo = bank.Logo }));
    }

    [Fact]
    public async Task Action_attribute_overrides_controller_and_renders_once()
    {
        // Every SVG response looks up IOptions<TingQrOptions> once, when it runs (startup reads it once more, before the
        // count is reset): counting the lookups counts the renders of a request.
        var options = new TingQrOptions { Svg = new SvgOptions { Margin = 2 } };
        options.Profiles["a"] = new SvgOptions { Margin = 8, Background = "#ffffee" };
        options.Profiles["b"] = new SvgOptions { Foreground = "#112233" };
        var renders = 0;
        await using var app = TestApp.Build(b =>
        {
            b.Services.AddTingQr();
            b.Services.AddSingleton<IOptions<TingQrOptions>>(_ => new CountingOptions(options, () => Interlocked.Increment(ref renders)));
            b.Services.AddControllers().ConfigureApplicationPartManager(manager =>
            {
                manager.ApplicationParts.Clear();
                manager.ApplicationParts.Add(new MvcTestApp.TypesPart(new[] { typeof(MvcProfilesController) }));
            });
        });
        app.MapControllers();
        await app.StartAsync();
        var client = app.GetTestClient();

        // The action's profile wins as a whole: nothing of "a" (not its Background either) is applied.
        Volatile.Write(ref renders, 0);
        await Contract.AssertSvg(await client.GetAsync("/mvc/profiles/action.svg"),
            TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 2, Foreground = "#112233" }));
        Assert.Equal(1, Volatile.Read(ref renders));

        Volatile.Write(ref renders, 0);
        await Contract.AssertSvg(await client.GetAsync("/mvc/profiles/controller.svg"),
            TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 8, Background = "#ffffee" }));
        Assert.Equal(1, Volatile.Read(ref renders));
    }

    /// <summary>IOptions that calls <c>onRead</c> each time its value is read.</summary>
    private sealed class CountingOptions : IOptions<TingQrOptions>
    {
        private readonly TingQrOptions _value;
        private readonly Action _onRead;

        public CountingOptions(TingQrOptions value, Action onRead)
        {
            _value = value;
            _onRead = onRead;
        }

        public TingQrOptions Value
        {
            get
            {
                _onRead();
                return _value;
            }
        }
    }

    [Fact]
    public async Task Profile_clash_with_app_wide_is_500_per_request()
    {
        // Each set is valid on its own; the app-wide logo needs ECC H, which the profile's Ecc = L takes away.
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcClashController) }, o =>
        {
            o.Svg = new SvgOptions { Logo = new LogoOptions { Href = BankLogos.Icon("mb")! } };
            o.Profiles["low"] = new SvgOptions { Ecc = Ecc.L };
        });
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/mvc/clash.svg"), "INVALID_VALUE");
    }

    private sealed class TeapotExceptionFilter : IExceptionFilter
    {
        public void OnException(ExceptionContext context)
        {
            context.Result = new ContentResult { StatusCode = 418, Content = "filter: " + context.Exception.Message };
            context.ExceptionHandled = true;
        }
    }
}

[Route("mvc")]
public class MvcSvgController : ControllerBase
{
    [HttpGet("qr.svg"), HttpPost("qr.svg"), HttpPut("qr.svg"), HttpPatch("qr.svg"), TingQrSvg]
    public string Qr() => Contract.VietQr;

    [HttpPost("accepted.svg"), TingQrSvg]
    public string AcceptedStatus()
    {
        Response.StatusCode = StatusCodes.Status202Accepted;
        return Contract.VietQr;
    }

    [HttpGet("promptpay.svg"), TingQrSvg]
    public string PromptPay() => Contract.PromptPay;

    [HttpGet("null.svg"), TingQrSvg]
    public string? Null() => null;

    [HttpGet("empty.svg"), TingQrSvg]
    public string EmptyPayload() => "";

    [HttpGet("task-null.svg"), TingQrSvg]
    public async Task<string?> TaskNull()
    {
        await Task.Yield();
        return null;
    }

    [HttpGet("result-null.svg"), TingQrSvg]
    public ActionResult<string?> ResultNull() => (string?)null;

    [HttpGet("task.svg"), TingQrSvg]
    public async Task<string> TaskPayload()
    {
        await Task.Yield();
        return Contract.VietQr;
    }

    [HttpGet("result.svg"), TingQrSvg]
    public ActionResult<string> ResultPayload() => Contract.VietQr;

    [HttpGet("task-result.svg"), TingQrSvg]
    public async Task<ActionResult<string>> TaskResultPayload()
    {
        await Task.Yield();
        return Contract.VietQr;
    }

    [HttpGet("accented.svg"), TingQrSvg]
    public string Accented([FromServices] TingQrService tingqr) => tingqr.PaymentQr(purpose: "Chuyển tiền");

    [HttpGet("after-await.svg"), TingQrSvg]
    public async Task<string> AfterAwait()
    {
        await Task.Yield();
        throw new TingQrException(TingQrErrorCode.CrcMismatch, "secret config");
    }

    [HttpGet("crash.svg"), TingQrSvg]
    public string Crash() => throw new InvalidOperationException("app bug");

    [HttpGet("int.svg"), TingQrSvg]
    public int Int() => 42;

    [HttpGet("bad-request.svg"), TingQrSvg]
    public ActionResult<string> BadRequestText() => BadRequest("msg");

    [HttpGet("not-found.svg"), TingQrSvg]
    public ActionResult<string> NotFoundText() => NotFound("msg");

    [HttpGet("ok.svg"), TingQrSvg]
    public ActionResult<string> OkText() => Ok("msg");

    [HttpGet("conflict.svg"), TingQrSvg]
    public ActionResult<string> ConflictText() => StatusCode(409, "msg");

    [HttpGet("object-result-status.svg"), TingQrSvg]
    public ActionResult<string> ObjectResultWithStatus() => new ObjectResult("msg") { StatusCode = 200 };

    [HttpGet("void.svg"), TingQrSvg]
    public void Void()
    {
    }

    [HttpGet("no-store.svg"), TingQrSvg(CacheControl = "no-store")]
    public string NoStore() => Contract.VietQr;

    [HttpGet("blank-cache.svg"), TingQrSvg(CacheControl = "  ")]
    public string BlankCache() => Contract.VietQr;
}

[Route("mvc")]
public class MvcTinyController : ControllerBase
{
    [HttpGet("tiny.svg"), TingQrSvg("tiny")]
    public string Tiny() => Contract.VietQr;
}

[Route("mvc")]
public class MvcBankLogoController : ControllerBase
{
    [HttpGet("bank.svg"), TingQrSvg("bank")]
    public string Bank() => Contract.VietQr;
}

[Route("mvc/profiles"), TingQrSvg("a")]
public class MvcProfilesController : ControllerBase
{
    [HttpGet("action.svg"), TingQrSvg("b")]
    public string ActionLevel() => Contract.VietQr;

    [HttpGet("controller.svg")]
    public string ControllerLevel() => Contract.VietQr;
}

[Route("mvc")]
public class MvcClashController : ControllerBase
{
    [HttpGet("clash.svg"), TingQrSvg("low")]
    public string Clash() => Contract.VietQr;
}
