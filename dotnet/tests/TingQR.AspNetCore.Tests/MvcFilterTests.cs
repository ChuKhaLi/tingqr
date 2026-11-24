using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;
using TingQR.Rendering;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>[TingQrSvg] next to other filters, as a global filter, and results the action built itself.</summary>
public class MvcFilterTests
{
    private static readonly string Payload = Contract.VietQr;

    [Fact]
    public async Task Short_circuit_by_another_filter_passes_its_result()
    {
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcFilterOrderController) }, exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync("/order/short-circuit.svg");
        Assert.Equal(409, (int)response.StatusCode);
        Assert.Equal("short-circuit", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Exception_handled_by_another_filter_passes_its_result()
    {
        // An inner filter turned the exception into its own response: neither a 500 from tingqr nor a programming error.
        var (app, client, logs) = await MvcTestApp.Serve(new[] { typeof(MvcFilterOrderController) }, exceptionHandler: true);
        await using var _app = app;
        foreach (var path in new[] { "/order/handled-tingqr.svg", "/order/handled-other.svg" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(409, (int)response.StatusCode);
            Assert.Equal("handled", await response.Content.ReadAsStringAsync());
        }
        Assert.DoesNotContain(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
    }

    [Theory]
    [InlineData("/order/no-content.svg", "NoContentResult")]
    [InlineData("/order/empty.svg", "EmptyResult")]
    public async Task Empty_result_the_action_built_is_not_a_payload(string path, string resultType)
    {
        // MVC wraps a returned null in an ObjectResult; NoContent() or new EmptyResult() is the action's own answer.
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcFilterOrderController) }, exceptionHandler: true);
        await using var _app = app;
        var response = await client.GetAsync(path);
        Assert.Equal(418, (int)response.StatusCode);
        Assert.Contains("got Microsoft.AspNetCore.Mvc." + resultType + " from ", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Global_attribute_serves_every_action()
    {
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcGlobalController) }, mvc: o => o.Filters.Add(new TingQrSvgAttribute()));
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/global/qr.svg"), TingQrRender.ToSvg(Payload));
    }

    [Fact]
    public async Task Last_global_attribute_wins()
    {
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcGlobalController) },
            o =>
            {
                o.Profiles["a"] = new SvgOptions { Margin = 1 };
                o.Profiles["b"] = new SvgOptions { Margin = 7 };
            },
            mvc: o =>
            {
                o.Filters.Add(new TingQrSvgAttribute("a"));
                o.Filters.Add(new TingQrSvgAttribute("b"));
            });
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/global/qr.svg"), TingQrRender.ToSvg(Payload, new SvgOptions { Margin = 7 }));
    }

    [Fact]
    public async Task Global_unknown_profile_stops_startup()
    {
        var e = await Assert.ThrowsAsync<TingQrException>(async () =>
        {
            await using var app = MvcTestApp.Build(new[] { typeof(MvcGlobalController) }, o => o.Profiles["a"] = new SvgOptions(),
                o => o.Filters.Add(new TingQrSvgAttribute("missing")));
            app.MapControllers();
            await app.StartAsync();
        });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("AddTingQr: [TingQrSvg(\"missing\")] on MvcGlobalController.Qr: no profile \"missing\" in AddTingQr Profiles.", e.Message);
    }

    [Fact]
    public async Task Global_profile_without_AddTingQr_is_500_per_request()
    {
        // No AddTingQr: no startup check, and model conventions do not see global filters, so the request reports it.
        var (app, client, logs) = await MvcTestApp.Serve(new[] { typeof(MvcGlobalController) }, mvc: o => o.Filters.Add(new TingQrSvgAttribute("missing")));
        await using var _app = app;
        await Contract.AssertError(await client.GetAsync("/global/qr.svg"), "INVALID_VALUE");
        var entry = Assert.Single(logs.Entries, e => e.Category == "TingQR.AspNetCore.TingQrSvg");
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Contains("[TingQrSvg(\"missing\")] on MvcGlobalController.Qr", entry.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Describe_names_a_non_controller_action_by_display_name_then_id()
    {
        var named = new ActionDescriptor { DisplayName = "Page /Index" };
        Assert.Equal("Page /Index", TingQrSvgMvcFilter.Describe(named));
        var unnamed = new ActionDescriptor { DisplayName = null };
        Assert.Equal(unnamed.Id, TingQrSvgMvcFilter.Describe(unnamed));
    }

    [Fact]
    public void Attribute_filter_is_reusable() => Assert.True(new TingQrSvgAttribute().IsReusable);
}

/// <summary>Sets a 409 result before the action runs.</summary>
public sealed class ShortCircuitAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context) =>
        context.Result = new ContentResult { StatusCode = 409, Content = "short-circuit" };
}

/// <summary>Handles any exception of the action with its own 409 result.</summary>
public sealed class HandleExceptionAttribute : ActionFilterAttribute
{
    public override void OnActionExecuted(ActionExecutedContext context)
    {
        if (context.Exception is not null)
        {
            context.Result = new ContentResult { StatusCode = 409, Content = "handled" };
            context.ExceptionHandled = true;
        }
    }
}

[Route("order")]
public class MvcFilterOrderController : ControllerBase
{
    // Order 1 runs inside [TingQrSvg] (order 0).
    [HttpGet("short-circuit.svg"), TingQrSvg, ShortCircuit(Order = 1)]
    public string ShortCircuited() => Contract.VietQr;

    [HttpGet("handled-tingqr.svg"), TingQrSvg, HandleException(Order = 1)]
    public string HandledTingQr() => throw new TingQrException(TingQrErrorCode.CrcMismatch, "secret config");

    [HttpGet("handled-other.svg"), TingQrSvg, HandleException(Order = 1)]
    public string HandledOther() => throw new InvalidOperationException("app bug");

    [HttpGet("no-content.svg"), TingQrSvg]
    public ActionResult<string> NoContentAction() => NoContent();

    [HttpGet("empty.svg"), TingQrSvg]
    public ActionResult<string> EmptyAction() => new EmptyResult();
}

[Route("global")]
public class MvcGlobalController : ControllerBase
{
    [HttpGet("qr.svg")]
    public string Qr() => Contract.VietQr;
}
