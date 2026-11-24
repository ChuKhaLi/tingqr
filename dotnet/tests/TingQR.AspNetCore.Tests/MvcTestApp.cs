using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>
/// An MVC app on the test server with only the given controllers (the test assembly holds controllers of several tests,
/// some with deliberately bad attributes, so the whole assembly is never added as an application part).
/// </summary>
internal static class MvcTestApp
{
    public static WebApplication Build(Type[] controllers, Action<TingQrOptions>? tingQr = null, Action<MvcOptions>? mvc = null,
        CapturingLoggerProvider? logs = null)
    {
        return TestApp.Build(b =>
        {
            if (logs is not null)
            {
                b.Logging.AddProvider(logs);
            }
            if (tingQr is not null)
            {
                b.Services.AddTingQr(tingQr);
            }
            b.Services.AddControllers(o => mvc?.Invoke(o)).ConfigureApplicationPartManager(manager =>
            {
                manager.ApplicationParts.Clear();
                manager.ApplicationParts.Add(new TypesPart(controllers));
            });
        });
    }

    /// <summary>Starts the app; <paramref name="exceptionHandler"/> adds the app's own 418 exception handler.</summary>
    public static async Task<(WebApplication App, HttpClient Client, CapturingLoggerProvider Logs)> Serve(Type[] controllers,
        Action<TingQrOptions>? tingQr = null, bool exceptionHandler = false, Action<MvcOptions>? mvc = null)
    {
        var logs = new CapturingLoggerProvider();
        var app = Build(controllers, tingQr, mvc, logs);
        if (exceptionHandler)
        {
            app.UseTeapotExceptionHandler();
        }
        app.MapControllers();
        await app.StartAsync();
        return (app, app.GetTestClient(), logs);
    }

    /// <summary>The exception that stops the app (mapping the controllers or starting the host).</summary>
    public static async Task<TingQrException> StartupError(Type[] controllers, Action<TingQrOptions>? tingQr = null)
    {
        return await Assert.ThrowsAsync<TingQrException>(async () =>
        {
            await using var app = Build(controllers, tingQr);
            app.MapControllers();
            await app.StartAsync();
        });
    }

    private sealed class TypesPart : ApplicationPart, IApplicationPartTypeProvider
    {
        public TypesPart(Type[] types)
        {
            Types = types.Select(t => t.GetTypeInfo()).ToArray();
        }

        public override string Name => "tingqr-test-controllers";

        public IEnumerable<TypeInfo> Types { get; }
    }
}
