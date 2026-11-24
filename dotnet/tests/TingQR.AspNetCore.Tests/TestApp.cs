using Xunit;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace TingQR.AspNetCore.Tests;

/// <summary>Builds a minimal app on the test server, like a real Program.cs.</summary>
internal static class TestApp
{
    /// <summary>Fake account of conformance/vectors/vietqr/vietqr-dynamic-amount-purpose.json (bank 970422, MB).</summary>
    public const string Account = "0123456789";

    public static WebApplication Build(Action<WebApplicationBuilder> configure)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        configure(builder);
        return builder.Build();
    }

    /// <summary>Builds and starts an app with AddTingQr(configure).</summary>
    public static async Task<WebApplication> StartAsync(Action<TingQrOptions> configure)
    {
        var app = Build(b => b.Services.AddTingQr(configure));
        await app.StartAsync();
        return app;
    }

    /// <summary>The exception that stops <c>await app.StartAsync()</c> for AddTingQr(configure), unwrapped as thrown.</summary>
    public static async Task<TingQrException> StartupError(Action<TingQrOptions> configure)
    {
        await using var app = Build(b => b.Services.AddTingQr(configure));
        return await Assert.ThrowsAsync<TingQrException>(() => app.StartAsync());
    }
}
