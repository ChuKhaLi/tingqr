using Microsoft.AspNetCore.Mvc;
using TingQR.Rendering;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>The startup scan of [TingQrSvg] profile names.</summary>
public class MvcStartupTests
{
    [Fact]
    public async Task Unknown_profile_stops_startup()
    {
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcUnknownProfileController) },
            o => o.Profiles["order"] = new SvgOptions { Margin = 2 });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("AddTingQr: [TingQrSvg(\"missing\")] on MvcUnknownProfileController.Qr: no profile \"missing\" in AddTingQr Profiles.",
            e.Message);
    }

    [Fact]
    public async Task Unknown_profile_on_controller_stops_startup()
    {
        // Even when every action overrides it, a controller attribute naming no profile is a mistake.
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcUnknownControllerProfileController) },
            o => o.Profiles["order"] = new SvgOptions { Margin = 2 });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("[TingQrSvg(\"nope\")] on MvcUnknownControllerProfileController.Qr", e.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Attribute_without_AddTingQr_works()
    {
        var (app, client, _) = await MvcTestApp.Serve(new[] { typeof(MvcPlainController) });
        await using var _app = app;
        await Contract.AssertSvg(await client.GetAsync("/plain/qr.svg"), TingQrRender.ToSvg(Contract.PromptPay));
    }

    [Fact]
    public async Task Profile_attribute_without_AddTingQr_stops_startup()
    {
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcUnknownProfileController) });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Equal("AddTingQr: [TingQrSvg(\"missing\")] on MvcUnknownProfileController.Qr: no profile \"missing\" in AddTingQr Profiles " +
            "(AddTingQr is not called).", e.Message);
    }

    [Fact]
    public async Task Profile_on_controller_without_AddTingQr_stops_startup()
    {
        var e = await MvcTestApp.StartupError(new[] { typeof(MvcUnknownControllerProfileController) });
        Assert.Equal(TingQrErrorCode.InvalidValue, e.Code);
        Assert.Contains("[TingQrSvg(\"nope\")] on MvcUnknownControllerProfileController:", e.Message, StringComparison.Ordinal);
    }
}

[Route("unknown")]
public class MvcUnknownProfileController : ControllerBase
{
    [HttpGet("qr.svg"), TingQrSvg("missing")]
    public string Qr() => Contract.VietQr;
}

[Route("unknown-controller"), TingQrSvg("nope")]
public class MvcUnknownControllerProfileController : ControllerBase
{
    [HttpGet("qr.svg"), TingQrSvg("order")]
    public string Qr() => Contract.VietQr;
}

[Route("plain")]
public class MvcPlainController : ControllerBase
{
    [HttpGet("qr.svg"), TingQrSvg]
    public string Qr() => Contract.PromptPay;
}
